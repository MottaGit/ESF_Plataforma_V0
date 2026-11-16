using Esf.Api.Domain;

namespace Esf.Api.Common;

/// <summary>Nome de cada tipo de registro de andamento, como aparece no historico e no nome da pasta do Drive.</summary>
public static class UpdateKinds
{
    public static string Label(ProjectUpdateKind kind) => kind switch
    {
        ProjectUpdateKind.VisitaTecnica => "Visita técnica",
        ProjectUpdateKind.Obra => "Obra",
        ProjectUpdateKind.AcaoComunidade => "Ação com a comunidade",
        _ => "Entrega final"
    };
}
