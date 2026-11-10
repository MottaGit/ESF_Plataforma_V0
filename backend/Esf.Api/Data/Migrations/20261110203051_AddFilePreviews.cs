using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Esf.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddFilePreviews : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "PreviewState",
                table: "ProjectFiles",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.CreateIndex(
                name: "IX_ProjectFiles_PreviewState",
                table: "ProjectFiles",
                column: "PreviewState");

            // Fotos ja enviadas entram na fila de miniaturas (o JobWorker gera uma de cada vez depois do deploy). Os
            // formatos sao os de ImagePreviews.Supports.
            migrationBuilder.Sql("""
                UPDATE "ProjectFiles" SET "PreviewState" = 1
                WHERE lower("ContentType") LIKE 'image/%'
                  AND (lower("StoredName") LIKE '%.jpg' OR lower("StoredName") LIKE '%.jpeg'
                       OR lower("StoredName") LIKE '%.png' OR lower("StoredName") LIKE '%.webp');
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_ProjectFiles_PreviewState",
                table: "ProjectFiles");

            migrationBuilder.DropColumn(
                name: "PreviewState",
                table: "ProjectFiles");
        }
    }
}
