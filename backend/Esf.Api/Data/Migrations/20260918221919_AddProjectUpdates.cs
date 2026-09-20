using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Esf.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddProjectUpdates : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "ProjectUpdateId",
                table: "ProjectFiles",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "ProjectUpdates",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ProjectId = table.Column<Guid>(type: "uuid", nullable: false),
                    Text = table.Column<string>(type: "text", nullable: false),
                    AuthorUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    EditedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ProjectUpdates", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ProjectUpdates_Projects_ProjectId",
                        column: x => x.ProjectId,
                        principalTable: "Projects",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ProjectUpdates_Users_AuthorUserId",
                        column: x => x.AuthorUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ProjectFiles_ProjectUpdateId",
                table: "ProjectFiles",
                column: "ProjectUpdateId");

            migrationBuilder.CreateIndex(
                name: "IX_ProjectUpdates_AuthorUserId",
                table: "ProjectUpdates",
                column: "AuthorUserId");

            migrationBuilder.CreateIndex(
                name: "IX_ProjectUpdates_ProjectId",
                table: "ProjectUpdates",
                column: "ProjectId");

            migrationBuilder.AddForeignKey(
                name: "FK_ProjectFiles_ProjectUpdates_ProjectUpdateId",
                table: "ProjectFiles",
                column: "ProjectUpdateId",
                principalTable: "ProjectUpdates",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_ProjectFiles_ProjectUpdates_ProjectUpdateId",
                table: "ProjectFiles");

            migrationBuilder.DropTable(
                name: "ProjectUpdates");

            migrationBuilder.DropIndex(
                name: "IX_ProjectFiles_ProjectUpdateId",
                table: "ProjectFiles");

            migrationBuilder.DropColumn(
                name: "ProjectUpdateId",
                table: "ProjectFiles");
        }
    }
}
