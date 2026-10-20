using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Esf.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddProgramTemplate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "TemplateDescription",
                table: "Programs",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "TemplateObjective",
                table: "Programs",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "TemplateTargetAudience",
                table: "Programs",
                type: "character varying(300)",
                maxLength: 300,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "ProgramTemplateActivities",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ProgramId = table.Column<Guid>(type: "uuid", nullable: false),
                    Position = table.Column<int>(type: "integer", nullable: false),
                    Title = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Description = table.Column<string>(type: "text", nullable: true),
                    Priority = table.Column<int>(type: "integer", nullable: false),
                    DueDays = table.Column<int>(type: "integer", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ProgramTemplateActivities", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ProgramTemplateActivities_Programs_ProgramId",
                        column: x => x.ProgramId,
                        principalTable: "Programs",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ProgramTemplateIndicators",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ProgramId = table.Column<Guid>(type: "uuid", nullable: false),
                    Position = table.Column<int>(type: "integer", nullable: false),
                    Name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Unit = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ProgramTemplateIndicators", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ProgramTemplateIndicators_Programs_ProgramId",
                        column: x => x.ProgramId,
                        principalTable: "Programs",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ProgramTemplateActivities_ProgramId_Position",
                table: "ProgramTemplateActivities",
                columns: new[] { "ProgramId", "Position" });

            migrationBuilder.CreateIndex(
                name: "IX_ProgramTemplateIndicators_ProgramId_Position",
                table: "ProgramTemplateIndicators",
                columns: new[] { "ProgramId", "Position" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ProgramTemplateActivities");

            migrationBuilder.DropTable(
                name: "ProgramTemplateIndicators");

            migrationBuilder.DropColumn(
                name: "TemplateDescription",
                table: "Programs");

            migrationBuilder.DropColumn(
                name: "TemplateObjective",
                table: "Programs");

            migrationBuilder.DropColumn(
                name: "TemplateTargetAudience",
                table: "Programs");
        }
    }
}
