using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Esf.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddProjectProgramEntity : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Programs",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Programs", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Programs_Name",
                table: "Programs",
                column: "Name",
                unique: true);

            // ProgramId comeca aceitando nulo para poder ser preenchido a partir do Category existente
            // antes de virar obrigatorio - assim nenhum projeto fica com uma referencia invalida.
            migrationBuilder.AddColumn<Guid>(
                name: "ProgramId",
                table: "Projects",
                type: "uuid",
                nullable: true);

            // Um Program por valor distinto de Category ja usado.
            migrationBuilder.Sql(
                "INSERT INTO \"Programs\" (\"Id\", \"Name\", \"Status\", \"CreatedAt\") " +
                "SELECT gen_random_uuid(), c.\"Category\", 0, now() " +
                "FROM (SELECT DISTINCT \"Category\" FROM \"Projects\" WHERE \"Category\" IS NOT NULL AND \"Category\" <> '') AS c;");

            // Aponta cada projeto para o Program com o mesmo nome da sua Category atual.
            migrationBuilder.Sql(
                "UPDATE \"Projects\" p SET \"ProgramId\" = prog.\"Id\" " +
                "FROM \"Programs\" prog " +
                "WHERE prog.\"Name\" = p.\"Category\";");

            migrationBuilder.AlterColumn<Guid>(
                name: "ProgramId",
                table: "Projects",
                type: "uuid",
                nullable: false,
                oldClrType: typeof(Guid),
                oldType: "uuid",
                oldNullable: true);

            migrationBuilder.DropColumn(
                name: "Category",
                table: "Projects");

            migrationBuilder.CreateIndex(
                name: "IX_Projects_ProgramId",
                table: "Projects",
                column: "ProgramId");

            migrationBuilder.AddForeignKey(
                name: "FK_Projects_Programs_ProgramId",
                table: "Projects",
                column: "ProgramId",
                principalTable: "Programs",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Projects_Programs_ProgramId",
                table: "Projects");

            migrationBuilder.DropIndex(
                name: "IX_Projects_ProgramId",
                table: "Projects");

            migrationBuilder.AddColumn<string>(
                name: "Category",
                table: "Projects",
                type: "character varying(80)",
                maxLength: 80,
                nullable: false,
                defaultValue: "");

            migrationBuilder.Sql(
                "UPDATE \"Projects\" p SET \"Category\" = prog.\"Name\" " +
                "FROM \"Programs\" prog " +
                "WHERE prog.\"Id\" = p.\"ProgramId\";");

            migrationBuilder.DropColumn(
                name: "ProgramId",
                table: "Projects");

            migrationBuilder.DropTable(
                name: "Programs");
        }
    }
}
