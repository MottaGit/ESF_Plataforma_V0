import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { displayName, roleLabel } from '../../utils/format';
import { Avatar } from '../ui/Avatar';
import { IconChevronDown, IconHelp, IconLogout, IconSettings, IconVolunteers } from '../ui/Icons';
import { usePopover } from '../ui/usePopover';

/**
 * Foto e nome no topo da tela: clicar abre o menu da conta (perfil de voluntario, dados de acesso, ajuda e sair).
 * "Meu perfil" so aparece quando o acesso esta vinculado a um voluntario.
 */
export function AccountMenu() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { open, setOpen, ref } = usePopover();

  function go(path: string) {
    setOpen(false);
    navigate(path);
  }

  return (
    <div className="account" ref={ref}>
      <button
        type="button"
        className="account__trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Menu da conta"
        onClick={() => setOpen((current) => !current)}
      >
        <Avatar name={displayName(user)} photoUrl={user?.volunteerPhotoUrl} size={30} />
        <span className="account__who">
          <span className="header__user-name">{displayName(user)}</span>
          <span className="header__user-role">{user ? roleLabel(user.role) : ''}</span>
        </span>
        <IconChevronDown size={14} className="account__chevron" />
      </button>

      {open ? (
        <div className="menu__list account__list" role="menu">
          {user?.volunteerId ? (
            <button type="button" role="menuitem" className="menu__item" onClick={() => go(`/voluntarios/${user.volunteerId}`)}>
              <IconVolunteers size={15} />
              Meu perfil
            </button>
          ) : null}
          <button type="button" role="menuitem" className="menu__item" onClick={() => go('/configuracoes?aba=conta')}>
            <IconSettings size={15} />
            Minha conta
          </button>
          <button type="button" role="menuitem" className="menu__item" onClick={() => go('/ajuda')}>
            <IconHelp size={15} />
            Ajuda
          </button>
          <div className="menu__separator" role="separator" />
          <button
            type="button"
            role="menuitem"
            className="menu__item"
            onClick={() => {
              setOpen(false);
              logout();
            }}
          >
            <IconLogout size={15} />
            Sair
          </button>
        </div>
      ) : null}
    </div>
  );
}
