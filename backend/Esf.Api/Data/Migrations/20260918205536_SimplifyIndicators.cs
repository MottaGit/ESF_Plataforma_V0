using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Esf.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class SimplifyIndicators : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "PlannedValue",
                table: "Indicators");

            migrationBuilder.DropColumn(
                name: "Description",
                table: "Indicators");

            migrationBuilder.RenameColumn(
                name: "ActualValue",
                table: "Indicators",
                newName: "Value");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.RenameColumn(
                name: "Value",
                table: "Indicators",
                newName: "ActualValue");

            migrationBuilder.AddColumn<decimal>(
                name: "PlannedValue",
                table: "Indicators",
                type: "numeric(18,2)",
                precision: 18,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<string>(
                name: "Description",
                table: "Indicators",
                type: "text",
                nullable: true);
        }
    }
}
