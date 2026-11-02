using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Esf.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddIndicadoresNacionais : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "NationalIndicatorId",
                table: "ProgramTemplateIndicators",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "NationalIndicatorId",
                table: "Indicators",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "NationalIndicators",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Unit = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: true),
                    Description = table.Column<string>(type: "character varying(600)", maxLength: 600, nullable: true),
                    IsArchived = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_NationalIndicators", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ProgramTemplateIndicators_NationalIndicatorId",
                table: "ProgramTemplateIndicators",
                column: "NationalIndicatorId");

            migrationBuilder.CreateIndex(
                name: "IX_Indicators_NationalIndicatorId",
                table: "Indicators",
                column: "NationalIndicatorId");

            migrationBuilder.CreateIndex(
                name: "IX_NationalIndicators_Name",
                table: "NationalIndicators",
                column: "Name",
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_Indicators_NationalIndicators_NationalIndicatorId",
                table: "Indicators",
                column: "NationalIndicatorId",
                principalTable: "NationalIndicators",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_ProgramTemplateIndicators_NationalIndicators_NationalIndica~",
                table: "ProgramTemplateIndicators",
                column: "NationalIndicatorId",
                principalTable: "NationalIndicators",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Indicators_NationalIndicators_NationalIndicatorId",
                table: "Indicators");

            migrationBuilder.DropForeignKey(
                name: "FK_ProgramTemplateIndicators_NationalIndicators_NationalIndica~",
                table: "ProgramTemplateIndicators");

            migrationBuilder.DropTable(
                name: "NationalIndicators");

            migrationBuilder.DropIndex(
                name: "IX_ProgramTemplateIndicators_NationalIndicatorId",
                table: "ProgramTemplateIndicators");

            migrationBuilder.DropIndex(
                name: "IX_Indicators_NationalIndicatorId",
                table: "Indicators");

            migrationBuilder.DropColumn(
                name: "NationalIndicatorId",
                table: "ProgramTemplateIndicators");

            migrationBuilder.DropColumn(
                name: "NationalIndicatorId",
                table: "Indicators");
        }
    }
}
