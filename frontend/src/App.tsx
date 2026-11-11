import { Suspense, lazy, type ComponentType } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import { Loading } from './components/ui/Feedback';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { HomePage } from './pages/HomePage';
import { LoginPage } from './pages/LoginPage';

/**
 * Tela carregada so quando aberta (cada uma vira um arquivo .js proprio no build): a primeira abertura no celular
 * baixa so o Inicio e o login. O service worker guarda todos os arquivos no primeiro acesso, entao sem internet as
 * telas continuam abrindo.
 */
function page<M, K extends keyof M>(load: () => Promise<M>, name: K) {
  return lazy(() => load().then((module) => ({ default: module[name] as ComponentType })));
}

const FirstAccessPage = page(() => import('./pages/FirstAccessPage'), 'FirstAccessPage');
const HelpPage = page(() => import('./pages/HelpPage'), 'HelpPage');
const NationalPage = page(() => import('./pages/NationalPage'), 'NationalPage');
const PrivacyPage = page(() => import('./pages/PrivacyPage'), 'PrivacyPage');
const PublicProgramPage = page(() => import('./pages/PublicProgramPage'), 'PublicProgramPage');
const ProgramEditPage = page(() => import('./pages/ProgramEditPage'), 'ProgramEditPage');
const ProgramRedirect = page(() => import('./pages/ProgramEditPage'), 'ProgramRedirect');
const ProgramTemplateRedirect = page(() => import('./pages/ProgramEditPage'), 'ProgramTemplateRedirect');
const ProjectDetailPage = page(() => import('./pages/ProjectDetailPage'), 'ProjectDetailPage');
const ProjectsPage = page(() => import('./pages/ProjectsPage'), 'ProjectsPage');
const ReportsPage = page(() => import('./pages/ReportsPage'), 'ReportsPage');
const SettingsPage = page(() => import('./pages/SettingsPage'), 'SettingsPage');
const TasksPage = page(() => import('./pages/TasksPage'), 'TasksPage');
const VolunteerDetailPage = page(() => import('./pages/VolunteerDetailPage'), 'VolunteerDetailPage');
const VolunteersPage = page(() => import('./pages/VolunteersPage'), 'VolunteersPage');

/** Area Nacional: so para quem faz parte da gestao nacional. */
function NationalRoute() {
  const { isNational } = useAuth();
  return isNational ? <NationalPage /> : <Navigate to="/" replace />;
}

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          {/* As telas de dentro do app tem o proprio Suspense (no AppLayout), que mantem o menu na tela. */}
          <Suspense fallback={<Loading />}>
            <Routes>
              <Route path="/entrar" element={<LoginPage />} />
              <Route path="/acesso/:token" element={<FirstAccessPage />} />
              <Route path="/privacidade" element={<PrivacyPage />} />
              {/* Pagina publica do programa: sem login, para parceiros e financiadores. */}
              <Route path="/publico/:token" element={<PublicProgramPage />} />
              <Route
                element={
                  <ProtectedRoute>
                    <AppLayout />
                  </ProtectedRoute>
                }
              >
                <Route path="/" element={<HomePage />} />
                <Route path="/projetos" element={<ProjectsPage />} />
                <Route path="/projetos/:id" element={<ProjectDetailPage />} />
                <Route path="/tarefas" element={<TasksPage />} />
                <Route path="/programas" element={<Navigate to="/projetos" replace />} />
                <Route path="/programas/:id" element={<ProgramRedirect />} />
                <Route path="/programas/:id/editar" element={<ProgramEditPage />} />
                <Route path="/programas/:id/modelo" element={<ProgramTemplateRedirect />} />
                <Route path="/voluntarios" element={<VolunteersPage />} />
                <Route path="/voluntarios/:id" element={<VolunteerDetailPage />} />
                <Route path="/relatorios" element={<ReportsPage />} />
                <Route path="/configuracoes" element={<SettingsPage />} />
                <Route path="/ajuda" element={<HelpPage />} />
                <Route path="/nacional" element={<NationalRoute />} />
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
