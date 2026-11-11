import { useSearchParams } from 'react-router-dom';
import { ScrollTabs } from '../components/ui/ScrollTabs';
import { NationalIndicatorsSection } from '../components/national/NationalIndicatorsSection';
import { NucleosSection } from '../components/national/NucleosSection';
import { PanelSection } from '../components/national/PanelSection';
import { PeopleSection } from '../components/national/PeopleSection';

type TabKey = 'panel' | 'nucleos' | 'indicators' | 'people';

const tabs: Array<{ key: TabKey; label: string; slug: string }> = [
  { key: 'panel', label: 'Painel', slug: 'painel' },
  { key: 'nucleos', label: 'Núcleos', slug: 'nucleos' },
  { key: 'indicators', label: 'Indicadores nacionais', slug: 'indicadores' },
  { key: 'people', label: 'Pessoas da gestão nacional', slug: 'pessoas' }
];

/**
 * Gestao nacional: os nucleos da plataforma (com quem os administra) e as pessoas da propria gestao nacional.
 * So numeros e contatos de quem administra; os dados de dentro dos nucleos ficam com cada nucleo.
 */
export function NationalPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = tabs.find((item) => item.slug === searchParams.get('aba'))?.key ?? tabs[0].key;

  return (
    <>
      <div className="page-head">
        <div className="page-head__text">
          <h1>Gestão nacional</h1>
          <p className="page-head__desc">
            Só números: os dados de dentro dos núcleos (voluntários, projetos, registros) ficam com cada núcleo.
          </p>
        </div>
      </div>

      <ScrollTabs activeKey={tab}>
        {tabs.map((item) => (
          <button
            key={item.key}
            type="button"
            className={`tab${tab === item.key ? ' tab--active' : ''}`}
            onClick={() => setSearchParams(item.key === tabs[0].key ? {} : { aba: item.slug }, { replace: true })}
          >
            {item.label}
          </button>
        ))}
      </ScrollTabs>

      {tab === 'panel' ? <PanelSection /> : null}
      {tab === 'nucleos' ? <NucleosSection /> : null}
      {tab === 'indicators' ? <NationalIndicatorsSection /> : null}
      {tab === 'people' ? <PeopleSection /> : null}
    </>
  );
}
