using Esf.Api.Domain;
using Esf.Api.Domain.Entities;
using Esf.Api.Dtos;

namespace Esf.Api.Services;

/// <summary>Conversao entre entidades e DTOs. A API nunca devolve entidades diretamente.</summary>
public static class Mapping
{
    public const string UploadsUrlPrefix = "/uploads";

    public static DateOnly Today => DateOnly.FromDateTime(DateTime.UtcNow);

    public static bool IsProjectLate(ProjectStatus status, DateOnly? endForecast) =>
        endForecast.HasValue
        && endForecast.Value < Today
        && status != ProjectStatus.Concluido
        && status != ProjectStatus.Cancelado;

    /// <summary>
    /// Progresso calculado: percentual de atividades concluidas. Projeto concluido conta como 100%
    /// mesmo sem atividades cadastradas; projeto sem atividades fica em 0%.
    /// </summary>
    public static int ProjectProgress(ProjectStatus status, int activitiesTotal, int activitiesDone)
    {
        if (status == ProjectStatus.Concluido) return 100;
        if (activitiesTotal == 0) return 0;
        return (int)Math.Round(activitiesDone * 100.0 / activitiesTotal);
    }

    public static bool IsActivityLate(ActivityStatus status, DateOnly? dueDate) =>
        dueDate.HasValue && dueDate.Value < Today && status != ActivityStatus.Concluida;

    public static UserDto ToDto(User u) =>
        new(u.Id, u.Name, u.Email, u.Role, u.IsActive, u.CreatedAt, u.VolunteerId, u.Volunteer?.Name,
            PhotoUrl(u.Volunteer?.PhotoStoredName));

    public static ActivityDto ToDto(Activity a) =>
        new(a.Id,
            a.ProjectId,
            a.Project?.Name,
            a.Title,
            a.Description,
            a.AssignedVolunteerId,
            a.AssignedVolunteer?.Name,
            a.Status,
            a.Priority,
            a.DueDate,
            a.Notes,
            IsActivityLate(a.Status, a.DueDate),
            a.CreatedAt,
            a.CompletedAt);

    public static IndicatorDto ToDto(Indicator i) =>
        new(i.Id, i.ProjectId, i.Name, i.Unit, i.Value, i.CreatedAt);

    public static VolunteerDto ToDto(Volunteer v, List<VolunteerProjectDto> projects) =>
        new(v.Id, v.Name, v.Email, v.Phone, v.Sector, v.Skills, v.Notes, v.Status, projects, v.CreatedAt,
            v.BirthDay, v.BirthMonth, PhotoUrl(v.PhotoStoredName));

    /// <summary>Endereco publico da foto de um voluntario (null quando nao ha foto).</summary>
    public static string? PhotoUrl(string? storedName) =>
        string.IsNullOrEmpty(storedName) ? null : $"{UploadsUrlPrefix}/{storedName}";

    public static VolunteerProjectDto ToProjectDto(ProjectVolunteer pv) =>
        new(pv.ProjectId,
            pv.Project?.Name ?? "Projeto removido",
            pv.Project?.Status ?? default,
            pv.Project?.Program?.Name ?? "Programa removido",
            pv.RoleInProject);

    public static ProjectVolunteerDto ToDto(ProjectVolunteer pv) =>
        new(pv.VolunteerId,
            pv.Volunteer?.Name ?? "Voluntario removido",
            pv.Volunteer?.Email,
            pv.Volunteer?.Phone,
            pv.Volunteer?.Sector ?? default,
            pv.RoleInProject,
            pv.JoinedAt,
            PhotoUrl(pv.Volunteer?.PhotoStoredName));

    public static ProjectFileDto ToDto(ProjectFile f) =>
        new(f.Id,
            f.ProjectId,
            f.FileName,
            f.ContentType,
            f.SizeBytes,
            f.Description,
            $"{UploadsUrlPrefix}/{f.StoredName}",
            f.ContentType.StartsWith("image/", StringComparison.OrdinalIgnoreCase),
            f.UploadedByUser?.Name,
            f.UploadedAt,
            f.ProjectUpdateId,
            f.ProjectUpdate?.CreatedAt);

    public static ProjectUpdateDto ToDto(ProjectUpdate u) =>
        new(u.Id,
            u.ProjectId,
            u.Text,
            u.AuthorUserId,
            u.AuthorUser?.Name,
            u.CreatedAt,
            u.EditedAt,
            u.Attachments.OrderBy(f => f.UploadedAt).Select(ToDto).ToList());

    public static OrganizationDto ToDto(Organization o) =>
        new(o.Id, o.Name, o.LegalName, o.Cnpj, o.Mission, o.About, o.Email, o.Phone, o.Website, o.City, o.State, o.LogoUrl, o.UpdatedAt);

    /// <summary>Detalhe completo do projeto, com as colecoes ja carregadas.</summary>
    public static ProjectDetailDto ToDetailDto(Project p) =>
        new(p.Id,
            p.Name,
            p.Description,
            p.ProgramId,
            p.Program!.Name,
            p.Status,
            p.OwnerVolunteerId,
            p.OwnerVolunteer?.Name,
            p.Objective,
            p.Beneficiaries,
            p.TargetAudience,
            p.Notes,
            p.Address,
            p.District,
            p.City,
            p.State,
            p.Latitude,
            p.Longitude,
            p.StartDate,
            p.EndDateForecast,
            IsProjectLate(p.Status, p.EndDateForecast),
            p.IsArchived,
            p.CreatedAt,
            p.UpdatedAt,
            p.Activities
                .OrderBy(a => a.Status)
                .ThenByDescending(a => a.Priority)
                .ThenBy(a => a.DueDate ?? DateOnly.MaxValue)
                .Select(ToDto).ToList(),
            p.Volunteers.OrderBy(v => v.Volunteer!.Name).Select(ToDto).ToList(),
            p.Indicators.OrderBy(i => i.CreatedAt).Select(ToDto).ToList(),
            // Todos os arquivos do projeto, inclusive as fotos publicadas nas atualizacoes.
            p.Files.OrderByDescending(f => f.UploadedAt).Select(ToDto).ToList(),
            p.Updates.OrderByDescending(u => u.CreatedAt).Select(ToDto).ToList());
}
