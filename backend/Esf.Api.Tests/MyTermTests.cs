using System.Security.Cryptography;
using Esf.Api.Common;
using Esf.Api.Data;
using Esf.Api.Domain;
using Esf.Api.Domain.Entities;
using Esf.Api.Dtos;
using Esf.Api.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace Esf.Api.Tests;

/// <summary>
/// Termo de adesao assinado online pelo proprio voluntario: precisa do aceite, da resposta sobre imagem, do nome igual
/// ao do cadastro e de um CPF valido; gera o PDF com o registro da assinatura, assina uma vez so e a coordenacao ve.
/// </summary>
public class MyTermTests
{
    private const string Cpf = "529.982.247-25";

    private static FileStorageService Storage(EsfDbContext db) => new(db, Options.Create(new StorageOptions()));

    /// <summary>Da acesso (perfil Usuario) ao voluntario "Sem acesso" do nucleo e devolve quem fica logado.</summary>
    private static async Task<TestUser> VolunteerLoginAsync(TwoNucleos f, Nucleo nucleo)
    {
        await using var db = f.SystemContext();
        var user = new User
        {
            OrganizationId = nucleo.OrganizationId,
            Name = "Sem acesso",
            Email = "sem.acesso@teste.org",
            Role = UserRole.Usuario,
            VolunteerId = nucleo.VolunteerWithoutAccessId
        };
        db.Users.Add(user);
        db.VolunteerStatusChanges.Add(new VolunteerStatusChange
        {
            VolunteerId = nucleo.VolunteerWithoutAccessId,
            Status = VolunteerStatus.Ativo,
            StartsOn = DateOnly.FromDateTime(DateTime.UtcNow).AddDays(-20)
        });
        await db.SaveChangesAsync();
        return new TestUser { Id = user.Id, Name = user.Name, Role = UserRole.Usuario, OrganizationId = nucleo.OrganizationId };
    }

    private static SignTermRequest Request(string name = "sem ACESSO  a", string cpf = Cpf, bool? image = true,
        bool accepted = true) =>
        new() { FullName = name, Cpf = cpf, ImageAuthorized = image, Accepted = accepted };

    private static async Task<MyTermDto> SignAsync(TwoNucleos f, TestUser user, SignTermRequest request)
    {
        await using var db = f.Context(user);
        return await new MyTermService(db, Storage(db), user).SignAsync(request, "203.0.113.7", "Teste/1.0");
    }

    [Fact]
    public async Task VolunteerReadsSignsAndDownloadsTheTerm()
    {
        var f = await TwoNucleos.CreateAsync();
        var user = await VolunteerLoginAsync(f, f.A);

        await using (var db = f.Context(user))
        {
            var before = await new MyTermService(db, Storage(db), user).GetAsync();
            Assert.True(before.Pending);
            Assert.Null(before.Signed);
            Assert.Equal(7, before.Text.Clauses.Count);
            Assert.Contains("Nucleo A", before.Text.Opening);
        }

        var after = await SignAsync(f, user, Request());
        Assert.False(after.Pending);
        Assert.True(after.Signed!.SignedOnline);
        Assert.True(after.Signed.ImageAuthorized);

        await using (var db = f.Context(user))
        {
            var (content, contentType, fileName) = await new MyTermService(db, Storage(db), user).DownloadAsync();
            Assert.Equal("application/pdf", contentType);
            Assert.Equal("termo-de-adesao-sem-acesso-a-assinado.pdf", fileName);

            var document = await db.SignedDocuments.SingleAsync(d => d.VolunteerId == f.A.VolunteerWithoutAccessId);
            Assert.Equal("Sem acesso a", document.SignerName);
            Assert.Equal("203.0.113.7", document.SignerIp);
            Assert.Equal("Teste/1.0", document.SignerUserAgent);
            Assert.Equal(user.Id, document.UploadedByUserId);
            Assert.Equal(Convert.ToHexString(SHA256.HashData(content)).ToLowerInvariant(), document.ContentHash);
        }

        // A coordenacao ve o termo assinado na pagina do voluntario.
        await using (var db = f.Context(f.A.Admin))
        {
            var list = await new SignedDocumentService(db, Storage(db), f.A.Admin).ListForVolunteerAsync(f.A.VolunteerWithoutAccessId);
            var signed = Assert.Single(list);
            Assert.True(signed.SignedOnline);
            Assert.NotNull(signed.SignedAt);
            var volunteer = await new VolunteerService(db, Storage(db), new NotificationService(db, f.A.Admin)).GetAsync(f.A.VolunteerWithoutAccessId);
            Assert.NotNull(volunteer.TermSignedOn);
        }
    }

    [Theory]
    [InlineData("Outra Pessoa", Cpf, true, true, "nome completo")]
    [InlineData("Sem acesso a", "123.456.789-00", true, true, "CPF")]
    [InlineData("Sem acesso a", "111.111.111-11", true, true, "CPF")]
    [InlineData("Sem acesso a", Cpf, null, true, "imagem")]
    [InlineData("Sem acesso a", Cpf, true, false, "concorda")]
    public async Task IncompleteSignatureIsRefused(string name, string cpf, bool? image, bool accepted, string message)
    {
        var f = await TwoNucleos.CreateAsync();
        var user = await VolunteerLoginAsync(f, f.A);

        var error = await Assert.ThrowsAsync<AppException>(() => SignAsync(f, user, Request(name, cpf, image, accepted)));

        Assert.Contains(message, error.Message);
        await using var db = f.Context(user);
        Assert.False(await db.SignedDocuments.AnyAsync(d => d.VolunteerId == f.A.VolunteerWithoutAccessId));
    }

    [Fact]
    public async Task TermIsSignedOnlyOnce()
    {
        var f = await TwoNucleos.CreateAsync();
        var user = await VolunteerLoginAsync(f, f.A);
        await SignAsync(f, user, Request(image: false));

        var error = await Assert.ThrowsAsync<AppException>(() => SignAsync(f, user, Request()));

        Assert.Contains("já está assinado", error.Message);
    }

    [Fact]
    public async Task TermAlreadyUploadedByTheCoordinationIsNotPending()
    {
        var f = await TwoNucleos.CreateAsync();
        // O administrador do nucleo esta ligado ao voluntario que ja tem o termo enviado (arquivo).
        await using var db = f.Context(f.A.Admin);

        var term = await new MyTermService(db, Storage(db), f.A.Admin).GetAsync();

        Assert.False(term.Pending);
        Assert.False(term.Signed!.SignedOnline);
    }

    [Fact]
    public async Task AccessWithoutVolunteerHasNoTerm()
    {
        var f = await TwoNucleos.CreateAsync();
        var national = new TestUser { Id = Guid.NewGuid(), IsNational = true };
        await using var db = f.Context(national);

        await Assert.ThrowsAsync<AppException>(() => new MyTermService(db, Storage(db), national).GetAsync());
    }

    [Theory]
    [InlineData("52998224725", "529.982.247-25")]
    [InlineData("529.982.247-25", "529.982.247-25")]
    [InlineData("529.982.247-24", null)]
    [InlineData("000.000.000-00", null)]
    [InlineData("1234", null)]
    public void CpfIsChecked(string value, string? expected) => Assert.Equal(expected, MyTermService.FormatCpf(value));
}
