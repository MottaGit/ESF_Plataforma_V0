using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Esf.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class RemoveTaskNotesAndLowPriority : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // As observacoes da tarefa passam para o fim da descricao (a tarefa tem comentarios e checklist para o resto).
            migrationBuilder.Sql("""
                UPDATE "Activities"
                SET "Description" = CASE
                    WHEN COALESCE(btrim("Description"), '') = '' THEN btrim("Notes")
                    ELSE "Description" || chr(10) || chr(10) || btrim("Notes")
                END
                WHERE COALESCE(btrim("Notes"), '') <> '';
                """);

            // Prioridade: so "Urgente" (Alta) ou normal (Media); Baixa vira normal.
            migrationBuilder.Sql("""UPDATE "Activities" SET "Priority" = 1 WHERE "Priority" = 0;""");
            migrationBuilder.Sql("""UPDATE "ProgramTemplateActivities" SET "Priority" = 1 WHERE "Priority" = 0;""");

            migrationBuilder.DropColumn(
                name: "Notes",
                table: "Activities");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Notes",
                table: "Activities",
                type: "text",
                nullable: true);
        }
    }
}
