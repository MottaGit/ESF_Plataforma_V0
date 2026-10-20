using Esf.Api.Domain;
using Esf.Api.Services;

namespace Esf.Api.Dtos;

public record AuditEntryDto(
    Guid Id,
    DateTime At,
    Guid? UserId,
    // Nome atual de quem fez (voluntario vinculado ou usuario).
    string UserName,
    AuditAction Action,
    string EntityType,
    Guid EntityId,
    string EntityLabel,
    Guid? ProjectId,
    string? ProjectName,
    List<AuditChange> Changes);

public record AuditPageDto(List<AuditEntryDto> Items, bool HasMore);

public class AuditQuery
{
    public Guid? ProjectId { get; set; }
    public Guid? UserId { get; set; }
    public string? EntityType { get; set; }
    public DateOnly? From { get; set; }
    public DateOnly? To { get; set; }
    public int Page { get; set; } = 1;
}
