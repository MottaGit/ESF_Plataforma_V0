import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { organizationApi } from '../api/endpoints';
import { useAuth } from '../context/AuthContext';
import type { Organization } from '../types/api';

/**
 * Versao do texto abaixo. Ao mudar o conteudo, atualize tambem PrivacyTerms.CurrentVersion na API: todos
 * recebem o pedido de aceite de novo.
 */
export const PRIVACY_VERSION_LABEL = '20 de outubro de 2026';

/** Politica de privacidade e termos de uso, abertos a qualquer pessoa (link na tela de login). */
export function PrivacyPage() {
  const { user } = useAuth();
  const [organization, setOrganization] = useState<Organization | null>(null);

  useEffect(() => {
    organizationApi.get().then(setOrganization).catch(() => undefined);
  }, []);

  return (
    <div className="legal">
      <div className="legal__inner">
        <Link className="legal__back" to={user ? '/' : '/entrar'}>
          ← {user ? 'Voltar para a plataforma' : 'Voltar para o login'}
        </Link>
        <PrivacyContent organization={organization} />
      </div>
    </div>
  );
}

export function PrivacyContent({ organization }: { organization: Organization | null }) {
  const name = organization?.name ?? 'a organização';
  const identification = organization?.cnpj ? `${name}, CNPJ ${organization.cnpj}` : name;
  const contact = organization?.email ?? 'o e-mail de contato da organização';

  return (
    <article className="legal__text">
      <h1>Política de privacidade e termos de uso</h1>
      <p className="legal__version">Versão de {PRIVACY_VERSION_LABEL}</p>

      <h2>1. Quem cuida dos dados</h2>
      <p>
        Esta plataforma é usada por {identification} para organizar seus projetos, o trabalho voluntário e a prestação
        de contas. A organização é a responsável (controladora) pelos dados pessoais tratados aqui, nos termos da Lei
        Geral de Proteção de Dados (Lei 13.709/2018).
      </p>

      <h2>2. Quais dados guardamos</h2>
      <ul>
        <li>
          <strong>De quem tem acesso:</strong> nome, e-mail, perfil de acesso, a data em que aceitou estes termos e o
          registro das alterações que fez na plataforma.
        </li>
        <li>
          <strong>De voluntários:</strong> nome, e-mail, telefone, setor, habilidades, dia e mês do aniversário, foto,
          observações da coordenação, participação em projetos e atividades e o termo de adesão assinado.
        </li>
        <li>
          <strong>Dos projetos:</strong> endereço e localização das obras, relatos de andamento, fotos e documentos —
          que podem mostrar beneficiários — e as autorizações de uso de imagem assinadas.
        </li>
      </ul>
      <p>
        A plataforma não pede dados sensíveis (como saúde, religião, origem racial ou opinião política) nem CPF. Por
        favor, não os registre nos campos livres.
      </p>

      <h2>3. Para que usamos</h2>
      <ul>
        <li>Planejar e acompanhar os projetos, distribuir atividades e avisar cada pessoa do que é dela.</li>
        <li>Organizar o voluntariado, incluindo o termo de adesão e os certificados de participação.</li>
        <li>Prestar contas a parceiros e financiadores, por meio de relatórios.</li>
        <li>Cumprir obrigações legais e proteger a organização em caso de questionamentos.</li>
      </ul>
      <p>
        As bases legais são a execução do termo de voluntariado, o legítimo interesse da organização em gerir suas
        atividades, o cumprimento de obrigação legal e, para o uso de imagem, o consentimento de quem aparece nas fotos
        (ou de seus responsáveis, no caso de crianças e adolescentes).
      </p>

      <h2>4. Com quem compartilhamos</h2>
      <p>
        Não vendemos nem cedemos dados pessoais. Relatórios de projeto, que podem incluir nomes da equipe e fotos com
        autorização de uso de imagem, são enviados a parceiros e financiadores. Os serviços de hospedagem que mantêm a
        plataforma no ar tratam os dados apenas em nome da organização.
      </p>

      <h2>5. Por quanto tempo</h2>
      <p>
        Os dados ficam guardados enquanto houver vínculo com a organização e pelo tempo necessário para a prestação de
        contas e a defesa de direitos. Avisos da plataforma são apagados em até 60 dias. Quando um voluntário deixa a
        organização, seus dados podem ser anonimizados: o histórico dos projetos continua, sem identificar a pessoa.
      </p>

      <h2>6. Como protegemos</h2>
      <p>
        O acesso é feito com login individual e as senhas são guardadas de forma irreversível. Cada perfil vê e altera
        apenas o que precisa, as alterações ficam registradas e os documentos assinados só podem ser abertos pela
        coordenação.
      </p>

      <h2>7. Seus direitos</h2>
      <p>
        Você pode pedir a confirmação e o acesso aos seus dados, a correção do que estiver errado, a anonimização ou a
        exclusão do que não for mais necessário, informações sobre o compartilhamento e revogar a autorização de uso de
        imagem. Faça o pedido pelo e-mail {contact}.
      </p>

      <h2>8. Termos de uso</h2>
      <ul>
        <li>O acesso é pessoal e intransferível; não compartilhe sua senha.</li>
        <li>Use as informações da plataforma apenas para as atividades da organização.</li>
        <li>
          Não baixe nem repasse dados pessoais além do necessário, e publique fotos de pessoas somente com autorização
          de uso de imagem.
        </li>
        <li>Quem publica um relato, arquivo ou foto é responsável pelo que publicou.</li>
        <li>A organização pode suspender acessos usados em desacordo com estes termos.</li>
      </ul>

      <h2>9. Mudanças</h2>
      <p>
        Esta política pode ser atualizada. Quando isso acontecer, a plataforma pedirá um novo aceite no próximo acesso.
      </p>
    </article>
  );
}
