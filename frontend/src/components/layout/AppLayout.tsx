import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { organizationApi } from '../../api/endpoints';
import { IconMenu } from '../ui/Icons';
import { AccountMenu } from './AccountMenu';
import { GlobalSearch } from './GlobalSearch';
import { NotificationBell } from './NotificationBell';
import { TermsGate } from './TermsGate';
import { Sidebar } from './Sidebar';

const titles: Array<{ match: RegExp; title: string }> = [
  { match: /^\/$/, title: 'Início' },
  { match: /^\/projetos$/, title: 'Projetos' },
  { match: /^\/projetos\/.+/, title: 'Detalhes do projeto' },
  { match: /^\/programas/, title: 'Programas' },
  { match: /^\/tarefas/, title: 'Tarefas' },
  { match: /^\/voluntarios/, title: 'Voluntários' },
  { match: /^\/relatorios/, title: 'Relatórios' },
  { match: /^\/configuracoes/, title: 'Configurações' }
];

export function AppLayout() {
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [organizationName, setOrganizationName] = useState('Engenheiros Sem Fronteiras');

  useEffect(() => {
    organizationApi
      .get()
      .then((organization) => setOrganizationName(organization.name))
      .catch(() => undefined);
  }, []);

  useEffect(() => setMenuOpen(false), [location.pathname]);

  const title = titles.find((entry) => entry.match.test(location.pathname))?.title ?? 'Plataforma';

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

        <TermsGate />
      </div>
    </div>
  );
}
