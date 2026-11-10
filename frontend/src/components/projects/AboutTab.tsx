import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ApiError } from '../../api/client';
import { indicatorsApi } from '../../api/endpoints';
import { useToast } from '../../context/ToastContext';
import type { Indicator, ProjectDetail } from '../../types/api';
import { formatDate, formatNumber, timeAgoPhrase } from '../../utils/format';
import { SignedDocumentsPanel } from '../documents/SignedDocumentsPanel';
import { Button } from '../ui/Button';
import { ConfirmDialog, EmptyState } from '../ui/Feedback';
import { IconEdit, IconPlus, IconTrash } from '../ui/Icons';
import { IndicatorFormModal } from './IndicatorModals';

interface AboutTabProps {
  project: ProjectDetail;
  canManage: boolean;
  onChanged: () => void;
}

/** Dados cadastrais do projeto e seus indicadores de resultado. */
export function AboutTab({ project, canManage, onChanged }: AboutTabProps) {
  const { notify, notifyError } = useToast();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Indicator | null>(null);
  const [removing, setRemoving] = useState<Indicator | null>(null);
  const [busy, setBusy] = useState(false);

  const location = [project.address, project.district, project.city, project.state].filter(Boolean).join(', ');

  function openNew() {
    setEditing(null);
    setFormOpen(true);
  }

  async function handleDelete() {
    if (!removing) return;
    setBusy(true);
    try {
      await indicatorsApi.remove(removing.id);
      notify('Indicador excluído.');
      setRemoving(null);
      onChanged();
    } catch (err) {
      notifyError(err instanceof ApiError ? err.message : 'Não foi possível excluir o indicador.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="grid-sidebar">
        <div style={{ display: 'grid', gap: 16, alignContent: 'start' }}>
          <section className="panel">
            <div className="panel__head">
              <h2>Sobre o projeto</h2>
            </div>
            <div className="panel__body">
              <div style={{ display: 'grid', gap: 16 }}>
                <div>
                  <div className="meta__label">Descrição</div>
                  <p className="meta__value about__text">{project.description ?? 'Sem descrição registrada.'}</p>
                </div>
                <div>
                  <div className="meta__label">Objetivo</div>
                  <p className="meta__value about__text">{project.objective ?? 'Sem objetivo registrado.'}</p>
                </div>
                {project.notes ? (
                  <div>
                    <div className="meta__label">Observações</div>
                    <p className="meta__value about__text">{project.notes}</p>
                  </div>
                ) : null}
              </div>
            </div>
          </section>

          <section className="panel">
            <div className="panel__head">
              <h2>Indicadores do projeto</h2>
              <div className="panel__actions">
                <Button variant="primary" small icon={<IconPlus size={15} />} onClick={openNew}>
                  Novo indicador
                </Button>
              </div>
            </div>
            <div className="panel__body">
              {project.indicators.length === 0 ? (
                <EmptyState
                  title="Sem indicadores"
                  description="Registre indicadores para mostrar resultados em relatórios e prestação de contas."
                  action={
                    <Button variant="primary" onClick={openNew}>
                      Criar indicador
                    </Button>
                  }
                />
              ) : (
                project.indicators.map((indicator) => (
                  <div className="indicator" key={indicator.id}>
                    <div className="indicator__top">
                      <span className="indicator__name">
                        {indicator.name}
                        {indicator.nationalIndicatorId ? (
                          <span
                            className="national-mark"
                            title="Indicador nacional: está em todo projeto e entra na soma de todos os núcleos"
                          >
                            nacional
                          </span>
                        ) : null}
                      </span>
                      <span className="indicator__values num">
                        {indicator.value == null ? (
                          <span className="indicator__blank">
                            não informado{indicator.target != null ? ` · meta ${formatNumber(indicator.target)}` : ''}
                          </span>
                        ) : (
                          <>
                            <strong>{formatNumber(indicator.value)}</strong>
                            {indicator.target != null ? ` de ${formatNumber(indicator.target)}` : ''}
                            {indicator.unit ? ` ${indicator.unit}` : ''}
                            {indicator.valueUpdatedAt ? (
                              <span className="indicator__when"> · atualizado {timeAgoPhrase(indicator.valueUpdatedAt)}</span>
                            ) : null}
                          </>
                        )}
                      </span>
                      <div className="row-actions" style={{ marginLeft: 8 }}>
                        <Button
                          small
                          variant="ghost"
                          icon={<IconEdit size={15} />}
                          title="Editar indicador"
                          aria-label="Editar indicador"
                          onClick={() => {
                            setEditing(indicator);
                            setFormOpen(true);
                          }}
                        />
                        {/* Nacional nao sai do projeto: fica em branco enquanto nao houver o numero. */}
                        {canManage && !indicator.nationalIndicatorId ? (
                          <Button
                            small
                            variant="ghost"
                            icon={<IconTrash size={15} />}
                            title="Excluir indicador"
                            aria-label="Excluir indicador"
                            onClick={() => setRemoving(indicator)}
                          />
                        ) : null}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>

        <div style={{ display: 'grid', gap: 16, alignContent: 'start' }}>
        <section className="panel">
          <div className="panel__head">
            <h2>Informações gerais</h2>
          </div>
          <div className="panel__body">
            <div className="meta-list">
              <MetaItem
                label="Período"
                value={`${formatDate(project.startDate)} até ${
                  project.closedOn
                    ? `${formatDate(project.closedOn)} (${project.status === 'Cancelado' ? 'cancelado' : 'concluído'})`
                    : project.endDateForecast
                      ? `${formatDate(project.endDateForecast)} (previsão)`
                      : 'sem previsão'
                }`}
              />
              <MetaItem label="Comunidade ou família atendida" value={project.beneficiaries ?? '—'} />
              <MetaItem label="Quem se beneficia" value={project.targetAudience ?? '—'} />
              <MetaItem label="Localização" value={location || '—'} />
              <div>
                <div className="meta__label">No mapa</div>
                <div className="meta__value">
                  {project.latitude != null && project.longitude != null ? (
                    <Link to={`/projetos?exibir=mapa&foco=${project.id}`}>Ver no mapa</Link>
                  ) : (
                    'Ainda não marcado (Editar projeto › Marcar no mapa)'
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        {canManage ? (
          <SignedDocumentsPanel
            owner={{ type: 'project', id: project.id }}
            title="Autorização de imagem dos beneficiários"
            description="Necessária para usar fotos que mostram as famílias atendidas em relatórios e redes. Gere o termo, colha a assinatura de cada família e envie as cópias."
            templateLabel="Gerar autorização para assinar"
            onChanged={onChanged}
          />
        ) : null}
        </div>
      </div>

      {formOpen ? (
        <IndicatorFormModal
          projectId={project.id}
          indicator={editing}
          onClose={() => setFormOpen(false)}
          onSaved={() => {
            setFormOpen(false);
            notify(editing ? 'Indicador atualizado.' : 'Indicador criado.');
            onChanged();
          }}
        />
      ) : null}

      {removing ? (
        <ConfirmDialog
          title="Excluir indicador"
          message={`O indicador "${removing.name}" será removido do projeto.`}
          confirmLabel="Excluir"
          destructive
          busy={busy}
          onCancel={() => setRemoving(null)}
          onConfirm={() => void handleDelete()}
        />
      ) : null}
    </>
  );
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="meta__label">{label}</div>
      <div className="meta__value">{value}</div>
    </div>
  );
}
