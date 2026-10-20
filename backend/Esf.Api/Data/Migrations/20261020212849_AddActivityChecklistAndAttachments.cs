using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Esf.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddActivityChecklistAndAttachments : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "ActivityId",
                table: "ProjectFiles",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "ActivityChecklistItems",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ActivityId = table.Column<Guid>(type: "uuid", nullable: false),
                    Position = table.Column<int>(type: "integer", nullable: false),
                    Text = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    Done = table.Column<bool>(type: "boolean", nullable: false),
                    DoneAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ActivityChecklistItems", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ActivityChecklistItems_Activities_ActivityId",
                        column: x => x.ActivityId,
                        principalTable: "Activities",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ProjectFiles_ActivityId",
                table: "ProjectFiles",
                column: "ActivityId");

            migrationBuilder.CreateIndex(
                name: "IX_ActivityChecklistItems_ActivityId_Position",
                table: "ActivityChecklistItems",
                columns: new[] { "ActivityId", "Position" });

            migrationBuilder.AddForeignKey(
                name: "FK_ProjectFiles_Activities_ActivityId",
                table: "ProjectFiles",
                column: "ActivityId",
                principalTable: "Activities",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_ProjectFiles_Activities_ActivityId",
                table: "ProjectFiles");

            migrationBuilder.DropTable(
                name: "ActivityChecklistItems");

            migrationBuilder.DropIndex(
                name: "IX_ProjectFiles_ActivityId",
                table: "ProjectFiles");

            migrationBuilder.DropColumn(
                name: "ActivityId",
                table: "ProjectFiles");
        }
    }
}
