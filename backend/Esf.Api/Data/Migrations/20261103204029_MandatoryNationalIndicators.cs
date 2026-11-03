using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Esf.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class MandatoryNationalIndicators : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<decimal>(
                name: "Value",
                table: "Indicators",
                type: "numeric(18,2)",
                precision: 18,
                scale: 2,
                nullable: true,
                oldClrType: typeof(decimal),
                oldType: "numeric(18,2)",
                oldPrecision: 18,
                oldScale: 2);

            // Todo projeto passa a ter os indicadores nacionais ativos: o que faltava entra em branco (nao informado).
            migrationBuilder.Sql("""
                INSERT INTO "Indicators" ("Id", "ProjectId", "NationalIndicatorId", "Name", "Unit", "Value", "CreatedAt")
                SELECT gen_random_uuid(), p."Id", n."Id", n."Name", n."Unit", NULL, now()
                FROM "Projects" p
                CROSS JOIN "NationalIndicators" n
                WHERE NOT n."IsArchived"
                  AND NOT EXISTS (
                      SELECT 1 FROM "Indicators" i
                      WHERE i."ProjectId" = p."Id" AND i."NationalIndicatorId" = n."Id");
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Voltar a exigir valor: o que estava em branco vira zero.
            migrationBuilder.Sql("""UPDATE "Indicators" SET "Value" = 0 WHERE "Value" IS NULL;""");

            migrationBuilder.AlterColumn<decimal>(
                name: "Value",
                table: "Indicators",
                type: "numeric(18,2)",
                precision: 18,
                scale: 2,
                nullable: false,
                defaultValue: 0m,
                oldClrType: typeof(decimal),
                oldType: "numeric(18,2)",
                oldPrecision: 18,
                oldScale: 2,
                oldNullable: true);
        }
    }
}
