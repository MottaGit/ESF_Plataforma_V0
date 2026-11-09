using Esf.Api.Common;
using Esf.Api.Data;
using Esf.Api.Domain;
using Esf.Api.Domain.Entities;
using Esf.Api.Services;
using Microsoft.EntityFrameworkCore;

namespace Esf.Api.Tests;

/// <summary>
/// Banco em memoria com dois nucleos (A e B), cada um com ao menos um registro de cada tabela coberta pelo filtro
/// por nucleo. O programa dos dois tem o mesmo nome de proposito (nome unico vale dentro do nucleo).
/// </summary>
public sealed class TwoNucleos
{
    public const string Password = "Senha@123";

    private readonly string _database = Guid.NewGuid().ToString();

    public Nucleo A { get; private set; } = null!;
    public Nucleo B { get; private set; } = null!;

    public static async Task<TwoNucleos> CreateAsync()
    {
        var fixture = new TwoNucleos();
        fixture.A = await fixture.AddNucleoAsync("Nucleo A", "a");
        fixture.B = await fixture.AddNucleoAsync("Nucleo B", "b");
        return fixture;
    }

    /// <summary>Contexto como se a pessoa estivesse logada: o filtro usa o nucleo dela.</summary>
    public EsfDbContext Context(ICurrentUser user) =>
        new(new DbContextOptionsBuilder<EsfDbContext>().UseInMemoryDatabase(_database).Options, user);

    /// <summary>Contexto de rotina interna (ve todos os nucleos).</summary>
    public EsfDbContext SystemContext()
    {
        var db = Context(TestUser.Anonymous);
        db.AllOrganizations = true;
        return db;
    }

    private async Task<Nucleo> AddNucleoAsync(string name, string slug)
    {
        await using var db = SystemContext();
        var today = Mapping.Today;

        var org = new Organization { Name = name };
        var volunteer = new Volunteer { OrganizationId = org.Id, Name = $"Voluntario {slug}", Email = $"voluntario.{slug}@teste.org" };
        var withoutAccess = new Volunteer { OrganizationId = org.Id, Name = $"Sem acesso {slug}", Email = $"sem.acesso.{slug}@teste.org" };
        var admin = new User
        {
            OrganizationId = org.Id,
            Name = $"Admin {slug}",
            Email = $"admin.{slug}@teste.org",
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(Password),
            Role = UserRole.Administrador,
            VolunteerId = volunteer.Id
        };
        var program = new ProjectProgram { OrganizationId = org.Id, Name = "Banheiros" };
        var project = new Project
        {
            OrganizationId = org.Id,
            ProgramId = program.Id,
            Name = $"Projeto {slug}",
            StartDate = today.AddDays(-10),
            Status = ProjectStatus.EmAndamento
        };
        var activity = new Activity
        {
            ProjectId = project.Id,
            Title = $"Tarefa {slug}",
            Status = ActivityStatus.AFazer,
            Priority = ActivityPriority.Media,
            AssignedVolunteerId = volunteer.Id,
            DueDate = today.AddDays(-1)
        };

        db.AddRange(org, volunteer, withoutAccess, admin, program, project, activity,
            new Indicator { ProjectId = project.Id, Name = "Familias atendidas", Unit = "familias", Value = 1 },
            new ProjectUpdate { ProjectId = project.Id, Text = $"<p>Registro {slug}</p>", AuthorUserId = admin.Id },
            new ProjectFile { ProjectId = project.Id, FileName = "foto.jpg", StoredName = $"{slug}.jpg", ContentType = "image/jpeg" },
            new ProjectVolunteer { ProjectId = project.Id, VolunteerId = volunteer.Id },
            new ActivityChecklistItem { ActivityId = activity.Id, Text = $"Item {slug}" },
            new ActivityComment { ActivityId = activity.Id, Text = $"Comentario {slug}", AuthorUserId = admin.Id },
            new VolunteerStatusChange { VolunteerId = volunteer.Id, Status = VolunteerStatus.Ativo, StartsOn = today.AddDays(-30) },
            new Notification { VolunteerId = volunteer.Id, ProjectId = project.Id, Type = NotificationType.ActivityAssigned, Message = $"Aviso {slug}" },
            new SignedDocument
            {
                Kind = SignedDocumentKind.VolunteerTerm, VolunteerId = volunteer.Id,
                FileName = "termo.pdf", StoredName = $"{slug}-termo.pdf", ContentType = "application/pdf", SignedOn = today
            },
            new SignedDocument
            {
                Kind = SignedDocumentKind.BeneficiaryImageAuthorization, ProjectId = project.Id,
                FileName = "autorizacao.pdf", StoredName = $"{slug}-autorizacao.pdf", ContentType = "application/pdf", SignedOn = today
            },
            new ProgramTemplateActivity { ProgramId = program.Id, Title = "Visita tecnica" },
            new ProgramTemplateIndicator { ProgramId = program.Id, Name = "Familias atendidas" },
            new ProgramPartner
            {
                ProgramId = program.Id, Name = $"Instituto {slug}", Role = "Financiador",
                ContactName = $"Contato {slug}", Email = $"contato.{slug}@parceiro.org"
            },
            new AuditEntry { OrganizationId = org.Id, UserName = admin.Name, EntityType = "Projeto", EntityLabel = project.Name },
            new AccessLink { UserId = admin.Id, TokenHash = $"hash-{slug}", ExpiresAt = DateTime.UtcNow.AddDays(1) });
        await db.SaveChangesAsync();

        return new Nucleo(org.Id, admin.Id, admin.Email, volunteer.Id, withoutAccess.Id, program.Id, project.Id, activity.Id);
    }
}

/// <summary>Ids dos registros de um nucleo do teste.</summary>
public record Nucleo(
    Guid OrganizationId,
    Guid AdminUserId,
    string AdminEmail,
    Guid VolunteerId,
    Guid VolunteerWithoutAccessId,
    Guid ProgramId,
    Guid ProjectId,
    Guid ActivityId)
{
    /// <summary>O administrador do nucleo, logado.</summary>
    public TestUser Admin => new()
    {
        Id = AdminUserId,
        Name = "Admin",
        Role = UserRole.Administrador,
        OrganizationId = OrganizationId
    };
}
