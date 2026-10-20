using System.Globalization;
using System.Security.Claims;
using System.Text.Json;
using Esf.Api.Common;
using Esf.Api.Data;
using Esf.Api.Domain;
using Esf.Api.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Microsoft.EntityFrameworkCore.Diagnostics;

namespace Esf.Api.Services;

/// <summary>Uma linha de "campo: antes -> depois" do historico.</summary>
public record AuditChange(string Field, string Before, string After);

/// <summary>
/// Registra no historico (AuditEntries) as alteracoes feitas por pessoas logadas, no mesmo SaveChanges da
/// alteracao. O que nao vem de uma pessoa (dados de demonstracao, rotinas internas) nao entra.
/// </summary>
public class AuditInterceptor : SaveChangesInterceptor
{
    private readonly IHttpContextAccessor _http;

    public AuditInterceptor(IHttpContextAccessor http) => _http = http;

    public override async ValueTask<InterceptionResult<int>> SavingChangesAsync(DbContextEventData eventData,
        InterceptionResult<int> result, CancellationToken cancellationToken = default)
    {
        var claim = _http.HttpContext?.User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (eventData.Context is EsfDbContext db && Guid.TryParse(claim, out var userId))
            await AuditTrail.RecordAsync(db, userId, cancellationToken);

        return await base.SavingChangesAsync(eventData, result, cancellationToken);
    }
}

public static class AuditTrail
{
    /// <summary>Referencia a um voluntario, resolvida para o nome atual na hora de exibir.</summary>
    public static string VolunteerRef(Guid? id) => id.HasValue ? $"[[vol:{id:N}]]" : "—";

    public static string ProgramRef(Guid? id) => id.HasValue ? $"[[prog:{id:N}]]" : "—";

    private const string Hidden = "(dado pessoal)";

    /// <summary>Campos acompanhados em cada tipo e o nome exibido. Fora desta lista, a mudanca nao entra.</summary>
    private static readonly Dictionary<Type, Dictionary<string, string>> Fields = new()
    {
        [typeof(Project)] = new()
        {
            ["Name"] = "Nome", ["Status"] = "Status", ["ProgramId"] = "Programa", ["OwnerVolunteerId"] = "Responsável",
            ["StartDate"] = "Início", ["EndDateForecast"] = "Previsão de término", ["IsArchived"] = "Arquivado",
            ["Description"] = "Descrição", ["Objective"] = "Objetivo", ["Address"] = "Endereço",
            ["District"] = "Bairro", ["City"] = "Cidade", ["State"] = "Estado"
        },
        [typeof(Activity)] = new()
        {
            ["Title"] = "Título", ["Status"] = "Status", ["Priority"] = "Prioridade",
            ["AssignedVolunteerId"] = "Responsável", ["DueDate"] = "Prazo", ["BlockedReason"] = "O que está travando",
            ["Description"] = "Descrição", ["Notes"] = "Observações"
        },
        [typeof(Volunteer)] = new()
        {
            ["Name"] = "Nome", ["Email"] = "E-mail", ["Phone"] = "Telefone", ["Sector"] = "Setor",
            ["Skills"] = "Competências", ["Notes"] = "Observações", ["Status"] = "Situação",
            ["BirthDay"] = "Aniversário (dia)", ["BirthMonth"] = "Aniversário (mês)", ["PhotoStoredName"] = "Foto"
        },
        [typeof(User)] = new()
        {
            ["Name"] = "Nome", ["Email"] = "E-mail", ["Role"] = "Perfil", ["IsActive"] = "Ativo",
            ["VolunteerId"] = "Voluntário vinculado", ["PasswordHash"] = "Senha", ["TermsVersion"] = "Política aceita (versão)"
        },
        [typeof(Indicator)] = new() { ["Name"] = "Nome", ["Value"] = "Valor", ["Unit"] = "Unidade" },
        [typeof(ProjectFile)] = new() { ["Description"] = "Legenda" },
        [typeof(ProjectUpdate)] = new() { ["Text"] = "Texto" },
        [typeof(ProjectProgram)] = new() { ["Name"] = "Nome", ["Status"] = "Situação", ["Icon"] = "Ícone", ["Color"] = "Cor" },
        [typeof(ProjectVolunteer)] = new() { ["RoleInProject"] = "Função" },
        [typeof(SignedDocument)] = new() { ["SignedOn"] = "Assinado em" },
        [typeof(VolunteerStatusChange)] = new() { ["Status"] = "Status", ["StartsOn"] = "A partir de" },
        [typeof(Organization)] = new()
        {
            ["Name"] = "Nome", ["LegalName"] = "Razão social", ["Cnpj"] = "CNPJ", ["Email"] = "E-mail",
            ["Phone"] = "Telefone", ["Website"] = "Site", ["City"] = "Cidade", ["State"] = "Estado",
            ["SignatoryName"] = "Quem assina", ["SignatoryRole"] = "Cargo de quem assina",
            ["SignatoryNote"] = "Linha abaixo do cargo", ["LogoUrl"] = "Logo", ["SignatureStoredName"] = "Assinatura"
        }
    };

    /// <summary>Campos cujo valor nunca vai para o historico (so o fato de terem mudado).</summary>
    private static readonly Dictionary<Type, HashSet<string>> MaskedFields = new()
    {
        [typeof(Volunteer)] = new() { "Name", "Email", "Phone", "Skills", "Notes", "BirthDay", "BirthMonth", "PhotoStoredName" },
        [typeof(User)] = new() { "PasswordHash" },
        [typeof(Organization)] = new() { "LogoUrl", "SignatureStoredName" }
    };

    public static async Task RecordAsync(EsfDbContext db, Guid userId, CancellationToken cancellationToken)
    {
        db.ChangeTracker.DetectChanges();
        var entries = db.ChangeTracker.Entries()
            .Where(e => e.State is EntityState.Added or EntityState.Modified or EntityState.Deleted)
            .Where(e => Fields.ContainsKey(e.Entity.GetType()))
            .ToList();

        // A primeira linha do historico de status de um voluntario novo ja esta no "criou o voluntario".
        var newVolunteers = entries
            .Where(e => e.State == EntityState.Added && e.Entity is Volunteer)
            .Select(e => ((Volunteer)e.Entity).Id)
            .ToHashSet();
        entries.RemoveAll(e => e.Entity is VolunteerStatusChange c && newVolunteers.Contains(c.VolunteerId));
        if (entries.Count == 0) return;

        var userName = await db.Users.AsNoTracking()
            .Where(u => u.Id == userId)
            .Select(u => u.Volunteer != null ? u.Volunteer.Name : u.Name)
            .FirstOrDefaultAsync(cancellationToken) ?? "Alguém";

        foreach (var entry in entries)
        {
            var action = entry.State switch
            {
                EntityState.Added => AuditAction.Created,
                EntityState.Deleted => AuditAction.Deleted,
                _ => AuditAction.Updated
            };

            var changes = action == AuditAction.Updated ? Changes(entry) : new List<AuditChange>();
            // So o UpdatedAt (ou outro campo nao acompanhado) mudou: nao e uma alteracao de verdade.
            if (action == AuditAction.Updated && changes.Count == 0) continue;

            var (type, label, id, projectId) = Describe(entry.Entity);
            db.AuditEntries.Add(new AuditEntry
            {
                At = DateTime.UtcNow,
                UserId = userId,
                UserName = Truncate(userName, 160),
                Action = action,
                EntityType = type,
                EntityId = id,
                EntityLabel = Truncate(label, 300),
                ProjectId = projectId,
                Changes = changes.Count > 0 ? JsonSerializer.Serialize(changes) : null
            });
        }
    }

    private static (string Type, string Label, Guid Id, Guid? ProjectId) Describe(object entity) => entity switch
    {
        Project p => ("Projeto", p.Name, p.Id, p.Id),
        Activity a => ("Atividade", a.Title, a.Id, a.ProjectId),
        Volunteer v => ("Voluntário", VolunteerRef(v.Id), v.Id, null),
        User u => ("Usuário", u.Name, u.Id, null),
        Indicator i => ("Indicador", i.Name, i.Id, i.ProjectId),
        ProjectFile f => ("Arquivo", f.FileName, f.Id, f.ProjectId),
        ProjectUpdate u => ("Relato", Truncate(RichText.ToPlainText(u.Text), 80), u.Id, u.ProjectId),
        ProjectProgram g => ("Programa", g.Name, g.Id, null),
        ProjectVolunteer pv => ("Equipe", VolunteerRef(pv.VolunteerId), pv.VolunteerId, pv.ProjectId),
        SignedDocument d => ("Documento assinado",
            d.Kind == SignedDocumentKind.VolunteerTerm
                ? $"Termo de adesão de {VolunteerRef(d.VolunteerId)}"
                : "Autorização de imagem dos beneficiários",
            d.Id, d.ProjectId),
        VolunteerStatusChange c => ("Histórico de status",
            $"{VolunteerRef(c.VolunteerId)}: {(c.Status.HasValue ? Format(typeof(VolunteerStatusChange), "Status", c.Status) : "sem registro")} a partir de {c.StartsOn:dd/MM/yyyy}",
            c.Id, null),
        Organization o => ("Organização", o.Name, o.Id, null),
        _ => ("Registro", entity.GetType().Name, Guid.Empty, null)
    };

    private static List<AuditChange> Changes(EntityEntry entry)
    {
        var type = entry.Entity.GetType();
        var labels = Fields[type];
        var masked = MaskedFields.GetValueOrDefault(type) ?? new HashSet<string>();
        var changes = new List<AuditChange>();

        foreach (var property in entry.Properties)
        {
            var name = property.Metadata.Name;
            if (!property.IsModified || !labels.TryGetValue(name, out var label)) continue;
            if (Equals(property.OriginalValue, property.CurrentValue)) continue;

            if (masked.Contains(name))
            {
                changes.Add(new AuditChange(label, Hidden, Hidden));
                continue;
            }

            changes.Add(new AuditChange(label, Format(type, name, property.OriginalValue),
                Format(type, name, property.CurrentValue)));
        }

        return changes;
    }

    private static string Format(Type type, string property, object? value)
    {
        if (value is null) return "—";
        if (value is Guid id)
            return property.EndsWith("VolunteerId", StringComparison.Ordinal)
                ? VolunteerRef(id)
                : property == "ProgramId" ? ProgramRef(id) : id.ToString();

        return value switch
        {
            string text when type == typeof(ProjectUpdate) => Truncate(RichText.ToPlainText(text), 160),
            string key when type == typeof(ProjectProgram) && property == "Icon" =>
                ProgramAppearance.Icons.GetValueOrDefault(key, key),
            string key when type == typeof(ProjectProgram) && property == "Color" =>
                ProgramAppearance.Colors.GetValueOrDefault(key, key),
            string text => Truncate(text, 160),
            bool flag => flag ? "sim" : "não",
            decimal number => Math.Round(number, 2).ToString("0.##", CultureInfo.InvariantCulture).Replace('.', ','),
            DateOnly date => date.ToString("dd/MM/yyyy"),
            DateTime moment => moment.ToString("dd/MM/yyyy HH:mm"),
            ProjectStatus status => status switch
            {
                ProjectStatus.Planejamento => "Planejamento",
                ProjectStatus.EmAndamento => "Em andamento",
                ProjectStatus.Pausado => "Pausado",
                ProjectStatus.Concluido => "Concluído",
                _ => "Cancelado"
            },
            ActivityStatus status => status switch
            {
                ActivityStatus.AFazer => "Não iniciada",
                ActivityStatus.EmAndamento => "Em andamento",
                ActivityStatus.Bloqueada => "Bloqueada",
                _ => "Concluída"
            },
            ActivityPriority priority => priority switch
            {
                ActivityPriority.Baixa => "Baixa",
                ActivityPriority.Media => "Média",
                _ => "Alta"
            },
            VolunteerStatus status => status switch
            {
                VolunteerStatus.Ativo => "Ativo",
                VolunteerStatus.Inativo => "Inativo",
                VolunteerStatus.ExMembro => "Ex-membro",
                _ => "Afastado"
            },
            UserRole role => role switch
            {
                UserRole.Administrador => "Administrador",
                UserRole.Coordenador => "Coordenador",
                _ => "Usuário"
            },
            ProgramStatus status => status == ProgramStatus.Ativo ? "Ativo" : "Arquivado",
            VolunteerSector sector => sector switch
            {
                VolunteerSector.Juridico => "Jurídico",
                VolunteerSector.Comunicacao => "Comunicação",
                _ => sector.ToString()
            },
            _ => Truncate(value.ToString() ?? "—", 160)
        };
    }

    private static string Truncate(string value, int max) => value.Length <= max ? value : value[..(max - 1)] + "…";
}
