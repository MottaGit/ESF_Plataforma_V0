using Esf.Api.Common;
using Esf.Api.Data;
using Esf.Api.Domain.Entities;
using Esf.Api.Dtos;
using Esf.Api.Reports;
using Microsoft.EntityFrameworkCore;

namespace Esf.Api.Services;

/// <summary>Certificado de participacao no voluntariado, gerado na hora (nada fica salvo).</summary>
public class CertificateService
{
    private static readonly HashSet<string> ImageExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ".png", ".jpg", ".jpeg", ".webp"
    };

    private readonly EsfDbContext _db;
    private readonly FileStorageService _storage;

    public CertificateService(EsfDbContext db, FileStorageService storage)
    {
        _db = db;
        _storage = storage;
    }

    /// <summary>
    /// Total de horas do periodo: semanas (dias corridos, contando o primeiro e o ultimo) vezes a carga semanal,
    /// arredondado para baixo. De 07/10 a 31/12/2025 sao 86 dias = 12,3 semanas; com 6 h/semana, 73 horas.
    /// </summary>
    public static int TotalHours(DateOnly start, DateOnly end, int weeklyHours) =>
        (int)Math.Floor((end.DayNumber - start.DayNumber + 1) / 7.0 * weeklyHours);

    public async Task<(byte[] Content, string FileName)> GenerateAsync(Guid volunteerId, CertificateRequest request)
    {
        var volunteer = await _db.Volunteers.AsNoTracking().FirstOrDefaultAsync(v => v.Id == volunteerId)
                        ?? throw AppException.NotFound("Voluntario");

        var start = request.StartDate!.Value;
        var end = request.EndDate!.Value;
        if (end < start) throw new AppException("O fim do periodo nao pode ser antes do inicio.");

        var org = await _db.Organizations.AsNoTracking().OrderBy(o => o.UpdatedAt).FirstOrDefaultAsync()
                  ?? new Organization { Name = "Engenheiros Sem Fronteiras" };

        var model = new CertificateModel(
            org.Name,
            org.Cnpj,
            org.City,
            volunteer.Name,
            FormatCpf(request.Cpf),
            request.WeeklyHours,
            TextHelpers.LongDate(start),
            TextHelpers.LongDate(end),
            TotalHours(start, end, request.WeeklyHours),
            org.SignatoryName,
            org.SignatoryRole,
            org.SignatoryNote,
            await ImageAsync(org.SignatureStoredName),
            await ImageAsync(org.LogoUrl?.Split('/').Last()));

        return (CertificateBuilder.Build(model), $"certificado-{TextHelpers.Slug(volunteer.Name)}.pdf");
    }

    /// <summary>11 digitos viram 000.000.000-00; qualquer outra coisa vai como foi digitada.</summary>
    private static string? FormatCpf(string? cpf)
    {
        if (string.IsNullOrWhiteSpace(cpf)) return null;
        var digits = new string(cpf.Where(char.IsDigit).ToArray());
        return digits.Length == 11
            ? $"{digits[..3]}.{digits[3..6]}.{digits[6..9]}-{digits[9..]}"
            : cpf.Trim();
    }

    private async Task<byte[]?> ImageAsync(string? storedName) =>
        string.IsNullOrWhiteSpace(storedName) || !ImageExtensions.Contains(Path.GetExtension(storedName))
            ? null
            : await _storage.TryReadAsync(storedName);
}
