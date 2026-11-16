using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Esf.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddGoogleDrive : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "DriveConnectedAt",
                table: "Organizations",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "DriveFolderId",
                table: "Organizations",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "DriveFolderName",
                table: "Organizations",
                type: "character varying(300)",
                maxLength: 300,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "DriveItems",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    OrganizationId = table.Column<Guid>(type: "uuid", nullable: false),
                    Kind = table.Column<int>(type: "integer", nullable: false),
                    EntityId = table.Column<Guid>(type: "uuid", nullable: false),
                    Key = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    DriveId = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    ParentDriveId = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    Name = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: true),
                    PhotosFolderId = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    OtherPhotosFolderId = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    DocumentsFolderId = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    State = table.Column<int>(type: "integer", nullable: false),
                    Attempts = table.Column<int>(type: "integer", nullable: false),
                    NextAttemptAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    LastError = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    LeaseUntil = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    Stamp = table.Column<Guid>(type: "uuid", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DriveItems", x => x.Id);
                    table.ForeignKey(
                        name: "FK_DriveItems_Organizations_OrganizationId",
                        column: x => x.OrganizationId,
                        principalTable: "Organizations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "DriveSyncRequests",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    OrganizationId = table.Column<Guid>(type: "uuid", nullable: false),
                    Kind = table.Column<int>(type: "integer", nullable: false),
                    EntityId = table.Column<Guid>(type: "uuid", nullable: false),
                    Key = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    Delete = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DriveSyncRequests", x => x.Id);
                    table.ForeignKey(
                        name: "FK_DriveSyncRequests_Organizations_OrganizationId",
                        column: x => x.OrganizationId,
                        principalTable: "Organizations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_DriveItems_Kind_EntityId_Key",
                table: "DriveItems",
                columns: new[] { "Kind", "EntityId", "Key" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_DriveItems_OrganizationId",
                table: "DriveItems",
                column: "OrganizationId");

            migrationBuilder.CreateIndex(
                name: "IX_DriveItems_State_NextAttemptAt",
                table: "DriveItems",
                columns: new[] { "State", "NextAttemptAt" });

            migrationBuilder.CreateIndex(
                name: "IX_DriveSyncRequests_CreatedAt",
                table: "DriveSyncRequests",
                column: "CreatedAt");

            migrationBuilder.CreateIndex(
                name: "IX_DriveSyncRequests_OrganizationId",
                table: "DriveSyncRequests",
                column: "OrganizationId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "DriveItems");

            migrationBuilder.DropTable(
                name: "DriveSyncRequests");

            migrationBuilder.DropColumn(
                name: "DriveConnectedAt",
                table: "Organizations");

            migrationBuilder.DropColumn(
                name: "DriveFolderId",
                table: "Organizations");

            migrationBuilder.DropColumn(
                name: "DriveFolderName",
                table: "Organizations");
        }
    }
}
