using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Esf.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class RenameActivityToTask : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // "Atividade" passou a se chamar "Tarefa" na plataforma: o historico ja gravado acompanha.
            migrationBuilder.Sql("""
                UPDATE "AuditEntries" SET "EntityType" = 'Tarefa' WHERE "EntityType" = 'Atividade';
                UPDATE "AuditEntries" SET "EntityLabel" = replace("EntityLabel", ': atividade "', ': tarefa "')
                    WHERE "EntityType" = 'Modelo do programa';
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                UPDATE "AuditEntries" SET "EntityType" = 'Atividade' WHERE "EntityType" = 'Tarefa';
                UPDATE "AuditEntries" SET "EntityLabel" = replace("EntityLabel", ': tarefa "', ': atividade "')
                    WHERE "EntityType" = 'Modelo do programa';
                """);
        }
    }
}
