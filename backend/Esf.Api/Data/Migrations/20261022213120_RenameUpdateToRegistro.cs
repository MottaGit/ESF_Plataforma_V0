using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Esf.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class RenameUpdateToRegistro : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // O relato de andamento passou a se chamar "registro de andamento": o historico ja gravado acompanha.
            migrationBuilder.Sql("""
                UPDATE "AuditEntries" SET "EntityType" = 'Registro de andamento' WHERE "EntityType" = 'Relato';
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                UPDATE "AuditEntries" SET "EntityType" = 'Relato' WHERE "EntityType" = 'Registro de andamento';
                """);
        }
    }
}
