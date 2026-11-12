import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom';
import { ApiError } from '../api/client';
import { programsApi } from '../api/endpoints';
import { ProgramLookField } from '../components/programs/ProgramLookField';
import { ProgramMark } from '../components/programs/ProgramMark';
import { ProgramPartnersTab } from '../components/programs/ProgramPartnersTab';
import { ProgramTemplateTab } from '../components/programs/ProgramTemplateTab';
import { Button } from '../components/ui/Button';
import { Field, TextArea, TextInput } from '../components/ui/Field';
import { Alert, Loading } from '../components/ui/Feedback';
import { IconChevronLeft, IconEdit } from '../components/ui/Icons';
import { Modal } from '../components/ui/Modal';
import { ScrollTabs } from '../components/ui/ScrollTabs';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import type { Program } from '../types/api';
import { emptyToNull } from '../utils/format';
import { programIconLabel } from '../utils/programs';
import { useLatestRequest } from '../utils/useLatestRequest';

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

type TabKey = 'sobre' | 'modelo' | 'parceiros';

// Quem e o programa primeiro (Sobre, Parceiros); o operacional (Modelo de projeto) por ultimo.
const tabs: Array<{ key: TabKey; label: string }> = [
  { key: 'sobre', label: 'Sobre' },
  { key: 'parceiros', label: 'Parceiros' },
  { key: 'modelo', label: 'Modelo de projeto' }
];

/** Limites da ficha (os mesmos da API). */
const LIMITS = { description: 1500, objective: 1000, audience: 300 };

/**
 * Editar programa (Projetos › programa › Editar programa, /programas/{id}/editar): o lugar de tudo o que e do
 * programa. Abas na URL (?aba=parceiros, ?aba=modelo): Sobre (identidade e a ficha: o que faz, objetivo, para quem),
 * Parceiros e Modelo de projeto (tarefas e indicadores que cada projeto novo recebe).
 */
export function ProgramEditPage() {
  const { id = '' } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { canManage } = useAuth();
  const [program, setProgram] = useState<Program | null>(null);
  const [error, setError] = useState<string | null>(null);
  const tab = tabs.find((item) => item.key === searchParams.get('aba'))?.key ?? tabs[0].key;

  // Ir de um programa a outro com o anterior ainda carregando: so vale o ultimo aberto.
  const startRequest = useLatestRequest();
  const load = useCallback(() => {
    const isCurrent = startRequest();
    programsApi
      .get(id)
      .then((loaded) => isCurrent() && setProgram(loaded))
      .catch(
        (err) => isCurrent() && setError(err instanceof ApiError ? err.message : 'Não foi possível carregar o programa.')
      );
  }, [startRequest, id]);

  useEffect(() => {
    load();
  }, [load]);

  if (error) return <Alert kind="error">{error}</Alert>;
  if (!program) return <Loading label="Carregando programa…" />;

  return (
    <>
      <div className="mb-12">
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

      {tab === 'sobre' ? <ProgramAboutTab program={program} canEdit={canManage} onSaved={setProgram} /> : null}
      {tab === 'modelo' ? <ProgramTemplateTab programId={program.id} canEdit={canManage} onChanged={load} /> : null}
      {tab === 'parceiros' ? <ProgramPartnersTab programId={program.id} canEdit={canManage} onChanged={load} /> : null}
    </>
  );
}

interface ProgramAboutTabProps {
  program: Program;
  canEdit: boolean;
  onSaved: (program: Program) => void;
}

/** Os tres textos da ficha, com o que cada um pede (o mesmo texto serve a pagina publica e ao projeto novo). */
const SHEET_FIELDS = [
  {
    key: 'description',
    label: 'O que o programa faz',
    hint: 'Em poucas linhas, para quem não conhece o núcleo.',
    placeholder: 'Ex.: Constrói ou reforma o banheiro de famílias sem saneamento, com construtor da própria comunidade.',
    rows: 4
  },
  {
    key: 'objective',
    label: 'Objetivo',
    hint: 'O resultado que o programa busca.',
    placeholder: 'Ex.: Garantir acesso a saneamento digno às famílias atendidas.',
    rows: 2
  },
  {
    key: 'audience',
    label: 'Para quem',
    hint: 'Quem o programa atende, em geral (quem se beneficia em cada projeto fica no projeto).',
    placeholder: 'Ex.: Famílias de baixa renda de Porto Alegre sem banheiro adequado em casa',
    rows: 0
  }
] as const;

type SheetKey = (typeof SHEET_FIELDS)[number]['key'];
type SheetValues = Record<SheetKey, string>;

function sheetOf(program: Program): SheetValues {
  return {
    description: program.description ?? '',
    objective: program.objective ?? '',
    audience: program.audience ?? ''
  };
}

/**
 * Aba Sobre: a ficha do programa, para leitura (nome, icone e a apresentacao: o que faz, objetivo, para quem).
 * "Editar" abre a janela com o formulario; ao salvar, ela fecha e a ficha mostra o que ficou gravado.
 */
function ProgramAboutTab({ program, canEdit, onSaved }: ProgramAboutTabProps) {
  const { notify } = useToast();
  const [editing, setEditing] = useState(false);
  const sheet = sheetOf(program);

  return (
    <>
      <section className="panel program-about">
        <div className="panel__head">
          <h2>Ficha do programa</h2>
          {canEdit ? (
            <div className="panel__actions">
              <Button small icon={<IconEdit size={15} />} onClick={() => setEditing(true)}>
                Editar
              </Button>
            </div>
          ) : null}
        </div>
        <div className="panel__body program-about__body">
          <p className="program-about__uses">
            Aparece na <strong>página pública</strong>, e o que o programa faz e o objetivo já vêm preenchidos em{' '}
            <strong>cada projeto novo</strong> (dá para ajustar no projeto).
          </p>

          <div className="program-about__identity">
            <ProgramMark icon={program.icon} color={program.color} size={40} />
            <div>
              <div className="meta__label">Nome</div>
              <div className="program-about__name">{program.name}</div>
              <div className="field__hint">Ícone: {programIconLabel(program.icon)}</div>
            </div>
          </div>

          {SHEET_FIELDS.map((field) => (
            <div key={field.key} className="program-about__text">
              <div className="meta__label">{field.label}</div>
              {sheet[field.key] ? (
                <p className="meta__value activity-detail__text">{sheet[field.key]}</p>
              ) : (
                <p className="program-about__empty">Ainda não escrito.</p>
              )}
            </div>
          ))}
        </div>
      </section>

      {editing ? (
        <ProgramSheetModal
          program={program}
          onClose={() => setEditing(false)}
          onSaved={(saved) => {
            setEditing(false);
            onSaved(saved);
            notify('Ficha do programa salva.');
          }}
        />
      ) : null}
    </>
  );
}

/** Janela "Editar ficha do programa": identidade (nome, icone, cor) e apresentacao, gravadas de uma vez. */
function ProgramSheetModal({
  program,
  onClose,
  onSaved
}: {
  program: Program;
  onClose: () => void;
  onSaved: (program: Program) => void;
}) {
  const [name, setName] = useState(program.name);
  const [icon, setIcon] = useState(program.icon);
  const [color, setColor] = useState(program.color);
  const [sheet, setSheet] = useState<SheetValues>(() => sheetOf(program));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(event?: FormEvent) {
    event?.preventDefault();
    if (name.trim().length < 3) {
      setError('Informe um nome com ao menos 3 caracteres.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      onSaved(
        await programsApi.update(program.id, {
          name: name.trim(),
          status: program.status,
          icon,
          color,
          description: emptyToNull(sheet.description),
          objective: emptyToNull(sheet.objective),
          audience: emptyToNull(sheet.audience)
        })
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível salvar o programa.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      guardChanges
      title="Editar ficha do programa"
      subtitle="Aparece na página pública e preenche a descrição e o objetivo de cada projeto novo."
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="primary" loading={saving} onClick={() => void submit()}>
            Salvar
          </Button>
        </>
      }
    >
      {error ? (
        <div className="mb-16">
          <Alert kind="error">{error}</Alert>
        </div>
      ) : null}
      <form onSubmit={submit} className="form-grid form-grid--single">
        <h3 className="program-sheet__section">Identidade</h3>
        <Field label="Nome" htmlFor="program-sheet-name" required>
          <TextInput
            id="program-sheet-name"
            autoFocus
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

        <h3 className="program-sheet__section">Apresentação</h3>
        {SHEET_FIELDS.map((field) => {
          const id = `program-sheet-${field.key}`;
          const value = sheet[field.key];
          const max = LIMITS[field.key];
          const onChange = (text: string) => setSheet((current) => ({ ...current, [field.key]: text }));
          return (
            <Field
              key={field.key}
              label={field.label}
              htmlFor={id}
              hint={value.length > max * 0.8 ? `${field.hint} ${value.length}/${max}` : field.hint}
            >
              {field.rows > 0 ? (
                <TextArea
                  id={id}
                  rows={field.rows}
                  maxLength={max}
                  value={value}
                  placeholder={field.placeholder}
                  onChange={(event) => onChange(event.target.value)}
                />
              ) : (
                <TextInput
                  id={id}
                  maxLength={max}
                  value={value}
                  placeholder={field.placeholder}
                  onChange={(event) => onChange(event.target.value)}
                />
              )}
            </Field>
          );
        })}
        <button type="submit" hidden aria-hidden="true" />
      </form>
    </Modal>
  );
}
