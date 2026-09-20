using Esf.Api.Domain;
using Esf.Api.Domain.Entities;
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

        db.Volunteers.AddRange(
            vLeonardo, vClivia, vSandra, vAna, vGiovani, vFelipe, vAdriano, vEdu, vLuca,
            vGuilherme, vTanea, vCarol, vJulia, vMarcosHeitor, vAlice, vYasminM, vFrancielly, vAlisson, vMariaAntonia);

        const string categoriaBanheiro = "Banheiro Direito da Gente";
        const string categoriaHorta = "Horta comunitaria";
        const string cidade = "Porto Alegre";
        const string estado = "RS";

        DateTime Dt(int y, int m, int d) => new(y, m, d, 12, 0, 0, DateTimeKind.Utc);
        DateOnly Do(int y, int m, int d) => new(y, m, d);

        // ---------------------------------------------------------------
        // Projetos de banheiro (Direito da Gente) - baseados em registros reais
        // ---------------------------------------------------------------

        var b1 = new Project
        {
            Name = "Banheiro Direito da Gente - Dona Cinara",
            Category = categoriaBanheiro,
            Description = "Reforma completa do banheiro interno: reconstrucao de paredes, aberturas, forro, ceramica, loucas e metais, chuveiro e redes hidraulica e eletrica.",
            Objective = "Reformar o banheiro interno da residencia, comprometido pela enchente, garantindo instalacao segura e digna.",
            Beneficiaries = "Dona Cinara e filha adolescente",
            TargetAudience = "2 pessoas (1 adolescente)",
            Address = "Rua 4, Loteamento A. J. Renner",
            District = "Vila Pirulito",
            City = cidade,
            State = estado,
            StartDate = Do(2025, 8, 1),
            EndDateForecast = Do(2025, 9, 6),
            Status = ProjectStatus.Concluido,
            Progress = 100,
            OwnerUser = ana,
            Notes = "Execucao pelo construtor local Sr. Gabriel. Fonte: registros INFOBAN 08 e 11."
        };

        var b2 = new Project
        {
            Name = "Banheiro Direito da Gente - Dona Solange e Dona Michele",
            Category = categoriaBanheiro,
            Description = "Construcao nova completa para duas familias: alicerce, paredes, telhado, aberturas, forro, ceramica, box, loucas e metais, hidraulica, esgoto completo, eletrica, chuveiro e pintura; obra comunitaria de rede de esgoto no beco.",
            Objective = "Construir banheiro novo para duas familias no mesmo terreno, com acessibilidade para moradora idosa com baixa visao.",
            Beneficiaries = "Solange, Michele e familia",
            TargetAudience = "9 pessoas, 5 criancas/adolescentes, 1 idosa",
            Address = "Beco D",
            District = "Vila Nossa Senhora das Gracas",
            City = cidade,
            State = estado,
            StartDate = Do(2025, 11, 1),
            EndDateForecast = Do(2026, 1, 11),
            Status = ProjectStatus.Concluido,
            Progress = 100,
            OwnerUser = ana,
            Notes = "Gestora local: Casa de Nazare. Fonte: INFOBAN 23-27, 39."
        };

        var b3 = new Project
        {
            Name = "Banheiro Direito da Gente - Sra. Carla",
            Category = categoriaBanheiro,
            Description = "Construcao totalmente nova de casa com banheiro, cozinha e quarto/sala; alicerces, colunas, alvenaria, telhado, ceramica, redes cloacal, pluvial, agua e eletrica, canal de drenagem.",
            Objective = "Reconstruir moradia em situacao de risco, incluindo banheiro completo, apos demolicao necessaria.",
            Beneficiaries = "Sra. Carla",
            TargetAudience = "1 pessoa",
            District = "Vila Alta Tensao",
            City = cidade,
            State = estado,
            StartDate = Do(2026, 5, 19),
            EndDateForecast = Do(2026, 8, 30),
            Status = ProjectStatus.EmAndamento,
            Progress = 30,
            OwnerUser = ana,
            Notes = "Casa em situacao de risco; demolicao e reconstrucao total. Construtor Solano. Fonte: INFOBAN 43-44."
        };

        var b4 = new Project
        {
            Name = "Banheiro Direito da Gente - Dona Patricia (Vila Jardim)",
            Category = categoriaBanheiro,
            Description = "Construcao praticamente integral de nova moradia: ampliacao de area, dormitorio, sala/cozinha, banheiro amplo acessivel, piso, paredes, telhado, hidraulica, esgoto e eletrica.",
            Objective = "Reconstruir quase integralmente a moradia, incluindo banheiro amplo e acessivel.",
            Beneficiaries = "Dona Patricia e familiares",
            TargetAudience = "Familia com pessoas com mobilidade reduzida",
            Address = "Rua Souza Lobo (escadaria)",
            District = "Vila Jardim",
            City = cidade,
            State = estado,
            StartDate = Do(2025, 9, 15),
            EndDateForecast = Do(2025, 12, 14),
            Status = ProjectStatus.Concluido,
            Progress = 100,
            OwnerUser = leonardo,
            Notes = "Parceria: Cozinha Solidaria Compartilhando Sabores + Levante. Construtores Paulo e Alexandre. Fonte: INFOBAN 12-26."
        };

        var b5 = new Project
        {
            Name = "Banheiro Direito da Gente - Sra. Julia",
            Category = categoriaBanheiro,
            Description = "Construcao de banheiro em alvenaria com acessibilidade plena (area interna 4,94 m2 e externa 5,63 m2), dimensionado para cadeira de rodas, barras de apoio, ceramica, loucas, chuveiro, hidraulica, esgoto e eletrica.",
            Objective = "Construir banheiro com acessibilidade plena (NBR 9050) para moradora cadeirante.",
            Beneficiaries = "Julia, Michel e Maria",
            TargetAudience = "3 pessoas, 1 idosa, 1 cadeirante",
            District = "Vila Nossa Senhora Aparecida",
            City = cidade,
            State = estado,
            StartDate = Do(2026, 4, 1),
            EndDateForecast = Do(2026, 5, 20),
            Status = ProjectStatus.Concluido,
            Progress = 100,
            OwnerUser = ana,
            Notes = "Gestora local: ACONVI / Banco Comunitario Justa Troca. Construtor: equipe Josimar. Fonte: INFOBAN 37-43."
        };

        var b6 = new Project
        {
            Name = "Banheiro Direito da Gente - Yasmin",
            Category = categoriaBanheiro,
            Description = "Construcao de banheiro acoplado a moradia e area de servico; projeto ampliado para reforco de telhado, construcao de cozinha e demolicao da cozinha atual em risco.",
            Objective = "Construir banheiro e area de servico, com reforco estrutural e nova cozinha apos risco de colapso.",
            Beneficiaries = "Yasmin, companheiro e quatro filhos",
            TargetAudience = "6 pessoas, 4 criancas pequenas",
            District = "Vila Nossa Senhora Aparecida",
            City = cidade,
            State = estado,
            StartDate = Do(2026, 5, 1),
            EndDateForecast = Do(2026, 7, 31),
            Status = ProjectStatus.EmAndamento,
            Progress = 25,
            OwnerUser = fausto,
            Notes = "Gestora local: ACONVI. Equipe Silvio e Igor. Fonte: INFOBAN 41-44."
        };

        var b7 = new Project
        {
            Name = "Banheiro Direito da Gente - Elisa e Marcelo",
            Category = categoriaBanheiro,
            Description = "Construcao de casa pre-fabricada de madeira com banheiro completo em alvenaria, apos demolicao da casa original; alicerces, banheiro, estrutura, piso e telhado.",
            Objective = "Construir casa pre-fabricada com banheiro completo apos demolicao da moradia anterior, atingida por queda de arvore.",
            Beneficiaries = "Elisa e Marcelo, casal de idosos",
            TargetAudience = "2 pessoas idosas, catadores",
            District = "Vila Pinheirinho",
            City = cidade,
            State = estado,
            StartDate = Do(2025, 11, 17),
            EndDateForecast = Do(2026, 1, 20),
            Status = ProjectStatus.Concluido,
            Progress = 100,
            OwnerUser = ana,
            Notes = "Gestora local: CPCA. Apoio de madeireira parceira. Fonte: INFOBAN 18-32."
        };

        var b8 = new Project
        {
            Name = "Banheiro Direito da Gente - Sra. Beatriz",
            Category = categoriaBanheiro,
            Description = "Projeto originalmente de reforma, alterado para construcao de modulo sanitario em alvenaria acoplado a moradia; baldrame, paredes, telhado, ceramica, loucas, chuveiro, redes hidraulica/esgoto/eletrica e lavanderia.",
            Objective = "Construir modulo sanitario em alvenaria para familia extensa, apos mudanca de escopo de reforma para construcao nova.",
            Beneficiaries = "Sra. Beatriz e familia",
            TargetAudience = "8 pessoas, criancas/adolescentes assistidos pela Casa de Santa Clara",
            District = "Beco dos Herdeiros",
            City = cidade,
            State = estado,
            StartDate = Do(2026, 1, 10),
            EndDateForecast = Do(2026, 9, 30),
            Status = ProjectStatus.EmAndamento,
            Progress = 45,
            OwnerUser = ana,
            Notes = "Projeto teve paralisacoes e troca de construtores; retomado em 15/05/2026 pela equipe de Flavio e Rita. Gestora local: CPCA. Fonte: INFOBAN 31, 42-44."
        };

        var b9 = new Project
        {
            Name = "Banheiro Direito da Gente - Sra. Rosangela",
            Category = categoriaBanheiro,
            Description = "Construcao de banheiro completo sobre alicerce ja existente da futura casa e parede sanitaria para iniciar cozinha; caixa d'agua prevista devido a desabastecimento frequente.",
            Objective = "Construir banheiro completo sobre alicerce ja existente, com caixa d'agua devido a desabastecimento frequente.",
            Beneficiaries = "Rosangela e cinco filhos",
            TargetAudience = "6 pessoas, filhos de 1 a 18 anos",
            District = "Beco dos Herdeiros",
            City = cidade,
            State = estado,
            StartDate = Do(2026, 1, 15),
            EndDateForecast = Do(2026, 10, 15),
            Status = ProjectStatus.Planejamento,
            Progress = 5,
            OwnerUser = fausto,
            Notes = "CPCA contratou construtor local Flavio para retomada. Fonte: INFOBAN 14, 30-31."
        };

        var b10 = new Project
        {
            Name = "Banheiro Direito da Gente - Sra. Marcelina",
            Category = categoriaBanheiro,
            Description = "Construcao de modulo sanitario acoplado a moradia, com padrao BDG; reconstrucao de redes de agua e esgoto da cozinha e pavimentacao do acesso.",
            Objective = "Construir modulo sanitario acoplado a moradia atingida por incendio, padrao BDG.",
            Beneficiaries = "Marcelina, irma Salete e filhos",
            TargetAudience = "4 pessoas, filhos adolescentes, irma idosa",
            District = "Vila Sao Pedro / Vicosa",
            City = cidade,
            State = estado,
            StartDate = Do(2026, 4, 18),
            EndDateForecast = Do(2026, 6, 20),
            Status = ProjectStatus.EmAndamento,
            Progress = 85,
            OwnerUser = ana,
            Notes = "Casa afetada por incendio. Construtor Ivo, da comunidade. Aguardando vistoria final desde 07/05/2026. Gestora local: CPCA. Fonte: INFOBAN 38-41."
        };

        // ---------------------------------------------------------------
        // Projetos de horta comunitaria - estimados
        // ---------------------------------------------------------------

        var h1 = new Project
        {
            Name = "Horta Comunitaria Vila Farrapos",
            Category = categoriaHorta,
            Description = "Preparacao de canteiros, sistema de irrigacao simples e oficinas de manejo agroecologico em terreno cedido pela comunidade.",
            Objective = "Implantar horta comunitaria para seguranca alimentar e geracao de renda complementar.",
            Beneficiaries = "Moradores da Vila Farrapos",
            TargetAudience = "Cerca de 25 familias",
            District = "Bairro Farrapos",
            City = cidade,
            State = estado,
            StartDate = Do(2026, 3, 1),
            EndDateForecast = Do(2026, 8, 1),
            Status = ProjectStatus.EmAndamento,
            Progress = 40,
            OwnerUser = ana
        };

        var h2 = new Project
        {
            Name = "Horta Comunitaria Sarandi",
            Category = categoriaHorta,
            Description = "Levantamento de terreno disponivel e articulacao com associacao de moradores para implantacao de horta comunitaria.",
            Objective = "Iniciar horta comunitaria junto a familias ja atendidas pelo programa de banheiros, ampliando seguranca alimentar.",
            Beneficiaries = "Familias do Sarandi",
            TargetAudience = "A definir",
            District = "Sarandi",
            City = cidade,
            State = estado,
            StartDate = Do(2026, 7, 1),
            EndDateForecast = Do(2027, 1, 15),
            Status = ProjectStatus.Planejamento,
            Progress = 5,
            OwnerUser = fausto
        };

        var h3 = new Project
        {
            Name = "Horta Comunitaria Cristal",
            Category = categoriaHorta,
            Description = "Canteiros implantados, sistema de irrigacao por gotejamento e oficinas mensais de compostagem e manejo.",
            Objective = "Entregar horta comunitaria funcional com oficinas periodicas de manejo.",
            Beneficiaries = "Comunidade do Cristal",
            TargetAudience = "18 familias participantes",
            District = "Cristal",
            City = cidade,
            State = estado,
            StartDate = Do(2025, 6, 1),
            EndDateForecast = Do(2025, 11, 15),
            Status = ProjectStatus.Concluido,
            Progress = 100,
            OwnerUser = leonardo
        };

        var h4 = new Project
        {
            Name = "Horta Comunitaria Lomba do Pinheiro",
            Category = categoriaHorta,
            Description = "Preparacao de canteiros e capacitacao de familias em cultivo de hortalicas para consumo proprio.",
            Objective = "Implantar horta comunitaria integrada as familias ja atendidas pelo programa de banheiros na regiao.",
            Beneficiaries = "Familias da Lomba do Pinheiro",
            TargetAudience = "15 familias",
            District = "Lomba do Pinheiro",
            City = cidade,
            State = estado,
            StartDate = Do(2026, 2, 1),
            EndDateForecast = Do(2026, 9, 1),
            Status = ProjectStatus.EmAndamento,
            Progress = 30,
            OwnerUser = ana
        };

        var h5 = new Project
        {
            Name = "Horta Comunitaria Vila Jardim",
            Category = categoriaHorta,
            Description = "Estudo de viabilidade e articulacao com parceiros locais para futura implantacao de horta comunitaria.",
            Objective = "Avaliar viabilidade de horta comunitaria junto a parceiros locais (Cozinha Solidaria).",
            Beneficiaries = "Comunidade da Vila Jardim",
            TargetAudience = "A definir",
            District = "Bom Jesus / Vila Jardim",
            City = cidade,
            State = estado,
            StartDate = Do(2026, 8, 1),
            EndDateForecast = Do(2027, 2, 1),
            Status = ProjectStatus.Planejamento,
            Progress = 0,
            OwnerUser = fausto
        };

        db.Projects.AddRange(b1, b2, b3, b4, b5, b6, b7, b8, b9, b10, h1, h2, h3, h4, h5);

        db.Activities.AddRange(
            new Activity { Project = b1, Title = "Visita tecnica e levantamento", Status = ActivityStatus.Concluida, Priority = ActivityPriority.Alta, AssignedUser = ana, DueDate = Do(2025, 8, 1), CompletedAt = Dt(2025, 8, 1) },
            new Activity { Project = b1, Title = "Reconstrucao de paredes e revestimento ceramico", Status = ActivityStatus.Concluida, Priority = ActivityPriority.Alta, AssignedUser = leonardo, DueDate = Do(2025, 8, 25), CompletedAt = Dt(2025, 8, 24) },
            new Activity { Project = b1, Title = "Instalacao de loucas, metais e chuveiro", Status = ActivityStatus.Concluida, Priority = ActivityPriority.Media, AssignedUser = leonardo, DueDate = Do(2025, 9, 5), CompletedAt = Dt(2025, 9, 5) },
            new Activity { Project = b1, Title = "Entrega e vistoria final", Status = ActivityStatus.Concluida, Priority = ActivityPriority.Media, AssignedUser = ana, DueDate = Do(2025, 9, 6), CompletedAt = Dt(2025, 9, 6) },

            new Activity { Project = b2, Title = "Levantamento e projeto para duas familias", Status = ActivityStatus.Concluida, Priority = ActivityPriority.Alta, AssignedUser = ana, DueDate = Do(2025, 11, 5), CompletedAt = Dt(2025, 11, 5) },
            new Activity { Project = b2, Title = "Fundacao e alvenaria", Status = ActivityStatus.Concluida, Priority = ActivityPriority.Alta, AssignedUser = ana, DueDate = Do(2025, 12, 5), CompletedAt = Dt(2025, 12, 5) },
            new Activity { Project = b2, Title = "Rede de esgoto do beco", Status = ActivityStatus.Concluida, Priority = ActivityPriority.Alta, AssignedUser = ana, DueDate = Do(2025, 12, 20), CompletedAt = Dt(2025, 12, 20) },
            new Activity { Project = b2, Title = "Acabamento, barras de apoio e entrega", Status = ActivityStatus.Concluida, Priority = ActivityPriority.Media, AssignedUser = ana, DueDate = Do(2026, 1, 11), CompletedAt = Dt(2026, 1, 11) },

            new Activity { Project = b3, Title = "Demolicao da casa em risco", Status = ActivityStatus.Concluida, Priority = ActivityPriority.Alta, AssignedUser = ana, DueDate = Do(2026, 5, 20), CompletedAt = Dt(2026, 5, 20) },
            new Activity { Project = b3, Title = "Fundacao e alvenaria da nova casa", Status = ActivityStatus.EmAndamento, Priority = ActivityPriority.Alta, AssignedUser = ana, DueDate = Do(2026, 7, 1) },
            new Activity { Project = b3, Title = "Redes hidrossanitarias e eletrica", Status = ActivityStatus.AFazer, Priority = ActivityPriority.Alta, AssignedUser = ana, DueDate = Do(2026, 8, 1) },
            new Activity { Project = b3, Title = "Acabamento e entrega", Status = ActivityStatus.AFazer, Priority = ActivityPriority.Media, AssignedUser = ana, DueDate = Do(2026, 8, 30) },

            new Activity { Project = b4, Title = "Levantamento e projeto de acessibilidade", Status = ActivityStatus.Concluida, Priority = ActivityPriority.Alta, AssignedUser = leonardo, DueDate = Do(2025, 9, 20), CompletedAt = Dt(2025, 9, 20) },
            new Activity { Project = b4, Title = "Ampliacao e fundacao", Status = ActivityStatus.Concluida, Priority = ActivityPriority.Alta, AssignedUser = leonardo, DueDate = Do(2025, 10, 20), CompletedAt = Dt(2025, 10, 20) },
            new Activity { Project = b4, Title = "Banheiro acessivel e instalacoes", Status = ActivityStatus.Concluida, Priority = ActivityPriority.Alta, AssignedUser = leonardo, DueDate = Do(2025, 11, 25), CompletedAt = Dt(2025, 11, 25) },
            new Activity { Project = b4, Title = "Acabamento e entrega", Status = ActivityStatus.Concluida, Priority = ActivityPriority.Media, AssignedUser = leonardo, DueDate = Do(2025, 12, 14), CompletedAt = Dt(2025, 12, 14) },

            new Activity { Project = b5, Title = "Projeto de acessibilidade NBR 9050", Status = ActivityStatus.Concluida, Priority = ActivityPriority.Alta, AssignedUser = ana, DueDate = Do(2026, 4, 5), CompletedAt = Dt(2026, 4, 5) },
            new Activity { Project = b5, Title = "Fundacao e alvenaria ampliada", Status = ActivityStatus.Concluida, Priority = ActivityPriority.Alta, AssignedUser = ana, DueDate = Do(2026, 4, 25), CompletedAt = Dt(2026, 4, 25) },
            new Activity { Project = b5, Title = "Instalacao de barras e adaptacoes", Status = ActivityStatus.Concluida, Priority = ActivityPriority.Alta, AssignedUser = ana, DueDate = Do(2026, 5, 10), CompletedAt = Dt(2026, 5, 10) },
            new Activity { Project = b5, Title = "Entrega e vistoria", Status = ActivityStatus.Concluida, Priority = ActivityPriority.Media, AssignedUser = ana, DueDate = Do(2026, 5, 20), CompletedAt = Dt(2026, 5, 20) },

            new Activity { Project = b6, Title = "Demolicao da cozinha em risco", Status = ActivityStatus.Concluida, Priority = ActivityPriority.Alta, AssignedUser = fausto, DueDate = Do(2026, 5, 10), CompletedAt = Dt(2026, 5, 10) },
            new Activity { Project = b6, Title = "Fundacao do banheiro e area de servico", Status = ActivityStatus.EmAndamento, Priority = ActivityPriority.Alta, AssignedUser = fausto, DueDate = Do(2026, 6, 15) },
            new Activity { Project = b6, Title = "Reforco de telhado e nova cozinha", Status = ActivityStatus.AFazer, Priority = ActivityPriority.Media, AssignedUser = fausto, DueDate = Do(2026, 7, 15) },
            new Activity { Project = b6, Title = "Instalacoes hidrossanitarias", Status = ActivityStatus.AFazer, Priority = ActivityPriority.Alta, AssignedUser = fausto, DueDate = Do(2026, 7, 31) },

            new Activity { Project = b7, Title = "Demolicao da casa atingida", Status = ActivityStatus.Concluida, Priority = ActivityPriority.Alta, AssignedUser = ana, DueDate = Do(2025, 11, 20), CompletedAt = Dt(2025, 11, 20) },
            new Activity { Project = b7, Title = "Montagem da casa pre-fabricada", Status = ActivityStatus.Concluida, Priority = ActivityPriority.Alta, AssignedUser = ana, DueDate = Do(2025, 12, 15), CompletedAt = Dt(2025, 12, 15) },
            new Activity { Project = b7, Title = "Banheiro em alvenaria e instalacoes", Status = ActivityStatus.Concluida, Priority = ActivityPriority.Alta, AssignedUser = ana, DueDate = Do(2026, 1, 10), CompletedAt = Dt(2026, 1, 10) },
            new Activity { Project = b7, Title = "Entrega com mobiliario basico", Status = ActivityStatus.Concluida, Priority = ActivityPriority.Media, AssignedUser = ana, DueDate = Do(2026, 1, 20), CompletedAt = Dt(2026, 1, 20) },

            new Activity { Project = b8, Title = "Levantamento e mudanca de escopo do projeto", Status = ActivityStatus.Concluida, Priority = ActivityPriority.Media, AssignedUser = ana, DueDate = Do(2026, 1, 15), CompletedAt = Dt(2026, 1, 15) },
            new Activity { Project = b8, Title = "Baldrame e alvenaria (1a fase, paralisada)", Status = ActivityStatus.Concluida, Priority = ActivityPriority.Alta, AssignedUser = ana, DueDate = Do(2026, 3, 1), CompletedAt = Dt(2026, 3, 1) },
            new Activity { Project = b8, Title = "Retomada da obra com nova equipe", Status = ActivityStatus.EmAndamento, Priority = ActivityPriority.Alta, AssignedUser = ana, DueDate = Do(2026, 7, 1) },
            new Activity { Project = b8, Title = "Instalacoes e lavanderia", Status = ActivityStatus.AFazer, Priority = ActivityPriority.Media, AssignedUser = ana, DueDate = Do(2026, 9, 1) },

            new Activity { Project = b9, Title = "Levantamento tecnico sobre alicerce existente", Status = ActivityStatus.Concluida, Priority = ActivityPriority.Media, AssignedUser = fausto, DueDate = Do(2026, 1, 20), CompletedAt = Dt(2026, 1, 20) },
            new Activity { Project = b9, Title = "Contratacao de construtor local para retomada", Status = ActivityStatus.EmAndamento, Priority = ActivityPriority.Alta, AssignedUser = fausto, DueDate = Do(2026, 6, 1) },
            new Activity { Project = b9, Title = "Construcao do banheiro e caixa d'agua", Status = ActivityStatus.AFazer, Priority = ActivityPriority.Alta, AssignedUser = fausto, DueDate = Do(2026, 9, 15) },

            new Activity { Project = b10, Title = "Levantamento pos-incendio", Status = ActivityStatus.Concluida, Priority = ActivityPriority.Alta, AssignedUser = ana, DueDate = Do(2026, 4, 20), CompletedAt = Dt(2026, 4, 20) },
            new Activity { Project = b10, Title = "Construcao do modulo sanitario", Status = ActivityStatus.Concluida, Priority = ActivityPriority.Alta, AssignedUser = ana, DueDate = Do(2026, 5, 20), CompletedAt = Dt(2026, 5, 20) },
            new Activity { Project = b10, Title = "Pavimentacao do acesso e redes da cozinha", Status = ActivityStatus.Concluida, Priority = ActivityPriority.Media, AssignedUser = ana, DueDate = Do(2026, 6, 1), CompletedAt = Dt(2026, 6, 1) },
            new Activity { Project = b10, Title = "Vistoria final", Status = ActivityStatus.EmAndamento, Priority = ActivityPriority.Media, AssignedUser = ana, DueDate = Do(2026, 6, 20) },

            new Activity { Project = h1, Title = "Cessao e preparacao do terreno", Status = ActivityStatus.Concluida, Priority = ActivityPriority.Media, AssignedUser = ana, DueDate = Do(2026, 3, 15), CompletedAt = Dt(2026, 3, 15) },
            new Activity { Project = h1, Title = "Implantacao dos canteiros", Status = ActivityStatus.EmAndamento, Priority = ActivityPriority.Media, AssignedUser = ana, DueDate = Do(2026, 6, 1) },
            new Activity { Project = h1, Title = "Oficina de manejo agroecologico", Status = ActivityStatus.AFazer, Priority = ActivityPriority.Baixa, AssignedUser = ana, DueDate = Do(2026, 7, 15) },

            new Activity { Project = h2, Title = "Articulacao com associacao de moradores", Status = ActivityStatus.EmAndamento, Priority = ActivityPriority.Media, AssignedUser = fausto, DueDate = Do(2026, 8, 1) },
            new Activity { Project = h2, Title = "Definicao do terreno", Status = ActivityStatus.AFazer, Priority = ActivityPriority.Media, AssignedUser = fausto, DueDate = Do(2026, 9, 15) },

            new Activity { Project = h3, Title = "Preparacao do solo e canteiros", Status = ActivityStatus.Concluida, Priority = ActivityPriority.Media, AssignedUser = leonardo, DueDate = Do(2025, 6, 20), CompletedAt = Dt(2025, 6, 20) },
            new Activity { Project = h3, Title = "Sistema de irrigacao por gotejamento", Status = ActivityStatus.Concluida, Priority = ActivityPriority.Media, AssignedUser = leonardo, DueDate = Do(2025, 8, 10), CompletedAt = Dt(2025, 8, 10) },
            new Activity { Project = h3, Title = "Primeira oficina de manejo", Status = ActivityStatus.Concluida, Priority = ActivityPriority.Baixa, AssignedUser = leonardo, DueDate = Do(2025, 11, 15), CompletedAt = Dt(2025, 11, 15) },

            new Activity { Project = h4, Title = "Preparacao dos canteiros", Status = ActivityStatus.Concluida, Priority = ActivityPriority.Media, AssignedUser = ana, DueDate = Do(2026, 3, 1), CompletedAt = Dt(2026, 3, 1) },
            new Activity { Project = h4, Title = "Capacitacao em cultivo de hortalicas", Status = ActivityStatus.EmAndamento, Priority = ActivityPriority.Media, AssignedUser = ana, DueDate = Do(2026, 7, 1) },
            new Activity { Project = h4, Title = "Colheita e avaliacao", Status = ActivityStatus.AFazer, Priority = ActivityPriority.Baixa, AssignedUser = ana, DueDate = Do(2026, 9, 1) },

            new Activity { Project = h5, Title = "Estudo de viabilidade", Status = ActivityStatus.AFazer, Priority = ActivityPriority.Media, AssignedUser = fausto, DueDate = Do(2026, 10, 1) }
        );

        db.Indicators.AddRange(
            new Indicator { Project = b1, Name = "Pessoas beneficiadas", Unit = "pessoas", Value = 2 },
            new Indicator { Project = b2, Name = "Pessoas beneficiadas", Unit = "pessoas", Value = 9 },
            new Indicator { Project = b3, Name = "Pessoas beneficiadas", Unit = "pessoas", Value = 1 },
            new Indicator { Project = b4, Name = "Pessoas beneficiadas", Unit = "pessoas", Value = 4 },
            new Indicator { Project = b5, Name = "Pessoas beneficiadas", Unit = "pessoas", Value = 3 },
            new Indicator { Project = b6, Name = "Pessoas beneficiadas", Unit = "pessoas", Value = 6 },
            new Indicator { Project = b7, Name = "Pessoas beneficiadas", Unit = "pessoas", Value = 2 },
            new Indicator { Project = b8, Name = "Pessoas beneficiadas", Unit = "pessoas", Value = 8 },
            new Indicator { Project = b9, Name = "Pessoas beneficiadas", Unit = "pessoas", Value = 6 },
            new Indicator { Project = b10, Name = "Pessoas beneficiadas", Unit = "pessoas", Value = 4 },

            new Indicator { Project = h1, Name = "Familias participantes", Unit = "familias", Value = 25 },
            new Indicator { Project = h2, Name = "Familias participantes", Unit = "familias", Value = 0 },
            new Indicator { Project = h3, Name = "Familias participantes", Unit = "familias", Value = 18 },
            new Indicator { Project = h3, Name = "Canteiros implantados", Unit = "canteiros", Value = 12 },
            new Indicator { Project = h4, Name = "Familias participantes", Unit = "familias", Value = 15 }
        );

        db.ProjectVolunteers.AddRange(
            new ProjectVolunteer { Project = b1, Volunteer = vLeonardo, RoleInProject = "Responsavel tecnico" },
            new ProjectVolunteer { Project = b1, Volunteer = vClivia, RoleInProject = "Acompanhamento" },

            new ProjectVolunteer { Project = b2, Volunteer = vSandra, RoleInProject = "Responsavel tecnico" },
            new ProjectVolunteer { Project = b2, Volunteer = vAdriano, RoleInProject = "Instalacoes" },

            new ProjectVolunteer { Project = b3, Volunteer = vFelipe, RoleInProject = "Acompanhamento tecnico" },
            new ProjectVolunteer { Project = b3, Volunteer = vEdu, RoleInProject = "Instalacoes" },

            new ProjectVolunteer { Project = b4, Volunteer = vLuca, RoleInProject = "Responsavel tecnico" },
            new ProjectVolunteer { Project = b4, Volunteer = vGiovani, RoleInProject = "Acompanhamento" },

            new ProjectVolunteer { Project = b5, Volunteer = vAdriano, RoleInProject = "Projeto de acessibilidade" },
            new ProjectVolunteer { Project = b5, Volunteer = vMariaAntonia, RoleInProject = "Padrao e qualidade" },

            new ProjectVolunteer { Project = b6, Volunteer = vEdu, RoleInProject = "Responsavel tecnico" },
            new ProjectVolunteer { Project = b6, Volunteer = vSandra, RoleInProject = "Acompanhamento" },

            new ProjectVolunteer { Project = b7, Volunteer = vGuilherme, RoleInProject = "Acompanhamento" },
            new ProjectVolunteer { Project = b7, Volunteer = vCarol, RoleInProject = "Apoio social" },

            new ProjectVolunteer { Project = b8, Volunteer = vLuca, RoleInProject = "Responsavel tecnico" },
            new ProjectVolunteer { Project = b8, Volunteer = vFelipe, RoleInProject = "Acompanhamento" },

            new ProjectVolunteer { Project = b9, Volunteer = vClivia, RoleInProject = "Levantamento tecnico" },
            new ProjectVolunteer { Project = b9, Volunteer = vAna, RoleInProject = "Acompanhamento" },

            new ProjectVolunteer { Project = b10, Volunteer = vGiovani, RoleInProject = "Responsavel tecnico" },
            new ProjectVolunteer { Project = b10, Volunteer = vSandra, RoleInProject = "Acompanhamento" },

            new ProjectVolunteer { Project = h1, Volunteer = vJulia, RoleInProject = "Mobilizacao comunitaria" },
            new ProjectVolunteer { Project = h1, Volunteer = vMarcosHeitor, RoleInProject = "Apoio social" },

            new ProjectVolunteer { Project = h2, Volunteer = vAlisson, RoleInProject = "Articulacao local" },
            new ProjectVolunteer { Project = h2, Volunteer = vFelipe, RoleInProject = "Levantamento" },

            new ProjectVolunteer { Project = h3, Volunteer = vMariaAntonia, RoleInProject = "Coordenacao das oficinas" },
            new ProjectVolunteer { Project = h3, Volunteer = vYasminM, RoleInProject = "Comunicacao e mobilizacao" },

            new ProjectVolunteer { Project = h4, Volunteer = vAlice, RoleInProject = "Comunicacao e mobilizacao" },
            new ProjectVolunteer { Project = h4, Volunteer = vLuca, RoleInProject = "Capacitacao" },

            new ProjectVolunteer { Project = h5, Volunteer = vFrancielly, RoleInProject = "Viabilidade orcamentaria" },
            new ProjectVolunteer { Project = h5, Volunteer = vTanea, RoleInProject = "Articulacao com parceiros" }
        );

        db.ProjectUpdates.AddRange(
            new ProjectUpdate { Project = b1, AuthorUser = ana, Text = "Visita tecnica realizada na casa da Dona Cinara. Banheiro interno com paredes comprometidas pela enchente, reforma completa necessaria.", CreatedAt = Dt(2025, 8, 1) },
            new ProjectUpdate { Project = b1, AuthorUser = leonardo, Text = "Obra entregue e vistoriada. Banheiro reformado com sucesso, familia muito satisfeita com o resultado.", CreatedAt = Dt(2025, 9, 6) },

            new ProjectUpdate { Project = b2, AuthorUser = ana, Text = "Iniciada obra do banheiro comunitario para as familias de Solange e Michele. Projeto contempla rede de esgoto para todo o beco.", CreatedAt = Dt(2025, 11, 5) },
            new ProjectUpdate { Project = b2, AuthorUser = ana, Text = "Banheiro entregue com barras de apoio para a moradora idosa com dificuldade de visao. Rede de esgoto do beco concluida, beneficiando a vizinhanca.", CreatedAt = Dt(2026, 1, 11) },

            new ProjectUpdate { Project = b3, AuthorUser = ana, Text = "Demolicao da casa em risco realizada com seguranca. Inicio da reconstrucao completa, incluindo banheiro.", CreatedAt = Dt(2026, 5, 20) },

            new ProjectUpdate { Project = b4, AuthorUser = leonardo, Text = "Iniciada reconstrucao quase integral da moradia da Dona Patricia, com banheiro acessivel para atender as necessidades de mobilidade da familia.", CreatedAt = Dt(2025, 9, 20) },
            new ProjectUpdate { Project = b4, AuthorUser = leonardo, Text = "Casa entregue com banheiro acessivel concluido. Familia com mobilidade reduzida ja usufruindo da nova estrutura.", CreatedAt = Dt(2025, 12, 14) },

            new ProjectUpdate { Project = b5, AuthorUser = ana, Text = "Projeto de acessibilidade definido conforme NBR 9050, atendendo necessidade de moradora cadeirante.", CreatedAt = Dt(2026, 4, 5) },
            new ProjectUpdate { Project = b5, AuthorUser = ana, Text = "Banheiro acessivel entregue, com dimensoes e barras de apoio adequadas para cadeira de rodas.", CreatedAt = Dt(2026, 5, 20) },

            new ProjectUpdate { Project = b6, AuthorUser = fausto, Text = "Demolicao da cozinha em risco concluida com seguranca, apesar da casa ter quatro criancas pequenas no nucleo familiar. Obra do banheiro iniciada.", CreatedAt = Dt(2026, 5, 10) },

            new ProjectUpdate { Project = b7, AuthorUser = ana, Text = "Demolicao da casa do casal de idosos, atingida por queda de arvore. Inicio da montagem de nova moradia pre-fabricada com banheiro.", CreatedAt = Dt(2025, 11, 20) },
            new ProjectUpdate { Project = b7, AuthorUser = ana, Text = "Casa entregue com banheiro completo, mobiliario basico e remocao dos escombros. Casal de idosos catadores ja instalado.", CreatedAt = Dt(2026, 1, 20) },

            new ProjectUpdate { Project = b8, AuthorUser = ana, Text = "Obra paralisada apos problemas com a equipe de construcao contratada inicialmente. Necessario buscar novos profissionais.", CreatedAt = Dt(2026, 3, 1) },
            new ProjectUpdate { Project = b8, AuthorUser = ana, Text = "Obra retomada com a equipe de Flavio e Rita. Modulo sanitario em andamento para atender familia de 8 pessoas.", CreatedAt = Dt(2026, 5, 15) },

            new ProjectUpdate { Project = b9, AuthorUser = fausto, Text = "Levantamento realizado sobre o alicerce ja existente. Familia enfrenta desabastecimento de agua frequente; caixa d'agua sera incluida no projeto.", CreatedAt = Dt(2026, 1, 20) },

            new ProjectUpdate { Project = b10, AuthorUser = ana, Text = "Levantamento realizado apos incendio que comprometeu a moradia. Modulo sanitario padrao BDG sera construido.", CreatedAt = Dt(2026, 4, 20) },
            new ProjectUpdate { Project = b10, AuthorUser = ana, Text = "Modulo sanitario construido e redes da cozinha reconstruidas. Aguardando agenda de vistoria final para entrega.", CreatedAt = Dt(2026, 6, 1) },

            new ProjectUpdate { Project = h1, AuthorUser = ana, Text = "Terreno cedido pela comunidade e preparado. Canteiros em fase de implantacao.", CreatedAt = Dt(2026, 3, 15) },

            new ProjectUpdate { Project = h2, AuthorUser = fausto, Text = "Iniciada articulacao com a associacao de moradores do Sarandi para definicao do terreno da futura horta.", CreatedAt = Dt(2026, 7, 5) },

            new ProjectUpdate { Project = h3, AuthorUser = leonardo, Text = "Canteiros implantados e sistema de irrigacao por gotejamento instalado.", CreatedAt = Dt(2025, 8, 10) },
            new ProjectUpdate { Project = h3, AuthorUser = leonardo, Text = "Horta entregue e funcionando, com primeira oficina de manejo realizada junto as 18 familias participantes.", CreatedAt = Dt(2025, 11, 15) },

            new ProjectUpdate { Project = h4, AuthorUser = ana, Text = "Canteiros preparados. Capacitacao das familias em cultivo de hortalicas em andamento.", CreatedAt = Dt(2026, 3, 1) }
        );

        await db.SaveChangesAsync();
        logger.LogInformation("Dados iniciais criados: {Users} usuarios, {Volunteers} voluntarios, {Projects} projetos.", 3, 19, 15);
    }
}
