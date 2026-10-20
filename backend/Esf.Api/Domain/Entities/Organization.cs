namespace Esf.Api.Domain.Entities;

/// <summary>Dados institucionais. A V0 mantem um unico registro.</summary>
public class Organization
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Name { get; set; } = string.Empty;
    public string? LegalName { get; set; }
    public string? Cnpj { get; set; }
    public string? Mission { get; set; }
    public string? About { get; set; }
    public string? Email { get; set; }
    public string? Phone { get; set; }
    public string? Website { get; set; }
    public string? City { get; set; }
    public string? State { get; set; }
    /// <summary>Caminho relativo do logo enviado (ex.: /uploads/logo.png).</summary>
    public string? LogoUrl { get; set; }

    /// <summary>Quem assina pela organizacao nos termos e certificados (ex.: Diretora Geral).</summary>
    public string? SignatoryName { get; set; }
    public string? SignatoryRole { get; set; }
    /// <summary>Linha abaixo do cargo no certificado (ex.: Gestao 2025).</summary>
    public string? SignatoryNote { get; set; }
    /// <summary>Imagem da assinatura usada nos certificados (arquivo privado).</summary>
    public string? SignatureStoredName { get; set; }
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
