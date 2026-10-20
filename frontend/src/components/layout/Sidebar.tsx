import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { displayName } from '../../utils/format';
import {
  IconDashboard,
  IconProjects,
  IconReports,
  IconSettings,
  IconVolunteers
} from '../ui/Icons';

interface SidebarProps {
  open: boolean;
  organizationName: string;
  onNavigate: () => void;
}

const items = [
  { to: '/', label: 'Visão geral', icon: IconDashboard, end: true },
  // Programas ficam dentro de Projetos (Projetos › Programas).
  { to: '/projetos', label: 'Projetos', icon: IconProjects, end: false, also: '/programas' },
  { to: '/voluntarios', label: 'Voluntários', icon: IconVolunteers, end: false },
  { to: '/relatorios', label: 'Relatórios', icon: IconReports, end: false },
  { to: '/configuracoes', label: 'Configurações', icon: IconSettings, end: false }
];

export function Sidebar({ open, organizationName, onNavigate }: SidebarProps) {
  const { user } = useAuth();
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
        {items.map((item) => (
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
