import { Navigate, useSearchParams } from 'react-router-dom';
import { AuditSection } from '../components/settings/AuditSection';
import { SpreadsheetsSection } from '../components/settings/SpreadsheetsSection';
import { ScrollTabs } from '../components/ui/ScrollTabs';
import { useAuth } from '../context/AuthContext';
import { AccountSection } from '../components/settings/AccountSection';
import { OrganizationSection } from '../components/settings/OrganizationSection';
import { UsersSection } from '../components/settings/UsersSection';

type TabKey = 'organization' | 'users' | 'spreadsheets' | 'history' | 'account';

// A aba aberta fica na URL (?aba=conta), para o menu da conta e links diretos cairem no lugar certo.
const tabs: Array<{ key: TabKey; label: string; slug: string; adminOnly?: boolean; manageOnly?: boolean }> = [
  { key: 'organization', label: 'Organização', slug: 'organizacao', manageOnly: true },
  { key: 'users', label: 'Acessos', slug: 'acessos', manageOnly: true },
  { key: 'spreadsheets', label: 'Planilhas', slug: 'planilhas', adminOnly: true },
  { key: 'history', label: 'Histórico', slug: 'historico', adminOnly: true },
  { key: 'account', label: 'Minha conta', slug: 'conta' }
];

export function SettingsPage() {
  const { isAdmin, canManage } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  // Coordenacao ve tudo (o historico so a administracao); o voluntario comum, so a propria conta.
  const visibleTabs = tabs.filter((item) => (!item.adminOnly || isAdmin) && (!item.manageOnly || canManage));
  // "usuarios" e o nome antigo da aba Acessos, que links ja enviados ainda usam.
  const slug = searchParams.get('aba') === 'usuarios' ? 'acessos' : searchParams.get('aba');
  const tab = visibleTabs.find((item) => item.slug === slug)?.key ?? visibleTabs[0].key;

  // Os programas sairam daqui e foram para Projetos › Programas; links antigos continuam funcionando.
  if (searchParams.get('aba') === 'programas') return <Navigate to="/programas" replace />;

  function setTab(key: TabKey) {
    setSearchParams(key === visibleTabs[0].key ? {} : { aba: tabs.find((item) => item.key === key)!.slug }, { replace: true });
  }

  return (
    <>
      <div className="page-head">
        <div className="page-head__text">
          <h1>{canManage ? 'Configurações' : 'Minha conta'}</h1>
        </div>
      </div>

      {visibleTabs.length > 1 ? (
        <ScrollTabs activeKey={tab}>
          {visibleTabs.map((item) => (
            <button
              key={item.key}
              type="button"
              className={`tab${tab === item.key ? ' tab--active' : ''}`}
              onClick={() => setTab(item.key)}
            >
              {item.label}
            </button>
          ))}
        </ScrollTabs>
      ) : null}

      {tab === 'organization' ? <OrganizationSection canEdit={isAdmin} /> : null}
      {tab === 'users' ? <UsersSection canEdit={isAdmin} canGrant={canManage} /> : null}
      {tab === 'spreadsheets' ? <SpreadsheetsSection /> : null}
      {tab === 'history' ? <AuditSection /> : null}
      {tab === 'account' ? <AccountSection /> : null}
    </>
  );
}
