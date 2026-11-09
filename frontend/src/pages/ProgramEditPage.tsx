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
 * Aba Sobre: a ficha do programa. Identidade (nome, icone e cor) e Apresentacao (o que faz, objetivo, para quem),
 * escrita uma vez: aparece na pagina publica e o que faz e o objetivo ja vem preenchidos em cada projeto novo.
 * Salvar grava tudo de uma vez.
 */
function ProgramAboutTab({ program, canEdit, onSaved }: ProgramAboutTabProps) {
  const { notify } = useToast();
  const [name, setName] = useState(program.name);
  const [icon, setIcon] = useState(program.icon);
  const [color, setColor] = useState(program.color);
  const [sheet, setSheet] = useState<SheetValues>(() => sheetOf(program));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const saved = sheetOf(program);
  const dirty =
    name.trim() !== program.name ||
    icon !== program.icon ||
    color !== program.color ||
    SHEET_FIELDS.some((field) => sheet[field.key].trim() !== saved[field.key]);

  function reset(source: Program) {
    setName(source.name);
    setIcon(source.icon);
    setColor(source.color);
    setSheet(sheetOf(source));
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
      const result = await programsApi.update(program.id, {
        name: name.trim(),
        status: program.status,
        icon,
        color,
        description: emptyToNull(sheet.description),
        objective: emptyToNull(sheet.objective),
        audience: emptyToNull(sheet.audience)
      });
      reset(result);
      onSaved(result);
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
        <div className="panel__body meta-list">
          {SHEET_FIELDS.map((field) => (
            <div key={field.key}>
              <div className="meta__label">{field.label}</div>
              <p className="meta__value activity-detail__text">{saved[field.key] || '—'}</p>
            </div>
          ))}
        </div>
      </section>
    );
  }

  return (
    <form onSubmit={submit} className="program-about">
      {error ? <Alert kind="error">{error}</Alert> : null}

      <section className="panel">
        <div className="panel__head">
          <h2>Identidade</h2>
        </div>
        <div className="panel__body form-grid form-grid--single">
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
        </div>
      </section>

      <section className="panel">
        <div className="panel__head">
          <h2>Apresentação</h2>
        </div>
        <div className="panel__body form-grid form-grid--single">
          <p className="program-about__uses">
            Escreva uma vez: aparece na <strong>página pública</strong>, e o que o programa faz e o objetivo já vêm
            preenchidos em <strong>cada projeto novo</strong> (dá para ajustar no projeto).
          </p>
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
        </div>
      </section>

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
  );
}
