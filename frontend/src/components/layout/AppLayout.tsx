import { useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { organizationApi } from '../../api/endpoints';
import { useAuth } from '../../context/AuthContext';
import { OfflineBanner } from '../../offline/OfflineBanner';
import { IconMenu } from '../ui/Icons';
import { AccountMenu } from './AccountMenu';
import { BottomBar } from './BottomBar';
import { GlobalSearch } from './GlobalSearch';
import { NotificationBell } from './NotificationBell';
import { TermsGate } from './TermsGate';
import { Sidebar } from './Sidebar';

/**
 * Nome da secao no topo, igual ao item marcado no menu (o nome do projeto ou da pessoa ja vem logo abaixo). So aparece
 * quando o menu lateral esta recolhido (celular) ou nao ha busca no topo (conta so da gestao nacional).
 */
const titles: Array<{ match: RegExp; title: string }> = [
  { match: /^\/$/, title: 'Início' },
  { match: /^\/projetos/, title: 'Projetos' },
  { match: /^\/programas/, title: 'Projetos' },
  { match: /^\/tarefas/, title: 'Tarefas' },
  { match: /^\/voluntarios/, title: 'Voluntários' },
  { match: /^\/relatorios/, title: 'Relatórios' },
  { match: /^\/configuracoes/, title: 'Configurações' },
  { match: /^\/ajuda/, title: 'Ajuda' },
  { match: /^\/nacional/, title: 'Gestão nacional' }
];

/** Conta so da gestao nacional (sem nucleo) so usa estas telas; o resto e de dentro de um nucleo. */
const nationalOnlyPaths = /^\/(nacional|configuracoes|ajuda)(\/|$)/;

export function AppLayout() {
  const location = useLocation();
  const { canManage, hasNucleo } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [organizationName, setOrganizationName] = useState(hasNucleo ? 'Engenheiros Sem Fronteiras' : 'Gestão nacional');

  useEffect(() => {
    if (!hasNucleo) return;
    organizationApi
      .get()
      .then((organization) => setOrganizationName(organization.name))
      .catch(() => undefined);
  }, [hasNucleo]);

  useEffect(() => setMenuOpen(false), [location.pathname]);

  if (!hasNucleo && !nationalOnlyPaths.test(location.pathname)) return <Navigate to="/nacional" replace />;

  // Para o voluntario comum, Configuracoes e so a propria conta.
  const title =
    !canManage && location.pathname.startsWith('/configuracoes')
      ? 'Minha conta'
      : titles.find((entry) => entry.match.test(location.pathname))?.title ?? 'Plataforma';

  return (
    <div className="app">
      <Sidebar open={menuOpen} organizationName={organizationName} onNavigate={() => setMenuOpen(false)} />
      {menuOpen ? <div className="scrim" onClick={() => setMenuOpen(false)} /> : null}

      <div className="main">
        <header className={`header${hasNucleo ? ' header--search' : ''}`}>
          <button
            type="button"
            className="icon-button sidebar__toggle"
            onClick={() => setMenuOpen((value) => !value)}
            aria-label="Abrir menu"
          >
            <IconMenu size={18} />
          </button>

          <span className="header__title">{title}</span>
          <span className="header__spacer" />

          {/* Busca e avisos sao do dia a dia do nucleo. */}
          {hasNucleo ? (
            <>
              <GlobalSearch />
              <NotificationBell />
            </>
          ) : null}

          <div className="header__user">
            <AccountMenu />
          </div>
        </header>

        <main className="content">
          <OfflineBanner />
          <Outlet />
        </main>

        {hasNucleo ? <BottomBar /> : null}

        <TermsGate />
      </div>
    </div>
  );
}
