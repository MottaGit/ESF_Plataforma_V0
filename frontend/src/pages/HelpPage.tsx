import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { IconChevronDown } from '../components/ui/Icons';
import { useAuth } from '../context/AuthContext';

interface HelpTopic {
  question: string;
  answer: ReactNode;
}

interface HelpSection {
  title: string;
  topics: HelpTopic[];
  /** So aparece para a coordenacao (coordenadores e administradores). */
  manageOnly?: boolean;
  /** So aparece para quem faz parte da gestao nacional. */
  nationalOnly?: boolean;
}

// Criterio: so o que nao da para descobrir olhando a tela (onde fica, o que nao e obvio). Botao com o mesmo nome da
// pergunta na tela obvia nao vira pergunta; detalhe que a propria janela explica tambem nao.
const SECTIONS: HelpSection[] = [
  {
    title: 'Primeiros passos',
    topics: [
      {
        question: 'Como uso pelo celular?',
        answer: (
          <>
            <p>
              A barra de baixo leva a <strong>Início</strong>, <strong>Projetos</strong>, <strong>Tarefas</strong> e{' '}
              <strong>+ Registrar</strong>; o resto do menu abre nas três linhas, no canto de cima. Para ter o ícone{' '}
              <strong>CtrlESF</strong> na tela, como um aplicativo:
            </p>
            <ul>
              <li>
                <strong>iPhone:</strong> no Safari, <strong>Compartilhar</strong> (o quadrado com a seta) e{' '}
                <strong>Adicionar à Tela de Início</strong>.
              </li>
              <li>
                <strong>Android:</strong> no Chrome, os três pontinhos e <strong>Instalar app</strong> (ou{' '}
                <strong>Adicionar à tela inicial</strong>).
              </li>
            </ul>
          </>
        )
      },
      {
        question: 'Dá para usar sem internet?',
        answer: (
          <p>
            Para consultar, sim: o que você abriu com internet, e os seus projetos, fica guardado no aparelho. Para
            salvar, precisa de internet. Antes de ir a campo, abra a plataforma com internet.
          </p>
        )
      },
      {
        question: 'Como encontro um projeto, uma tarefa ou uma pessoa?',
        answer: (
          <p>
            Na busca do topo (no celular, a lupa). No computador, <strong>Ctrl K</strong> leva direto para ela.
          </p>
        )
      }
    ]
  },
  {
    title: 'Tarefas',
    topics: [
      {
        question: 'Onde vejo as minhas tarefas?',
        answer: (
          <p>
            No Início, em <strong>Minhas tarefas</strong>, e na tela <strong>Tarefas</strong>, com{' '}
            <strong>Minhas</strong> marcado.
          </p>
        )
      },
      {
        question: 'Como concluo uma tarefa?',
        answer: (
          <p>
            Marque a caixinha ao lado dela. Marcou sem querer? <strong>Desfazer</strong>, ao lado, volta como
            estava. Para outro status, como <strong>Bloqueada</strong>, abra a tarefa e troque o status.
          </p>
        )
      },
      {
        question: 'Como chamo alguém num comentário?',
        answer: (
          <p>
            Digite <strong>@</strong> e escolha a pessoa. Ela recebe um aviso no sininho.
          </p>
        )
      }
    ]
  },
  {
    title: 'Projetos e andamento',
    topics: [
      {
        question: 'Como registro o andamento de um projeto?',
        answer: (
          <p>
            Toque em <strong>Registrar</strong> ao lado do projeto, em Meus projetos no Início (no celular,{' '}
            <strong>+ Registrar</strong> na barra de baixo), ou abra o projeto na aba <strong>Andamento</strong>.
            Escreva o que foi feito, anexe fotos se quiser e publique. As fotos entram no relatório do projeto. Se
            sair no meio, o texto fica guardado como rascunho neste aparelho (as fotos não) e volta quando você abrir
            o projeto de novo.
          </p>
        )
      },
      {
        question: 'Errei num registro. Dá para corrigir?',
        answer: (
          <p>
            Sim. No menu <strong>⋯</strong> do registro dá para editar, anexar fotos ou excluir.
          </p>
        )
      },
      {
        question: 'Onde ficam as fotos e os documentos do projeto?',
        answer: (
          <p>
            Na aba <strong>Arquivos</strong> do projeto, junto com as fotos dos registros. Ali também se muda a
            legenda, que aparece embaixo da foto no relatório.
          </p>
        )
      },
      {
        question: 'Como gero um relatório?',
        answer: (
          <p>
            De um projeto: no topo dele, <strong>Gerar relatório</strong> (no celular, pode estar no{' '}
            <strong>⋯</strong>). De vários: na tela <strong>Relatórios</strong>, marque os projetos. Dá para escolher
            um período, como o trimestre que o parceiro pediu.
          </p>
        )
      },
      {
        question: 'Como concluo um projeto?',
        answer: (
          <p>
            No status do topo do projeto, escolha <strong>Concluído</strong>. A janela pede o dia em que terminou e os
            números finais dos indicadores: confira antes de confirmar, porque são eles que vão para o relatório e a
            soma nacional.
          </p>
        )
      }
    ]
  },
  {
    title: 'Avisos e sua conta',
    topics: [
      {
        question: 'Para que serve o sininho?',
        answer: (
          <p>
            Avisa o que envolve você: tarefas novas ou vencendo, menções com @, comentários nas suas tarefas e entrada
            num projeto. Tocar no aviso leva ao lugar certo.
          </p>
        )
      },
      {
        question: 'Onde vejo meu perfil e minhas horas de voluntariado?',
        answer: (
          <p>
            Na sua foto, no canto de cima, escolha <strong>Meu perfil</strong>. Se a opção não aparecer, peça a um
            administrador para ligar o seu acesso ao seu cadastro de voluntário.
          </p>
        )
      },
      {
        question: 'Como lanço as horas que trabalhei num projeto?',
        answer: (
          <p>
            Ao registrar o andamento, preencha <strong>Suas horas hoje</strong>. Para outro dia, abra o projeto, aba{' '}
            <strong>Equipe</strong>, e use <strong>Lançar horas</strong>.
          </p>
        )
      },
      {
        question: 'Como assino o termo de adesão?',
        answer: (
          <p>
            No aviso <strong>Assine seu termo de adesão</strong>, no Início (também em <strong>Minha conta</strong>).
            Depois de assinado, a via fica no seu perfil.
          </p>
        )
      },
      {
        question: 'Como troco minha senha?',
        answer: (
          <p>
            Na sua foto, no canto de cima, escolha <strong>Minha conta</strong>.
          </p>
        )
      },
      {
        question: 'Esqueci minha senha. E agora?',
        answer: (
          <p>
            Peça à coordenação do seu núcleo um link novo de acesso. Ele chega pelo WhatsApp ou por e-mail e, ao abrir,
            você cria uma senha nova.
          </p>
        )
      }
    ]
  },
  {
    title: 'Para a coordenação',
    manageOnly: true,
    topics: [
      {
        question: 'Como acompanho a organização?',
        answer: (
          <p>
            No Início, <strong>Na organização</strong> mostra o que pede atenção; cada número abre a lista.{' '}
            <strong>Quem está sem tarefa</strong> mostra quem pode ser chamado.
          </p>
        )
      },
      {
        question: 'O que são o programa e o modelo do programa?',
        answer: (
          <p>
            O programa reúne projetos do mesmo tipo (ex.: banheiros, hortas). O modelo do programa é a lista de tarefas
            e indicadores que todo projeto novo dele já recebe. Em <strong>Projetos</strong>, escolha o programa no
            topo para ver os resultados somados.
          </p>
        )
      },
      {
        question: 'Como mostro um programa a um parceiro ou financiador?',
        answer: (
          <p>
            Em <strong>Projetos</strong>, escolha o programa, abra <strong>Página pública</strong>, use{' '}
            <strong>Gerar link</strong> e mande o link. Ele abre sem login, com os projetos, os resultados e os números
            da equipe, sem dados pessoais. <strong>Desligar link</strong> faz ele parar de abrir.
          </p>
        )
      },
      {
        question: 'O que é um indicador nacional?',
        answer: (
          <p>
            É definido pela gestão nacional (ex.: Pessoas beneficiadas), vem em todo projeto e é somado entre os
            núcleos. Preencha quando tiver o número: em branco não conta como zero. Para algo só do seu projeto, use{' '}
            <strong>Novo indicador</strong> na aba Sobre.
          </p>
        )
      },
      {
        question: 'Como cadastro um voluntário e dou acesso?',
        answer: (
          <p>
            Em <strong>Voluntários</strong>, <strong>Novo voluntário</strong> (com o dia em que a pessoa entrou no
            núcleo, para as horas contarem); a página dela abre em seguida: <strong>Dar acesso</strong>. Sai um link de primeiro acesso (vale 7 dias) para mandar por WhatsApp ou
            e-mail: a pessoa cria a senha e, ao entrar, assina o termo de adesão. Quem está sem termo aparece com um{' '}
            <strong>!</strong> vermelho na foto. Se alguém esquecer a senha, use <strong>Gerar link de acesso</strong>{' '}
            na página do voluntário.
          </p>
        )
      },
      {
        question: 'Como gero um certificado de voluntariado?',
        answer: (
          <p>
            Na página do voluntário, <strong>Gerar certificado</strong>: período completo, um período específico ou um
            projeto. Tudo vem preenchido e dá para ajustar.
          </p>
        )
      },
      {
        question: 'Como importo uma planilha?',
        answer: (
          <p>
            Em <strong>Configurações › Planilhas</strong> (administradores), baixe o <strong>modelo vazio</strong> (a
            aba Instruções explica cada coluna), preencha e envie. Antes de gravar aparece a conferência. A importação só
            cria registros novos: o que já existe não muda.
          </p>
        )
      }
    ]
  }
];

const NATIONAL_SECTION: HelpSection = {
  title: 'Gestão nacional',
  nationalOnly: true,
  topics: [
    {
      question: 'O que a gestão nacional vê?',
      answer: (
        <p>
          Na área <strong>Nacional</strong>: os núcleos, quem administra cada um e o <strong>Painel</strong>, com os
          números de todos (no total e por núcleo, com os indicadores nacionais somados). Os dados de dentro dos
          núcleos ficam com cada núcleo: a gestão nacional vê só números.
        </p>
      )
    },
    {
      question: 'Como cadastro um núcleo novo?',
      answer: (
        <p>
          Em <strong>Nacional › Núcleos</strong>, <strong>Novo núcleo</strong>, com quem vai administrar. Essa pessoa
          recebe um link de primeiro acesso e, a partir daí, cuida do núcleo.
        </p>
      )
    },
    {
      question: 'E se quem administra um núcleo sair ou perder o acesso?',
      answer: (
        <p>
          No <strong>⋯</strong> do núcleo, <strong>Novo administrador</strong> inclui outra pessoa. Para quem perdeu o
          link ou a senha, a chave ao lado do nome gera um link novo.
        </p>
      )
    },
    {
      question: 'Para que servem os indicadores nacionais?',
      answer: (
        <p>
          Para somar o mesmo resultado em todos os núcleos, mesmo que cada um use outro nome. Em{' '}
          <strong>Nacional › Indicadores nacionais</strong> você define nome, unidade e como contar; arquivar tira das
          opções sem apagar o que já foi registrado.
        </p>
      )
    },
    {
      question: 'O que querem dizer "—" e "informado em 3 de 5 projetos" no painel?',
      answer: (
        <p>
          "—": nenhum projeto informou o número (em branco não conta como zero). "Informado em 3 de 5": a soma é só
          dos 3 que informaram. As horas do painel são estimadas (6 h por semana de cada voluntário ativo).
        </p>
      )
    },
    {
      question: 'Como incluo alguém na gestão nacional?',
      answer: (
        <p>
          Em <strong>Nacional › Pessoas da gestão nacional</strong>, <strong>Incluir pessoa</strong>. Se o e-mail já
          for login de alguém de um núcleo, a pessoa só ganha a permissão; se não, recebe um link de primeiro acesso.
        </p>
      )
    }
  ]
};

/** Ajuda: perguntas frequentes sobre o uso da plataforma (abre pelo menu da conta, no topo). */
export function HelpPage() {
  const { canManage, hasNucleo, isNational } = useAuth();
  // Conta so da gestao nacional nao tem nucleo: so as perguntas da gestao nacional.
  const sections = [...SECTIONS, NATIONAL_SECTION].filter((section) =>
    section.nationalOnly ? isNational : hasNucleo && (!section.manageOnly || canManage)
  );

  return (
    <div className="help">
      <div className="page-head">
        <div className="page-head__text">
          <h1>Ajuda</h1>
          <p className="page-head__desc">Como usar a plataforma no dia a dia. Toque numa pergunta para ver a resposta.</p>
        </div>
      </div>

      {sections.map((section) => (
        <section key={section.title} className="panel help__section">
          <div className="panel__head">
            <h2>{section.title}</h2>
          </div>
          <div>
            {section.topics.map((topic) => (
              <details key={topic.question} className="help__item">
                <summary>
                  <span>{topic.question}</span>
                  <IconChevronDown size={16} className="help__chevron" />
                </summary>
                <div className="help__answer">{topic.answer}</div>
              </details>
            ))}
          </div>
        </section>
      ))}

      <p className="help__footer">
        Não achou o que procurava? Fale com a coordenação do seu projeto. Para saber como os seus dados são usados, veja
        a <Link to="/privacidade">política de privacidade</Link>.
      </p>
    </div>
  );
}
