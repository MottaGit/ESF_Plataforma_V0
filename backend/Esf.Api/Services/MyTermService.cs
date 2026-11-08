using System.Security.Cryptography;
using System.Text.RegularExpressions;
using Esf.Api.Common;
using Esf.Api.Data;
using Esf.Api.Domain;
using Esf.Api.Domain.Entities;
using Esf.Api.Dtos;
using Esf.Api.Reports;
using Microsoft.EntityFrameworkCore;

namespace Esf.Api.Services;

/// <summary>
/// Termo de adesao do proprio voluntario, na conta dele: ler, assinar online (assinatura eletronica simples: conta
/// logada + "li e concordo" + nome completo digitado + CPF) e baixar a via assinada. A assinatura gera o PDF na hora,
/// com o registro no fim, e guarda junto o momento, o endereco de rede, o navegador, a versao do texto e o SHA-256 do
/// arquivo.
/// </summary>
public partial class MyTermService
{
    private readonly EsfDbContext _db;
    private readonly FileStorageService _storage;
    private readonly ICurrentUser _currentUser;

    public MyTermService(EsfDbContext db, FileStorageService storage, ICurrentUser currentUser)
    {
        _db = db;
        _storage = storage;
        _currentUser = currentUser;
    }

    public async Task<MyTermDto> GetAsync()
    {
        var (_, volunteer) = await MineAsync();
        return await ToDtoAsync(volunteer);
    }

    /// <param name="ip">Endereco de rede de quem assinou (com os repassados pelo proxy).</param>
    /// <param name="userAgent">Navegador de quem assinou.</param>
    public async Task<MyTermDto> SignAsync(SignTermRequest request, string? ip, string? userAgent)
    {
        var (user, volunteer) = await MineAsync();
        if (volunteer.AnonymizedAt is not null) throw new AppException("Os dados deste voluntário foram anonimizados.");
        if (await TermsOf(volunteer.Id).AnyAsync())
            throw new AppException("Seu termo de adesão já está assinado. Para trocar, fale com a coordenação.");

        if (!request.Accepted) throw new AppException("Para assinar, marque que leu e concorda com o termo.");
        if (request.ImageAuthorized is null) throw new AppException("Responda se autoriza ou não o uso da sua imagem (cláusula 6).");
        if (Normalize(request.FullName) != Normalize(volunteer.Name))
            throw new AppException($"Digite o nome completo exatamente como está no cadastro: {volunteer.Name}.");
        var cpf = FormatCpf(request.Cpf) ?? throw new AppException("Informe um CPF válido (11 números).");

        var org = await _db.Organizations.AsNoTracking().OrderBy(o => o.UpdatedAt).FirstOrDefaultAsync()
                  ?? new Organization { Name = "Engenheiros Sem Fronteiras" };

        var now = DateTime.UtcNow;
        var document = new SignedDocument { Kind = SignedDocumentKind.VolunteerTerm, VolunteerId = volunteer.Id };
        var pdf = DocumentTemplates.VolunteerTerm(org, volunteer, new TermSignature(
            document.Id,
            volunteer.Name,
            cpf,
            user.Email,
            now,
            Truncate(ip, 200),
            request.ImageAuthorized.Value));

        var saved = _storage.SaveGenerated(pdf, ".pdf", isPrivate: true);
        document.FileName = $"termo-de-adesao-{TextHelpers.Slug(volunteer.Name)}-assinado.pdf";
        document.StoredName = saved.StoredName;
        document.ContentType = saved.ContentType;
        document.SizeBytes = saved.Size;
        document.SignedOn = TextHelpers.BrasiliaDay(now);
        document.UploadedAt = now;
        document.UploadedByUserId = user.Id;
        document.SignerName = volunteer.Name;
        document.SignedAt = now;
        document.SignerIp = Truncate(ip, 200);
        document.SignerUserAgent = Truncate(userAgent, 400);
        document.TermVersion = DocumentTemplates.VolunteerTermVersion;
        document.ContentHash = Convert.ToHexString(SHA256.HashData(pdf)).ToLowerInvariant();
        document.ImageAuthorized = request.ImageAuthorized;

        _db.SignedDocuments.Add(document);
        await _db.SaveChangesAsync();
        return await ToDtoAsync(volunteer);
    }

    /// <summary>Via mais recente do termo do proprio voluntario (assinada online ou enviada pela coordenacao).</summary>
    public async Task<(byte[] Content, string ContentType, string FileName)> DownloadAsync()
    {
        var (_, volunteer) = await MineAsync();
        var document = await TermsOf(volunteer.Id).FirstOrDefaultAsync() ?? throw AppException.NotFound("Termo assinado");
        var content = await _storage.TryReadAsync(document.StoredName) ?? throw AppException.NotFound("Conteúdo do documento");
        return (content, FileStorageService.ContentTypeFor(document.StoredName), document.FileName);
    }

    /// <summary>CPF valido (digitos verificadores) no formato 000.000.000-00; null quando nao e valido.</summary>
    public static string? FormatCpf(string? value)
    {
        var digits = new string((value ?? string.Empty).Where(char.IsDigit).ToArray());
        if (digits.Length != 11 || digits.Distinct().Count() == 1) return null;
        for (var length = 9; length <= 10; length++)
        {
            var sum = 0;
            for (var i = 0; i < length; i++) sum += (digits[i] - '0') * (length + 1 - i);
            var check = sum * 10 % 11 % 10;
            if (check != digits[length] - '0') return null;
        }
        return $"{digits[..3]}.{digits[3..6]}.{digits[6..9]}-{digits[9..]}";
    }

    // ---------- internos ----------

    private async Task<(User User, Volunteer Volunteer)> MineAsync()
    {
        var userId = _currentUser.RequireId();
        var user = await _db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userId) ?? throw AppException.NotFound("Usuário");
        var volunteer = user.VolunteerId is null
            ? null
            : await _db.Volunteers.AsNoTracking().FirstOrDefaultAsync(v => v.Id == user.VolunteerId);
        return (user, volunteer ?? throw new AppException("Seu acesso não está ligado a um voluntário.", 404));
    }

    private IQueryable<SignedDocument> TermsOf(Guid volunteerId) =>
        _db.SignedDocuments
            .Where(d => d.VolunteerId == volunteerId && d.Kind == SignedDocumentKind.VolunteerTerm)
            .OrderByDescending(d => d.SignedOn)
            .ThenByDescending(d => d.UploadedAt);

    private async Task<MyTermDto> ToDtoAsync(Volunteer volunteer)
    {
        var signed = await TermsOf(volunteer.Id)
            .AsNoTracking()
            .Select(d => new MyTermSignedDto(d.SignedOn, d.SignedAt, d.SignerName != null, d.ImageAuthorized))
            .FirstOrDefaultAsync();
        var org = await _db.Organizations.AsNoTracking().OrderBy(o => o.UpdatedAt).FirstOrDefaultAsync()
                  ?? new Organization { Name = "Engenheiros Sem Fronteiras" };

        return new MyTermDto(
            volunteer.Name,
            volunteer.Email,
            volunteer.Phone,
            Pending: signed is null && volunteer.AnonymizedAt is null
                     && volunteer.Status is VolunteerStatus.Ativo or VolunteerStatus.Afastado,
            signed,
            DocumentTemplates.VolunteerTermContent(org, volunteer));
    }

    /// <summary>Nome para comparar: sem acento, minusculas e espacos simples.</summary>
    private static string Normalize(string? value) =>
        Spaces().Replace(SearchText.Fold(value ?? string.Empty), " ").Trim();

    private static string? Truncate(string? value, int max) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Length > max ? value[..max] : value.Trim();

    [GeneratedRegex(@"\s+")]
    private static partial Regex Spaces();
}
