using Esf.Api.Common;
using Esf.Api.Domain;
using Esf.Api.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace Esf.Api.Data;

public class EsfDbContext : DbContext
{
    private readonly ICurrentUser? _currentUser;

    public EsfDbContext(DbContextOptions<EsfDbContext> options, ICurrentUser? currentUser = null) : base(options)
    {
        _currentUser = currentUser;
    }

    /// <summary>
    /// Nucleo cujos dados as consultas enxergam: o de quem esta logado (ou o fixado em OrganizationOverride).
    /// Sem nucleo (sem login, conta so da gestao nacional), nenhum dado de nucleo aparece.
    /// </summary>
    public Guid? CurrentOrganizationId => OrganizationOverride ?? _currentUser?.OrganizationId;

    /// <summary>Nucleo fixado a mao (dados de demonstracao, rotinas internas), no lugar do de quem esta logado.</summary>
    public Guid? OrganizationOverride { get; set; }

    /// <summary>
    /// Desliga o filtro por nucleo neste contexto: so para rotinas internas (migracao, dados de demonstracao) e para
    /// os numeros agregados da gestao nacional. Nunca para devolver dados de um nucleo a quem e de outro.
    /// </summary>
    public bool AllOrganizations { get; set; }

    /// <summary>Quem esta logado (ou quem pediu a tarefa em segundo plano): o historico de alteracoes grava em nome dele.</summary>
    public Guid? CurrentUserId => _currentUser?.Id;

    public DbSet<User> Users => Set<User>();
    public DbSet<Volunteer> Volunteers => Set<Volunteer>();
    public DbSet<Project> Projects => Set<Project>();
    public DbSet<ProjectProgram> Programs => Set<ProjectProgram>();
    public DbSet<Activity> Activities => Set<Activity>();
    public DbSet<Indicator> Indicators => Set<Indicator>();
    public DbSet<IndicatorValueChange> IndicatorValueChanges => Set<IndicatorValueChange>();
    public DbSet<ProjectVolunteer> ProjectVolunteers => Set<ProjectVolunteer>();
    public DbSet<ProjectHourEntry> ProjectHourEntries => Set<ProjectHourEntry>();
    public DbSet<ProjectFile> ProjectFiles => Set<ProjectFile>();
    public DbSet<ProjectUpdate> ProjectUpdates => Set<ProjectUpdate>();
    public DbSet<Organization> Organizations => Set<Organization>();
    public DbSet<StoredFile> StoredFiles => Set<StoredFile>();
    public DbSet<Notification> Notifications => Set<Notification>();
    public DbSet<SignedDocument> SignedDocuments => Set<SignedDocument>();
    public DbSet<AuditEntry> AuditEntries => Set<AuditEntry>();
    public DbSet<VolunteerStatusChange> VolunteerStatusChanges => Set<VolunteerStatusChange>();
    public DbSet<ProgramTemplateActivity> ProgramTemplateActivities => Set<ProgramTemplateActivity>();
    public DbSet<ActivityChecklistItem> ActivityChecklistItems => Set<ActivityChecklistItem>();
    public DbSet<ActivityComment> ActivityComments => Set<ActivityComment>();
    public DbSet<ProgramTemplateIndicator> ProgramTemplateIndicators => Set<ProgramTemplateIndicator>();
    public DbSet<ProgramPartner> ProgramPartners => Set<ProgramPartner>();
    public DbSet<AccessLink> AccessLinks => Set<AccessLink>();
    public DbSet<NationalIndicator> NationalIndicators => Set<NationalIndicator>();
    public DbSet<BackgroundJob> BackgroundJobs => Set<BackgroundJob>();

    public override int SaveChanges(bool acceptAllChangesOnSuccess)
    {
        StampOrganization();
        RecordIndicatorHistory();
        return base.SaveChanges(acceptAllChangesOnSuccess);
    }

    public override Task<int> SaveChangesAsync(bool acceptAllChangesOnSuccess, CancellationToken cancellationToken = default)
    {
        StampOrganization();
        RecordIndicatorHistory();
        return base.SaveChangesAsync(acceptAllChangesOnSuccess, cancellationToken);
    }

    /// <summary>
    /// Indicador novo com valor, ou valor que mudou, vira uma linha do historico (o relatorio le o valor em cada data).
    /// Mudar so o nome ou a unidade nao conta. A data e o ValueUpdatedAt de quem gravou (a demonstracao e a planilha
    /// trazem a sua); sem ela, agora.
    /// </summary>
    private void RecordIndicatorHistory()
    {
        foreach (var entry in ChangeTracker.Entries<Indicator>().ToList())
        {
            var indicator = entry.Entity;
            var value = entry.Property(x => x.Value);
            var changed = entry.State switch
            {
                EntityState.Added => indicator.Value != null,
                EntityState.Modified => value.IsModified && value.OriginalValue != indicator.Value,
                _ => false
            };
            if (!changed) continue;

            IndicatorValueChanges.Add(new IndicatorValueChange
            {
                IndicatorId = indicator.Id,
                Value = indicator.Value,
                ChangedAt = indicator.ValueUpdatedAt ?? DateTime.UtcNow
            });
        }
    }

    /// <summary>Registro novo de nucleo (voluntario, programa, projeto) entra no nucleo atual, se nao veio com um.</summary>
    private void StampOrganization()
    {
        foreach (var entry in ChangeTracker.Entries<IOrganizationOwned>())
        {
            if (entry.State != EntityState.Added || entry.Entity.OrganizationId != Guid.Empty) continue;
            entry.Entity.OrganizationId = CurrentOrganizationId
                ?? throw AppException.Forbidden("Só quem é de um núcleo pode cadastrar dados nele.");
        }
    }

    /// <summary>Funcao esf_fold do banco: minusculas e sem acento (busca geral). So vale dentro de consultas.</summary>
    public static string Fold(string text) => throw new NotSupportedException("Use apenas em consultas.");

    /// <summary>Funcao esf_fold_html do banco: como Fold, sem as tags do texto formatado dos relatos.</summary>
    public static string FoldHtml(string html) => throw new NotSupportedException("Use apenas em consultas.");

    protected override void OnModelCreating(ModelBuilder b)
    {
        base.OnModelCreating(b);

        b.HasDbFunction(typeof(EsfDbContext).GetMethod(nameof(Fold), new[] { typeof(string) })!).HasName("esf_fold");
        b.HasDbFunction(typeof(EsfDbContext).GetMethod(nameof(FoldHtml), new[] { typeof(string) })!).HasName("esf_fold_html");

        b.Entity<User>(e =>
        {
            e.Property(x => x.Name).HasMaxLength(160).IsRequired();
            e.Property(x => x.Email).HasMaxLength(200).IsRequired();
            e.Property(x => x.PasswordHash).HasMaxLength(300).IsRequired();
            // Um e-mail, um acesso, em toda a plataforma (o login nao pergunta o nucleo).
            e.HasIndex(x => x.Email).IsUnique();
            e.HasOne<Organization>().WithMany().HasForeignKey(x => x.OrganizationId).OnDelete(DeleteBehavior.Restrict);

            // Cada voluntario tem no maximo um acesso (indice unico criado pelo 1:1).
            e.HasOne(x => x.Volunteer)
                .WithOne()
                .HasForeignKey<User>(x => x.VolunteerId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        b.Entity<AccessLink>(e =>
        {
            e.Property(x => x.TokenHash).HasMaxLength(64).IsRequired();
            e.HasIndex(x => x.TokenHash).IsUnique();
            e.HasIndex(x => x.UserId);
            e.HasOne(x => x.User).WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
        });

        b.Entity<Volunteer>(e =>
        {
            e.Property(x => x.Name).HasMaxLength(160).IsRequired();
            e.Property(x => x.Email).HasMaxLength(200);
            e.Property(x => x.Phone).HasMaxLength(40);
            e.Property(x => x.PhotoStoredName).HasMaxLength(160);
            e.HasIndex(x => x.Name);
            e.HasIndex(x => x.Sector);
            e.HasOne<Organization>().WithMany().HasForeignKey(x => x.OrganizationId).OnDelete(DeleteBehavior.Restrict);
        });

        b.Entity<Project>(e =>
        {
            e.Property(x => x.Name).HasMaxLength(200).IsRequired();
            e.Property(x => x.Beneficiaries).HasMaxLength(300);
            e.Property(x => x.TargetAudience).HasMaxLength(300);
            e.Property(x => x.Address).HasMaxLength(300);
            e.Property(x => x.District).HasMaxLength(120);
            e.Property(x => x.City).HasMaxLength(120);
            e.Property(x => x.State).HasMaxLength(60);
            e.HasIndex(x => x.Status);
            e.HasIndex(x => x.Name);
            e.HasOne<Organization>().WithMany().HasForeignKey(x => x.OrganizationId).OnDelete(DeleteBehavior.Restrict);

            e.HasOne(x => x.OwnerVolunteer)
                .WithMany()
                .HasForeignKey(x => x.OwnerVolunteerId)
                .OnDelete(DeleteBehavior.SetNull);

            e.HasOne(x => x.Program)
                .WithMany(pr => pr.Projects)
                .HasForeignKey(x => x.ProgramId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        b.Entity<ProjectProgram>(e =>
        {
            e.Property(x => x.Name).HasMaxLength(120).IsRequired();
            // Nome unico dentro do nucleo (nucleos diferentes podem ter programas com o mesmo nome).
            e.HasIndex(x => new { x.OrganizationId, x.Name }).IsUnique();
            e.HasOne<Organization>().WithMany().HasForeignKey(x => x.OrganizationId).OnDelete(DeleteBehavior.Restrict);
            e.Property(x => x.Icon).HasMaxLength(20).IsRequired();
            e.Property(x => x.Color).HasMaxLength(20).IsRequired();
            e.Property(x => x.Audience).HasMaxLength(300);
            e.Property(x => x.PublicToken).HasMaxLength(40);
            e.HasIndex(x => x.PublicToken).IsUnique();
        });

        b.Entity<ProgramTemplateActivity>(e =>
        {
            e.Property(x => x.Title).HasMaxLength(200).IsRequired();
            e.HasIndex(x => new { x.ProgramId, x.Position });
            e.HasOne(x => x.Program).WithMany(p => p.TemplateActivities).HasForeignKey(x => x.ProgramId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        b.Entity<ProgramTemplateIndicator>(e =>
        {
            e.Property(x => x.Name).HasMaxLength(200).IsRequired();
            e.Property(x => x.Unit).HasMaxLength(60);
            e.Property(x => x.Target).HasPrecision(18, 2);
            e.HasIndex(x => new { x.ProgramId, x.Position });
            e.HasOne(x => x.Program).WithMany(p => p.TemplateIndicators).HasForeignKey(x => x.ProgramId)
                .OnDelete(DeleteBehavior.Cascade);
            e.HasOne(x => x.NationalIndicator).WithMany().HasForeignKey(x => x.NationalIndicatorId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        b.Entity<ProgramPartner>(e =>
        {
            e.Property(x => x.Name).HasMaxLength(120).IsRequired();
            e.Property(x => x.Role).HasMaxLength(60);
            e.Property(x => x.ContactName).HasMaxLength(120);
            e.Property(x => x.Email).HasMaxLength(200);
            e.Property(x => x.Phone).HasMaxLength(40);
            e.Property(x => x.Notes).HasMaxLength(1000);
            e.HasIndex(x => new { x.ProgramId, x.Position });
            e.HasOne(x => x.Program).WithMany(p => p.Partners).HasForeignKey(x => x.ProgramId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        // Indicadores nacionais: da gestao nacional, sem nucleo (todos os nucleos veem e escolhem).
        b.Entity<NationalIndicator>(e =>
        {
            e.Property(x => x.Name).HasMaxLength(200).IsRequired();
            e.Property(x => x.Unit).HasMaxLength(60);
            e.Property(x => x.Description).HasMaxLength(600);
            e.HasIndex(x => x.Name).IsUnique();
        });

        b.Entity<Activity>(e =>
        {
            e.Property(x => x.Title).HasMaxLength(200).IsRequired();
            e.Property(x => x.BlockedReason).HasMaxLength(300);

            e.HasOne(x => x.Project)
                .WithMany(p => p.Activities)
                .HasForeignKey(x => x.ProjectId)
                .OnDelete(DeleteBehavior.Cascade);

            e.HasOne(x => x.AssignedVolunteer)
                .WithMany()
                .HasForeignKey(x => x.AssignedVolunteerId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        b.Entity<ActivityChecklistItem>(e =>
        {
            e.Property(x => x.Text).HasMaxLength(300).IsRequired();
            e.HasIndex(x => new { x.ActivityId, x.Position });
            e.HasOne(x => x.Activity).WithMany(a => a.ChecklistItems).HasForeignKey(x => x.ActivityId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        b.Entity<ActivityComment>(e =>
        {
            e.Property(x => x.Text).HasMaxLength(2000).IsRequired();
            e.HasIndex(x => new { x.ActivityId, x.CreatedAt });
            e.HasOne(x => x.Activity).WithMany(a => a.Comments).HasForeignKey(x => x.ActivityId)
                .OnDelete(DeleteBehavior.Cascade);
            e.HasOne(x => x.AuthorUser).WithMany().HasForeignKey(x => x.AuthorUserId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        b.Entity<Indicator>(e =>
        {
            e.Property(x => x.Name).HasMaxLength(200).IsRequired();
            e.Property(x => x.Unit).HasMaxLength(60);
            e.Property(x => x.Value).HasPrecision(18, 2);

            e.HasOne(x => x.Project)
                .WithMany(p => p.Indicators)
                .HasForeignKey(x => x.ProjectId)
                .OnDelete(DeleteBehavior.Cascade);

            e.HasOne(x => x.NationalIndicator).WithMany().HasForeignKey(x => x.NationalIndicatorId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        b.Entity<IndicatorValueChange>(e =>
        {
            e.Property(x => x.Value).HasPrecision(18, 2);
            e.HasIndex(x => new { x.IndicatorId, x.ChangedAt });
            e.HasOne(x => x.Indicator).WithMany(i => i.ValueChanges).HasForeignKey(x => x.IndicatorId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        b.Entity<ProjectHourEntry>(e =>
        {
            e.Property(x => x.Hours).HasPrecision(5, 2);
            e.Property(x => x.Description).HasMaxLength(300);
            e.HasIndex(x => new { x.ProjectId, x.VolunteerId });
            e.HasIndex(x => x.VolunteerId);

            e.HasOne(x => x.Project).WithMany().HasForeignKey(x => x.ProjectId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne(x => x.Volunteer).WithMany().HasForeignKey(x => x.VolunteerId).OnDelete(DeleteBehavior.Cascade);
        });

        b.Entity<ProjectVolunteer>(e =>
        {
            e.HasKey(x => new { x.ProjectId, x.VolunteerId });
            e.Property(x => x.RoleInProject).HasMaxLength(120);

            e.HasOne(x => x.Project)
                .WithMany(p => p.Volunteers)
                .HasForeignKey(x => x.ProjectId)
                .OnDelete(DeleteBehavior.Cascade);

            e.HasOne(x => x.Volunteer)
                .WithMany(v => v.Projects)
                .HasForeignKey(x => x.VolunteerId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        b.Entity<AuditEntry>(e =>
        {
            e.Property(x => x.UserName).HasMaxLength(160).IsRequired();
            e.Property(x => x.EntityType).HasMaxLength(40).IsRequired();
            e.Property(x => x.EntityLabel).HasMaxLength(300).IsRequired();
            e.HasIndex(x => x.At);
            e.HasIndex(x => x.ProjectId);
            e.HasIndex(x => x.UserId);
            e.HasIndex(x => x.OrganizationId);
        });

        b.Entity<SignedDocument>(e =>
        {
            e.Property(x => x.FileName).HasMaxLength(260).IsRequired();
            e.Property(x => x.StoredName).HasMaxLength(160).IsRequired();
            e.Property(x => x.ContentType).HasMaxLength(160).IsRequired();
            e.Property(x => x.SignerName).HasMaxLength(160);
            e.Property(x => x.SignerIp).HasMaxLength(200);
            e.Property(x => x.SignerUserAgent).HasMaxLength(400);
            e.Property(x => x.TermVersion).HasMaxLength(20);
            e.Property(x => x.ContentHash).HasMaxLength(64);
            e.HasIndex(x => x.VolunteerId);
            e.HasIndex(x => x.ProjectId);

            e.HasOne(x => x.Volunteer).WithMany().HasForeignKey(x => x.VolunteerId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne(x => x.Project).WithMany().HasForeignKey(x => x.ProjectId).OnDelete(DeleteBehavior.Cascade);
        });

        b.Entity<VolunteerStatusChange>(e =>
        {
            e.HasIndex(x => new { x.VolunteerId, x.StartsOn }).IsUnique();
            e.HasOne(x => x.Volunteer).WithMany().HasForeignKey(x => x.VolunteerId).OnDelete(DeleteBehavior.Cascade);
        });

        b.Entity<Notification>(e =>
        {
            e.Property(x => x.Message).HasMaxLength(400).IsRequired();
            e.Property(x => x.Context).HasMaxLength(200);
            e.Property(x => x.Key).HasMaxLength(120);
            e.HasIndex(x => new { x.VolunteerId, x.CreatedAt });
            e.HasIndex(x => new { x.VolunteerId, x.Key }).IsUnique().HasFilter("\"Key\" IS NOT NULL");

            e.HasOne(x => x.Volunteer).WithMany().HasForeignKey(x => x.VolunteerId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne(x => x.Project).WithMany().HasForeignKey(x => x.ProjectId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne(x => x.Activity).WithMany().HasForeignKey(x => x.ActivityId).OnDelete(DeleteBehavior.SetNull);
        });

        b.Entity<StoredFile>(e =>
        {
            e.HasKey(x => x.StoredName);
            e.Property(x => x.StoredName).HasMaxLength(160);
            e.Property(x => x.ContentType).HasMaxLength(160).IsRequired();
            e.Property(x => x.Content).IsRequired();
        });

        b.Entity<BackgroundJob>(e =>
        {
            e.Property(x => x.RequestedByName).HasMaxLength(160).IsRequired();
            e.Property(x => x.Payload).IsRequired();
            e.Property(x => x.InputStoredName).HasMaxLength(160);
            e.Property(x => x.ResultStoredName).HasMaxLength(160);
            e.Property(x => x.ResultFileName).HasMaxLength(260);
            e.Property(x => x.Error).HasMaxLength(500);
            e.Property(x => x.Stamp).IsConcurrencyToken();
            // Proxima da fila e "as minhas" na tela.
            e.HasIndex(x => new { x.Status, x.CreatedAt });
            e.HasIndex(x => new { x.RequestedByUserId, x.CreatedAt });
            e.HasOne<Organization>().WithMany().HasForeignKey(x => x.OrganizationId).OnDelete(DeleteBehavior.Cascade);
        });

        b.Entity<ProjectFile>(e =>
        {
            e.Property(x => x.FileName).HasMaxLength(260).IsRequired();
            e.Property(x => x.StoredName).HasMaxLength(160).IsRequired();
            e.Property(x => x.ContentType).HasMaxLength(160).IsRequired();
            e.Property(x => x.Description).HasMaxLength(300);
            // Fotos esperando a miniatura (o JobWorker procura por este indice).
            e.HasIndex(x => x.PreviewState);

            e.HasOne(x => x.Project)
                .WithMany(p => p.Files)
                .HasForeignKey(x => x.ProjectId)
                .OnDelete(DeleteBehavior.Cascade);

            e.HasOne(x => x.UploadedByUser)
                .WithMany()
                .HasForeignKey(x => x.UploadedByUserId)
                .OnDelete(DeleteBehavior.SetNull);

            // Excluir a atividade nao apaga o arquivo: ele continua no projeto, sem a atividade.
            e.HasOne(x => x.Activity)
                .WithMany(a => a.Attachments)
                .HasForeignKey(x => x.ActivityId)
                .OnDelete(DeleteBehavior.SetNull);

            e.HasOne(x => x.ProjectUpdate)
                .WithMany(u => u.Attachments)
                .HasForeignKey(x => x.ProjectUpdateId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        b.Entity<ProjectUpdate>(e =>
        {
            e.Property(x => x.Text).IsRequired();
            e.HasIndex(x => x.ProjectId);

            e.HasOne(x => x.Project)
                .WithMany(p => p.Updates)
                .HasForeignKey(x => x.ProjectId)
                .OnDelete(DeleteBehavior.Cascade);

            e.HasOne(x => x.AuthorUser)
                .WithMany()
                .HasForeignKey(x => x.AuthorUserId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        b.Entity<Organization>(e =>
        {
            e.Property(x => x.Name).HasMaxLength(200).IsRequired();
            e.Property(x => x.LegalName).HasMaxLength(200);
            e.Property(x => x.Cnpj).HasMaxLength(20);
            e.Property(x => x.Email).HasMaxLength(200);
            e.Property(x => x.Phone).HasMaxLength(50);
            e.Property(x => x.Website).HasMaxLength(200);
            e.Property(x => x.City).HasMaxLength(120);
            e.Property(x => x.State).HasMaxLength(60);
            e.Property(x => x.LogoUrl).HasMaxLength(500);
            e.Property(x => x.SignatoryName).HasMaxLength(160);
            e.Property(x => x.SignatoryRole).HasMaxLength(120);
            e.Property(x => x.SignatoryNote).HasMaxLength(80);
            e.Property(x => x.SignatureStoredName).HasMaxLength(160);
        });

        ApplyOrganizationFilters(b);
    }

    /// <summary>
    /// Separacao entre nucleos: toda consulta so enxerga os dados do nucleo atual (CurrentOrganizationId). Os
    /// registros que nao guardam o nucleo herdam o do projeto, do voluntario, da tarefa ou do programa a que
    /// pertencem. Arquivos (StoredFiles) ficam de fora: sao achados pelo nome unico que so o dono conhece.
    /// </summary>
    private void ApplyOrganizationFilters(ModelBuilder b)
    {
        b.Entity<Organization>().HasQueryFilter(x => AllOrganizations || x.Id == CurrentOrganizationId);
        b.Entity<User>().HasQueryFilter(x => AllOrganizations || x.OrganizationId == CurrentOrganizationId);
        b.Entity<Volunteer>().HasQueryFilter(x => AllOrganizations || x.OrganizationId == CurrentOrganizationId);
        b.Entity<ProjectProgram>().HasQueryFilter(x => AllOrganizations || x.OrganizationId == CurrentOrganizationId);
        b.Entity<Project>().HasQueryFilter(x => AllOrganizations || x.OrganizationId == CurrentOrganizationId);
        b.Entity<AuditEntry>().HasQueryFilter(x => AllOrganizations || x.OrganizationId == CurrentOrganizationId);

        b.Entity<Activity>().HasQueryFilter(x => AllOrganizations || x.Project!.OrganizationId == CurrentOrganizationId);
        b.Entity<Indicator>().HasQueryFilter(x => AllOrganizations || x.Project!.OrganizationId == CurrentOrganizationId);
        b.Entity<IndicatorValueChange>()
            .HasQueryFilter(x => AllOrganizations || x.Indicator!.Project!.OrganizationId == CurrentOrganizationId);
        b.Entity<ProjectUpdate>().HasQueryFilter(x => AllOrganizations || x.Project!.OrganizationId == CurrentOrganizationId);
        b.Entity<ProjectFile>().HasQueryFilter(x => AllOrganizations || x.Project!.OrganizationId == CurrentOrganizationId);
        b.Entity<ProjectVolunteer>().HasQueryFilter(x => AllOrganizations || x.Project!.OrganizationId == CurrentOrganizationId);
        b.Entity<ProjectHourEntry>().HasQueryFilter(x => AllOrganizations || x.Project!.OrganizationId == CurrentOrganizationId);
        b.Entity<ActivityChecklistItem>()
            .HasQueryFilter(x => AllOrganizations || x.Activity!.Project!.OrganizationId == CurrentOrganizationId);
        b.Entity<ActivityComment>()
            .HasQueryFilter(x => AllOrganizations || x.Activity!.Project!.OrganizationId == CurrentOrganizationId);

        b.Entity<VolunteerStatusChange>()
            .HasQueryFilter(x => AllOrganizations || x.Volunteer!.OrganizationId == CurrentOrganizationId);
        b.Entity<Notification>()
            .HasQueryFilter(x => AllOrganizations || x.Volunteer!.OrganizationId == CurrentOrganizationId);
        b.Entity<SignedDocument>().HasQueryFilter(x => AllOrganizations
            || (x.VolunteerId != null && x.Volunteer!.OrganizationId == CurrentOrganizationId)
            || (x.ProjectId != null && x.Project!.OrganizationId == CurrentOrganizationId));

        b.Entity<ProgramTemplateActivity>()
            .HasQueryFilter(x => AllOrganizations || x.Program!.OrganizationId == CurrentOrganizationId);
        b.Entity<ProgramTemplateIndicator>()
            .HasQueryFilter(x => AllOrganizations || x.Program!.OrganizationId == CurrentOrganizationId);
        b.Entity<ProgramPartner>()
            .HasQueryFilter(x => AllOrganizations || x.Program!.OrganizationId == CurrentOrganizationId);

        b.Entity<AccessLink>().HasQueryFilter(x => AllOrganizations || x.User!.OrganizationId == CurrentOrganizationId);
        b.Entity<BackgroundJob>().HasQueryFilter(x => AllOrganizations || x.OrganizationId == CurrentOrganizationId);
    }
}
