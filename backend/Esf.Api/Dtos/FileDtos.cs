namespace Esf.Api.Dtos;

public record ProjectFileDto(
    Guid Id,
    Guid ProjectId,
    string FileName,
    string ContentType,
    long SizeBytes,
    string? Description,
    string Url,
    bool IsImage,
    string? UploadedByName,
    DateTime UploadedAt);
