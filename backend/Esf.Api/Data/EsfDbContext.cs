using Esf.Api.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace Esf.Api.Data;

public class EsfDbContext : DbContext
{
    public EsfDbContext(DbContextOptions<EsfDbContext> options) : base(options) { }

    public DbSet<User> Users => Set<User>();
    public DbSet<Volunteer> Volunteers => Set<Volunteer>();
    public DbSet<Project> Projects => Set<Project>();
    public DbSet<Activity> Activities => Set<Activity>();
    public DbSet<Indicator> Indicators => Set<Indicator>();
    public DbSet<ProjectVolunteer> ProjectVolunteers => Set<ProjectVolunteer>();
    public DbSet<ProjectFile> ProjectFiles => Set<ProjectFile>();
    public DbSet<ProjectUpdate> ProjectUpdates => Set<ProjectUpdate>();
    public DbSet<Organization> Organizations => Set<Organization>();

    protected override void OnModelCreating(ModelBuilder b)
    {
        base.OnModelCreating(b);

        b.Entity<User>(e =>
        {
            e.Property(x => x.Name).HasMaxLength(160).IsRequired();
            e.Property(x => x.Email).HasMaxLength(200).IsRequired();
            e.Property(x => x.PasswordHash).HasMaxLength(300).IsRequired();
            e.HasIndex(x => x.Email).IsUnique();
        });

        b.Entity<Volunteer>(e =>
        {
            e.Property(x => x.Name).HasMaxLength(160).IsRequired();
            e.Property(x => x.Email).HasMaxLength(200);
            e.Property(x => x.Phone).HasMaxLength(40);
            e.HasIndex(x => x.Name);
            e.HasIndex(x => x.Sector);
        });

        b.Entity<Project>(e =>
        {
            e.Property(x => x.Name).HasMaxLength(200).IsRequired();
            e.Property(x => x.Category).HasMaxLength(80).IsRequired();
            e.Property(x => x.Beneficiaries).HasMaxLength(300);
            e.Property(x => x.TargetAudience).HasMaxLength(300);
            e.Property(x => x.Address).HasMaxLength(300);
            e.Property(x => x.District).HasMaxLength(120);
            e.Property(x => x.City).HasMaxLength(120);
            e.Property(x => x.State).HasMaxLength(60);
            e.HasIndex(x => x.Status);
            e.HasIndex(x => x.Name);

            e.HasOne(x => x.OwnerVolunteer)
                .WithMany()
                .HasForeignKey(x => x.OwnerVolunteerId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        b.Entity<Activity>(e =>
        {
            e.Property(x => x.Title).HasMaxLength(200).IsRequired();

            e.HasOne(x => x.Project)
                .WithMany(p => p.Activities)
                .HasForeignKey(x => x.ProjectId)
                .OnDelete(DeleteBehavior.Cascade);

            e.HasOne(x => x.AssignedVolunteer)
                .WithMany()
                .HasForeignKey(x => x.AssignedVolunteerId)
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

        b.Entity<ProjectFile>(e =>
        {
            e.Property(x => x.FileName).HasMaxLength(260).IsRequired();
            e.Property(x => x.StoredName).HasMaxLength(160).IsRequired();
            e.Property(x => x.ContentType).HasMaxLength(160).IsRequired();
            e.Property(x => x.Description).HasMaxLength(300);

            e.HasOne(x => x.Project)
                .WithMany(p => p.Files)
                .HasForeignKey(x => x.ProjectId)
                .OnDelete(DeleteBehavior.Cascade);

            e.HasOne(x => x.UploadedByUser)
                .WithMany()
                .HasForeignKey(x => x.UploadedByUserId)
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
            e.Property(x => x.Email).HasMaxLength(200);
            e.Property(x => x.Phone).HasMaxLength(50);
            e.Property(x => x.Website).HasMaxLength(200);
            e.Property(x => x.City).HasMaxLength(120);
            e.Property(x => x.State).HasMaxLength(60);
            e.Property(x => x.LogoUrl).HasMaxLength(500);
        });
    }
}
