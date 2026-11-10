using System.Security.Cryptography;
using Esf.Api.Common;
using Esf.Api.Domain;
using Esf.Api.Domain.Entities;
using Esf.Api.Reports;
using Esf.Api.Services;
using Microsoft.EntityFrameworkCore;

namespace Esf.Api.Data;

/// <summary>
/// Dados iniciais para que a aplicacao possa ser executada e demonstrada imediatamente.
/// Roda apenas quando o banco esta vazio. Projetos de banheiro baseados em registros reais
/// (planilha consolidada de INFOBANs) do programa Direito da Gente em Porto Alegre.
/// </summary>
public static class DbSeeder
{
    public static async Task SeedAsync(EsfDbContext db, string demoPassword, ILogger logger)
    {
        // Rotina interna, sem login: ve todos os nucleos.
        db.AllOrganizations = true;
        var hasUsers = await db.Users.AnyAsync();
        var hasOrg = await db.Organizations.AnyAsync();

        if (!hasOrg)
        {
            db.Organizations.Add(new Organization
            {
                Name = "ESF Porto Alegre",
                LegalName = "Engenheiros Sem Fronteiras - Núcleo Porto Alegre",
                Mission = "Levar engenharia a comunidades em situação de vulnerabilidade, com projetos construídos junto das pessoas atendidas.",
                About = "Organização formada por voluntários que constroem e reformam banheiros, cuidam de saneamento e implantam hortas comunitárias em Porto Alegre.",
                Email = "contato@esf-nucleo.org.br",
                Phone = "(51) 3000-0000",
                Website = "https://esf.org.br",
                City = "Porto Alegre",
                State = "RS",
                SignatoryName = "Ana Aumond",
                SignatoryRole = "Coordenadora do núcleo",
                SignatoryNote = $"Gestão {DateTime.UtcNow.Year}",
                UpdatedAt = DateTime.UtcNow
            });
        }

        if (hasUsers)
        {
            await db.SaveChangesAsync();
            return;
        }

        logger.LogInformation("Banco vazio: criando dados iniciais de demonstracao.");

        var org = db.Organizations.Local.FirstOrDefault() ?? await db.Organizations.FirstAsync();
        // Voluntarios, programas e projetos da demonstracao entram neste nucleo ao salvar.
        db.OrganizationOverride = org.Id;

        // Datas relativas ao dia em que o banco e criado, para a demonstracao nao envelhecer: tarefas vencidas,
        // proximas e concluidas aparecem sempre perto de "hoje".
        var today = Mapping.Today;
        DateOnly Day(int offset) => today.AddDays(offset);
        DateTime At(int offset) => Day(offset).ToDateTime(new TimeOnly(12, 0), DateTimeKind.Utc);

        var hash = BCrypt.Net.BCrypt.HashPassword(demoPassword);

        var leonardo = new User { OrganizationId = org.Id, Name = "Leonardo Motta", Email = "leonardo.motta@esf.org.br", PasswordHash = hash, Role = UserRole.Administrador };
        var ana = new User { OrganizationId = org.Id, Name = "Ana Aumond", Email = "ana.aumond@esf.org.br", PasswordHash = hash, Role = UserRole.Coordenador };
        var fausto = new User { OrganizationId = org.Id, Name = "Fausto da Silva", Email = "fausto.silva@esf.org.br", PasswordHash = hash, Role = UserRole.Usuario };
        db.Users.AddRange(leonardo, ana, fausto);

        // Checklist da tarefa: (texto, dia em que foi feito; vazio = pendente).
        List<ActivityChecklistItem> Checklist(params (string Text, int? DoneOn)[] items) =>
            items.Select((item, index) => new ActivityChecklistItem
            {
                Position = index,
                Text = item.Text,
                Done = item.DoneOn.HasValue,
                DoneAt = item.DoneOn.HasValue ? At(item.DoneOn.Value) : null
            }).ToList();

        void Team(Project project, params (Volunteer Volunteer, string Role)[] members) =>
            db.ProjectVolunteers.AddRange(members.Select(m => new ProjectVolunteer
            {
                Project = project,
                Volunteer = m.Volunteer,
                RoleInProject = m.Role,
                JoinedAt = project.CreatedAt
            }));

        // Horas lancadas no projeto: (voluntario, dia, horas, o que fez).
        void Hours(Project project, params (Volunteer Volunteer, int On, decimal Hours, string What)[] entries) =>
            db.ProjectHourEntries.AddRange(entries.Select(e => new ProjectHourEntry
            {
                Project = project,
                Volunteer = e.Volunteer,
                Date = Day(e.On),
                Hours = e.Hours,
                Description = e.What,
                CreatedAt = At(e.On)
            }));

        // Metas da demonstracao: um banheiro (ou moradia) por projeto e o que cada horta planejou.
        decimal? Target(Project project, string name) => name switch
        {
            "Banheiros construídos" or "Moradias reformadas" => 1,
            "Canteiros" => project.Name.Contains("Farrapos") ? 10 : 12,
            "Oficinas realizadas" => 6,
            _ => null
        };

        void Results(Project project, params (string Name, string Unit, decimal Value)[] indicators) =>
            db.Indicators.AddRange(indicators.Select(i => new Indicator
            {
                Project = project,
                Name = i.Name,
                Unit = i.Unit,
                Value = i.Value,
                Target = Target(project, i.Name),
                // Concluido: os numeros finais, do dia em que terminou; em aberto, de duas semanas atras.
                ValueUpdatedAt = project.ClosedOn is { } closed
                    ? DateTime.SpecifyKind(closed.ToDateTime(new TimeOnly(18, 0)), DateTimeKind.Utc)
                    : DateTime.UtcNow.AddDays(-12)
            }));

        // Registros de andamento sao texto formatado (HTML); os de demonstracao estao escritos como texto puro.
        void Record(Project project, User author, int on, string text) =>
            db.ProjectUpdates.Add(new ProjectUpdate
            {
                Project = project,
                AuthorUser = author,
                Text = RichText.FromPlainText(text),
                CreatedAt = At(on)
            });

        // Documento assinado de demonstracao, guardado como se a coordenacao o tivesse enviado (por padrao a Ana).
        SignedDocument SignedDocument(SignedDocumentKind kind, Volunteer? volunteer, Project? project, byte[] content,
            string fileName, int signedOn, User? uploadedBy = null, Guid? id = null)
        {
            var storedName = $"{Guid.NewGuid():N}.pdf";
            db.StoredFiles.Add(new StoredFile
            {
                StoredName = storedName,
                ContentType = "application/pdf",
                SizeBytes = content.Length,
                Content = content,
                IsPrivate = true,
                CreatedAt = At(signedOn)
            });
            var document = new SignedDocument
            {
                Id = id ?? Guid.NewGuid(),
                Kind = kind,
                VolunteerId = volunteer?.Id,
                ProjectId = project?.Id,
                FileName = fileName,
                StoredName = storedName,
                ContentType = "application/pdf",
                SizeBytes = content.Length,
                SignedOn = Day(signedOn),
                UploadedAt = At(signedOn),
                UploadedByUserId = (uploadedBy ?? ana).Id
            };
            db.SignedDocuments.Add(document);
            return document;
        }

        // Termo de adesao assinado online pelo proprio voluntario no dia da entrada, com um CPF de demonstracao valido.
        var demoTerms = 0;
        void SignedTerm(Organization organization, Volunteer volunteer, int on)
        {
            var id = Guid.NewGuid();
            var signedAt = At(on);
            var pdf = DocumentTemplates.VolunteerTerm(organization, volunteer, new TermSignature(
                id, volunteer.Name, DemoCpf(++demoTerms), volunteer.Email ?? "", signedAt, null, ImageAuthorized: true));
            var document = SignedDocument(SignedDocumentKind.VolunteerTerm, volunteer, null, pdf,
                $"termo-de-adesao-{TextHelpers.Slug(volunteer.Name)}-assinado.pdf", on, id: id);
            document.UploadedByUserId = null;
            document.SignerName = volunteer.Name;
            document.SignedAt = signedAt;
            document.TermVersion = DocumentTemplates.VolunteerTermVersion;
            document.ContentHash = Convert.ToHexString(SHA256.HashData(pdf)).ToLowerInvariant();
            document.ImageAuthorized = true;
        }

        void ImageAuthorization(Project project, int signedOn) =>
            SignedDocument(SignedDocumentKind.BeneficiaryImageAuthorization, null, project,
                DocumentTemplates.BeneficiaryImageAuthorization(org, project),
                $"autorizacao-de-imagem-{TextHelpers.Slug(project.Name)}-assinada.pdf", signedOn);

        // Entrada do voluntario e as mudancas de situacao depois dela; a situacao atual e a ultima da lista.
        // Com o termo, guarda o termo de adesao assinado no dia da entrada.
        void Joined(Volunteer volunteer, int on, bool signedTerm, params (int On, VolunteerStatus Status)[] changes)
        {
            volunteer.CreatedAt = At(on);
            volunteer.Status = changes.Length == 0 ? VolunteerStatus.Ativo : changes[^1].Status;
            db.VolunteerStatusChanges.Add(new VolunteerStatusChange { VolunteerId = volunteer.Id, Status = VolunteerStatus.Ativo, StartsOn = Day(on) });
            db.VolunteerStatusChanges.AddRange(changes.Select(c =>
                new VolunteerStatusChange { VolunteerId = volunteer.Id, Status = c.Status, StartsOn = Day(c.On) }));

            if (signedTerm) SignedTerm(org, volunteer, on);
        }

        // ---------------------------------------------------------------
        // Voluntarios: um ou mais por setor, com contato, competencias, aniversario e historico.
        // ---------------------------------------------------------------

        // Um aniversario logo adiante e outro de poucos dias atras, para o painel do Inicio nao ficar vazio.
        var birthdaySoon = Day(4);
        var birthdayRecent = Day(-3);

        var vLeonardo = new Volunteer
        {
            Name = "Leonardo Motta", Sector = VolunteerSector.Projetos,
            Email = "leonardo.motta@esf.org.br", Phone = "(51) 99000-0101",
            Skills = "Engenharia civil, orçamento de obras, AutoCAD, gestão de projetos",
            Notes = "Coordena a frente técnica do Banheiro Direito da Gente. Disponível à noite e aos sábados.",
            BirthDay = 14, BirthMonth = 3
        };
        var vAna = new Volunteer
        {
            Name = "Ana Aumond", Sector = VolunteerSector.Projetos,
            Email = "ana.aumond@esf.org.br", Phone = "(51) 99000-0102",
            Skills = "Arquitetura, acessibilidade (NBR 9050), levantamento técnico, articulação com lideranças comunitárias",
            Notes = "Coordenadora do núcleo e ponto de contato com as gestoras locais (CPCA e ACONVI).",
            BirthDay = birthdaySoon.Day, BirthMonth = birthdaySoon.Month
        };
        var vFausto = new Volunteer
        {
            Name = "Fausto da Silva", Sector = VolunteerSector.Projetos,
            Email = "fausto.silva@esf.org.br", Phone = "(51) 99000-0103",
            Skills = "Técnico em edificações, instalações hidrossanitárias, acompanhamento de obra",
            Notes = "Acompanha as obras do Beco dos Herdeiros junto com a CPCA.",
            BirthDay = 22, BirthMonth = 8
        };
        var vAdriano = new Volunteer
        {
            Name = "Adriano Panazzolo", Sector = VolunteerSector.Projetos,
            Email = "adriano.panazzolo@esf.org.br", Phone = "(51) 99000-0104",
            Skills = "Engenharia civil, estruturas e fundações, visitas técnicas",
            Notes = "Disponível para visitas técnicas aos sábados pela manhã.",
            BirthDay = 5, BirthMonth = 6
        };
        var vEdu = new Volunteer
        {
            Name = "Edu Grehs", Sector = VolunteerSector.Projetos,
            Email = "edu.grehs@esf.org.br", Phone = "(51) 99000-0105",
            Skills = "Engenharia elétrica, instalações elétricas residenciais, padrão de entrada",
            Notes = "Afastado temporariamente; na volta, retoma as instalações elétricas da obra da Sra. Beatriz.",
            BirthDay = 30, BirthMonth = 9
        };
        var vLuca = new Volunteer
        {
            Name = "Luca Moura", Sector = VolunteerSector.Projetos,
            Email = "luca.moura@esf.org.br", Phone = "(51) 99000-0106",
            Skills = "Engenharia ambiental (estudante), compostagem, irrigação por gotejamento",
            Notes = "Cuida da parte técnica das hortas: canteiros, irrigação e oficinas.",
            BirthDay = 9, BirthMonth = 5
        };
        var vGuilherme = new Volunteer
        {
            Name = "Guilherme Fd", Sector = VolunteerSector.Juridico,
            Email = "guilherme.fd@esf.org.br", Phone = "(51) 99000-0107",
            Skills = "Direito civil, contratos com construtores locais, termos e autorizações (LGPD)",
            Notes = "Revisa os contratos com os construtores e os termos assinados pelas famílias.",
            BirthDay = 11, BirthMonth = 1
        };
        var vCarol = new Volunteer
        {
            Name = "Carol Metz", Sector = VolunteerSector.Pessoas,
            Email = "carol.metz@esf.org.br", Phone = "(51) 99000-0108",
            Skills = "Psicologia, acolhimento de novos voluntários, processo seletivo",
            Notes = "Entrou no último processo seletivo; organiza a escala de voluntários dos mutirões.",
            BirthDay = 19, BirthMonth = 12
        };
        var vJulia = new Volunteer
        {
            Name = "Julia Schafer", Sector = VolunteerSector.Pessoas,
            Email = "julia.schafer@esf.org.br", Phone = "(51) 99000-0109",
            Skills = "Serviço social, mobilização comunitária, cadastro de famílias",
            Notes = "Faz o cadastro das famílias junto com as gestoras locais.",
            BirthDay = birthdayRecent.Day, BirthMonth = birthdayRecent.Month
        };
        var vAlice = new Volunteer
        {
            Name = "Alice Marques", Sector = VolunteerSector.Comunicacao,
            Email = "alice.marques@esf.org.br", Phone = "(51) 99000-0110",
            Skills = "Fotografia, redes sociais, relatórios para parceiros",
            Notes = "Fotografa as entregas para os relatórios, só onde há autorização de imagem assinada.",
            BirthDay = 27, BirthMonth = 7
        };
        var vYasminM = new Volunteer
        {
            Name = "Yasmin Meirelles", Sector = VolunteerSector.Comunicacao,
            Email = "yasmin.meirelles@esf.org.br", Phone = "(51) 99000-0111",
            Skills = "Design gráfico, redes sociais",
            Notes = "Saiu da organização; cuidou da comunicação da horta do Cristal.",
            BirthDay = 8, BirthMonth = 2
        };
        var vFrancielly = new Volunteer
        {
            Name = "Francielly Ramos", Sector = VolunteerSector.Financeiro,
            Email = "francielly.ramos@esf.org.br", Phone = "(51) 99000-0112",
            Skills = "Contabilidade, cotação de material, prestação de contas",
            Notes = "Faz as cotações e guarda as notas fiscais de cada obra.",
            BirthDay = 3, BirthMonth = 10
        };
        var vMariaAntonia = new Volunteer
        {
            Name = "Maria Antonia", Sector = VolunteerSector.Qualidade,
            Email = "maria.antonia@esf.org.br", Phone = "(51) 99000-0113",
            Skills = "Engenharia de produção, padrão BDG, vistorias de entrega",
            Notes = "Confere cada entrega com o checklist de vistoria do programa.",
            BirthDay = 16, BirthMonth = 4
        };
        db.Volunteers.AddRange(vLeonardo, vAna, vFausto, vAdriano, vEdu, vLuca, vGuilherme, vCarol, vJulia, vAlice,
            vYasminM, vFrancielly, vMariaAntonia);

        // Fausto teve um afastamento e voltou; Edu esta afastado; Yasmin saiu. Termo pendente: as tres contas de
        // demonstracao (Ana, Leonardo e Fausto), para dar para assinar online; Carol, que acabou de entrar; e Alice,
        // que entrou antes de o termo existir (as duas sem acesso).
        Joined(vAna, -1250, signedTerm: false);
        Joined(vLeonardo, -1020, signedTerm: false);
        Joined(vGuilherme, -900, signedTerm: true);
        Joined(vJulia, -800, signedTerm: true);
        Joined(vYasminM, -760, signedTerm: true, (-60, VolunteerStatus.ExMembro));
        Joined(vAdriano, -700, signedTerm: true);
        Joined(vEdu, -650, signedTerm: true, (-20, VolunteerStatus.Afastado));
        Joined(vFrancielly, -600, signedTerm: true);
        Joined(vLuca, -560, signedTerm: true);
        Joined(vFausto, -480, signedTerm: false, (-300, VolunteerStatus.Afastado), (-240, VolunteerStatus.Ativo));
        Joined(vMariaAntonia, -450, signedTerm: true);
        Joined(vAlice, -400, signedTerm: false);
        Joined(vCarol, -100, signedTerm: false);

        // Acessos de demonstracao representam voluntarios ja cadastrados.
        leonardo.Volunteer = vLeonardo;
        ana.Volunteer = vAna;
        fausto.Volunteer = vFausto;

        // ---------------------------------------------------------------
        // Programas e modelos (o que um projeto novo de cada programa ja recebe)
        // ---------------------------------------------------------------

        var pBanheiro = new ProjectProgram
        {
            Name = "Banheiro Direito da Gente",
            Icon = "banheiro",
            Color = "blue",
            Description = "Construção ou reforma do banheiro da família, com redes de água, esgoto e elétrica, louças, metais e chuveiro. A obra é feita por construtor local, com acompanhamento técnico dos voluntários e indicação da família por uma gestora local.",
            Objective = "Garantir acesso a saneamento digno com a construção ou reforma do banheiro da família.",
            Audience = "Famílias de baixa renda de Porto Alegre sem banheiro adequado em casa"
        };
        var pHorta = new ProjectProgram
        {
            Name = "Horta comunitária",
            Icon = "horta",
            Color = "green",
            Description = "Horta em terreno cedido pela comunidade, com canteiros elevados, irrigação simples e oficinas de manejo agroecológico e compostagem.",
            Objective = "Fortalecer a segurança alimentar das famílias com uma horta mantida pela própria comunidade.",
            Audience = "Famílias do entorno de terrenos cedidos pelas associações de moradores"
        };
        db.Programs.AddRange(pBanheiro, pHorta);

        // Parceiros: as gestoras locais que indicam as familias e os construtores (sem contato inventado).
        db.ProgramPartners.AddRange(
            new ProgramPartner { Program = pBanheiro, Position = 0, Name = "ACONVI / Banco Comunitário Justa Troca", Role = "Gestora local" },
            new ProgramPartner { Program = pBanheiro, Position = 1, Name = "CPCA", Role = "Gestora local" },
            new ProgramPartner { Program = pHorta, Position = 0, Name = "Associação de moradores do bairro", Role = "Cedeu o terreno" });

        db.ProgramTemplateActivities.AddRange(
            new ProgramTemplateActivity { Program = pBanheiro, Position = 0, Title = "Visita técnica e levantamento", Priority = ActivityPriority.Media, DueDays = 7 },
            new ProgramTemplateActivity { Program = pBanheiro, Position = 1, Title = "Projeto e orçamento", Priority = ActivityPriority.Media, DueDays = 20 },
            new ProgramTemplateActivity { Program = pBanheiro, Position = 2, Title = "Contratação do construtor local", Priority = ActivityPriority.Media, DueDays = 30 },
            new ProgramTemplateActivity { Program = pBanheiro, Position = 3, Title = "Compra de material", Priority = ActivityPriority.Media, DueDays = 35 },
            new ProgramTemplateActivity { Program = pBanheiro, Position = 4, Title = "Execução da obra", Priority = ActivityPriority.Media },
            new ProgramTemplateActivity { Program = pBanheiro, Position = 5, Title = "Vistoria final e entrega", Priority = ActivityPriority.Media },
            new ProgramTemplateActivity { Program = pHorta, Position = 0, Title = "Cessão e preparo do terreno", Priority = ActivityPriority.Media },
            new ProgramTemplateActivity { Program = pHorta, Position = 1, Title = "Implantação dos canteiros e irrigação", Priority = ActivityPriority.Media },
            new ProgramTemplateActivity { Program = pHorta, Position = 2, Title = "Plantio com a comunidade", Priority = ActivityPriority.Media },
            new ProgramTemplateActivity { Program = pHorta, Position = 3, Title = "Oficina de manejo e compostagem", Priority = ActivityPriority.Media });

        // Os indicadores do modelo sao os que a pagina do programa soma; os projetos abaixo usam os mesmos nomes.
        db.ProgramTemplateIndicators.AddRange(
            new ProgramTemplateIndicator { Program = pBanheiro, Position = 0, Name = "Famílias atendidas", Unit = "famílias" },
            new ProgramTemplateIndicator { Program = pBanheiro, Position = 1, Name = "Pessoas beneficiadas", Unit = "pessoas" },
            new ProgramTemplateIndicator { Program = pBanheiro, Position = 2, Name = "Banheiros construídos", Unit = "un.", Target = 1 },
            new ProgramTemplateIndicator { Program = pHorta, Position = 0, Name = "Famílias envolvidas", Unit = "famílias" },
            new ProgramTemplateIndicator { Program = pHorta, Position = 1, Name = "Canteiros", Unit = "un." },
            new ProgramTemplateIndicator { Program = pHorta, Position = 2, Name = "Oficinas realizadas", Unit = "oficinas" });

        const string cidade = "Porto Alegre";
        const string estado = "RS";

        // ---------------------------------------------------------------
        // Banheiro Direito da Gente: baseados nos registros reais (INFOBANs).
        // Sem ponto no mapa de proposito: sao casas de familias.
        // ---------------------------------------------------------------

        // Concluido: banheiro acessivel para moradora cadeirante.
        var bJulia = new Project
        {
            Name = "Banheiro Direito da Gente - Sra. Julia",
            Program = pBanheiro,
            Description = "Construção de banheiro em alvenaria com acessibilidade plena: 4,94 m² de área interna e 5,63 m² de área externa, área de giro para cadeira de rodas, porta de 90 cm, barras de apoio na bacia e no chuveiro, piso antiderrapante, louças, chuveiro e redes de água, esgoto e elétrica.",
            Objective = "Construir banheiro com acessibilidade plena (NBR 9050) para a moradora cadeirante, com autonomia e segurança no uso diário.",
            Beneficiaries = "Julia, Michel e Maria",
            TargetAudience = "3 pessoas, 1 idosa, 1 cadeirante",
            District = "Vila Nossa Senhora Aparecida",
            City = cidade,
            State = estado,
            StartDate = Day(-215),
            EndDateForecast = Day(-165),
            ClosedOn = Day(-165),
            Status = ProjectStatus.Concluido,
            OwnerVolunteer = vAna,
            Notes = "Gestora local: ACONVI / Banco Comunitário Justa Troca. Obra feita pela equipe do construtor Josimar. Fonte: registros INFOBAN 37 a 43.",
            CreatedAt = At(-215),
            UpdatedAt = At(-165)
        };
        db.Projects.Add(bJulia);
        Team(bJulia,
            (vAna, "Responsável pelo projeto"),
            (vAdriano, "Projeto de acessibilidade"),
            (vLeonardo, "Acompanhamento da obra"),
            (vGuilherme, "Contrato com o construtor"),
            (vFrancielly, "Compras"),
            (vMariaAntonia, "Vistoria de qualidade"),
            (vAlice, "Registro fotográfico"));
        Hours(bJulia,
            (vAna, -211, 4, "Visita técnica e levantamento com a família"),
            (vAdriano, -204, 6, "Projeto do banheiro acessível"),
            (vAna, -196, 3, "Orçamento e contrato com o construtor"),
            (vLeonardo, -188, 5, "Acompanhamento da obra"),
            (vLeonardo, -176, 4, "Acompanhamento da obra e ajustes no piso"),
            (vMariaAntonia, -168, 3, "Vistoria de qualidade e entrega à família"),
            (vAlice, -168, 2, "Registro fotográfico da entrega"));
        db.Activities.AddRange(
            new Activity
            {
                Project = bJulia, Title = "Visita técnica e levantamento", Status = ActivityStatus.Concluida, Priority = ActivityPriority.Media,
                AssignedVolunteer = vAna, DueDate = Day(-208), CompletedAt = At(-211),
                ChecklistItems = Checklist(("Medir o espaço disponível ao lado do quarto", -211), ("Localizar o ponto de água e a saída de esgoto", -211), ("Entender com a família a rotina de uso", -211))
            },
            new Activity
            {
                Project = bJulia, Title = "Projeto de acessibilidade (NBR 9050) e orçamento", Status = ActivityStatus.Concluida, Priority = ActivityPriority.Media,
                AssignedVolunteer = vAdriano, DueDate = Day(-195), CompletedAt = At(-197),
                Description = "Área de giro de 1,50 m para a cadeira de rodas, porta de 90 cm abrindo para fora e barras de apoio na bacia e no chuveiro.",
                ChecklistItems = Checklist(("Planta com a área de giro", -200), ("Lista de material com três cotações", -198), ("Aprovação do projeto com a família", -197))
            },
            new Activity
            {
                Project = bJulia, Title = "Contratação do construtor local", Status = ActivityStatus.Concluida, Priority = ActivityPriority.Media,
                AssignedVolunteer = vGuilherme, DueDate = Day(-190), CompletedAt = At(-192),
                Description = "Contrato com a equipe do Josimar, indicada pela ACONVI."
            },
            new Activity
            {
                Project = bJulia, Title = "Compra de material", Status = ActivityStatus.Concluida, Priority = ActivityPriority.Media,
                AssignedVolunteer = vFrancielly, DueDate = Day(-188), CompletedAt = At(-189)
            },
            new Activity
            {
                Project = bJulia, Title = "Execução da obra", Status = ActivityStatus.Concluida, Priority = ActivityPriority.Media,
                AssignedVolunteer = vLeonardo, DueDate = Day(-170), CompletedAt = At(-168),
                ChecklistItems = Checklist(("Fundação e alvenaria", -185), ("Telhado", -180), ("Redes de água, esgoto e elétrica", -176), ("Revestimento e piso antiderrapante", -172), ("Louças, metais e barras de apoio", -168))
            },
            new Activity
            {
                Project = bJulia, Title = "Vistoria final e entrega", Status = ActivityStatus.Concluida, Priority = ActivityPriority.Media,
                AssignedVolunteer = vMariaAntonia, DueDate = Day(-165), CompletedAt = At(-165),
                ChecklistItems = Checklist(("Testar as barras de apoio", -165), ("Conferir o caimento do piso para o ralo", -165), ("Fotos de antes e depois", -165), ("Termo de entrega assinado pela família", -165))
            });
        Results(bJulia,
            ("Famílias atendidas", "famílias", 1),
            ("Pessoas beneficiadas", "pessoas", 3),
            ("Banheiros construídos", "un.", 1),
            ("Área construída", "m²", 10.57m));
        Record(bJulia, ana, -211, "Visita técnica na casa da Sra. Julia, com a ACONVI. O banheiro novo precisa de área de giro para a cadeira de rodas e barras de apoio; o projeto vai seguir a NBR 9050.");
        Record(bJulia, leonardo, -180, "Alvenaria e telhado concluídos pela equipe do Josimar. Redes de água e esgoto ligadas; o revestimento começa na semana que vem.");
        Record(bJulia, ana, -165, "Banheiro entregue e vistoriado: 4,94 m² internos e 5,63 m² de área externa, com barras de apoio, piso antiderrapante e espaço para a cadeira de rodas.");
        ImageAuthorization(bJulia, -205);

        // Em andamento: mudou de reforma para modulo novo e teve troca de construtor.
        var bBeatriz = new Project
        {
            Name = "Banheiro Direito da Gente - Sra. Beatriz",
            Program = pBanheiro,
            Description = "Módulo sanitário em alvenaria acoplado à moradia: baldrame, paredes, telhado, cerâmica, louças, chuveiro, redes de água, esgoto e elétrica, e lavanderia. O projeto começou como reforma e passou a construção nova.",
            Objective = "Construir módulo sanitário com lavanderia para a família extensa, depois que a reforma do banheiro antigo se mostrou inviável.",
            Beneficiaries = "Sra. Beatriz e família",
            TargetAudience = "8 pessoas, com crianças e adolescentes atendidos pela Casa de Santa Clara",
            District = "Beco dos Herdeiros",
            City = cidade,
            State = estado,
            StartDate = Day(-140),
            EndDateForecast = Day(40),
            Status = ProjectStatus.EmAndamento,
            OwnerVolunteer = vFausto,
            Notes = "A obra parou com a saída do primeiro construtor e foi retomada pela equipe de Flávio e Rita. Gestora local: CPCA. Fonte: registros INFOBAN 31 e 42 a 44.",
            CreatedAt = At(-140),
            UpdatedAt = At(-3)
        };
        db.Projects.Add(bBeatriz);
        Team(bBeatriz,
            (vFausto, "Responsável pelo projeto"),
            (vLeonardo, "Responsável técnico"),
            (vAdriano, "Estrutura"),
            (vEdu, "Instalações elétricas"),
            (vFrancielly, "Compras"),
            (vMariaAntonia, "Vistoria de qualidade"));
        Hours(bBeatriz,
            (vFausto, -45, 3, "Visita técnica e conversa com a família"),
            (vLeonardo, -40, 5, "Projeto hidrossanitário"),
            (vAdriano, -33, 4, "Cálculo da estrutura"),
            (vFrancielly, -24, 2.5m, "Cotação e compra dos materiais"),
            (vFausto, -10, 4, "Acompanhamento da obra"),
            (vEdu, -6, 3, "Instalação elétrica do banheiro"));
        var beatrizObra = new Activity
        {
            Project = bBeatriz, Title = "Execução da obra", Status = ActivityStatus.EmAndamento, Priority = ActivityPriority.Alta,
            AssignedVolunteer = vFausto, DueDate = Day(30),
            ChecklistItems = Checklist(("Baldrame", -100), ("Alvenaria", -50), ("Telhado", -10), ("Redes de água e esgoto", null), ("Instalação elétrica", null), ("Revestimento cerâmico", null), ("Lavanderia", null))
        };
        db.Activities.AddRange(
            new Activity
            {
                Project = bBeatriz, Title = "Visita técnica e levantamento", Status = ActivityStatus.Concluida, Priority = ActivityPriority.Media,
                AssignedVolunteer = vFausto, DueDate = Day(-133), CompletedAt = At(-135),
                Description = "As paredes do banheiro antigo não têm condição de reforma."
            },
            new Activity
            {
                Project = bBeatriz, Title = "Projeto e orçamento do módulo sanitário", Status = ActivityStatus.Concluida, Priority = ActivityPriority.Media,
                AssignedVolunteer = vLeonardo, DueDate = Day(-120), CompletedAt = At(-121),
                Description = "Escopo mudou de reforma para construção nova: módulo em alvenaria acoplado à casa, com lavanderia."
            },
            new Activity
            {
                Project = bBeatriz, Title = "Contratação do construtor local", Status = ActivityStatus.Concluida, Priority = ActivityPriority.Media,
                AssignedVolunteer = vFausto, DueDate = Day(-60), CompletedAt = At(-58),
                Description = "O primeiro construtor saiu depois do baldrame. A CPCA indicou a equipe de Flávio e Rita para retomar."
            },
            new Activity
            {
                Project = bBeatriz, Title = "Compra de material: louças e revestimento", Status = ActivityStatus.Bloqueada, Priority = ActivityPriority.Media,
                AssignedVolunteer = vFrancielly, DueDate = Day(5),
                BlockedReason = "O fornecedor do primeiro lote parou de entregar no beco; aguardando cotação de outra loja."
            },
            beatrizObra,
            new Activity
            {
                Project = bBeatriz, Title = "Vistoria final e entrega", Status = ActivityStatus.AFazer, Priority = ActivityPriority.Media,
                AssignedVolunteer = vMariaAntonia, DueDate = Day(40)
            });
        db.ActivityComments.AddRange(
            new ActivityComment
            {
                Activity = beatrizObra, AuthorUser = fausto, CreatedAt = At(-3),
                Text = "Telhado fechado. @Leonardo Motta consegue passar na quinta para conferir o caimento do esgoto antes de fecharmos o piso?",
                MentionedVolunteerIds = [vLeonardo.Id]
            },
            new ActivityComment
            {
                Activity = beatrizObra, AuthorUser = leonardo, CreatedAt = At(-2),
                Text = "Consigo, passo na quinta de manhã. Peço para não concretar o piso antes disso."
            });
        Results(bBeatriz,
            ("Famílias atendidas", "famílias", 1),
            ("Pessoas beneficiadas", "pessoas", 8),
            ("Banheiros construídos", "un.", 0));
        Record(bBeatriz, ana, -121, "Na visita, as paredes do banheiro antigo não tinham condição de reforma. O projeto passou a ser um módulo sanitário novo acoplado à casa, com lavanderia.");
        Record(bBeatriz, fausto, -80, "Obra parada: o construtor contratado saiu depois do baldrame e de parte da alvenaria. A CPCA está buscando outra equipe na comunidade.");
        Record(bBeatriz, fausto, -55, "Obra retomada com a equipe de Flávio e Rita. Alvenaria concluída nesta semana.");
        Record(bBeatriz, fausto, -10, "Telhado pronto. Próximas etapas: redes de água e esgoto e instalação elétrica.");
        ImageAuthorization(bBeatriz, -130);

        // Planejamento: banheiro sobre alicerce existente, com caixa d'agua.
        var bRosangela = new Project
        {
            Name = "Banheiro Direito da Gente - Sra. Rosangela",
            Program = pBanheiro,
            Description = "Construção de banheiro completo sobre o alicerce já existente da futura casa, com parede hidráulica preparada para a cozinha e caixa d'água de 500 litros por causa da falta frequente de água.",
            Objective = "Construir banheiro completo sobre o alicerce existente, com reserva de água para os dias de desabastecimento.",
            Beneficiaries = "Sra. Rosangela e cinco filhos",
            TargetAudience = "6 pessoas, filhos de 1 a 18 anos",
            District = "Beco dos Herdeiros",
            City = cidade,
            State = estado,
            StartDate = Day(-25),
            EndDateForecast = Day(110),
            Status = ProjectStatus.Planejamento,
            OwnerVolunteer = vFausto,
            Notes = "A CPCA indicou o construtor local Flávio, que já está na obra da Sra. Beatriz. Fonte: registros INFOBAN 14, 30 e 31.",
            CreatedAt = At(-25),
            UpdatedAt = At(-8)
        };
        db.Projects.Add(bRosangela);
        Team(bRosangela,
            (vFausto, "Responsável pelo projeto"),
            (vAdriano, "Levantamento técnico"),
            (vLeonardo, "Projeto e orçamento"),
            (vJulia, "Cadastro da família"),
            (vFrancielly, "Compras"));
        db.Activities.AddRange(
            new Activity
            {
                Project = bRosangela, Title = "Visita técnica e levantamento", Status = ActivityStatus.Concluida, Priority = ActivityPriority.Media,
                AssignedVolunteer = vAdriano, DueDate = Day(-18), CompletedAt = At(-20),
                ChecklistItems = Checklist(("Conferir o alicerce existente", -20), ("Registrar com a família os dias sem água", -20))
            },
            new Activity
            {
                Project = bRosangela, Title = "Projeto e orçamento", Status = ActivityStatus.EmAndamento, Priority = ActivityPriority.Media,
                AssignedVolunteer = vLeonardo, DueDate = Day(-3),
                ChecklistItems = Checklist(("Planta do banheiro sobre o alicerce", -8), ("Detalhe da caixa d'água de 500 litros", null), ("Orçamento com três cotações", null))
            },
            new Activity
            {
                Project = bRosangela, Title = "Termo e autorização de imagem com a família", Status = ActivityStatus.AFazer, Priority = ActivityPriority.Media,
                AssignedVolunteer = vJulia, DueDate = Day(7),
                Description = "Levar a autorização de uso de imagem para a família assinar na próxima visita."
            },
            new Activity
            {
                Project = bRosangela, Title = "Contratação do construtor local", Status = ActivityStatus.AFazer, Priority = ActivityPriority.Media,
                AssignedVolunteer = vFausto, DueDate = Day(20)
            },
            new Activity
            {
                Project = bRosangela, Title = "Compra de material", Status = ActivityStatus.AFazer, Priority = ActivityPriority.Media,
                AssignedVolunteer = vFrancielly, DueDate = Day(30)
            },
            new Activity { Project = bRosangela, Title = "Execução da obra", Status = ActivityStatus.AFazer, Priority = ActivityPriority.Media },
            new Activity { Project = bRosangela, Title = "Vistoria final e entrega", Status = ActivityStatus.AFazer, Priority = ActivityPriority.Media });
        Results(bRosangela,
            ("Famílias atendidas", "famílias", 1),
            ("Pessoas beneficiadas", "pessoas", 6),
            ("Banheiros construídos", "un.", 0));
        Record(bRosangela, fausto, -20, "Visita com a CPCA. O alicerce da futura casa está em bom estado e aguenta o banheiro. A falta de água é frequente, então o projeto vai incluir caixa d'água.");

        // ---------------------------------------------------------------
        // Horta comunitaria: dados estimados. O ponto no mapa marca o bairro, nao o terreno.
        // ---------------------------------------------------------------

        // Concluida: horta entregue a comunidade.
        var hCristal = new Project
        {
            Name = "Horta Comunitária do Cristal",
            Program = pHorta,
            Description = "12 canteiros elevados em terreno cedido pela associação de moradores, irrigação por gotejamento ligada a um reservatório de água da chuva, composteira coletiva e oficinas mensais de manejo e compostagem.",
            Objective = "Entregar uma horta comunitária funcionando, mantida pelas famílias, com oficinas periódicas de manejo.",
            Beneficiaries = "Famílias do Cristal",
            TargetAudience = "18 famílias participantes",
            District = "Cristal",
            City = cidade,
            State = estado,
            Latitude = -30.0915,
            Longitude = -51.2400,
            StartDate = Day(-520),
            EndDateForecast = Day(-350),
            ClosedOn = Day(-350),
            Status = ProjectStatus.Concluido,
            OwnerVolunteer = vLeonardo,
            Notes = "Terreno cedido pela associação de moradores por cinco anos. A colheita é dividida entre as famílias que cuidam dos canteiros.",
            CreatedAt = At(-520),
            UpdatedAt = At(-352)
        };
        db.Projects.Add(hCristal);
        Team(hCristal,
            (vLeonardo, "Responsável pelo projeto"),
            (vLuca, "Irrigação e compostagem"),
            (vJulia, "Mobilização comunitária"),
            (vYasminM, "Comunicação"));
        db.Activities.AddRange(
            new Activity
            {
                Project = hCristal, Title = "Cessão e preparo do terreno", Status = ActivityStatus.Concluida, Priority = ActivityPriority.Media,
                AssignedVolunteer = vLeonardo, DueDate = Day(-500), CompletedAt = At(-505),
                ChecklistItems = Checklist(("Termo de cessão com a associação de moradores", -515), ("Limpeza e correção do solo", -505))
            },
            new Activity
            {
                Project = hCristal, Title = "Implantação dos canteiros e irrigação", Status = ActivityStatus.Concluida, Priority = ActivityPriority.Media,
                AssignedVolunteer = vLuca, DueDate = Day(-460), CompletedAt = At(-462),
                ChecklistItems = Checklist(("12 canteiros elevados", -480), ("Reservatório de água da chuva (1.000 litros)", -470), ("Mangueiras de gotejamento", -462))
            },
            new Activity
            {
                Project = hCristal, Title = "Plantio com a comunidade", Status = ActivityStatus.Concluida, Priority = ActivityPriority.Media,
                AssignedVolunteer = vJulia, DueDate = Day(-455), CompletedAt = At(-455),
                Description = "Mutirão de plantio com as famílias: alface, couve, rúcula, temperos e chás."
            },
            new Activity
            {
                Project = hCristal, Title = "Oficina de manejo e compostagem", Status = ActivityStatus.Concluida, Priority = ActivityPriority.Media,
                AssignedVolunteer = vLuca, DueDate = Day(-350), CompletedAt = At(-352),
                Description = "Seis oficinas mensais; na última, a composteira passou para o cuidado das famílias."
            });
        Results(hCristal,
            ("Famílias envolvidas", "famílias", 18),
            ("Canteiros", "un.", 12),
            ("Oficinas realizadas", "oficinas", 6));
        Record(hCristal, leonardo, -505, "Terreno cedido pela associação de moradores e limpo em mutirão. O solo recebeu calcário e composto antes dos canteiros.");
        Record(hCristal, leonardo, -462, "12 canteiros prontos e irrigação por gotejamento funcionando com o reservatório de água da chuva.");
        Record(hCristal, leonardo, -352, "Horta entregue às 18 famílias. Na última oficina, a composteira passou para o cuidado da comunidade.");

        // Em andamento: horta em terreno atingido pela enchente de 2024.
        var hFarrapos = new Project
        {
            Name = "Horta Comunitária Vila Farrapos",
            Program = pHorta,
            Description = "Horta em terreno cedido pela associação de moradores e atingido pela enchente de 2024: limpeza e correção do solo, 10 canteiros elevados, irrigação por gotejamento e oficinas de manejo agroecológico.",
            Objective = "Implantar horta comunitária para segurança alimentar e renda complementar das famílias.",
            Beneficiaries = "Famílias da Vila Farrapos",
            TargetAudience = "Cerca de 25 famílias",
            District = "Farrapos",
            City = cidade,
            State = estado,
            Latitude = -29.9835,
            Longitude = -51.1925,
            StartDate = Day(-90),
            EndDateForecast = Day(60),
            Status = ProjectStatus.EmAndamento,
            OwnerVolunteer = vAna,
            Notes = "Como o terreno ficou alagado, a análise do solo veio antes de tudo; os canteiros são elevados e recebem terra nova.",
            CreatedAt = At(-90),
            UpdatedAt = At(-3)
        };
        db.Projects.Add(hFarrapos);
        Team(hFarrapos,
            (vAna, "Responsável pelo projeto"),
            (vLuca, "Responsável técnico"),
            (vJulia, "Mobilização comunitária"),
            (vAlice, "Comunicação"),
            (vCarol, "Voluntários do mutirão"));
        var farraposCanteiros = new Activity
        {
            Project = hFarrapos, Title = "Implantação dos canteiros e irrigação", Status = ActivityStatus.EmAndamento, Priority = ActivityPriority.Media,
            AssignedVolunteer = vLuca, DueDate = Day(6),
            ChecklistItems = Checklist(("Canteiros 1 a 5", -14), ("Canteiros 6 a 10", null), ("Caixa d'água e mangueiras de gotejamento", null))
        };
        db.Activities.AddRange(
            new Activity
            {
                Project = hFarrapos, Title = "Cessão e preparo do terreno", Status = ActivityStatus.Concluida, Priority = ActivityPriority.Media,
                AssignedVolunteer = vAna, DueDate = Day(-65), CompletedAt = At(-70),
                ChecklistItems = Checklist(("Termo de cessão com a associação de moradores", -85), ("Análise do solo depois da enchente", -78), ("Limpeza do terreno em mutirão", -70))
            },
            farraposCanteiros,
            new Activity
            {
                Project = hFarrapos, Title = "Divulgação do mutirão de plantio", Status = ActivityStatus.EmAndamento, Priority = ActivityPriority.Media,
                AssignedVolunteer = vAlice, DueDate = Day(10),
                Description = "Cartaz na associação e mensagem nos grupos da comunidade."
            },
            new Activity
            {
                Project = hFarrapos, Title = "Plantio com a comunidade", Status = ActivityStatus.AFazer, Priority = ActivityPriority.Media,
                AssignedVolunteer = vJulia, DueDate = Day(14)
            },
            new Activity
            {
                Project = hFarrapos, Title = "Oficina de manejo e compostagem", Status = ActivityStatus.AFazer, Priority = ActivityPriority.Media,
                AssignedVolunteer = vLuca, DueDate = Day(30)
            });
        db.ActivityComments.AddRange(
            new ActivityComment
            {
                Activity = farraposCanteiros, AuthorUser = ana, CreatedAt = At(-4),
                Text = "A associação ofereceu o ponto de água deles. @Leonardo Motta a caixa d'água pode ficar junto do muro?",
                MentionedVolunteerIds = [vLeonardo.Id]
            },
            new ActivityComment
            {
                Activity = farraposCanteiros, AuthorUser = leonardo, CreatedAt = At(-3),
                Text = "Junto do muro fica bom: a água desce por gravidade até os canteiros. @Luca Moura só precisa de uma base nivelada antes de instalar.",
                MentionedVolunteerIds = [vLuca.Id]
            });
        Results(hFarrapos,
            ("Famílias envolvidas", "famílias", 25),
            ("Canteiros", "un.", 5),
            ("Oficinas realizadas", "oficinas", 0));
        Record(hFarrapos, ana, -70, "Termo de cessão assinado com a associação de moradores. A análise mostrou solo pobre depois da enchente; vamos usar canteiros elevados com terra nova e composto.");
        Record(hFarrapos, ana, -14, "Cinco canteiros prontos e plantados com alface, couve e temperos. Faltam cinco e a irrigação.");

        // ---------------------------------------------------------------
        // Segundo nucleo, menor (Curitiba): mostra a separacao entre nucleos e da numeros ao painel nacional. Cada
        // pessoa e de um nucleo so, e os programas sao do nucleo (este tem o proprio).
        // ---------------------------------------------------------------
        var curitiba = new Organization
        {
            Name = "ESF Curitiba",
            LegalName = "Engenheiros Sem Fronteiras - Núcleo Curitiba",
            Mission = "Engenharia a serviço de comunidades da Região Metropolitana de Curitiba, com obras feitas junto das famílias.",
            Email = "contato@esf-curitiba.org.br",
            City = "Curitiba",
            State = "PR",
            SignatoryName = "Marina Costa",
            SignatoryRole = "Coordenadora do núcleo",
            SignatoryNote = $"Gestão {today.Year}",
            UpdatedAt = DateTime.UtcNow
        };
        db.Organizations.Add(curitiba);

        Volunteer CuritibaVolunteer(string name, VolunteerSector sector, string phone, string skills) => new()
        {
            OrganizationId = curitiba.Id,
            Name = name,
            Sector = sector,
            Email = $"{TextHelpers.Slug(name).Replace('-', '.')}@esf.org.br",
            Phone = phone,
            Skills = skills
        };
        var cMarina = CuritibaVolunteer("Marina Costa", VolunteerSector.Projetos, "(41) 99000-0201", "Engenharia civil, patologia das construções, gestão de obras");
        var cPedro = CuritibaVolunteer("Pedro Alves", VolunteerSector.Projetos, "(41) 99000-0202", "Instalações elétricas e hidráulicas");
        var cCamila = CuritibaVolunteer("Camila Rocha", VolunteerSector.Pessoas, "(41) 99000-0203", "Mobilização comunitária, conversa com as famílias");
        var cRafael = CuritibaVolunteer("Rafael Lima", VolunteerSector.Financeiro, "(41) 99000-0204", "Orçamento, compras e prestação de contas");
        db.Volunteers.AddRange(cMarina, cPedro, cCamila, cRafael);
        Joined(cMarina, -420, false);
        Joined(cPedro, -310, false);
        Joined(cCamila, -150, false);
        Joined(cRafael, -60, false);

        var marina = new User
        {
            OrganizationId = curitiba.Id, Name = "Marina Costa", Email = cMarina.Email!, PasswordHash = hash,
            Role = UserRole.Administrador, VolunteerId = cMarina.Id
        };
        db.Users.Add(marina);

        // Termos do nucleo de Curitiba (com os dados dele); o do Rafael, que chegou ha pouco, ainda falta.
        foreach (var (volunteer, on) in new[] { (cMarina, -420), (cPedro, -310), (cCamila, -150) })
            SignedTerm(curitiba, volunteer, on);

        var pReforma = new ProjectProgram
        {
            OrganizationId = curitiba.Id,
            Name = "Reforma de moradias",
            Icon = "casa",
            Color = "orange",
            Description = "Reforma de moradias em situação de risco (cobertura, instalações elétricas, umidade), com mão de obra local e acompanhamento técnico dos voluntários.",
            Objective = "Deixar a moradia segura e salubre para a família.",
            Audience = "Famílias em moradias com risco de desabamento, incêndio ou umidade"
        };
        db.Programs.Add(pReforma);
        db.ProgramTemplateActivities.AddRange(
            new ProgramTemplateActivity { Program = pReforma, Position = 0, Title = "Vistoria da moradia", Priority = ActivityPriority.Media, DueDays = 10 },
            new ProgramTemplateActivity { Program = pReforma, Position = 1, Title = "Projeto e orçamento", Priority = ActivityPriority.Media, DueDays = 25 },
            new ProgramTemplateActivity { Program = pReforma, Position = 2, Title = "Execução da reforma", Priority = ActivityPriority.Media },
            new ProgramTemplateActivity { Program = pReforma, Position = 3, Title = "Entrega à família", Priority = ActivityPriority.Media });
        db.ProgramTemplateIndicators.AddRange(
            new ProgramTemplateIndicator { Program = pReforma, Position = 0, Name = "Famílias atendidas", Unit = "famílias" },
            new ProgramTemplateIndicator { Program = pReforma, Position = 1, Name = "Pessoas beneficiadas", Unit = "pessoas" },
            new ProgramTemplateIndicator { Program = pReforma, Position = 2, Name = "Moradias reformadas", Unit = "un." });

        var rLucia = new Project
        {
            OrganizationId = curitiba.Id,
            Name = "Reforma - Casa da Dona Lúcia",
            Program = pReforma,
            Description = "Troca da cobertura com infiltração, refação da instalação elétrica e tratamento da umidade do quarto das crianças.",
            Objective = "Acabar com as infiltrações e o risco de choque elétrico na casa.",
            Beneficiaries = "Dona Lúcia e quatro netos",
            TargetAudience = "5 pessoas, 4 crianças",
            District = "Vila Torres",
            City = "Curitiba",
            State = "PR",
            StartDate = Day(-180),
            EndDateForecast = Day(-110),
            ClosedOn = Day(-110),
            Status = ProjectStatus.Concluido,
            OwnerVolunteer = cMarina,
            CreatedAt = At(-180),
            UpdatedAt = At(-112)
        };
        var rJoaquim = new Project
        {
            OrganizationId = curitiba.Id,
            Name = "Reforma - Casa do Sr. Joaquim",
            Program = pReforma,
            Description = "Reforço do telhado e instalação elétrica nova numa casa de madeira com fiação exposta.",
            Objective = "Eliminar o risco de incêndio e as goteiras.",
            Beneficiaries = "Sr. Joaquim e a esposa",
            TargetAudience = "2 pessoas idosas",
            District = "Cajuru",
            City = "Curitiba",
            State = "PR",
            StartDate = Day(-45),
            EndDateForecast = Day(30),
            Status = ProjectStatus.EmAndamento,
            OwnerVolunteer = cPedro,
            CreatedAt = At(-45),
            UpdatedAt = At(-6)
        };
        db.Projects.AddRange(rLucia, rJoaquim);
        Team(rLucia, (cMarina, "Responsável pelo projeto"), (cPedro, "Instalação elétrica"), (cCamila, "Contato com a família"));
        Team(rJoaquim, (cPedro, "Responsável pelo projeto"), (cMarina, "Responsável técnica"), (cRafael, "Compras"));
        db.Activities.AddRange(
            new Activity { Project = rLucia, Title = "Vistoria da moradia", Status = ActivityStatus.Concluida, Priority = ActivityPriority.Media, AssignedVolunteer = cMarina, DueDate = Day(-170), CompletedAt = At(-172) },
            new Activity { Project = rLucia, Title = "Projeto e orçamento", Status = ActivityStatus.Concluida, Priority = ActivityPriority.Media, AssignedVolunteer = cMarina, DueDate = Day(-155), CompletedAt = At(-158) },
            new Activity { Project = rLucia, Title = "Execução da reforma", Status = ActivityStatus.Concluida, Priority = ActivityPriority.Media, AssignedVolunteer = cPedro, CompletedAt = At(-118) },
            new Activity { Project = rLucia, Title = "Entrega à família", Status = ActivityStatus.Concluida, Priority = ActivityPriority.Media, AssignedVolunteer = cCamila, CompletedAt = At(-112) },
            new Activity { Project = rJoaquim, Title = "Vistoria da moradia", Status = ActivityStatus.Concluida, Priority = ActivityPriority.Media, AssignedVolunteer = cPedro, DueDate = Day(-35), CompletedAt = At(-38) },
            new Activity { Project = rJoaquim, Title = "Projeto e orçamento", Status = ActivityStatus.Concluida, Priority = ActivityPriority.Media, AssignedVolunteer = cMarina, DueDate = Day(-20), CompletedAt = At(-22) },
            new Activity { Project = rJoaquim, Title = "Execução da reforma", Status = ActivityStatus.EmAndamento, Priority = ActivityPriority.Media, AssignedVolunteer = cPedro, DueDate = Day(20) },
            new Activity { Project = rJoaquim, Title = "Compra do material elétrico", Status = ActivityStatus.AFazer, Priority = ActivityPriority.Media, AssignedVolunteer = cRafael, DueDate = Day(5) },
            new Activity { Project = rJoaquim, Title = "Entrega à família", Status = ActivityStatus.AFazer, Priority = ActivityPriority.Media });
        Results(rLucia, ("Famílias atendidas", "famílias", 1), ("Pessoas beneficiadas", "pessoas", 5), ("Moradias reformadas", "un.", 1));
        Results(rJoaquim, ("Famílias atendidas", "famílias", 1), ("Pessoas beneficiadas", "pessoas", 2), ("Moradias reformadas", "un.", 0));
        Record(rLucia, marina, -165, "Vistoria feita com a Dona Lúcia: a infiltração vem das telhas quebradas e a fiação do quarto está sem proteção.");
        Record(rLucia, marina, -112, "Reforma entregue: telhado novo, instalação elétrica refeita e quarto das crianças sem umidade.");
        Record(rJoaquim, marina, -36, "Vistoria com o Sr. Joaquim: madeiramento do telhado comprometido e fiação exposta na cozinha.");
        Record(rJoaquim, marina, -6, "Telhado reforçado. A instalação elétrica começa assim que o material chegar.");

        // ---------------------------------------------------------------
        // Gestao nacional: indicadores nacionais (com os indicadores dos nucleos ligados a eles) e uma conta so nacional.
        // A horta de Porto Alegre chamava de "Famílias envolvidas" o mesmo resultado: ligada ao nacional, ganha o nome dele.
        // ---------------------------------------------------------------
        var nFamilias = new NationalIndicator
        {
            Name = "Famílias atendidas",
            Unit = "famílias",
            Description = "Cada família que usa a obra ou participa da atividade, contada uma vez por projeto."
        };
        var nPessoas = new NationalIndicator
        {
            Name = "Pessoas beneficiadas",
            Unit = "pessoas",
            Description = "Pessoas que usam a obra ou o serviço no dia a dia (moradores, alunos, funcionários); não conte visitantes nem quem só passou por uma oficina."
        };
        db.NationalIndicators.AddRange(nFamilias, nPessoas);

        var nationalByName = new Dictionary<string, NationalIndicator>
        {
            ["Famílias atendidas"] = nFamilias,
            ["Famílias envolvidas"] = nFamilias,
            ["Pessoas beneficiadas"] = nPessoas
        };
        foreach (var item in db.ProgramTemplateIndicators.Local)
        {
            if (!nationalByName.TryGetValue(item.Name, out var national)) continue;
            item.NationalIndicator = national;
            item.Name = national.Name;
            item.Unit = national.Unit;
        }
        foreach (var item in db.Indicators.Local)
        {
            if (!nationalByName.TryGetValue(item.Name, out var national)) continue;
            item.NationalIndicator = national;
            item.Name = national.Name;
            item.Unit = national.Unit;
        }
        // Todo projeto tem os nacionais: o que o projeto nao tinha entra em branco (ainda nao informado), como as
        // pessoas beneficiadas das hortas.
        var linked = db.Indicators.Local.Where(i => i.NationalIndicator is not null)
            .Select(i => (i.Project, i.NationalIndicator)).ToHashSet();
        foreach (var project in db.Projects.Local.ToList())
        {
            foreach (var national in new[] { nFamilias, nPessoas }.Where(n => !linked.Contains((project, n))))
            {
                db.Indicators.Add(new Indicator
                {
                    Project = project,
                    NationalIndicator = national,
                    Name = national.Name,
                    Unit = national.Unit,
                    Value = null,
                    CreatedAt = project.CreatedAt
                });
            }
        }

        db.Users.Add(new User
        {
            Name = "Coordenação nacional",
            Email = "nacional@esf.org.br",
            PasswordHash = hash,
            Role = UserRole.Usuario,
            IsNational = true
        });

        await db.SaveChangesAsync();
        await ProjectTeam.SyncAllAsync(db);
        logger.LogInformation("Dados iniciais criados: {Nucleos} nucleos, {Users} usuarios, {Volunteers} voluntarios, {Projects} projetos.",
            db.Organizations.Local.Count, db.Users.Local.Count, db.Volunteers.Local.Count, db.Projects.Local.Count);
    }

    /// <summary>CPF de demonstracao com os digitos verificadores certos, diferente para cada numero.</summary>
    private static string DemoCpf(int seed)
    {
        var digits = (100_000_000 + seed * 7_654_321 % 899_999_999).ToString("D9").Select(c => c - '0').ToList();
        for (var length = 9; length <= 10; length++)
        {
            var sum = 0;
            for (var i = 0; i < length; i++) sum += digits[i] * (length + 1 - i);
            digits.Add(sum * 10 % 11 % 10);
        }
        var text = string.Concat(digits);
        return $"{text[..3]}.{text[3..6]}.{text[6..9]}-{text[9..]}";
    }
}
