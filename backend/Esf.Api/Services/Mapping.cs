using Esf.Api.Common;
using Esf.Api.Domain;
using Esf.Api.Domain.Entities;
using Esf.Api.Dtos;
using Esf.Api.Reports;

namespace Esf.Api.Services;

/// <summary>Conversao entre entidades e DTOs. A API nunca devolve entidades diretamente.</summary>
public static class Mapping
{
    public const string UploadsUrlPrefix = "/uploads";

    /// <summary>Hoje no horario de Brasilia (o servidor roda em UTC, que ja vira o dia as 21 h).</summary>
    public static DateOnly Today => TextHelpers.BrasiliaDay(DateTime.UtcNow);

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
            PhotoUrl(u.Volunteer?.PhotoStoredName), u.TermsVersion != PrivacyTerms.CurrentVersion,
            u.PasswordHash.Length == 0, u.OrganizationId, u.IsNational);

    public static ActivityDto ToDto(Activity a) => ToDto(a, null);

    /// <summary>Com o resumo do checklist e dos anexos (sem ele, os contadores vao zerados).</summary>
    public static ActivityDto ToDto(Activity a, ActivityCounts? counts) =>
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
            IsActivityLate(a.Status, a.DueDate),
            a.CreatedAt,
            a.CompletedAt,
            PhotoUrl(a.AssignedVolunteer?.PhotoStoredName),
            a.BlockedReason,
            a.Project?.ProgramId,
            a.Project?.Program?.Name,
            counts?.ChecklistTotal ?? 0,
            counts?.ChecklistDone ?? 0,
            counts?.Attachments ?? 0,
            counts?.Comments ?? 0,
            a.Project?.Program?.Icon,
            a.Project?.Program?.Color,
            a.Kind,
            a.VisitShift,
            a.VisitTime,
            a.CompanionVolunteerId,
            a.CompanionVolunteer?.Name,
            PhotoUrl(a.CompanionVolunteer?.PhotoStoredName));

    public static IndicatorDto ToDto(Indicator i) =>
        new(i.Id, i.ProjectId, i.Name, i.Unit, i.Value, i.CreatedAt, i.NationalIndicatorId, i.ValueUpdatedAt);

    /// <summary>withAvailability: bairro, deslocamento e turnos (so para a coordenacao e para a propria pessoa).</summary>
    public static VolunteerDto ToDto(Volunteer v, List<VolunteerProjectDto> projects, DateOnly? termSignedOn = null,
        VolunteerAccessDto? access = null, bool withAvailability = false) =>
        new(v.Id, v.Name, v.Email, v.Phone, v.Sector, v.Skills, v.Notes, v.Status, projects, v.CreatedAt,
            v.BirthDay, v.BirthMonth, PhotoUrl(v.PhotoStoredName), termSignedOn, v.AnonymizedAt != null, access,
            withAvailability ? ToAvailabilityDto(v) : null);

    public static VolunteerAvailabilityDto ToAvailabilityDto(Volunteer v) =>
        new(v.HomeDistrict,
            v.HomeCity,
            v.HomeLatitude.HasValue && v.HomeLongitude.HasValue,
            v.Transport,
            VolunteerAvailability.ToSlots(v.AvailabilityMask),
            v.AvailabilityUpdatedAt,
            v.HomeLatitude,
            v.HomeLongitude);

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
            pv.Volunteer?.Name ?? "Voluntário removido",
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
            PersonName(f.UploadedByUser),
            f.UploadedAt,
            f.ProjectUpdateId,
            f.ProjectUpdate?.CreatedAt,
            f.ActivityId,
            f.Activity?.Title,
            f.PreviewState == PreviewState.Ready ? $"{UploadsUrlPrefix}/{ImagePreviews.ThumbnailName(f.StoredName)}" : null);

    public static ProjectUpdateDto ToDto(ProjectUpdate u) =>
        new(u.Id,
            u.ProjectId,
            u.Text,
            u.AuthorUserId,
            PersonName(u.AuthorUser),
            u.CreatedAt,
            u.EditedAt,
            u.Attachments.OrderBy(f => f.UploadedAt).Select(ToDto).ToList(),
            PhotoUrl(u.AuthorUser?.Volunteer?.PhotoStoredName),
            u.Day);

    /// <summary>
    /// Nome exibido de quem fez algo na plataforma: o do voluntario vinculado ao acesso; sem vinculo, o do
    /// proprio usuario. Requer a navegacao User.Volunteer carregada.
    /// </summary>
    public static string? PersonName(User? user) => user?.Volunteer?.Name ?? user?.Name;

    public static OrganizationDto ToDto(Organization o) =>
        new(o.Id, o.Name, o.LegalName, o.Cnpj, o.Mission, o.About, o.Email, o.Phone, o.Website, o.City, o.State, o.LogoUrl,
            o.UpdatedAt, o.SignatoryName, o.SignatoryRole, o.SignatoryNote, o.SignatureStoredName != null);

    /// <summary>Detalhe do projeto, com tarefas, equipe e indicadores ja carregados.</summary>
    public static ProjectDetailDto ToDetailDto(Project p, int updatesCount, int filesCount,
        DateOnly? imageAuthorizedOn = null, IReadOnlyDictionary<Guid, ActivityCounts>? counts = null) =>
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
                .Select(a => ToDto(a, counts?.GetValueOrDefault(a.Id))).ToList(),
            p.Volunteers.OrderBy(v => v.Volunteer!.Name).Select(ToDto).ToList(),
            // Nacionais primeiro (iguais em todo projeto), depois os especificos na ordem em que foram criados.
            p.Indicators.OrderBy(i => i.NationalIndicatorId == null).ThenBy(i => i.CreatedAt).ThenBy(i => i.Name)
                .Select(ToDto).ToList(),
            updatesCount,
            // Todos os arquivos do projeto, inclusive as fotos publicadas nos registros.
            filesCount,
            imageAuthorizedOn,
            p.Program.Icon,
            p.Program.Color,
            p.ClosedOn);
}
