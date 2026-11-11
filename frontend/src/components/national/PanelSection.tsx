import { useEffect, useState } from 'react';
import { ApiError } from '../../api/client';
import { nationalApi } from '../../api/endpoints';
import { TextInput } from '../ui/Field';
import { EmptyState, LoadError, Loading } from '../ui/Feedback';
import type { NationalPanel, SummedValue } from '../../types/api';
import { coverageLabel, daysFromToday, formatDate, formatNumber, timeAgo, todayInputValue } from '../../utils/format';
import { periodShortcuts } from '../../utils/periods';

/** A partir de quantos dias sem registro nem tarefa concluida o nucleo aparece como parado. */
const STALE_DAYS = 30;

/** Dias desde a ultima atividade (null: nunca teve). */
function daysSince(value: string | null) {
  return value ? -daysFromToday(value.slice(0, 10)) : null;
}

/**
 * Painel: os numeros de todos os nucleos, no total e por nucleo. Tarefas concluidas, registros e horas contam no
 * periodo escolhido (o ano corrente, por padrao); projetos, voluntarios ativos e indicadores sao a situacao de hoje.
 */
export function PanelSection() {
  const today = todayInputValue();
  const [from, setFrom] = useState(`${today.slice(0, 4)}-01-01`);
  const [to, setTo] = useState(today);
  const [panel, setPanel] = useState<NationalPanel | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Trocar o periodo mantem os numeros anteriores na tela ate chegarem os novos: "Atualizando…" avisa.
  const [refreshing, setRefreshing] = useState(false);
  const [attempt, setAttempt] = useState(0);

  const periodError = from && to && to < from ? 'O fim do período não pode ser antes do início.' : null;

  useEffect(() => {
    if (periodError) return;
    let active = true;
    setError(null);
    setRefreshing(true);
    nationalApi
      .panel(from || null, to || null)
      .then((result) => active && setPanel(result))
      .catch((err) => active && setError(err instanceof ApiError ? err.message : 'Não foi possível carregar o painel.'))
      .finally(() => active && setRefreshing(false));
    return () => {
      active = false;
    };
  }, [from, to, periodError, attempt]);

  const totals = panel?.totals;
  const stats = totals
    ? [
        { label: 'núcleos', value: totals.nucleos },
        { label: 'projetos ativos', value: totals.activeProjects },
        { label: 'projetos concluídos', value: totals.concludedProjects },
        { label: 'voluntários ativos', value: totals.activeVolunteers },
        { label: 'horas de voluntariado estimadas no período', value: totals.volunteerHours },
        { label: 'tarefas concluídas no período', value: totals.tasksCompleted },
        { label: 'registros de andamento no período', value: totals.records }
      ]
    : [];

  return (
    <>
      <div className="toolbar">
        <div className="field">
          <span className="field__label">Período</span>
          <div className="report-period">
            <TextInput
              type="date"
              aria-label="Início do período"
              value={from}
              invalid={Boolean(periodError)}
              onChange={(event) => setFrom(event.target.value)}
            />
            <span className="report-period__sep">a</span>
            <TextInput
              type="date"
              aria-label="Fim do período"
              value={to}
              invalid={Boolean(periodError)}
              onChange={(event) => setTo(event.target.value)}
            />
          </div>
          <div className="chip-group report-period__shortcuts" role="group" aria-label="Atalhos de período">
            {periodShortcuts().map((shortcut) => {
              const active = from === shortcut.from && to === shortcut.to;
              return (
                <button
                  key={shortcut.label}
                  type="button"
                  className={`chip${active ? ' chip--active' : ''}`}
                  aria-pressed={active}
                  onClick={() => {
                    setFrom(shortcut.from);
                    setTo(shortcut.to);
                  }}
                >
                  {shortcut.label}
                </button>
              );
            })}
          </div>
          {periodError ? <span className="field__error">{periodError}</span> : null}
        </div>
        <p className="field__hint" style={{ maxWidth: 420 }}>
          O período vale para horas, tarefas concluídas e registros. Projetos, voluntários e indicadores mostram a
          situação de hoje. Ativos: em planejamento, em andamento ou pausados. Horas estimadas: 6 h por semana de cada
          voluntário ativo (não são as horas lançadas nos projetos).
        </p>
      </div>

      {error ? <LoadError message={error} onRetry={() => setAttempt((current) => current + 1)} /> : null}
      {refreshing && panel ? (
        <p className="field__hint" role="status">
          Atualizando os números…
        </p>
      ) : null}

      {!panel ? (
        error ? null : <Loading label="Carregando o painel…" />
      ) : (
        <>
          <div className="national-stats">
            {stats.map((stat) => (
              <div key={stat.label} className="national-stat">
                <div className="national-stat__value num">{formatNumber(stat.value)}</div>
                <div className="national-stat__label">{stat.label}</div>
              </div>
            ))}
          </div>

          <section className="panel" style={{ marginTop: 16 }}>
            <div className="panel__head">
              <h2>Indicadores nacionais</h2>
            </div>
            <div className="panel__body">
              {panel.indicators.length === 0 ? (
                <EmptyState
                  title="Nenhum indicador nacional"
                  description="Cadastre na aba Indicadores nacionais: eles entram em todo projeto de todos os núcleos e a soma aparece aqui."
                />
              ) : (
                <>
                  <div className="national-stats">
                    {panel.indicators.map((indicator) => {
                      const coverage = coverageLabel(indicator.informed, indicator.projects);
                      return (
                        <div key={indicator.id} className="national-stat national-stat--result">
                          <div className="national-stat__value num">
                            {indicator.total == null ? (
                              '—'
                            ) : (
                              <>
                                {formatNumber(indicator.total)}
                                {indicator.unit ? <small> {indicator.unit}</small> : null}
                              </>
                            )}
                          </div>
                          <div className="national-stat__label">{indicator.name}</div>
                          {indicator.total == null ? (
                            <div className="national-stat__hint">nenhum projeto informou</div>
                          ) : coverage ? (
                            <div className="national-stat__hint">{coverage}</div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                  <p className="field__hint" style={{ marginTop: 10 }}>
                    Valores atuais, somados nos projetos de todos os núcleos (os arquivados entram; os cancelados, não).
                    Só soma o que foi informado: em branco não conta como zero, e "—" quer dizer que nenhum projeto
                    informou.
                  </p>
                </>
              )}
            </div>
          </section>

          <section className="panel" style={{ marginTop: 16 }}>
            <div className="panel__head">
              <h2>Por núcleo</h2>
              <span className="field__hint">
                Primeiro quem está há mais tempo sem atividade (registro de andamento ou tarefa concluída); {STALE_DAYS}{' '}
                dias ou mais: parado.
              </span>
            </div>
            <div className="table-wrap">
              <table className="table table--cards">
                <thead>
                  <tr>
                    <th>Núcleo</th>
                    <th className="tight">Última atividade</th>
                    <th className="tight">Projetos ativos</th>
                    <th className="tight">Concluídos</th>
                    <th className="tight">Voluntários ativos</th>
                    <th className="tight">Horas estimadas no período</th>
                    <th className="tight">Tarefas no período</th>
                    <th className="tight">Registros no período</th>
                    {panel.indicators.map((indicator) => (
                      <th key={indicator.id} className="tight">
                        {indicator.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {/* Quem esta parado ha mais tempo primeiro (sem nenhuma atividade, no topo). */}
                  {[...panel.nucleos]
                    .sort((a, b) => (daysSince(b.lastActivityAt) ?? Infinity) - (daysSince(a.lastActivityAt) ?? Infinity))
                    .map((row) => (
                    <tr key={row.id}>
                      <td className="cell--main" style={{ minWidth: 150 }}>
                        <div className="table__primary">{row.name}</div>
                        <div className="table__secondary">{[row.city, row.state].filter(Boolean).join(' / ') || '—'}</div>
                      </td>
                      <td className="tight" data-label="Última atividade">
                        <LastActivity value={row.lastActivityAt} />
                      </td>
                      <td className="tight num" data-label="Projetos ativos">{row.activeProjects}</td>
                      <td className="tight num" data-label="Concluídos">{row.concludedProjects}</td>
                      <td className="tight num" data-label="Voluntários ativos">{row.activeVolunteers}</td>
                      <td className="tight num" data-label="Horas estimadas">{formatNumber(row.volunteerHours)}</td>
                      <td className="tight num" data-label="Tarefas">{row.tasksCompleted}</td>
                      <td className="tight num" data-label="Registros">{row.records}</td>
                      {panel.indicators.map((indicator) => (
                        <td key={indicator.id} className="tight num" data-label={indicator.name}>
                          <SummedCell value={row.indicators[indicator.id]} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </>
  );
}

/** "há 3 dias" (data na dica) e a marca "parado" a partir de STALE_DAYS, ou quando nunca houve atividade. */
function LastActivity({ value }: { value: string | null }) {
  const days = daysSince(value);
  const stale = days === null || days >= STALE_DAYS;
  return (
    <span className="last-activity" title={value ? formatDate(value) : undefined}>
      {value ? timeAgo(value) : 'nenhuma'}
      {stale ? <span className="stale-mark">parado</span> : null}
    </span>
  );
}

/** Valor de um indicador nacional num nucleo: "—" quando nenhum projeto informou, e quantos informaram quando falta algum. */
function SummedCell({ value }: { value: SummedValue | undefined }) {
  if (!value || value.total == null) {
    return (
      <span className="table__secondary" title="Nenhum projeto informou">
        —
      </span>
    );
  }
  const coverage = coverageLabel(value.informed, value.projects);
  return (
    <>
      {formatNumber(value.total)}
      {coverage ? <div className="table__secondary">{coverage}</div> : null}
    </>
  );
}
