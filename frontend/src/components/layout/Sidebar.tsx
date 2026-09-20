import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
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
  { to: '/projetos', label: 'Projetos', icon: IconProjects, end: false },
  { to: '/voluntarios', label: 'Voluntários', icon: IconVolunteers, end: false },
  { to: '/relatorios', label: 'Relatórios', icon: IconReports, end: false },
  { to: '/configuracoes', label: 'Configurações', icon: IconSettings, end: false }
];

export function Sidebar({ open, organizationName, onNavigate }: SidebarProps) {
  const { user } = useAuth();

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
            className={({ isActive }) => `nav-item${isActive ? ' nav-item--active' : ''}`}
          >
            <item.icon className="nav-item__icon" />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="sidebar__footer">
        Conectado como {user?.name}
        <br />
        Versão 0 — produto em validação
      </div>
    </aside>
  );
}
