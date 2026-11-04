import { useState, type FormEvent } from 'react';
import { ApiError } from '../../api/client';
import { myTermApi } from '../../api/endpoints';
import { useToast } from '../../context/ToastContext';
import type { MyTerm } from '../../types/api';
import { formatDateTime } from '../../utils/format';
import { Button } from '../ui/Button';
import { Field, TextInput } from '../ui/Field';
import { Alert } from '../ui/Feedback';
import { IconDownload } from '../ui/Icons';
import { Modal } from '../ui/Modal';

interface SignTermDialogProps {
  term: MyTerm;
  onClose: () => void;
  /** O termo depois de assinado (para a tela tirar o aviso de pendente). */
  onSigned: (term: MyTerm) => void;
}

/**
 * Leitura e assinatura online do termo de adesao pelo proprio voluntario: o texto inteiro, a resposta sobre uso de
 * imagem, o CPF, "li e concordo" e o nome completo digitado. Depois de assinar, oferece baixar a via assinada.
 */
export function SignTermDialog({ term, onClose, onSigned }: SignTermDialogProps) {
  const { notifyError } = useToast();
  const [imageAuthorized, setImageAuthorized] = useState<boolean | null>(null);
  const [cpf, setCpf] = useState('');
  const [fullName, setFullName] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [signing, setSigning] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signed, setSigned] = useState<MyTerm | null>(null);

  const ready = accepted && imageAuthorized !== null && cpf.trim() !== '' && fullName.trim() !== '';

  async function sign(event?: FormEvent) {
    event?.preventDefault();
    if (!ready) return;
    setSigning(true);
    setError(null);
    try {
      const result = await myTermApi.sign({ fullName, cpf, imageAuthorized, accepted });
      setSigned(result);
      onSigned(result);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível assinar o termo.');
    } finally {
      setSigning(false);
    }
  }

  async function download() {
    setDownloading(true);
    try {
      await myTermApi.download();
    } catch (err) {
      notifyError(err instanceof ApiError ? err.message : 'Não foi possível baixar o termo.');
    } finally {
      setDownloading(false);
    }
  }

  if (signed?.signed) {
    return (
      <Modal
        title="Termo assinado"
        size="narrow"
        onClose={onClose}
        footer={
          <>
            <Button onClick={onClose}>Fechar</Button>
            <Button variant="primary" icon={<IconDownload size={15} />} loading={downloading} onClick={() => void download()}>
              Baixar PDF
            </Button>
          </>
        }
      >
        <p className="term-done">
          Seu termo de adesão foi assinado em {formatDateTime(signed.signed.signedAt ?? signed.signed.signedOn)}. A via
          assinada fica em <strong>Minha conta</strong> para baixar quando quiser, e a coordenação também tem uma cópia.
        </p>
      </Modal>
    );
  }

  const { text } = term;

  return (
    <Modal
      title="Termo de adesão ao voluntariado"
      subtitle="Leia o termo inteiro. A assinatura online vale como a assinatura no papel."
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="primary" loading={signing} disabled={!ready} onClick={() => void sign()}>
            Assinar termo
          </Button>
        </>
      }
    >
      <article className="term-doc" tabIndex={0} aria-label="Texto do termo">
        <h3>{text.title}</h3>
        <p>{text.opening}</p>
        <dl className="term-doc__person">
          <div>
            <dt>Nome</dt>
            <dd>{term.volunteerName}</dd>
          </div>
          <div>
            <dt>CPF</dt>
            <dd>informado abaixo</dd>
          </div>
          {term.email ? (
            <div>
              <dt>E-mail</dt>
              <dd>{term.email}</dd>
            </div>
          ) : null}
          {term.phone ? (
            <div>
              <dt>Telefone</dt>
              <dd>{term.phone}</dd>
            </div>
          ) : null}
        </dl>
        <p>{text.commitment}</p>
        {text.clauses.map((clause) => (
          <p key={clause.title}>
            <strong>{clause.title}</strong> {clause.text}
          </p>
        ))}
      </article>

      <form className="term-sign" onSubmit={sign}>
        {error ? <Alert kind="error">{error}</Alert> : null}

        <fieldset className="term-sign__image">
          <legend>Uso da sua imagem (cláusula 6)</legend>
          <div className="term-sign__choices">
            {[
              { value: true, label: 'Autorizo', hint: 'Fotos e vídeos das atividades podem mostrar você.' },
              { value: false, label: 'Não autorizo', hint: 'A organização evita mostrar você em fotos e vídeos.' }
            ].map((option) => (
              <label key={option.label} className="term-choice">
                <input
                  type="radio"
                  name="image-authorized"
                  checked={imageAuthorized === option.value}
                  onChange={() => setImageAuthorized(option.value)}
                />
                <span>
                  <strong>{option.label}</strong>
                  <small>{option.hint}</small>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="form-grid">
          <Field label="CPF" htmlFor="term-cpf" required hint="Vai só no documento assinado.">
            <TextInput
              id="term-cpf"
              inputMode="numeric"
              autoComplete="off"
              placeholder="000.000.000-00"
              value={cpf}
              onChange={(event) => setCpf(event.target.value)}
            />
          </Field>
          <Field label="Nome completo" htmlFor="term-name" required hint={`Como está no cadastro: ${term.volunteerName}`}>
            <TextInput
              id="term-name"
              autoComplete="name"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
            />
          </Field>
        </div>

        <label className="checkbox term-sign__accept">
          <input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} />
          Li o termo e concordo com ele
        </label>
        <button type="submit" style={{ display: 'none' }} aria-hidden="true" />
      </form>
    </Modal>
  );
}
