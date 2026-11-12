import { useEffect, useState, type FormEvent } from 'react';
import { ApiError } from '../../api/client';
import { certificatesApi } from '../../api/endpoints';
import type { CertificateKind, CertificateOptions, Volunteer } from '../../types/api';
import { emptyToNull, formatDate, formatHours, todayInputValue } from '../../utils/format';
import { Button } from '../ui/Button';
import { Field, Select, TextArea, TextInput } from '../ui/Field';
import { Alert, Loading } from '../ui/Feedback';
import { IconDownload } from '../ui/Icons';
import { Modal } from '../ui/Modal';

const SUMMARY_MAX = 300;
const ACTIVITIES_MAX = 400;

/** Total de horas do periodo escolhido: semanas (contando o primeiro e o ultimo dia) x carga semanal. */
function periodHours(start: string, end: string, weeklyHours: number) {
  const days = Math.round((new Date(`${end}T00:00:00`).getTime() - new Date(`${start}T00:00:00`).getTime()) / 86400000) + 1;
  return days > 0 && weeklyHours > 0 ? Math.floor((days / 7) * weeklyHours) : 0;
}

/**
 * Certificado de voluntariado com tres opcoes: periodo completo (do historico, com as horas que a plataforma calcula),
 * periodo especifico (com a carga semanal) ou por projeto (resumo do projeto, o que a pessoa fez e as horas lancadas,
 * tudo ja sugerido e editavel). O CPF vai so para o PDF e nao fica salvo.
 */
export function CertificateModal({ volunteer, onClose }: { volunteer: Volunteer; onClose: () => void }) {
  const [options, setOptions] = useState<CertificateOptions | null>(null);
  const [kind, setKind] = useState<CertificateKind>('Full');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState(todayInputValue());
  const [weeklyHours, setWeeklyHours] = useState('6');
  const [projectId, setProjectId] = useState('');
  const [summary, setSummary] = useState('');
  const [activities, setActivities] = useState('');
  const [includeHours, setIncludeHours] = useState(true);
  const [cpf, setCpf] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    certificatesApi
      .options(volunteer.id)
      .then((result) => {
        setOptions(result);
        setKind(result.full ? 'Full' : 'Period');
        setStartDate(result.full?.start ?? `${todayInputValue().slice(0, 4)}-01-01`);
        setEndDate(result.full?.end ?? todayInputValue());
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Não foi possível carregar as opções do certificado.'));
  }, [volunteer.id]);

  const project = options?.projects.find((item) => item.projectId === projectId) ?? null;

  /** Escolher um projeto preenche o periodo e os textos sugeridos para ele. */
  function chooseProject(id: string) {
    const chosen = options?.projects.find((item) => item.projectId === id);
    setProjectId(id);
    if (!chosen) return;
    setStartDate(chosen.start);
    setEndDate(chosen.end);
    setSummary(chosen.summary ?? '');
    setActivities(chosen.activities ?? '');
    setIncludeHours(chosen.hours > 0);
  }

  function chooseKind(next: CertificateKind) {
    setKind(next);
    setError(null);
    if (next === 'Project' && !projectId && options?.projects[0]) chooseProject(options.projects[0].projectId);
    if (next === 'Period' && options?.full) {
      setStartDate(options.full.start);
      setEndDate(options.full.end);
    }
  }

  const hours = Number(weeklyHours);

  async function generate(event?: FormEvent) {
    event?.preventDefault();
    if (kind !== 'Full' && (!startDate || !endDate || endDate < startDate)) {
      setError('Informe um período válido (o fim não pode ser antes do início).');
      return;
    }
    if (kind === 'Period' && (!Number.isInteger(hours) || hours < 1 || hours > 60)) {
      setError('Informe de 1 a 60 horas por semana.');
      return;
    }
    if (kind === 'Project' && !projectId) {
      setError('Escolha o projeto.');
      return;
    }

    setGenerating(true);
    setError(null);
    try {
      await certificatesApi.download(volunteer.id, {
        kind,
        startDate: kind === 'Full' ? null : startDate,
        endDate: kind === 'Full' ? null : endDate,
        weeklyHours: kind === 'Period' ? hours : 6,
        cpf: emptyToNull(cpf),
        projectId: kind === 'Project' ? projectId : null,
        projectSummary: kind === 'Project' ? emptyToNull(summary) : null,
        activities: kind === 'Project' ? emptyToNull(activities) : null,
        includeHours
      });
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível gerar o certificado.');
    } finally {
      setGenerating(false);
    }
  }

  const choices: Array<{ value: CertificateKind; label: string; hint: string; disabled?: boolean }> = [
    {
      value: 'Full',
      label: 'Período completo',
      hint: options?.full
        ? `${formatDate(options.full.start)} a ${formatDate(options.full.end)} · ${options.full.hours} horas`
        : 'Sem período como Ativo no histórico.',
      disabled: !options?.full
    },
    { value: 'Period', label: 'Período específico', hint: 'Você escolhe as datas e as horas por semana.' },
    {
      value: 'Project',
      label: 'Por projeto',
      hint:
        options && options.projects.length === 0
          ? 'A pessoa ainda não participa de nenhum projeto.'
          : 'Com a descrição do projeto e o que a pessoa fez nele.',
      disabled: !options || options.projects.length === 0
    }
  ];

  return (
    <Modal
      guardChanges
      title="Gerar certificado"
      subtitle={`Certificado de voluntariado de ${volunteer.name}.`}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button
            variant="primary"
            icon={<IconDownload size={15} />}
            loading={generating}
            disabled={!options}
            onClick={() => void generate()}
          >
            Gerar PDF
          </Button>
        </>
      }
    >
      {error ? (
        <div className="mb-16">
          <Alert kind="error">{error}</Alert>
        </div>
      ) : null}
      {!options ? (
        error ? null : <Loading label="Carregando…" />
      ) : (
        <form onSubmit={generate} className="certificate-form">
          <div className="certificate-kinds" role="radiogroup" aria-label="Tipo de certificado">
            {choices.map((choice) => (
              <label key={choice.value} className={`term-choice${choice.disabled ? ' term-choice--disabled' : ''}`}>
                <input
                  type="radio"
                  name="certificate-kind"
                  checked={kind === choice.value}
                  disabled={choice.disabled}
                  onChange={() => chooseKind(choice.value)}
                />
                <span>
                  <strong>{choice.label}</strong>
                  <small>{choice.hint}</small>
                </span>
              </label>
            ))}
          </div>

          <div className="form-grid">
            {kind === 'Project' ? (
              <Field label="Projeto" htmlFor="certificate-project" required span>
                <Select id="certificate-project" value={projectId} onChange={(event) => chooseProject(event.target.value)}>
                  {options.projects.map((item) => (
                    <option key={item.projectId} value={item.projectId}>
                      {item.name}
                    </option>
                  ))}
                </Select>
              </Field>
            ) : null}

            {kind !== 'Full' ? (
              <>
                <Field label="Início" htmlFor="certificate-start" required>
                  <TextInput id="certificate-start" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
                </Field>
                <Field label="Fim" htmlFor="certificate-end" required>
                  <TextInput id="certificate-end" type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
                </Field>
              </>
            ) : null}

            {kind === 'Period' ? (
              <Field
                label="Horas por semana"
                htmlFor="certificate-hours"
                required
                hint={`Total no período: ${startDate && endDate ? periodHours(startDate, endDate, hours) : 0} horas.`}
              >
                <TextInput
                  id="certificate-hours"
                  type="number"
                  min={1}
                  max={60}
                  value={weeklyHours}
                  onChange={(event) => setWeeklyHours(event.target.value)}
                />
              </Field>
            ) : null}

            {kind === 'Project' && project ? (
              <>
                <Field
                  label="Sobre o projeto"
                  htmlFor="certificate-summary"
                  hint={`Sugerido pelo objetivo do projeto. ${summary.length}/${SUMMARY_MAX}`}
                  span
                >
                  <TextArea
                    id="certificate-summary"
                    rows={3}
                    maxLength={SUMMARY_MAX}
                    value={summary}
                    onChange={(event) => setSummary(event.target.value)}
                  />
                </Field>
                <Field
                  label="O que a pessoa fez"
                  htmlFor="certificate-activities"
                  hint={`Sugerido pela função na equipe e pelas horas lançadas. ${activities.length}/${ACTIVITIES_MAX}`}
                  span
                >
                  <TextArea
                    id="certificate-activities"
                    rows={3}
                    maxLength={ACTIVITIES_MAX}
                    value={activities}
                    onChange={(event) => setActivities(event.target.value)}
                  />
                </Field>
                <div className="field span-2">
                  <label className="checkbox">
                    <input
                      type="checkbox"
                      checked={includeHours && project.hours > 0}
                      disabled={project.hours === 0}
                      onChange={(event) => setIncludeHours(event.target.checked)}
                    />
                    {project.hours > 0
                      ? `Incluir as horas lançadas no projeto (${formatHours(project.hours)} no total)`
                      : 'Nenhuma hora lançada neste projeto: o certificado mostra só o período'}
                  </label>
                </div>
              </>
            ) : null}

            <Field label="CPF" htmlFor="certificate-cpf" hint="Opcional. Só vai para o certificado; não fica salvo." span>
              <TextInput id="certificate-cpf" value={cpf} placeholder="000.000.000-00" onChange={(event) => setCpf(event.target.value)} />
            </Field>
          </div>
          <button type="submit" hidden aria-hidden="true" />
        </form>
      )}
    </Modal>
  );
}
