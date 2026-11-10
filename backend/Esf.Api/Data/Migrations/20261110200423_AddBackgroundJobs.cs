using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Esf.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddBackgroundJobs : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "BackgroundJobs",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    OrganizationId = table.Column<Guid>(type: "uuid", nullable: false),
                    Kind = table.Column<int>(type: "integer", nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    RequestedByUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    RequestedByName = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: false),
                    RequestedByRole = table.Column<int>(type: "integer", nullable: true),
                    Payload = table.Column<string>(type: "text", nullable: false),
                    InputStoredName = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: true),
                    Result = table.Column<string>(type: "text", nullable: true),
                    ResultStoredName = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: true),
                    ResultFileName = table.Column<string>(type: "character varying(260)", maxLength: 260, nullable: true),
                    Error = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    Attempts = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    StartedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    FinishedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    LeaseUntil = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    LastSeenAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    Stamp = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_BackgroundJobs", x => x.Id);
                    table.ForeignKey(
                        name: "FK_BackgroundJobs_Organizations_OrganizationId",
                        column: x => x.OrganizationId,
                        principalTable: "Organizations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_BackgroundJobs_OrganizationId",
                table: "BackgroundJobs",
                column: "OrganizationId");

            migrationBuilder.CreateIndex(
                name: "IX_BackgroundJobs_RequestedByUserId_CreatedAt",
                table: "BackgroundJobs",
                columns: new[] { "RequestedByUserId", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_BackgroundJobs_Status_CreatedAt",
                table: "BackgroundJobs",
                columns: new[] { "Status", "CreatedAt" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "BackgroundJobs");
        }
    }
}
