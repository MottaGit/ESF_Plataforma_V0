using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Esf.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddVolunteerPhoto : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "PhotoStoredName",
                table: "Volunteers",
                type: "character varying(160)",
                maxLength: 160,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "PhotoStoredName",
                table: "Volunteers");
        }
    }
}
