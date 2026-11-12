namespace Esf.Api.Domain.Entities;

public class Volunteer : IOrganizationOwned
{
    public Guid Id { get; set; } = Guid.NewGuid();

    /// <summary>Nucleo do voluntario: cada pessoa e de um nucleo so.</summary>
    public Guid OrganizationId { get; set; }

    public string Name { get; set; } = string.Empty;
    public string? Email { get; set; }
    public string? Phone { get; set; }
    /// <summary>Setor interno da organizacao ao qual o voluntario pertence.</summary>
    public VolunteerSector Sector { get; set; }
    /// <summary>Competencias e habilidades do voluntario.</summary>
    public string? Skills { get; set; }
    public string? Notes { get; set; }
    public VolunteerStatus Status { get; set; } = VolunteerStatus.Ativo;

    /// <summary>Aniversario: so dia e mes (o ano nao e guardado). Ambos preenchidos ou ambos vazios.</summary>
    public int? BirthDay { get; set; }
    public int? BirthMonth { get; set; }

    /// <summary>Foto (ja recortada em quadrado pelo navegador), gravada no armazenamento de arquivos.</summary>
    public string? PhotoStoredName { get; set; }

    /// <summary>Bairro e cidade onde mora (nunca o endereco): servem para sugerir quem vai a uma visita.</summary>
    public string? HomeDistrict { get; set; }
    public string? HomeCity { get; set; }

    /// <summary>Ponto aproximado do bairro (o centro dele no mapa), para calcular a distancia ate a obra.</summary>
    public double? HomeLatitude { get; set; }
    public double? HomeLongitude { get; set; }

    public TransportMode? Transport { get; set; }

    /// <summary>
    /// Turnos em que a pessoa costuma estar livre: um bit por dia e turno (ver VolunteerAvailability). Zero: nada
    /// marcado.
    /// </summary>
    public int AvailabilityMask { get; set; }

    /// <summary>Quando bairro, deslocamento ou turnos foram salvos pela ultima vez (vazio: nunca preenchidos).</summary>
    public DateTime? AvailabilityUpdatedAt { get; set; }

    /// <summary>
    /// Quando os dados pessoais foram anonimizados (pedido do titular ou saida da organizacao): nome generico,
    /// sem contatos, foto nem aniversario. Projetos, atividades e documentos assinados continuam.
    /// </summary>
    public DateTime? AnonymizedAt { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<ProjectVolunteer> Projects { get; set; } = new List<ProjectVolunteer>();
}
