import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { ApiError } from '../api/client';
import { Button } from '../components/ui/Button';
import { Field, TextInput } from '../components/ui/Field';
import { Alert } from '../components/ui/Feedback';
import { useAuth } from '../context/AuthContext';

export function LoginPage() {
  const { user, initializing, login } = useAuth();
  const navigate = useNavigate();

  // Ja vem com o acesso de administrador da demonstracao (o mesmo do seed).
  const [email, setEmail] = useState('leonardo.motta@esf.org.br');
  const [password, setPassword] = useState('Esf@2026');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!initializing && user) return <Navigate to="/" replace />;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      await login(email.trim(), password);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível entrar. Tente novamente.');
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
            <li>Registre atividades, voluntários e resultados alcançados</li>
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
              <TextInput
                id="password"
                type="password"
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
              <span>Senha para todos</span>
              <strong>Esf@2026</strong>
            </div>
          </div>
        </form>
      </section>
    </div>
  );
}
