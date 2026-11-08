using Esf.Api.Common;
using Esf.Api.Reports;
using Xunit;

namespace Esf.Api.Tests;

/// <summary>
/// O servidor roda em UTC, que vira o dia as 21 h de Brasilia. Datas mostradas e "hoje" seguem o horario de Brasilia.
/// </summary>
public class BrasiliaTimeTests
{
    [Fact]
    public void LateEveningStaysOnTheSameDay()
    {
        // 23:30 de 08/11 em Brasilia = 02:30 de 09/11 em UTC.
        var utc = new DateTime(2026, 11, 9, 2, 30, 0, DateTimeKind.Utc);

        Assert.Equal(new DateOnly(2026, 11, 8), TextHelpers.BrasiliaDay(utc));
        Assert.Equal(new DateTime(2026, 11, 8, 23, 30, 0), TextHelpers.BrasiliaTime(utc));
    }

    [Fact]
    public void DayStartsAtThreeUtc()
    {
        Assert.Equal(new DateTime(2026, 11, 8, 3, 0, 0, DateTimeKind.Utc),
            TextHelpers.BrasiliaDayStartUtc(new DateOnly(2026, 11, 8)));
    }

    [Fact]
    public void ReportPeriodUsesTheBrasiliaDay()
    {
        var model = new ReportModel { From = new DateOnly(2026, 11, 1), To = new DateOnly(2026, 11, 8) };

        // Registro das 23:30 do dia 08 (Brasilia) entra; o das 00:30 do dia 09 nao.
        Assert.True(model.InPeriod(new DateTime(2026, 11, 9, 2, 30, 0, DateTimeKind.Utc)));
        Assert.False(model.InPeriod(new DateTime(2026, 11, 9, 3, 30, 0, DateTimeKind.Utc)));
        // 22:00 do dia 31/10 (Brasilia) ainda e outubro, mesmo sendo 01/11 em UTC.
        Assert.False(model.InPeriod(new DateTime(2026, 11, 1, 1, 0, 0, DateTimeKind.Utc)));
    }
}
