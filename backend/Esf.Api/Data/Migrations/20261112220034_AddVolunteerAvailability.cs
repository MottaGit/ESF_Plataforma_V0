using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Esf.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddVolunteerAvailability : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "AvailabilityMask",
                table: "Volunteers",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<DateTime>(
                name: "AvailabilityUpdatedAt",
                table: "Volunteers",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "HomeCity",
                table: "Volunteers",
                type: "character varying(120)",
                maxLength: 120,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "HomeDistrict",
                table: "Volunteers",
                type: "character varying(120)",
                maxLength: 120,
                nullable: true);

            migrationBuilder.AddColumn<double>(
                name: "HomeLatitude",
                table: "Volunteers",
                type: "double precision",
                nullable: true);

            migrationBuilder.AddColumn<double>(
                name: "HomeLongitude",
                table: "Volunteers",
                type: "double precision",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "Transport",
                table: "Volunteers",
                type: "integer",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "AvailabilityMask",
                table: "Volunteers");

            migrationBuilder.DropColumn(
                name: "AvailabilityUpdatedAt",
                table: "Volunteers");

            migrationBuilder.DropColumn(
                name: "HomeCity",
                table: "Volunteers");

            migrationBuilder.DropColumn(
                name: "HomeDistrict",
                table: "Volunteers");

            migrationBuilder.DropColumn(
                name: "HomeLatitude",
                table: "Volunteers");

            migrationBuilder.DropColumn(
                name: "HomeLongitude",
                table: "Volunteers");

            migrationBuilder.DropColumn(
                name: "Transport",
                table: "Volunteers");
        }
    }
}
