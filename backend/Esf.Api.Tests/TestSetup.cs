using System.Runtime.CompilerServices;

namespace Esf.Api.Tests;

/// <summary>
/// Configuracao unica do projeto de testes, antes de qualquer teste (como o Program.cs faz na API). Antes, so o
/// DemoDataTests ligava a licenca do QuestPDF e os testes que geram PDF dependiam da ordem em que rodavam.
/// </summary>
internal static class TestSetup
{
    [ModuleInitializer]
    internal static void Initialize()
    {
        QuestPDF.Settings.License = QuestPDF.Infrastructure.LicenseType.Community;
        QuestPDF.Settings.CheckIfAllTextGlyphsAreAvailable = false;
    }
}
