using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Esf.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class OnlineVolunteerTerm : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ContentHash",
                table: "SignedDocuments",
                type: "character varying(64)",
                maxLength: 64,
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "ImageAuthorized",
                table: "SignedDocuments",
                type: "boolean",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "SignedAt",
                table: "SignedDocuments",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "SignerIp",
                table: "SignedDocuments",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "SignerName",
                table: "SignedDocuments",
                type: "character varying(160)",
                maxLength: 160,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "SignerUserAgent",
                table: "SignedDocuments",
                type: "character varying(400)",
                maxLength: 400,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "TermVersion",
                table: "SignedDocuments",
                type: "character varying(20)",
                maxLength: 20,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ContentHash",
                table: "SignedDocuments");

            migrationBuilder.DropColumn(
                name: "ImageAuthorized",
                table: "SignedDocuments");

            migrationBuilder.DropColumn(
                name: "SignedAt",
                table: "SignedDocuments");

            migrationBuilder.DropColumn(
                name: "SignerIp",
                table: "SignedDocuments");

            migrationBuilder.DropColumn(
                name: "SignerName",
                table: "SignedDocuments");

            migrationBuilder.DropColumn(
                name: "SignerUserAgent",
                table: "SignedDocuments");

            migrationBuilder.DropColumn(
                name: "TermVersion",
                table: "SignedDocuments");
        }
    }
}
