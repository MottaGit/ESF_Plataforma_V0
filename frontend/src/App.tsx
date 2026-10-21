import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { HomePage } from './pages/HomePage';
import { LoginPage } from './pages/LoginPage';
import { PrivacyPage } from './pages/PrivacyPage';
import { ProgramRedirect, ProgramTemplatePage } from './pages/ProgramTemplatePage';
import { ProjectDetailPage } from './pages/ProjectDetailPage';
import { ProjectsPage } from './pages/ProjectsPage';
import { ReportsPage } from './pages/ReportsPage';
import { SettingsPage } from './pages/SettingsPage';
import { TasksPage } from './pages/TasksPage';
import { VolunteerDetailPage } from './pages/VolunteerDetailPage';
import { VolunteersPage } from './pages/VolunteersPage';

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            <Route path="/entrar" element={<LoginPage />} />
            <Route path="/privacidade" element={<PrivacyPage />} />
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
              <Route path="/programas/:id/modelo" element={<ProgramTemplatePage />} />
              <Route path="/voluntarios" element={<VolunteersPage />} />
              <Route path="/voluntarios/:id" element={<VolunteerDetailPage />} />
              <Route path="/relatorios" element={<ReportsPage />} />
              <Route path="/configuracoes" element={<SettingsPage />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
