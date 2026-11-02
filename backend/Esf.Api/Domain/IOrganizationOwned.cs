namespace Esf.Api.Domain;

/// <summary>
/// Registro que pertence a um nucleo (Organization). As consultas so enxergam os do nucleo de quem esta logado
/// (filtro global no EsfDbContext), e um registro novo entra sozinho nesse nucleo ao salvar.
/// </summary>
public interface IOrganizationOwned
{
    Guid OrganizationId { get; set; }
}
