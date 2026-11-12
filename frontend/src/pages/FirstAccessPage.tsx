import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ApiError } from '../api/client';
import { accessApi } from '../api/endpoints';
import { BrandMark } from '../components/ui/BrandMark';
import { Button } from '../components/ui/Button';
import { Field, PasswordInput } from '../components/ui/Field';
import { Alert, Loading } from '../components/ui/Feedback';
import { useAuth } from '../context/AuthContext';
import type { AccessLinkInfo } from '../types/api';

/**
 * Pagina publica do link de acesso (/acesso/:codigo): a pessoa cria a propria senha, aceita a politica de
 * privacidade e ja entra. Serve para o primeiro acesso e para quem esqueceu a senha.
 */
export function FirstAccessPage() {
  const { token = '' } = useParams();
  const { startSession, logout } = useAuth();
  const navigate = useNavigate();

  const [info, setInfo] = useState<AccessLinkInfo | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  // 410: o link ja foi usado, venceu ou foi trocado. O caso mais comum e quem ja criou a senha e tocou de novo no link.
  const [linkGone, setLinkGone] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    accessApi
      .info(token)
      .then(setInfo)
      .catch((err) => {
        setLinkGone(err instanceof ApiError && err.status === 410);
        setLoadError(err instanceof ApiError ? err.message : 'Não foi possível abrir o link.');
      });
  }, [token]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (password.length < 6) {
      setError('A senha deve ter ao menos 6 caracteres.');
      return;
    }
    if (password !== confirm) {
      setError('As duas senhas não são iguais.');
      return;
    }
    if (!accepted) {
      setError('Para entrar, aceite a política de privacidade e os termos de uso.');
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      const result = await accessApi.use(token, password);
      // Outra pessoa logada neste navegador sai antes: a sessao passa a ser de quem usou o link.
      logout();
      startSession(result);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível criar a senha. Tente novamente.');
      setSubmitting(false);
    }
  }

  return (
    <div className="login">
      <section className="login__aside">
        <div className="login__brand">
          <BrandMark />
          <span className="login__brand-name">Engenheiros Sem Fronteiras</span>
        </div>
        <div>
          <h1 className="login__headline">Seu acesso à plataforma de gestão do núcleo.</h1>
          <ul className="login__points">
            <li>Crie sua senha: só você vai saber qual é</li>
            <li>Depois, entre sempre com o seu e-mail e essa senha</li>
            <li>Esqueceu? Peça um link novo à coordenação do núcleo</li>
          </ul>
        </div>
      </section>

      <section className="login__panel">
        {linkGone ? (
          <div className="login__form">
            <h1>Este link não vale mais</h1>
            <p className="login__form-desc">
              Ele já foi usado, venceu ou foi trocado por um novo. <strong>Se você já criou sua senha</strong>, é só
              entrar com o seu e-mail e essa senha.
            </p>
            <Link className="btn btn--primary btn--block" to="/entrar">
              Entrar com e-mail e senha
            </Link>
            <p className="login__legal">
              Ainda não criou a senha, ou esqueceu? Peça um link novo à coordenação do seu núcleo: ele vale 7 dias e uma
              vez só.
            </p>
          </div>
        ) : loadError ? (
          <div className="login__form">
            <h1>Link indisponível</h1>
            <Alert kind="error">{loadError}</Alert>
            <p className="login__legal">
              <Link to="/entrar">Ir para a tela de entrada</Link>
            </p>
          </div>
        ) : !info ? (
          <Loading label="Abrindo o link…" />
        ) : (
          <form className="login__form" onSubmit={handleSubmit}>
            <h1>{info.firstAccess ? 'Crie sua senha' : 'Crie uma nova senha'}</h1>
            <p className="login__form-desc">
              Olá, {info.name.split(' ')[0]}! Seu login é <strong>{info.email}</strong>.
            </p>

            <div className="login__fields">
              <Field label="Senha" htmlFor="new-password" required hint="Mínimo de 6 caracteres.">
                <PasswordInput
                  id="new-password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />
              </Field>
              <Field label="Confirmar senha" htmlFor="confirm-password" required>
                <PasswordInput
                  id="confirm-password"
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(event) => setConfirm(event.target.value)}
                  required
                />
              </Field>
              <label className="checkbox">
                <input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} />
                <span>
                  Li e aceito a{' '}
                  <Link to="/privacidade" target="_blank">
                    política de privacidade e os termos de uso
                  </Link>
                </span>
              </label>

              {error ? <Alert kind="error">{error}</Alert> : null}
            </div>

            <Button type="submit" variant="primary" block loading={submitting}>
              Salvar senha e entrar
            </Button>
          </form>
        )}
      </section>
    </div>
  );
}
