import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { ApiError } from '../../api/client';
import { nationalIndicatorsApi } from '../../api/endpoints';
import { NeutralBadge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Field, TextArea, TextInput } from '../ui/Field';
import { Alert, EmptyState, Loading } from '../ui/Feedback';
import { IconPlus } from '../ui/Icons';
import { Menu } from '../ui/Menu';
import { Modal } from '../ui/Modal';
import { useToast } from '../../context/ToastContext';
import type { NationalIndicator } from '../../types/api';
import { emptyToNull } from '../../utils/format';

/**
 * Indicadores nacionais: a lista comum que entra em todo projeto de todos os nucleos. O painel soma pelo vinculo;
 * renomear vale para todos os nucleos; arquivar deixa de exigir sem apagar o que ja foi registrado.
 */
export function NationalIndicatorsSection() {
  const { notify, notifyError } = useToast();
  const [indicators, setIndicators] = useState<NationalIndicator[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<NationalIndicator | 'new' | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setIndicators(await nationalIndicatorsApi.list(true));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível carregar os indicadores nacionais.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function setArchived(indicator: NationalIndicator, archived: boolean) {
    try {
      await nationalIndicatorsApi.setArchived(indicator.id, archived);
      notify(archived ? 'Indicador arquivado.' : 'Indicador reativado.');
      void load();
    } catch (err) {
      notifyError(err instanceof ApiError ? err.message : 'Não foi possível alterar o indicador.');
    }
  }

  return (
    <>
      <div className="toolbar">
        <p className="field__hint measure">
          Estes indicadores entram sozinhos em todo projeto de todos os núcleos, em branco até cada núcleo informar o
          número; é o que permite somar os resultados de todos. Diga como contar, para todos contarem do mesmo jeito.
          Mudar o nome ou a unidade vale para todos os núcleos; arquivar deixa de exigir o indicador (os números já
          informados continuam).
        </p>
        <div className="toolbar__right">
          <Button variant="primary" small icon={<IconPlus size={15} />} onClick={() => setEditing('new')}>
            Novo indicador nacional
          </Button>
        </div>
      </div>

      {error ? <Alert kind="error">{error}</Alert> : null}

      <section className="panel">
        {loading ? (
          <Loading label="Carregando indicadores…" />
        ) : indicators.length === 0 ? (
          <EmptyState
            title="Nenhum indicador nacional"
            description="Cadastre os resultados que todos os núcleos acompanham (ex.: pessoas beneficiadas, famílias atendidas)."
          />
        ) : (
          <div className="table-wrap">
            <table className="table table--cards">
              <thead>
                <tr>
                  <th>Indicador</th>
                  <th>Unidade</th>
                  <th>Como contar</th>
                  <th>Situação</th>
                  <th className="right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {indicators.map((indicator) => (
                  <tr key={indicator.id}>
                    <td className="table__primary cell--main">{indicator.name}</td>
                    <td data-label="Unidade">{indicator.unit ?? '—'}</td>
                    <td className="table__secondary cell--wide">{indicator.description ?? '—'}</td>
                    <td>
                      <NeutralBadge>{indicator.isArchived ? 'Arquivado' : 'Ativo'}</NeutralBadge>
                    </td>
                    <td className="cell--actions">
                      <div className="row-actions">
                        <Menu
                          label={`Ações de ${indicator.name}`}
                          items={[
                            { label: 'Editar', onSelect: () => setEditing(indicator) },
                            indicator.isArchived
                              ? { label: 'Reativar', onSelect: () => void setArchived(indicator, false) }
                              : { label: 'Arquivar', onSelect: () => void setArchived(indicator, true) }
                          ]}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {editing ? (
        <NationalIndicatorFormModal
          indicator={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            notify(editing === 'new' ? 'Indicador nacional criado.' : 'Indicador nacional atualizado.');
            setEditing(null);
            void load();
          }}
        />
      ) : null}
    </>
  );
}

function NationalIndicatorFormModal({
  indicator,
  onClose,
  onSaved
}: {
  indicator: NationalIndicator | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(indicator?.name ?? '');
  const [unit, setUnit] = useState(indicator?.unit ?? '');
  const [description, setDescription] = useState(indicator?.description ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event?: FormEvent) {
    event?.preventDefault();
    if (name.trim().length < 2) {
      setError('Informe o nome do indicador.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = { name: name.trim(), unit: emptyToNull(unit), description: emptyToNull(description) };
      if (indicator) await nationalIndicatorsApi.update(indicator.id, payload);
      else await nationalIndicatorsApi.create(payload);
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível salvar o indicador.');
      setSaving(false);
    }
  }

  return (
    <Modal
      guardChanges
      title={indicator ? 'Editar indicador nacional' : 'Novo indicador nacional'}
      subtitle={indicator ? 'Nome e unidade novos valem para todos os núcleos.' : 'Entra em todos os projetos de todos os núcleos, em branco até cada um informar.'}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="primary" loading={saving} onClick={() => void handleSubmit()}>
            Salvar
          </Button>
        </>
      }
    >
      <form className="form-grid" onSubmit={handleSubmit}>
        {error ? (
          <div className="span-2">
            <Alert kind="error">{error}</Alert>
          </div>
        ) : null}
        <Field label="Nome" htmlFor="national-indicator-name" required>
          <TextInput
            id="national-indicator-name"
            value={name}
            placeholder="Ex.: Pessoas beneficiadas"
            onChange={(event) => setName(event.target.value)}
          />
        </Field>
        <Field label="Unidade" htmlFor="national-indicator-unit">
          <TextInput
            id="national-indicator-unit"
            maxLength={60}
            value={unit}
            placeholder="Ex.: pessoas, famílias, m²"
            onChange={(event) => setUnit(event.target.value)}
          />
        </Field>
        <Field
          label="Como contar"
          htmlFor="national-indicator-description"
          span
          hint="Aparece para os núcleos ao informar o número. Ex.: conte só quem usa a obra diretamente, não visitantes."
        >
          <TextArea
            id="national-indicator-description"
            maxLength={600}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </Field>
        <button type="submit" hidden aria-hidden="true" />
      </form>
    </Modal>
  );
}
