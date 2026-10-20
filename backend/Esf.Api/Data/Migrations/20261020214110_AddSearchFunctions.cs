using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Esf.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddSearchFunctions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Busca geral: texto sem acento e em minusculas (a mesma tabela de Common/SearchText.cs). Funcoes simples
            // de SQL, sem depender de extensao do Postgres.
            migrationBuilder.Sql("""
                CREATE OR REPLACE FUNCTION esf_fold(value text) RETURNS text
                LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE
                AS $$ SELECT lower(translate(value, 'ÁÀÂÃÄÅáàâãäåÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇçÑñ', 'AAAAAAaaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNn')) $$;

                CREATE OR REPLACE FUNCTION esf_fold_html(value text) RETURNS text
                LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE
                AS $$ SELECT esf_fold(regexp_replace(value, '<[^>]*>', ' ', 'g')) $$;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                DROP FUNCTION IF EXISTS esf_fold_html(text);
                DROP FUNCTION IF EXISTS esf_fold(text);
                """);
        }
    }
}
