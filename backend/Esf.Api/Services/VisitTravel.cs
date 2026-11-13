using Esf.Api.Domain;

namespace Esf.Api.Services;

/// <summary>
/// Tempo estimado de casa ate a obra, a partir da distancia em linha reta e do meio de transporte da pessoa. Nao e a
/// rota: e uma ordem de grandeza para comparar quem chega mais rapido (nao conhece pico, linhas, baldeacao nem pontes).
/// A reta vira distancia pelas ruas por um fator de desvio e depois tempo, com a velocidade media e o tempo fixo de
/// cada meio. Os numeros sao medias tipicas de cidade grande brasileira, fora do horario de pico; para calibrar com
/// trajetos conhecidos do nucleo, e so mudar as constantes abaixo.
/// </summary>
public static class VisitTravel
{
    /// <summary>Quanto o caminho pelas ruas e maior que a reta (cidades brasileiras ficam entre 1,3 e 1,4).</summary>
    public const double CarDetour = 1.35;

    /// <summary>A linha de onibus anda mais que o carro: desvia para passar pelas paradas e corredores.</summary>
    public const double BusDetour = 1.4;

    public const double WalkDetour = 1.3;

    /// <summary>Media urbana de carro fora do pico, com sinaleiras e transito comum.</summary>
    public const double CarKmh = 30;

    /// <summary>Velocidade comercial do onibus, contando as paradas.</summary>
    public const double BusKmh = 20;

    public const double WalkKmh = 4.5;

    /// <summary>Sair com o carro e estacionar perto da obra.</summary>
    public const double CarFixedMinutes = 5;

    /// <summary>Ir ate a parada e esperar o onibus (mais a caminhada do ponto ate a obra).</summary>
    public const double BusFixedMinutes = 15;

    /// <summary>
    /// Minutos estimados e o meio considerado. Sem o meio informado, conta como transporte publico (o caso mais lento).
    /// De transporte publico, quando andar e mais rapido (ate uns 1,5 km), conta a pe.
    /// </summary>
    public static (int Minutes, TravelMode Mode) Estimate(double straightKm, TransportMode? transport)
    {
        if (transport == TransportMode.Carro)
            return (Minutes(straightKm * CarDetour / CarKmh * 60 + CarFixedMinutes), TravelMode.Carro);

        var bus = straightKm * BusDetour / BusKmh * 60 + BusFixedMinutes;
        var walk = straightKm * WalkDetour / WalkKmh * 60;
        return walk <= bus
            ? (Minutes(walk), TravelMode.APe)
            : (Minutes(bus), TravelMode.TransportePublico);
    }

    private static int Minutes(double value) => Math.Max(1, (int)Math.Round(value));
}
