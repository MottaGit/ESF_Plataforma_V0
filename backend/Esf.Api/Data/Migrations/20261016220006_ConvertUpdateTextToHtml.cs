using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Esf.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class ConvertUpdateTextToHtml : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Relatos passam a ser texto formatado (HTML). Os antigos, em texto puro, viram um paragrafo
            // por linha, com &, < e > escapados para continuarem aparecendo exatamente como foram escritos.
            migrationBuilder.Sql("""
                UPDATE "ProjectUpdates"
                SET "Text" = '<p>' || replace(
                        replace(replace(replace(replace("Text", E'\r\n', E'\n'), '&', '&amp;'), '<', '&lt;'), '>', '&gt;'),
                        E'\n', '</p><p>') || '</p>'
                WHERE "Text" NOT LIKE '<%';
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Volta ao texto puro: paragrafos viram quebras de linha e as demais marcacoes sao removidas.
            migrationBuilder.Sql("""
                UPDATE "ProjectUpdates"
                SET "Text" = replace(replace(replace(
                        regexp_replace(replace("Text", '</p><p>', E'\n'), '<[^>]+>', '', 'g'),
                        '&lt;', '<'), '&gt;', '>'), '&amp;', '&');
                """);
        }
    }
}
