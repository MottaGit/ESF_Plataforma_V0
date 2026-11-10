using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Esf.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class ProgramIndicatorTargets : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // A meta passa a ser so do programa: sai a de cada projeto.
            migrationBuilder.DropColumn(
                name: "Target",
                table: "Indicators");

            // No modelo, a meta era "por projeto" (ex.: 1 banheiro) e agora e do programa todo (ex.: 55): a antiga
            // nao vale mais como meta do programa.
            migrationBuilder.Sql("""UPDATE "ProgramTemplateIndicators" SET "Target" = NULL;""");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "Target",
                table: "Indicators",
                type: "numeric(18,2)",
                precision: 18,
                scale: 2,
                nullable: true);
        }
    }
}
