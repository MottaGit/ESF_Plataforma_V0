using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Esf.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddIndicatorValueChanges : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "IndicatorValueChanges",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    IndicatorId = table.Column<Guid>(type: "uuid", nullable: false),
                    Value = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: true),
                    ChangedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_IndicatorValueChanges", x => x.Id);
                    table.ForeignKey(
                        name: "FK_IndicatorValueChanges_Indicators_IndicatorId",
                        column: x => x.IndicatorId,
                        principalTable: "Indicators",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_IndicatorValueChanges_IndicatorId_ChangedAt",
                table: "IndicatorValueChanges",
                columns: new[] { "IndicatorId", "ChangedAt" });

            // O historico comeca com o valor de hoje de cada indicador informado, valendo desde a ultima mudanca
            // conhecida (ou desde a criacao do indicador, quando ela nao foi registrada).
            migrationBuilder.Sql("""
                INSERT INTO "IndicatorValueChanges" ("Id", "IndicatorId", "Value", "ChangedAt")
                SELECT gen_random_uuid(), i."Id", i."Value", COALESCE(i."ValueUpdatedAt", i."CreatedAt")
                FROM "Indicators" i
                WHERE i."Value" IS NOT NULL;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "IndicatorValueChanges");
        }
    }
}
