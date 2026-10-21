import { useEffect, useMemo, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { dashboardApi, projectsApi } from '../../api/endpoints';
import type { HomeProject, ProjectListItem } from '../../types/api';
import { ProgramMark } from '../programs/ProgramMark';
import { TextInput } from '../ui/Field';
import { Loading } from '../ui/Feedback';
import { IconChecklist, IconHome, IconPlus, IconProjects, IconSearch } from '../ui/Icons';
import { Modal } from '../ui/Modal';

/** Busca sem diferenciar maiusculas nem acentos. */
const fold = (value: string) => value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

/**
 * Barra fixa embaixo da tela no celular: Inicio, Projetos, Tarefas e "Registrar" (escolhe o projeto e abre o
 * registro de andamento dele). No computador ela nao aparece; o menu lateral faz esse papel.
 */
export function BottomBar() {
  const { pathname } = useLocation();
  const [picking, setPicking] = useState(false);

  useEffect(() => setPicking(false), [pathname]);

  const tabClass = ({ isActive }: { isActive: boolean }) => `bottom-bar__tab${isActive ? ' bottom-bar__tab--active' : ''}`;

  return (
    <>
      <nav className="bottom-bar" aria-label="Navegação principal">
        <NavLink to="/" end className={tabClass}>
          <IconHome size={22} />
          Início
        </NavLink>
        <NavLink
          to="/projetos"
          className={({ isActive }) => tabClass({ isActive: isActive || pathname.startsWith('/programas') })}
        >
          <IconProjects size={22} />
          Projetos
        </NavLink>
        <NavLink to="/tarefas" className={tabClass}>
          <IconChecklist size={22} />
          Tarefas
        </NavLink>
        <button type="button" className="bottom-bar__tab bottom-bar__tab--plus" onClick={() => setPicking(true)}>
          <span className="bottom-bar__ring">
            <IconPlus size={20} />
          </span>
          Registrar
        </button>
      </nav>

      {picking ? <RegisterPicker onClose={() => setPicking(false)} /> : null}
    </>
  );
}

/** "Registrar andamento em qual projeto?": os da pessoa primeiro, depois os demais em andamento. */
function RegisterPicker({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const [mine, setMine] = useState<HomeProject[] | null>(null);
  const [all, setAll] = useState<ProjectListItem[] | null>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    dashboardApi
      .get()
      .then((data) => setMine(data.myProjects))
      .catch(() => setMine([]));
    projectsApi
      .list({ sort: 'name' })
      .then((list) => setAll(list.filter((p) => p.status === 'Planejamento' || p.status === 'EmAndamento')))
      .catch(() => setAll([]));
  }, []);

  const term = fold(query.trim());
  const mineIds = useMemo(() => new Set((mine ?? []).map((p) => p.id)), [mine]);
  const myList = (mine ?? []).filter((p) => !term || fold(p.name).includes(term));
  const others = (all ?? []).filter((p) => !mineIds.has(p.id) && (!term || fold(`${p.name} ${p.programName}`).includes(term)));

  function choose(id: string) {
    onClose();
    navigate(`/projetos/${id}?registrar=1`);
  }

  return (
    <Modal title="Registrar andamento" subtitle="Em qual projeto?" size="narrow" onClose={onClose}>
      <span className="search register-picker__search">
        <IconSearch className="search__icon" />
        <TextInput value={query} placeholder="Buscar projeto" aria-label="Buscar projeto" onChange={(e) => setQuery(e.target.value)} />
      </span>

      {mine === null || all === null ? (
        <Loading label="Carregando projetos…" />
      ) : (
        <div className="register-picker">
          {myList.length > 0 ? (
            <>
              <h3 className="register-picker__title">Meus projetos</h3>
              <ul>
                {myList.map((project) => (
                  <li key={project.id}>
                    <button type="button" onClick={() => choose(project.id)}>
                      <ProgramMark icon={project.programIcon} color={project.programColor} size={26} />
                      {project.name}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
          {others.length > 0 ? (
            <>
              <h3 className="register-picker__title">{myList.length > 0 ? 'Outros projetos' : 'Projetos'}</h3>
              <ul>
                {others.map((project) => (
                  <li key={project.id}>
                    <button type="button" onClick={() => choose(project.id)}>
                      <ProgramMark icon={project.programIcon} color={project.programColor} size={26} />
                      {project.name}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
          {myList.length === 0 && others.length === 0 ? <p className="field__hint">Nenhum projeto encontrado.</p> : null}
        </div>
      )}
    </Modal>
  );
}
