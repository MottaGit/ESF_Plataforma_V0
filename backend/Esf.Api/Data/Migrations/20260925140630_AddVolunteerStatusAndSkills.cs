using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Esf.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddVolunteerStatusAndSkills : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Skills",
                table: "Volunteers",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "Status",
                table: "Volunteers",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            // Preserva os dados existentes: IsActive=true -> Ativo (0), IsActive=false -> Inativo (1).
            migrationBuilder.Sql(
                "UPDATE \"Volunteers\" SET \"Status\" = CASE WHEN \"IsActive\" THEN 0 ELSE 1 END;");

            migrationBuilder.DropColumn(
                name: "IsActive",
                table: "Volunteers");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "IsActive",
                table: "Volunteers",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.Sql(
                "UPDATE \"Volunteers\" SET \"IsActive\" = (\"Status\" = 0);");

            migrationBuilder.DropColumn(
                name: "Skills",
                table: "Volunteers");

            migrationBuilder.DropColumn(
                name: "Status",
                table: "Volunteers");
        }
    }
}
