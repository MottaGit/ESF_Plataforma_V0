using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Esf.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddProgramAppearance : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Color",
                table: "Programs",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "teal");

            migrationBuilder.AddColumn<string>(
                name: "Icon",
                table: "Programs",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "pin");

            // Programas que ja existem ganham um icone pelo nome (da para trocar depois na tela do programa).
            migrationBuilder.Sql("""
                UPDATE "Programs" SET "Icon" = 'banheiro', "Color" = 'blue' WHERE "Name" ILIKE '%banheiro%';
                UPDATE "Programs" SET "Icon" = 'horta', "Color" = 'green' WHERE "Name" ILIKE '%horta%';
                UPDATE "Programs" SET "Icon" = 'evento', "Color" = 'orange' WHERE "Name" ILIKE '%evento%';
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Color",
                table: "Programs");

            migrationBuilder.DropColumn(
                name: "Icon",
                table: "Programs");
        }
    }
}
