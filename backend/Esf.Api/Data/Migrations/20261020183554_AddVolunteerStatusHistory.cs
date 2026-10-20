using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Esf.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddVolunteerStatusHistory : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "VolunteerStatusChanges",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    VolunteerId = table.Column<Guid>(type: "uuid", nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: true),
                    StartsOn = table.Column<DateOnly>(type: "date", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_VolunteerStatusChanges", x => x.Id);
                    table.ForeignKey(
                        name: "FK_VolunteerStatusChanges_Volunteers_VolunteerId",
                        column: x => x.VolunteerId,
                        principalTable: "Volunteers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_VolunteerStatusChanges_VolunteerId_StartsOn",
                table: "VolunteerStatusChanges",
                columns: new[] { "VolunteerId", "StartsOn" },
                unique: true);

            // Voluntarios ja cadastrados: o status atual desde a data do cadastro (a coordenacao acerta depois).
            migrationBuilder.Sql("""
                INSERT INTO "VolunteerStatusChanges" ("Id", "VolunteerId", "Status", "StartsOn", "CreatedAt")
                SELECT gen_random_uuid(), "Id", "Status", ("CreatedAt" AT TIME ZONE 'UTC')::date, now()
                FROM "Volunteers";
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "VolunteerStatusChanges");
        }
    }
}
