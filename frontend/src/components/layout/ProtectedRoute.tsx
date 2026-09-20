import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Loading } from '../ui/Feedback';
import type { ReactNode } from 'react';

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, initializing } = useAuth();
  const location = useLocation();

  if (initializing) return <Loading label="Verificando sessão…" />;
  if (!user) return <Navigate to="/entrar" replace state={{ from: location.pathname }} />;

  return <>{children}</>;
}
