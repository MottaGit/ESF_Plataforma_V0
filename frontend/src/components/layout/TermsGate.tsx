import { useState } from 'react';
import { ApiError } from '../../api/client';
import { authApi } from '../../api/endpoints';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../ui/Button';
import { Alert } from '../ui/Feedback';
import { Modal } from '../ui/Modal';

/**
 * Pedido de aceite da politica de privacidade e dos termos de uso: aparece no primeiro acesso (e de novo
 * quando o texto muda) e so sai depois do aceite.
 */
export function TermsGate() {
  const { user, refreshUser, logout } = useAuth();
  const [checked, setChecked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!user?.termsPending) return null;

  async function accept() {
    setSaving(true);
    setError(null);
    try {
      await authApi.acceptTerms();
      await refreshUser();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível registrar o aceite.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      title="Política de privacidade e termos de uso"
      subtitle="Antes de continuar, leia e aceite como tratamos os dados na plataforma."
      closable={false}
      onClose={() => undefined}
      footer={
        <>
          <Button onClick={logout}>Sair</Button>
          <Button variant="primary" disabled={!checked} loading={saving} onClick={() => void accept()}>
            Aceitar e continuar
          </Button>
        </>
      }
    >
      <div className="terms-gate">
        <ul>
          <li>Guardamos o necessário para organizar projetos, voluntariado e prestação de contas.</li>
          <li>Não vendemos dados; relatórios com fotos autorizadas vão para parceiros e financiadores.</li>
          <li>Não registre dados sensíveis (saúde, religião e afins) nem CPF nos campos livres.</li>
          <li>Publique fotos de pessoas somente com autorização de uso de imagem.</li>
          <li>Seu acesso é pessoal; não compartilhe a senha.</li>
        </ul>
        <p>
          <a href="/privacidade" target="_blank" rel="noreferrer">
            Ler a política completa
          </a>
        </p>
        {error ? <Alert kind="error">{error}</Alert> : null}
        <label className="checkbox terms-gate__check">
          <input type="checkbox" checked={checked} onChange={(event) => setChecked(event.target.checked)} />
          Li e aceito a política de privacidade e os termos de uso
        </label>
      </div>
    </Modal>
  );
}
