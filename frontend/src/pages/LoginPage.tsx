import { useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { ApiError } from '../api/client';
import { Button } from '../components/ui/Button';
import { Field, PasswordInput, TextInput } from '../components/ui/Field';
import { Alert } from '../components/ui/Feedback';
import { useAuth } from '../context/AuthContext';

/**
 * Para onde ir depois de entrar: a tela que a pessoa tentou abrir sem sessao (um link recebido pelo WhatsApp, a sessao
 * que venceu no meio do uso), guardada pelo ProtectedRoute. So caminhos de dentro do app; sem ele, o Inicio.
 */
function destinationFrom(state: unknown) {
  const from = (state as { from?: unknown } | null)?.from;
  if (typeof from !== 'string' || !from.startsWith('/') || from.startsWith('//') || from.startsWith('/entrar')) return '/';
  return from;
}

export function LoginPage() {
  const { user, initializing, login } = useAuth();
  const navigate = useNavigate();
  const destination = destinationFrom(useLocation().state);

  // Ja vem com o acesso de administrador da demonstracao (o mesmo do seed).
  const [email, setEmail] = useState('leonardo.motta@esf.org.br');
  const [password, setPassword] = useState('Esf@2026');
  const [error, setError] = useState<string | null>(null);
  // Senha errada, acesso bloqueado ou desativado: o caminho para quem esqueceu a senha ja aparece aberto.
  const [credentialsRefused, setCredentialsRefused] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  if (!initializing && user) return <Navigate to={destination} replace />;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      await login(email.trim(), password);
      navigate(destination, { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível entrar. Tente novamente.');
      setCredentialsRefused(err instanceof ApiError && [401, 403, 429].includes(err.status));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="login">
      <section className="login__aside">
        <div className="login__brand">
          <span className="sidebar__mark">ESF</span>
          <span className="login__brand-name">Engenheiros Sem Fronteiras</span>
        </div>

        <div>
          <h1 className="login__headline">Gerencie os projetos da sua organização em um só lugar.</h1>
          <ul className="login__points">
            <li>Acompanhe o andamento de cada projeto e o que está atrasado</li>
            <li>Organize tarefas, voluntários e resultados alcançados</li>
            <li>Gere relatórios em PDF para parceiros e prestação de contas</li>
          </ul>
        </div>
      </section>

      <section className="login__panel">
        <form className="login__form" onSubmit={handleSubmit}>
          <h1>Entrar na plataforma</h1>
          <p className="login__form-desc">Use o e-mail cadastrado pela coordenação do núcleo.</p>

          <div className="login__fields">
            <Field label="E-mail" htmlFor="email" required>
              <TextInput
                id="email"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </Field>

            <Field label="Senha" htmlFor="password" required>
              <PasswordInput
                id="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </Field>

            {error ? <Alert kind="error">{error}</Alert> : null}
          </div>

          <Button type="submit" variant="primary" block loading={submitting}>
            Entrar
          </Button>

          {/* Nao ha "esqueci minha senha" por e-mail: quem gera o link novo e a coordenacao do nucleo. */}
          <div className="login__forgot">
            {showForgot || credentialsRefused ? (
              <p className="login__forgot-text" role="note">
                <strong>Esqueceu a senha?</strong> Peça à coordenação do seu núcleo um link novo de acesso. Ele chega
                pelo WhatsApp ou por e-mail e, ao abrir, você cria uma senha nova.
              </p>
            ) : (
              <button type="button" className="link-button" onClick={() => setShowForgot(true)}>
                Esqueci minha senha
              </button>
            )}
          </div>

          <div className="login__demo">
            <strong>Acessos de demonstração</strong>
            <div className="login__demo-row">
              <span>leonardo.motta@esf.org.br</span>
              <span>Administrador</span>
            </div>
            <div className="login__demo-row">
              <span>ana.aumond@esf.org.br</span>
              <span>Coordenador</span>
            </div>
            <div className="login__demo-row">
              <span>fausto.silva@esf.org.br</span>
              <span>Usuário</span>
            </div>
            <div className="login__demo-row">
              <span>marina.costa@esf.org.br</span>
              <span>Administradora (Curitiba)</span>
            </div>
            <div className="login__demo-row">
              <span>nacional@esf.org.br</span>
              <span>Gestão nacional</span>
            </div>
            <div className="login__demo-row">
              <span>Senha para todos</span>
              <strong>Esf@2026</strong>
            </div>
          </div>

          <p className="login__legal">
            <Link to="/privacidade">Política de privacidade e termos de uso</Link>
          </p>
        </form>
      </section>
    </div>
  );
}
