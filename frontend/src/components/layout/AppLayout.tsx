import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { organizationApi } from '../../api/endpoints';
import { useAuth } from '../../context/AuthContext';
import { IconMenu } from '../ui/Icons';
import { AccountMenu } from './AccountMenu';
import { BottomBar } from './BottomBar';
import { GlobalSearch } from './GlobalSearch';
import { NotificationBell } from './NotificationBell';
import { TermsGate } from './TermsGate';
import { Sidebar } from './Sidebar';

/** Nome da secao no topo, igual ao item marcado no menu (o nome do projeto ou da pessoa ja vem logo abaixo). */
const titles: Array<{ match: RegExp; title: string }> = [
  { match: /^\/$/, title: 'Início' },
  { match: /^\/projetos/, title: 'Projetos' },
  { match: /^\/programas/, title: 'Projetos' },
  { match: /^\/tarefas/, title: 'Tarefas' },
  { match: /^\/voluntarios/, title: 'Voluntários' },
  { match: /^\/relatorios/, title: 'Relatórios' },
  { match: /^\/configuracoes/, title: 'Configurações' },
  { match: /^\/ajuda/, title: 'Ajuda' }
];

export function AppLayout() {
  const location = useLocation();
  const { canManage } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [organizationName, setOrganizationName] = useState('Engenheiros Sem Fronteiras');

  useEffect(() => {
    organizationApi
      .get()
      .then((organization) => setOrganizationName(organization.name))
      .catch(() => undefined);
  }, []);

  useEffect(() => setMenuOpen(false), [location.pathname]);

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
        <header className="header">
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

          <GlobalSearch />
          <NotificationBell />

          <div className="header__user">
            <AccountMenu />
          </div>
        </header>

        <main className="content">
          <Outlet />
        </main>

        <BottomBar />

        <TermsGate />
      </div>
    </div>
  );
}
