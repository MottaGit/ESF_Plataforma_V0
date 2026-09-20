import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { organizationApi } from '../../api/endpoints';
import { useAuth } from '../../context/AuthContext';
import { initials, roleLabel } from '../../utils/format';
import { Button } from '../ui/Button';
import { IconLogout, IconMenu } from '../ui/Icons';
import { Sidebar } from './Sidebar';

const titles: Array<{ match: RegExp; title: string }> = [
  { match: /^\/$/, title: 'Visão geral' },
  { match: /^\/projetos$/, title: 'Projetos' },
  { match: /^\/projetos\/.+/, title: 'Detalhes do projeto' },
  { match: /^\/voluntarios/, title: 'Voluntários' },
  { match: /^\/relatorios/, title: 'Relatórios' },
  { match: /^\/configuracoes/, title: 'Configurações' }
];

export function AppLayout() {
  const { user, logout } = useAuth();
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

          <div className="header__user">
            <span className="avatar">{initials(user?.name ?? '')}</span>
            <span>
              <span className="header__user-name">{user?.name}</span>
              <br />
              <span className="header__user-role">{user ? roleLabel(user.role) : ''}</span>
            </span>
            <Button variant="ghost" small icon={<IconLogout size={15} />} onClick={logout} title="Sair">
              Sair
            </Button>
          </div>
        </header>

        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
