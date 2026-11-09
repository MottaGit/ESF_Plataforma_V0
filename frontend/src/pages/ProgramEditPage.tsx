import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom';
import { ApiError } from '../api/client';
import { programsApi } from '../api/endpoints';
import { ProgramLookField } from '../components/programs/ProgramLookField';
import { ProgramMark } from '../components/programs/ProgramMark';
import { ProgramTemplateTab } from '../components/programs/ProgramTemplateTab';
import { Button } from '../components/ui/Button';
import { Field, TextArea, TextInput } from '../components/ui/Field';
import { Alert, Loading } from '../components/ui/Feedback';
import { IconChevronLeft } from '../components/ui/Icons';
import { ScrollTabs } from '../components/ui/ScrollTabs';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import type { Program } from '../types/api';
import { emptyToNull } from '../utils/format';

/** Endereco antigo da pagina do programa: hoje o programa e uma escolha da tela Projetos. */
export function ProgramRedirect() {
  const { id = '' } = useParams();
  return <Navigate to={`/projetos?programa=${id}`} replace />;
}

/** Endereco antigo do modelo (/programas/{id}/modelo): hoje e a aba "Modelo de projeto" de Editar programa. */
export function ProgramTemplateRedirect() {
  const { id = '' } = useParams();
  return <Navigate to={`/programas/${id}/editar?aba=modelo`} replace />;
}

type TabKey = 'sobre' | 'modelo';

const tabs: Array<{ key: TabKey; label: string }> = [
  { key: 'sobre', label: 'Sobre' },
  { key: 'modelo', label: 'Modelo de projeto' }
];

const ABOUT_MAX = 1500;

/**
 * Editar programa (Projetos › programa › Editar programa, /programas/{id}/editar): o lugar de tudo o que e do
 * programa. Abas na URL (?aba=modelo): Sobre (nome, icone, cor e o texto do programa) e Modelo de projeto (tarefas,
 * indicadores e textos que cada projeto novo recebe).
 */
export function ProgramEditPage() {
  const { id = '' } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { canManage } = useAuth();
  const [program, setProgram] = useState<Program | null>(null);
  const [error, setError] = useState<string | null>(null);
  const tab = tabs.find((item) => item.key === searchParams.get('aba'))?.key ?? tabs[0].key;

  const load = useCallback(() => {
    programsApi
      .get(id)
      .then(setProgram)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Não foi possível carregar o programa.'));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  if (error) return <Alert kind="error">{error}</Alert>;
  if (!program) return <Loading label="Carregando programa…" />;

  return (
    <>
      <div style={{ marginBottom: 12 }}>
        <Link to={`/projetos?programa=${program.id}`} className="btn btn--sm btn--ghost">
          <IconChevronLeft size={15} />
          {program.name}
        </Link>
      </div>

      <div className="page-head">
        <div className="page-head__text person-head">
          <ProgramMark icon={program.icon} color={program.color} size={48} />
          <div>
            <h1>{program.name}</h1>
            <p className="page-head__desc">
              {canManage ? 'Editar programa' : 'Programa'}
              {program.status === 'Arquivado' ? ' · arquivado: não aparece em novos projetos' : ''}
            </p>
          </div>
        </div>
      </div>

      <ScrollTabs activeKey={tab}>
        {tabs.map((item) => (
          <button
            key={item.key}
            type="button"
            className={`tab${tab === item.key ? ' tab--active' : ''}`}
            onClick={() => setSearchParams(item.key === tabs[0].key ? {} : { aba: item.key }, { replace: true })}
          >
            {item.label}
          </button>
        ))}
      </ScrollTabs>

      {/* Sobre fica montada (so escondida) ao trocar de aba: o que foi digitado e nao salvo continua la. */}
      <div hidden={tab !== 'sobre'}>
        <ProgramAboutTab key={program.id} program={program} canEdit={canManage} onSaved={setProgram} />
      </div>
      {tab === 'modelo' ? <ProgramTemplateTab programId={program.id} canEdit={canManage} onChanged={load} /> : null}
    </>
  );
}

interface ProgramAboutTabProps {
  program: Program;
  canEdit: boolean;
  onSaved: (program: Program) => void;
}

/** Aba Sobre: nome, icone e cor e o "Sobre o programa" (topo da pagina publica). Salvar grava tudo de uma vez. */
function ProgramAboutTab({ program, canEdit, onSaved }: ProgramAboutTabProps) {
  const { notify } = useToast();
  const [name, setName] = useState(program.name);
  const [icon, setIcon] = useState(program.icon);
  const [color, setColor] = useState(program.color);
  const [about, setAbout] = useState(program.about ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const dirty =
    name.trim() !== program.name ||
    icon !== program.icon ||
    color !== program.color ||
    about.trim() !== (program.about ?? '');

  function reset(source: Program) {
    setName(source.name);
    setIcon(source.icon);
    setColor(source.color);
    setAbout(source.about ?? '');
    setError(null);
  }

  async function submit(event?: FormEvent) {
    event?.preventDefault();
    if (name.trim().length < 3) {
      setError('Informe um nome com ao menos 3 caracteres.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const saved = await programsApi.update(program.id, {
        name: name.trim(),
        status: program.status,
        icon,
        color,
        about: emptyToNull(about)
      });
      reset(saved);
      onSaved(saved);
      notify('Programa atualizado.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível salvar o programa.');
    } finally {
      setSaving(false);
    }
  }

  if (!canEdit) {
    return (
      <section className="panel program-about">
        <div className="panel__body">
          <div className="meta__label">Sobre o programa</div>
          <p className="meta__value activity-detail__text">{program.about ?? '—'}</p>
        </div>
      </section>
    );
  }

  return (
    <section className="panel program-about">
      <form onSubmit={submit} className="panel__body form-grid form-grid--single">
        {error ? <Alert kind="error">{error}</Alert> : null}

        <Field label="Nome" htmlFor="program-about-name" required>
          <TextInput
            id="program-about-name"
            value={name}
            maxLength={120}
            onChange={(event) => setName(event.target.value)}
          />
        </Field>

        <ProgramLookField
          icon={icon}
          color={color}
          hint="Aparece na lista de programas, nos projetos e no mapa."
          onIcon={setIcon}
          onColor={setColor}
        />

        <Field
          label="Sobre o programa"
          htmlFor="program-about-text"
          hint={`Aparece no topo da página pública. Escreva para quem não conhece o núcleo: o que o programa faz, para quem e onde. ${about.length}/${ABOUT_MAX}`}
        >
          <TextArea
            id="program-about-text"
            rows={6}
            maxLength={ABOUT_MAX}
            value={about}
            onChange={(event) => setAbout(event.target.value)}
          />
        </Field>

        <div className="program-about__actions">
          {dirty ? (
            <Button variant="ghost" onClick={() => reset(program)}>
              Descartar mudanças
            </Button>
          ) : null}
          <Button type="submit" variant="primary" loading={saving} disabled={!dirty}>
            Salvar
          </Button>
        </div>
      </form>
    </section>
  );
}
