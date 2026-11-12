/**
 * Globo do logotipo da ESF num quadrado branco: menu lateral, login, primeiro acesso e pagina publica sem logo do
 * nucleo. A imagem (public/icons/globe.png) e o globo do icone instalado, sem o fundo branco. Decorativo: o nome vem
 * sempre ao lado.
 */
export function BrandMark() {
  return (
    <span className="sidebar__mark">
      <img src="/icons/globe.png" alt="" width={22} height={22} />
    </span>
  );
}
