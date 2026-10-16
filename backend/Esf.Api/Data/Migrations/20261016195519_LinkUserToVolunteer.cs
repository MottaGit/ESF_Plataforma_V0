using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Esf.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class LinkUserToVolunteer : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "VolunteerId",
                table: "Users",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Users_VolunteerId",
                table: "Users",
                column: "VolunteerId",
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_Users_Volunteers_VolunteerId",
                table: "Users",
                column: "VolunteerId",
                principalTable: "Volunteers",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            // Vincula acessos existentes ao voluntario de mesmo e-mail (so quando ha exatamente um).
            migrationBuilder.Sql("""
                UPDATE "Users" u
                SET "VolunteerId" = v."Id"
                FROM "Volunteers" v
                WHERE u."VolunteerId" IS NULL
                  AND v."Email" IS NOT NULL
                  AND lower(v."Email") = lower(u."Email")
                  AND (SELECT count(*) FROM "Volunteers" v2 WHERE lower(v2."Email") = lower(u."Email")) = 1;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Users_Volunteers_VolunteerId",
                table: "Users");

            migrationBuilder.DropIndex(
                name: "IX_Users_VolunteerId",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "VolunteerId",
                table: "Users");
        }
    }
}
