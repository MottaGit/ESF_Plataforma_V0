import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { displayName } from '../../utils/format';
import { IconChecklist, IconHome, IconProjects, IconReports, IconSettings, IconVolunteers } from '../ui/Icons';

interface SidebarProps {
  open: boolean;
  organizationName: string;
  onNavigate: () => void;
}

const items = [
  { to: '/', label: 'Início', icon: IconHome, end: true },
  // Programas ficam dentro de Projetos (Projetos › Programas).
  { to: '/projetos', label: 'Projetos', icon: IconProjects, end: false, also: '/programas' },
  { to: '/tarefas', label: 'Tarefas', icon: IconChecklist, end: false },
  { to: '/voluntarios', label: 'Voluntários', icon: IconVolunteers, end: false },
  { to: '/relatorios', label: 'Relatórios', icon: IconReports, end: false },
  // Configuracoes e da coordenacao; o voluntario chega na propria conta pelo menu do avatar.
  { to: '/configuracoes', label: 'Configurações', icon: IconSettings, end: false, manageOnly: true }
];

export function Sidebar({ open, organizationName, onNavigate }: SidebarProps) {
  const { user, canManage } = useAuth();
  const { pathname } = useLocation();

  return (
    <aside className={`sidebar${open ? ' sidebar--open' : ''}`}>
      <div className="sidebar__brand">
        <span className="sidebar__mark">ESF</span>
        <span>
          <span className="sidebar__name">{organizationName}</span>
          <span className="sidebar__sub">Gestão de projetos</span>
        </span>
      </div>

      <nav className="sidebar__group">
        {items.filter((item) => !item.manageOnly || canManage).map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={onNavigate}
            className={({ isActive }) =>
              `nav-item${isActive || (item.also !== undefined && pathname.startsWith(item.also)) ? ' nav-item--active' : ''}`
            }
          >
            <item.icon className="nav-item__icon" />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="sidebar__footer">
        Conectado como {displayName(user)}
        <br />
        Versão 0 — produto em validação
      </div>
    </aside>
  );
}
