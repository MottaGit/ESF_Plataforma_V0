/**
 * Lembra os filtros da lista de projetos (a query string) para que o link "Projetos" da pagina
 * de um projeto volte para a lista do jeito que estava. Sem storage disponivel, apenas nao lembra.
 */
const PROJECTS_QUERY_KEY = 'esf.projects.query';

export function rememberProjectsQuery(query: string) {
  try {
    sessionStorage.setItem(PROJECTS_QUERY_KEY, query);
  } catch {
    // storage bloqueado (aba anonima, preview): segue sem lembrar
  }
}

export function projectsListPath() {
  try {
    const query = sessionStorage.getItem(PROJECTS_QUERY_KEY);
    return query ? `/projetos?${query}` : '/projetos';
  } catch {
    return '/projetos';
  }
}
