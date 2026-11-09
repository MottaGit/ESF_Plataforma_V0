using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Esf.Api.Data.Migrations
{
    /// <summary>
    /// Ficha do programa: os textos sugeridos do modelo viram o "o que faz", o objetivo e o "para quem" do programa, e
    /// o "Sobre o programa" da pagina publica, quando havia, passa a ser o "o que faz" (ele foi escrito para quem e de
    /// fora). Nada se perde, a nao ser a descricao sugerida dos programas que tinham os dois textos.
    /// </summary>
    public partial class ProgramSheet : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.RenameColumn(
                name: "TemplateTargetAudience",
                table: "Programs",
                newName: "Audience");

            migrationBuilder.RenameColumn(
                name: "TemplateObjective",
                table: "Programs",
                newName: "Objective");

            migrationBuilder.RenameColumn(
                name: "TemplateDescription",
                table: "Programs",
                newName: "Description");

            // O texto da pagina publica (antes de apagar a coluna) vale mais que a descricao sugerida.
            migrationBuilder.Sql(
                "UPDATE \"Programs\" SET \"Description\" = \"PublicDescription\" " +
                "WHERE \"PublicDescription\" IS NOT NULL AND btrim(\"PublicDescription\") <> '';");

            migrationBuilder.DropColumn(
                name: "PublicDescription",
                table: "Programs");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "PublicDescription",
                table: "Programs",
                type: "character varying(1500)",
                maxLength: 1500,
                nullable: true);

            migrationBuilder.Sql(
                "UPDATE \"Programs\" SET \"PublicDescription\" = left(\"Description\", 1500) WHERE \"Description\" IS NOT NULL;");

            migrationBuilder.RenameColumn(
                name: "Objective",
                table: "Programs",
                newName: "TemplateObjective");

            migrationBuilder.RenameColumn(
                name: "Description",
                table: "Programs",
                newName: "TemplateDescription");

            migrationBuilder.RenameColumn(
                name: "Audience",
                table: "Programs",
                newName: "TemplateTargetAudience");
        }
    }
}
