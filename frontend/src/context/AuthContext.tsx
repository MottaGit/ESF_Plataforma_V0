import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { authApi } from '../api/endpoints';
import { onUnauthorized, tokenStore } from '../api/client';
import type { LoginResponse, User } from '../types/api';

interface AuthContextValue {
  user: User | null;
  initializing: boolean;
  login: (email: string, password: string) => Promise<void>;
  /** Comeca a sessao com um login ja feito (link de primeiro acesso: a pessoa cria a senha e ja entra). */
  startSession: (result: LoginResponse) => void;
  logout: () => void;
  /** Recarrega o usuario da sessao (ex.: depois de trocar a foto do proprio voluntario). */
  refreshUser: () => Promise<void>;
  /** Administrador e Coordenador podem criar e editar projetos, voluntarios e indicadores. */
  canManage: boolean;
  isAdmin: boolean;
  /** O acesso e de um nucleo (conta so da gestao nacional nao tem: so ve a area Nacional). */
  hasNucleo: boolean;
  /** Faz parte da gestao nacional (area Nacional no menu). */
  isNational: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [initializing, setInitializing] = useState(true);

  const logout = useCallback(() => {
    tokenStore.clear();
    setUser(null);
  }, []);

  useEffect(() => {
    let active = true;

    async function restoreSession() {
      if (!tokenStore.get()) {
        setInitializing(false);
        return;
      }

      try {
        const current = await authApi.me();
        if (active) setUser(current);
      } catch {
        tokenStore.clear();
      } finally {
        if (active) setInitializing(false);
      }
    }

    void restoreSession();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => onUnauthorized(() => setUser(null)), []);

  const refreshUser = useCallback(async () => {
    try {
      setUser(await authApi.me());
    } catch {
      // Sem sessao valida o onUnauthorized ja cuida de sair; outros erros mantem o usuario atual.
    }
  }, []);

  const startSession = useCallback((result: LoginResponse) => {
    tokenStore.set(result.token);
    setUser(result.user);
  }, []);

  const login = useCallback(
    async (email: string, password: string) => startSession(await authApi.login(email, password)),
    [startSession]
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      initializing,
      login,
      startSession,
      logout,
      refreshUser,
      // Conta so nacional tem um perfil de nucleo so por formalidade: nao gerencia nada dentro dos nucleos.
      canManage: Boolean(user?.organizationId) && (user?.role === 'Administrador' || user?.role === 'Coordenador'),
      isAdmin: Boolean(user?.organizationId) && user?.role === 'Administrador',
      hasNucleo: Boolean(user?.organizationId),
      isNational: Boolean(user?.isNational)
    }),
    [user, initializing, login, startSession, logout, refreshUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth precisa estar dentro de AuthProvider.');
  return context;
}
