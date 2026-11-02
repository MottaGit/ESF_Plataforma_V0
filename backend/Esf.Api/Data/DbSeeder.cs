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
        var hasUsers = await db.Users.AnyAsync();
        var hasOrg = await db.Organizations.AnyAsync();

        if (!hasOrg)
        {
            db.Organizations.Add(new Organization
            {
                Name = "Engenheiros Sem Fronteiras",
                LegalName = "Engenheiros Sem Fronteiras - Nucleo Local",
                Mission = "Levar engenharia a comunidades em situacao de vulnerabilidade, com projetos construidos junto das pessoas atendidas.",
                About = "Organizacao formada por voluntarios que realizam reformas habitacionais, saneamento e hortas comunitarias em Porto Alegre.",
                Email = "contato@esf-nucleo.org.br",
                Phone = "(51) 3000-0000",
                Website = "https://esf.org.br",
                City = "Porto Alegre",
                State = "RS",
                UpdatedAt = DateTime.UtcNow
            });
        }

        if (hasUsers)
        {
            await db.SaveChangesAsync();
            return;
        }

        logger.LogInformation("Banco vazio: criando dados iniciais de demonstracao.");

        var hash = BCrypt.Net.BCrypt.HashPassword(demoPassword);

        var leonardo = new User { Name = "Leonardo Motta", Email = "leonardo.motta@esf.org.br", PasswordHash = hash, Role = UserRole.Administrador };
        var ana = new User { Name = "Ana Aumond", Email = "ana.aumond@esf.org.br", PasswordHash = hash, Role = UserRole.Coordenador };
        var fausto = new User { Name = "Fausto da Silva", Email = "fausto.silva@esf.org.br", PasswordHash = hash, Role = UserRole.Usuario };
        db.Users.AddRange(leonardo, ana, fausto);

        // Setor Projetos
        var vLeonardo = new Volunteer { Name = "Leonardo Motta", Sector = VolunteerSector.Projetos };
        var vClivia = new Volunteer { Name = "Clivia", Sector = VolunteerSector.Projetos };
        var vSandra = new Volunteer { Name = "Sandra", Sector = VolunteerSector.Projetos };
        var vAna = new Volunteer { Name = "Ana", Sector = VolunteerSector.Projetos };
        var vGiovani = new Volunteer { Name = "Giovani", Sector = VolunteerSector.Projetos };
        var vFelipe = new Volunteer { Name = "Felipe", Sector = VolunteerSector.Projetos };
        var vAdriano = new Volunteer { Name = "Adriano Panazzolo", Sector = VolunteerSector.Projetos };
        var vEdu = new Volunteer { Name = "Edu Grehs", Sector = VolunteerSector.Projetos };
        var vLuca = new Volunteer { Name = "Luca Moura", Sector = VolunteerSector.Projetos };
        // Setor Juridico
        var vGuilherme = new Volunteer { Name = "Guilherme Fd", Sector = VolunteerSector.Juridico };
        var vTanea = new Volunteer { Name = "Tanea", Sector = VolunteerSector.Juridico };
        // Setor Pessoas
        var vCarol = new Volunteer { Name = "Carol Metz", Sector = VolunteerSector.Pessoas };
        var vJulia = new Volunteer { Name = "Julia Schafer", Sector = VolunteerSector.Pessoas };
        var vMarcosHeitor = new Volunteer { Name = "Marcos Heitor", Sector = VolunteerSector.Pessoas };
        // Setor Comunicacao
        var vAlice = new Volunteer { Name = "Alice Marques", Sector = VolunteerSector.Comunicacao };
        var vYasminM = new Volunteer { Name = "Yasmin Meirelles", Sector = VolunteerSector.Comunicacao };
        // Setor Financeiro
        var vFrancielly = new Volunteer { Name = "Francielly Ramos", Sector = VolunteerSector.Financeiro };
        // Setor Qualidade
        var vAlisson = new Volunteer { Name = "Alisson", Sector = VolunteerSector.Qualidade };
        var vMariaAntonia = new Volunteer { Name = "Maria Antonia", Sector = VolunteerSector.Qualidade };
        var vFausto = new Volunteer { Name = "Fausto da Silva", Sector = VolunteerSector.Projetos };

        Volunteer[] volunteers =
        [
            vLeonardo, vClivia, vSandra, vAna, vGiovani, vFelipe, vAdriano, vEdu, vLuca,
            vGuilherme, vTanea, vCarol, vJulia, vMarcosHeitor, vAlice, vYasminM, vFrancielly, vAlisson, vMariaAntonia,
            vFausto
        ];
        db.Volunteers.AddRange(volunteers);

        // Historico de status de demonstracao: todos ativos desde marco de 2025; Fausto teve um afastamento.
        foreach (var volunteer in volunteers)
            VolunteerStatusHistoryService.Start(db, volunteer, new DateOnly(2025, 3, 1));
        db.VolunteerStatusChanges.AddRange(
            new VolunteerStatusChange { VolunteerId = vFausto.Id, Status = VolunteerStatus.Afastado, StartsOn = new DateOnly(2025, 12, 1) },
            new VolunteerStatusChange { VolunteerId = vFausto.Id, Status = VolunteerStatus.Ativo, StartsOn = new DateOnly(2026, 2, 1) });

        // Acessos de demonstracao representam voluntarios ja cadastrados.
        leonardo.Volunteer = vLeonardo;
        ana.Volunteer = vAna;
        fausto.Volunteer = vFausto;

        var org = db.Organizations.Local.FirstOrDefault() ?? await db.Organizations.FirstAsync();

        // Datas relativas ao dia em que o banco e criado, para a demonstracao nao envelhecer: tarefas vencidas,
        // proximas e concluidas aparecem sempre perto de "hoje".
        var today = Mapping.Today;
        DateOnly Day(int offset) => today.AddDays(offset);
        DateTime At(int offset) => Day(offset).ToDateTime(new TimeOnly(12, 0), DateTimeKind.Utc);

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

        void Results(Project project, params (string Name, string Unit, decimal Value)[] indicators) =>
            db.Indicators.AddRange(indicators.Select(i => new Indicator
            {
                Project = project,
                Name = i.Name,
                Unit = i.Unit,
                Value = i.Value
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

        // Documento assinado de demonstracao: o proprio modelo em PDF, guardado como se a coordenacao o tivesse enviado.
        void SignedDocument(SignedDocumentKind kind, Volunteer? volunteer, Project? project, byte[] content,
            string fileName, int signedOn)
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
            db.SignedDocuments.Add(new SignedDocument
            {
                Kind = kind,
                VolunteerId = volunteer?.Id,
                ProjectId = project?.Id,
                FileName = fileName,
                StoredName = storedName,
                ContentType = "application/pdf",
                SizeBytes = content.Length,
                SignedOn = Day(signedOn),
                UploadedAt = At(signedOn),
                UploadedByUserId = ana.Id
            });
        }

        void ImageAuthorization(Project project, int signedOn) =>
            SignedDocument(SignedDocumentKind.BeneficiaryImageAuthorization, null, project,
                DocumentTemplates.BeneficiaryImageAuthorization(org, project),
                $"autorizacao-de-imagem-{TextHelpers.Slug(project.Name)}-assinada.pdf", signedOn);

        // ---------------------------------------------------------------
        // Programas e modelos (o que um projeto novo de cada programa ja recebe)
        // ---------------------------------------------------------------

        var pBanheiro = new ProjectProgram
        {
            Name = "Banheiro Direito da Gente",
            Icon = "banheiro",
            Color = "blue",
            TemplateDescription = "Construção ou reforma do banheiro da família, com redes de água, esgoto e elétrica, louças, metais e chuveiro. A obra é feita por construtor local, com acompanhamento técnico dos voluntários e indicação da família por uma gestora local.",
            TemplateObjective = "Garantir acesso a saneamento digno com a construção ou reforma do banheiro da família.",
            TemplateTargetAudience = "1 família"
        };
        var pHorta = new ProjectProgram
        {
            Name = "Horta comunitária",
            Icon = "horta",
            Color = "green",
            TemplateDescription = "Horta em terreno cedido pela comunidade, com canteiros elevados, irrigação simples e oficinas de manejo agroecológico e compostagem.",
            TemplateObjective = "Fortalecer a segurança alimentar das famílias com uma horta mantida pela própria comunidade.",
            TemplateTargetAudience = "Famílias do entorno"
        };
        db.Programs.AddRange(pBanheiro, pHorta);

        db.ProgramTemplateActivities.AddRange(
            new ProgramTemplateActivity { Program = pBanheiro, Position = 0, Title = "Visita técnica e levantamento", Priority = ActivityPriority.Alta, DueDays = 7 },
            new ProgramTemplateActivity { Program = pBanheiro, Position = 1, Title = "Projeto e orçamento", Priority = ActivityPriority.Alta, DueDays = 20 },
            new ProgramTemplateActivity { Program = pBanheiro, Position = 2, Title = "Contratação do construtor local", Priority = ActivityPriority.Media, DueDays = 30 },
            new ProgramTemplateActivity { Program = pBanheiro, Position = 3, Title = "Compra de material", Priority = ActivityPriority.Media, DueDays = 35 },
            new ProgramTemplateActivity { Program = pBanheiro, Position = 4, Title = "Execução da obra", Priority = ActivityPriority.Alta },
            new ProgramTemplateActivity { Program = pBanheiro, Position = 5, Title = "Vistoria final e entrega", Priority = ActivityPriority.Media },
            new ProgramTemplateActivity { Program = pHorta, Position = 0, Title = "Cessão e preparo do terreno", Priority = ActivityPriority.Alta },
            new ProgramTemplateActivity { Program = pHorta, Position = 1, Title = "Implantação dos canteiros e irrigação", Priority = ActivityPriority.Media },
            new ProgramTemplateActivity { Program = pHorta, Position = 2, Title = "Plantio com a comunidade", Priority = ActivityPriority.Media },
            new ProgramTemplateActivity { Program = pHorta, Position = 3, Title = "Oficina de manejo e compostagem", Priority = ActivityPriority.Baixa });

        // Os indicadores do modelo sao os que a pagina do programa soma; os projetos abaixo usam os mesmos nomes.
        db.ProgramTemplateIndicators.AddRange(
            new ProgramTemplateIndicator { Program = pBanheiro, Position = 0, Name = "Famílias atendidas", Unit = "famílias" },
            new ProgramTemplateIndicator { Program = pBanheiro, Position = 1, Name = "Pessoas beneficiadas", Unit = "pessoas" },
            new ProgramTemplateIndicator { Program = pBanheiro, Position = 2, Name = "Banheiros construídos", Unit = "un." },
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
        db.Activities.AddRange(
            new Activity
            {
                Project = bJulia, Title = "Visita técnica e levantamento", Status = ActivityStatus.Concluida, Priority = ActivityPriority.Alta,
                AssignedVolunteer = vAna, DueDate = Day(-208), CompletedAt = At(-211),
                ChecklistItems = Checklist(("Medir o espaço disponível ao lado do quarto", -211), ("Localizar o ponto de água e a saída de esgoto", -211), ("Entender com a família a rotina de uso", -211))
            },
            new Activity
            {
                Project = bJulia, Title = "Projeto de acessibilidade (NBR 9050) e orçamento", Status = ActivityStatus.Concluida, Priority = ActivityPriority.Alta,
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
                Project = bJulia, Title = "Execução da obra", Status = ActivityStatus.Concluida, Priority = ActivityPriority.Alta,
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
        var beatrizObra = new Activity
        {
            Project = bBeatriz, Title = "Execução da obra", Status = ActivityStatus.EmAndamento, Priority = ActivityPriority.Alta,
            AssignedVolunteer = vFausto, DueDate = Day(30),
            ChecklistItems = Checklist(("Baldrame", -100), ("Alvenaria", -50), ("Telhado", -10), ("Redes de água e esgoto", null), ("Instalação elétrica", null), ("Revestimento cerâmico", null), ("Lavanderia", null))
        };
        db.Activities.AddRange(
            new Activity
            {
                Project = bBeatriz, Title = "Visita técnica e levantamento", Status = ActivityStatus.Concluida, Priority = ActivityPriority.Alta,
                AssignedVolunteer = vFausto, DueDate = Day(-133), CompletedAt = At(-135),
                Description = "As paredes do banheiro antigo não têm condição de reforma."
            },
            new Activity
            {
                Project = bBeatriz, Title = "Projeto e orçamento do módulo sanitário", Status = ActivityStatus.Concluida, Priority = ActivityPriority.Alta,
                AssignedVolunteer = vLeonardo, DueDate = Day(-120), CompletedAt = At(-121),
                Description = "Escopo mudou de reforma para construção nova: módulo em alvenaria acoplado à casa, com lavanderia."
            },
            new Activity
            {
                Project = bBeatriz, Title = "Contratação do construtor local", Status = ActivityStatus.Concluida, Priority = ActivityPriority.Alta,
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
                Project = bRosangela, Title = "Visita técnica e levantamento", Status = ActivityStatus.Concluida, Priority = ActivityPriority.Alta,
                AssignedVolunteer = vAdriano, DueDate = Day(-18), CompletedAt = At(-20),
                ChecklistItems = Checklist(("Conferir o alicerce existente", -20), ("Registrar com a família os dias sem água", -20))
            },
            new Activity
            {
                Project = bRosangela, Title = "Projeto e orçamento", Status = ActivityStatus.EmAndamento, Priority = ActivityPriority.Alta,
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
            new Activity { Project = bRosangela, Title = "Execução da obra", Status = ActivityStatus.AFazer, Priority = ActivityPriority.Alta },
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
                Project = hCristal, Title = "Cessão e preparo do terreno", Status = ActivityStatus.Concluida, Priority = ActivityPriority.Alta,
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
                Project = hCristal, Title = "Oficina de manejo e compostagem", Status = ActivityStatus.Concluida, Priority = ActivityPriority.Baixa,
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
                Project = hFarrapos, Title = "Cessão e preparo do terreno", Status = ActivityStatus.Concluida, Priority = ActivityPriority.Alta,
                AssignedVolunteer = vAna, DueDate = Day(-65), CompletedAt = At(-70),
                ChecklistItems = Checklist(("Termo de cessão com a associação de moradores", -85), ("Análise do solo depois da enchente", -78), ("Limpeza do terreno em mutirão", -70))
            },
            farraposCanteiros,
            new Activity
            {
                Project = hFarrapos, Title = "Divulgação do mutirão de plantio", Status = ActivityStatus.EmAndamento, Priority = ActivityPriority.Baixa,
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
                Project = hFarrapos, Title = "Oficina de manejo e compostagem", Status = ActivityStatus.AFazer, Priority = ActivityPriority.Baixa,
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

        await db.SaveChangesAsync();
        await ProjectTeam.SyncAllAsync(db);
        logger.LogInformation("Dados iniciais criados: {Users} usuarios, {Volunteers} voluntarios, {Projects} projetos.",
            db.Users.Local.Count, db.Volunteers.Local.Count, db.Projects.Local.Count);
    }
}
