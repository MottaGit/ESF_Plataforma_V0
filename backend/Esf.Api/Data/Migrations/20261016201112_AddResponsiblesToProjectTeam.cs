using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Esf.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddResponsiblesToProjectTeam : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // A equipe passa a ser a referencia do projeto: responsaveis pelo projeto e pelas
            // atividades que ainda nao estao vinculados entram nela.
            migrationBuilder.Sql("""
                INSERT INTO "ProjectVolunteers" ("ProjectId", "VolunteerId", "RoleInProject", "JoinedAt")
                SELECT DISTINCT r."ProjectId", r."VolunteerId", NULL, now()
                FROM (
                    SELECT "Id" AS "ProjectId", "OwnerVolunteerId" AS "VolunteerId"
                    FROM "Projects" WHERE "OwnerVolunteerId" IS NOT NULL
                    UNION
                    SELECT "ProjectId", "AssignedVolunteerId"
                    FROM "Activities" WHERE "AssignedVolunteerId" IS NOT NULL
                ) r
                ON CONFLICT ("ProjectId", "VolunteerId") DO NOTHING;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Sem volta: nao ha como distinguir os vinculos criados aqui dos criados manualmente.
        }
    }
}
