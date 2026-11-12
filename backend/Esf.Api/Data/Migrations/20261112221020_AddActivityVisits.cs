using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Esf.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddActivityVisits : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "CompanionVolunteerId",
                table: "Activities",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "Kind",
                table: "Activities",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "VisitShift",
                table: "Activities",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "VisitTime",
                table: "Activities",
                type: "character varying(5)",
                maxLength: 5,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Activities_CompanionVolunteerId",
                table: "Activities",
                column: "CompanionVolunteerId");

            migrationBuilder.AddForeignKey(
                name: "FK_Activities_Volunteers_CompanionVolunteerId",
                table: "Activities",
                column: "CompanionVolunteerId",
                principalTable: "Volunteers",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Activities_Volunteers_CompanionVolunteerId",
                table: "Activities");

            migrationBuilder.DropIndex(
                name: "IX_Activities_CompanionVolunteerId",
                table: "Activities");

            migrationBuilder.DropColumn(
                name: "CompanionVolunteerId",
                table: "Activities");

            migrationBuilder.DropColumn(
                name: "Kind",
                table: "Activities");

            migrationBuilder.DropColumn(
                name: "VisitShift",
                table: "Activities");

            migrationBuilder.DropColumn(
                name: "VisitTime",
                table: "Activities");
        }
    }
}
