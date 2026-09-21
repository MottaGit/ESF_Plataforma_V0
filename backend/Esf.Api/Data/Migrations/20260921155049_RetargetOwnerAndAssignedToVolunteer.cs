using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Esf.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class RetargetOwnerAndAssignedToVolunteer : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Activities_Users_AssignedUserId",
                table: "Activities");

            migrationBuilder.DropForeignKey(
                name: "FK_Projects_Users_OwnerUserId",
                table: "Projects");

            migrationBuilder.RenameColumn(
                name: "OwnerUserId",
                table: "Projects",
                newName: "OwnerVolunteerId");

            migrationBuilder.RenameIndex(
                name: "IX_Projects_OwnerUserId",
                table: "Projects",
                newName: "IX_Projects_OwnerVolunteerId");

            migrationBuilder.RenameColumn(
                name: "AssignedUserId",
                table: "Activities",
                newName: "AssignedVolunteerId");

            migrationBuilder.RenameIndex(
                name: "IX_Activities_AssignedUserId",
                table: "Activities",
                newName: "IX_Activities_AssignedVolunteerId");

            migrationBuilder.AddForeignKey(
                name: "FK_Activities_Volunteers_AssignedVolunteerId",
                table: "Activities",
                column: "AssignedVolunteerId",
                principalTable: "Volunteers",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_Projects_Volunteers_OwnerVolunteerId",
                table: "Projects",
                column: "OwnerVolunteerId",
                principalTable: "Volunteers",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Activities_Volunteers_AssignedVolunteerId",
                table: "Activities");

            migrationBuilder.DropForeignKey(
                name: "FK_Projects_Volunteers_OwnerVolunteerId",
                table: "Projects");

            migrationBuilder.RenameColumn(
                name: "OwnerVolunteerId",
                table: "Projects",
                newName: "OwnerUserId");

            migrationBuilder.RenameIndex(
                name: "IX_Projects_OwnerVolunteerId",
                table: "Projects",
                newName: "IX_Projects_OwnerUserId");

            migrationBuilder.RenameColumn(
                name: "AssignedVolunteerId",
                table: "Activities",
                newName: "AssignedUserId");

            migrationBuilder.RenameIndex(
                name: "IX_Activities_AssignedVolunteerId",
                table: "Activities",
                newName: "IX_Activities_AssignedUserId");

            migrationBuilder.AddForeignKey(
                name: "FK_Activities_Users_AssignedUserId",
                table: "Activities",
                column: "AssignedUserId",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_Projects_Users_OwnerUserId",
                table: "Projects",
                column: "OwnerUserId",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }
    }
}
