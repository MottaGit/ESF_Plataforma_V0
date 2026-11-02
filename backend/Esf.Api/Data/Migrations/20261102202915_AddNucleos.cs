using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Esf.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddNucleos : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Programs_Name",
                table: "Programs");

            // As colunas entram vazias, recebem o nucleo que ja existe e so depois viram obrigatorias.
            foreach (var table in new[] { "Volunteers", "Users", "Projects", "Programs", "AuditEntries" })
            {
                migrationBuilder.AddColumn<Guid>(
                    name: "OrganizationId",
                    table: table,
                    type: "uuid",
                    nullable: true);
            }

            // Banco com dados de antes dos nucleos e sem registro institucional: cria um nucleo para guardar tudo.
            migrationBuilder.Sql("""
                INSERT INTO "Organizations" ("Id", "Name", "UpdatedAt")
                SELECT gen_random_uuid(), 'Engenheiros Sem Fronteiras', now()
                WHERE NOT EXISTS (SELECT 1 FROM "Organizations")
                  AND (EXISTS (SELECT 1 FROM "Users") OR EXISTS (SELECT 1 FROM "Volunteers")
                       OR EXISTS (SELECT 1 FROM "Programs"));
                """);

            // Tudo o que ja existia passa a ser do nucleo atual (o mesmo registro que os termos e certificados usavam).
            foreach (var table in new[] { "Volunteers", "Users", "Projects", "Programs", "AuditEntries" })
            {
                migrationBuilder.Sql($"""
                    UPDATE "{table}"
                    SET "OrganizationId" = (SELECT "Id" FROM "Organizations" ORDER BY "UpdatedAt" LIMIT 1)
                    WHERE "OrganizationId" IS NULL;
                    """);
            }

            foreach (var table in new[] { "Volunteers", "Projects", "Programs" })
            {
                migrationBuilder.AlterColumn<Guid>(
                    name: "OrganizationId",
                    table: table,
                    type: "uuid",
                    nullable: false,
                    oldClrType: typeof(Guid),
                    oldType: "uuid",
                    oldNullable: true);
            }

            migrationBuilder.CreateIndex(
                name: "IX_Volunteers_OrganizationId",
                table: "Volunteers",
                column: "OrganizationId");

            migrationBuilder.CreateIndex(
                name: "IX_Users_OrganizationId",
                table: "Users",
                column: "OrganizationId");

            migrationBuilder.CreateIndex(
                name: "IX_Projects_OrganizationId",
                table: "Projects",
                column: "OrganizationId");

            migrationBuilder.CreateIndex(
                name: "IX_Programs_OrganizationId_Name",
                table: "Programs",
                columns: new[] { "OrganizationId", "Name" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_AuditEntries_OrganizationId",
                table: "AuditEntries",
                column: "OrganizationId");

            migrationBuilder.AddForeignKey(
                name: "FK_Programs_Organizations_OrganizationId",
                table: "Programs",
                column: "OrganizationId",
                principalTable: "Organizations",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Projects_Organizations_OrganizationId",
                table: "Projects",
                column: "OrganizationId",
                principalTable: "Organizations",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Users_Organizations_OrganizationId",
                table: "Users",
                column: "OrganizationId",
                principalTable: "Organizations",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Volunteers_Organizations_OrganizationId",
                table: "Volunteers",
                column: "OrganizationId",
                principalTable: "Organizations",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Programs_Organizations_OrganizationId",
                table: "Programs");

            migrationBuilder.DropForeignKey(
                name: "FK_Projects_Organizations_OrganizationId",
                table: "Projects");

            migrationBuilder.DropForeignKey(
                name: "FK_Users_Organizations_OrganizationId",
                table: "Users");

            migrationBuilder.DropForeignKey(
                name: "FK_Volunteers_Organizations_OrganizationId",
                table: "Volunteers");

            migrationBuilder.DropIndex(
                name: "IX_Volunteers_OrganizationId",
                table: "Volunteers");

            migrationBuilder.DropIndex(
                name: "IX_Users_OrganizationId",
                table: "Users");

            migrationBuilder.DropIndex(
                name: "IX_Projects_OrganizationId",
                table: "Projects");

            migrationBuilder.DropIndex(
                name: "IX_Programs_OrganizationId_Name",
                table: "Programs");

            migrationBuilder.DropIndex(
                name: "IX_AuditEntries_OrganizationId",
                table: "AuditEntries");

            migrationBuilder.DropColumn(
                name: "OrganizationId",
                table: "Volunteers");

            migrationBuilder.DropColumn(
                name: "OrganizationId",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "OrganizationId",
                table: "Projects");

            migrationBuilder.DropColumn(
                name: "OrganizationId",
                table: "Programs");

            migrationBuilder.DropColumn(
                name: "OrganizationId",
                table: "AuditEntries");

            migrationBuilder.CreateIndex(
                name: "IX_Programs_Name",
                table: "Programs",
                column: "Name",
                unique: true);
        }
    }
}
