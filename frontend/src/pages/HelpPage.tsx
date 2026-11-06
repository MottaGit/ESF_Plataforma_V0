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

const SECTIONS: HelpSection[] = [
  {
    title: 'Primeiros passos',
    topics: [
      {
        question: 'O que aparece no Início?',
        answer: (
          <p>
            O Início é a sua página: <strong>Minhas tarefas</strong> (as suas, organizadas por prazo),{' '}
            <strong>Meus projetos</strong> (os projetos em que você está, com o último registro de cada um),{' '}
            <strong>Avisos recentes</strong> e os <strong>aniversariantes</strong>. A caixinha ao lado de uma tarefa a
            conclui na hora.
          </p>
        )
      },
      {
        question: 'Como uso pelo celular?',
        answer: (
          <p>
            Embaixo da tela fica uma barra com <strong>Início</strong>, <strong>Projetos</strong>,{' '}
            <strong>Tarefas</strong> e <strong>+ Registrar</strong>. O menu completo abre no ícone de três linhas, no
            canto de cima à esquerda.
          </p>
        )
      },
      {
        question: 'Como encontro um projeto, uma tarefa ou uma pessoa?',
        answer: (
          <p>
            Use a busca no topo da tela (no celular, a lupa). Ela procura em projetos, tarefas, voluntários, programas e
            registros de andamento, sem precisar de acento. No computador, <strong>Ctrl K</strong> leva direto para a
            busca.
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
            No Início, em <strong>Minhas tarefas</strong>, e na tela <strong>Tarefas</strong> com o botão{' '}
            <strong>Minhas</strong> marcado. Em <strong>Filtros</strong>, a <strong>Situação</strong> mostra só as
            atrasadas, as bloqueadas ou as concluídas, e o ícone de quadro, no canto, mostra uma coluna para cada
            status. No celular, a busca também fica em <strong>Filtros</strong>.
          </p>
        )
      },
      {
        question: 'Como concluo uma tarefa?',
        answer: (
          <p>
            Marque a caixinha ao lado dela, no Início ou nas listas. Para outro status, como <strong>Bloqueada</strong>,
            abra a tarefa e use o seletor de status, ou arraste o cartão para outra coluna no <strong>Quadro</strong>.
          </p>
        )
      },
      {
        question: 'O que tem dentro de uma tarefa?',
        answer: (
          <p>
            Clique na tarefa para abrir. Você vê a descrição, o responsável e o prazo, um <strong>checklist</strong> com
            itens para marcar, os <strong>anexos</strong> e os <strong>comentários</strong>. Para mudar título, prazo ou
            responsável, use <strong>Editar</strong>.
          </p>
        )
      },
      {
        question: 'Como chamo alguém num comentário?',
        answer: (
          <p>
            Digite <strong>@</strong> e escolha a pessoa na lista. Ela recebe um aviso no sininho com o seu comentário.
          </p>
        )
      },
      {
        question: 'Como crio uma tarefa?',
        answer: (
          <p>
            Na tela <strong>Tarefas</strong> ou na aba <strong>Tarefas</strong> de um projeto, use{' '}
            <strong>Nova tarefa</strong>.
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
          <>
            <ol>
              <li>
                Toque em <strong>Registrar</strong> ao lado do projeto, em Meus projetos no Início (no celular, use{' '}
                <strong>+ Registrar</strong> na barra de baixo). Ou abra o projeto: o campo fica no topo da aba{' '}
                <strong>Andamento</strong>.
              </li>
              <li>Escreva o que foi feito, o que foi decidido ou o que mudou.</li>
              <li>Se quiser, anexe fotos.</li>
              <li>
                Toque em <strong>Publicar registro</strong>.
              </li>
            </ol>
            <p>
              O registro aparece na aba <strong>Andamento</strong> do projeto, com o seu nome e a data, e as fotos entram
              no relatório do projeto.
            </p>
          </>
        )
      },
      {
        question: 'Errei num registro. Dá para corrigir?',
        answer: (
          <p>
            Sim. No registro, abra o menu <strong>⋯</strong> e use <strong>Editar</strong>,{' '}
            <strong>Anexar fotos</strong> ou <strong>Excluir</strong>.
          </p>
        )
      },
      {
        question: 'Onde ficam as fotos e os documentos do projeto?',
        answer: (
          <p>
            Na aba <strong>Arquivos</strong> do projeto: tudo o que foi enviado, inclusive as fotos dos registros. Ali dá
            para enviar arquivos novos e mudar a legenda, que é o texto que aparece embaixo da foto no relatório.
          </p>
        )
      },
      {
        question: 'Como gero o relatório de um projeto?',
        answer: (
          <p>
            No topo do projeto, use <strong>Gerar relatório</strong> (no celular, fica no <strong>⋯</strong>): abrem as
            mesmas opções da tela Relatórios (período de referência, tarefas concluídas, fotos e observação). Sai um PDF
            com os resultados, a equipe e a linha do tempo com as fotos, pronto para enviar a parceiros. Com um período
            (por exemplo, o trimestre que o parceiro pediu), entram só os registros e as tarefas concluídas dentro dele.
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
            Ele mostra os seus avisos: quando alguém passa uma tarefa para você, chama você com @ ou comenta numa tarefa
            sua; quando uma tarefa sua vence hoje ou amanhã; e quando você entra na equipe de um projeto ou passa a ser
            responsável por ele. O número vermelho é quantos você ainda não leu. Clicar no aviso leva ao lugar certo.
          </p>
        )
      },
      {
        question: 'Onde vejo meu perfil e minhas horas de voluntariado?',
        answer: (
          <p>
            Clique na sua foto, no canto de cima à direita, e escolha <strong>Meu perfil</strong>. Lá estão os seus
            dados, os seus projetos e as <strong>horas de voluntariado</strong>. Se a opção não aparecer, o seu acesso
            ainda não está ligado ao seu cadastro de voluntário: peça isso a um administrador.
          </p>
        )
      },
      {
        question: 'Como lanço as horas que trabalhei num projeto?',
        answer: (
          <p>
            Ao registrar o andamento, preencha <strong>Suas horas hoje</strong>: o texto do registro vira o que você fez.
            Para outro dia, abra o projeto, aba <strong>Equipe</strong>, e use <strong>Lançar horas</strong> (dia, horas e
            o que fez). Você corrige ou apaga os seus lançamentos ali mesmo; a coordenação corrige os de todos. As horas
            entram no relatório e no certificado do projeto.
          </p>
        )
      },
      {
        question: 'Como assino o termo de adesão?',
        answer: (
          <p>
            Enquanto faltar, o Início mostra <strong>Assine seu termo de adesão</strong>. Leia o texto, responda se
            autoriza o uso da sua imagem, informe o CPF, marque que concorda e digite o nome completo. O botão{' '}
            <strong>Ler e assinar</strong> também fica em <strong>Minha conta</strong> e no seu perfil, onde depois você
            baixa a via assinada.
          </p>
        )
      },
      {
        question: 'Como troco minha senha?',
        answer: (
          <p>
            Clique na sua foto, no canto de cima à direita, e escolha <strong>Minha conta</strong>.
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
            No Início, <strong>Na organização</strong> mostra as tarefas atrasadas e bloqueadas e os projetos parados
            (sem registro há 30 dias). Cada número abre a lista já filtrada. Mais abaixo,{' '}
            <strong>Quem está sem tarefa</strong> lista os voluntários ativos sem nenhuma tarefa em aberto (primeiro
            quem não está em nenhum projeto), para chamar quem está parado.
          </p>
        )
      },
      {
        question: 'Como crio um projeto?',
        answer: (
          <p>
            Em <strong>Projetos</strong>, use <strong>Novo projeto</strong> e escolha o programa. Se o programa tem um
            modelo, as tarefas e os indicadores do modelo já entram no projeto novo.
          </p>
        )
      },
      {
        question: 'O que são o programa e o modelo do programa?',
        answer: (
          <p>
            O programa reúne projetos do mesmo tipo (por exemplo, banheiros ou hortas); um programa também pode ter um
            projeto só. Em <strong>Projetos</strong>, escolha o programa na lista do topo (dá para buscar pelo nome; os
            arquivados ficam embaixo) para ver os resultados somados dos seus projetos. O{' '}
            <strong>Modelo do programa</strong> é a lista de tarefas e indicadores que todo projeto novo daquele programa
            recebe.
          </p>
        )
      },
      {
        question: 'O que é um indicador nacional?',
        answer: (
          <p>
            É um indicador definido pela gestão nacional da ESF (por exemplo, "Pessoas beneficiadas"), com uma regra de
            como contar. Todo projeto já vem com os indicadores nacionais, com a etiqueta "nacional": preencha o número
            quando tiver. Em branco quer dizer "ainda não informado" e não conta como zero. Eles não podem ser
            excluídos do projeto, e o número entra na soma de todos os núcleos. Para o que é só do seu projeto, use{' '}
            <strong>Novo indicador</strong> na aba Sobre.
          </p>
        )
      },
      {
        question: 'Como cadastro um voluntário e o termo de adesão?',
        answer: (
          <>
            <ol>
              <li>
                Em <strong>Voluntários</strong>, use <strong>Novo voluntário</strong>.
              </li>
              <li>
                Dê acesso à plataforma: no primeiro acesso, o Início pede para a pessoa ler e assinar o termo online.
              </li>
            </ol>
            <p>
              Quem assina é sempre a própria pessoa, na conta dela. Depois, a coordenação baixa o termo assinado na
              página do voluntário.
            </p>
            <p>
              Quem ainda está sem termo aparece com um <strong>!</strong> vermelho na foto, e o topo da lista de
              voluntários mostra quantos faltam.
            </p>
          </>
        )
      },
      {
        question: 'Como gero um certificado de voluntariado?',
        answer: (
          <p>
            Na página do voluntário, use <strong>Gerar certificado</strong> e escolha: <strong>período completo</strong>{' '}
            (todo o tempo como Ativo, com as horas que a plataforma calcula), <strong>período específico</strong> (as
            datas e as horas por semana que você quiser) ou <strong>por projeto</strong> (com um resumo do projeto, o que
            a pessoa fez e as horas lançadas nele, tudo já sugerido e editável). O CPF é opcional e não fica salvo.
          </p>
        )
      },
      {
        question: 'Como gero um relatório de vários projetos?',
        answer: (
          <p>
            Em <strong>Relatórios</strong>, marque os projetos e escolha o que entra no PDF.
          </p>
        )
      },
      {
        question: 'Como exporto ou importo uma planilha?',
        answer: (
          <>
            <p>
              Em <strong>Configurações › Planilhas</strong> (só administradores). <strong>Exportar planilha</strong> deixa
              escolher o que vai no arquivo do Excel: projetos (com o resumo dos programas), voluntários ou os dois. O
              botão <strong>Exportar</strong> nas telas de Projetos e de Voluntários abre a mesma escolha.
            </p>
            <p>
              Para importar, baixe o <strong>modelo vazio</strong>, preencha (à mão ou entregando o modelo e as suas
              anotações a uma IA: a aba Instruções explica cada coluna) e use <strong>Enviar planilha</strong>. Antes de
              gravar aparece a conferência, linha por linha. A importação só cria: o que já existe na plataforma não muda,
              e linhas com erro ficam de fora até você corrigir e enviar de novo.
            </p>
          </>
        )
      },
      {
        question: 'Como dou acesso à plataforma para alguém?',
        answer: (
          <>
            <p>
              Na página do voluntário, use <strong>Dar acesso</strong> (ou, em <strong>Configurações › Acessos</strong>,{' '}
              <strong>Novo acesso</strong>; só administradores). Escolha o perfil: o login é o e-mail do cadastro.
            </p>
            <p>
              Sai um link de primeiro acesso, que você manda pelo WhatsApp, por e-mail ou copiando. A pessoa abre, cria a
              própria senha e já entra. O link vale 7 dias e uma vez só. Se alguém esquecer a senha, gere um link novo
              (ícone da chave em Usuários ou "Gerar link de acesso" na página do voluntário).
            </p>
          </>
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
          Na área <strong>Nacional</strong> do menu: os núcleos da plataforma, quem administra cada um e as pessoas da
          gestão nacional. Os dados de dentro dos núcleos (voluntários, projetos, tarefas, registros) ficam com cada
          núcleo: a gestão nacional vê só números.
        </p>
      )
    },
    {
      question: 'O que o painel nacional mostra?',
      answer: (
        <p>
          Em <strong>Nacional › Painel</strong>, os números de todos os núcleos, no total e por núcleo: projetos em
          andamento e concluídos, voluntários ativos, horas de voluntariado, tarefas concluídas, registros de andamento,
          a data da última atividade de cada núcleo e os indicadores nacionais somados. Horas, tarefas e registros contam
          no período escolhido (o ano corrente, de início); o resto é a situação de hoje.
        </p>
      )
    },
    {
      question: 'Como cadastro um núcleo novo?',
      answer: (
        <p>
          Em <strong>Nacional › Núcleos</strong>, use <strong>Novo núcleo</strong>: nome, cidade, estado e quem vai
          administrar (nome e e-mail). Sai um link de primeiro acesso para essa pessoa; ela cria a senha, completa os
          dados do núcleo em Configurações e, a partir daí, cadastra os voluntários e dá os outros acessos.
        </p>
      )
    },
    {
      question: 'E se quem administra um núcleo sair ou perder o acesso?',
      answer: (
        <p>
          No menu <strong>⋯</strong> do núcleo, <strong>Novo administrador</strong> inclui outra pessoa. Para quem
          perdeu o link ou esqueceu a senha, use a chave ao lado do nome dela: sai um link novo.
        </p>
      )
    },
    {
      question: 'Para que servem os indicadores nacionais?',
      answer: (
        <p>
          Cada núcleo tem os próprios programas e pode dar outro nome ao mesmo resultado. Em{' '}
          <strong>Nacional › Indicadores nacionais</strong> você define os resultados comuns (nome, unidade e como
          contar); os núcleos escolhem esses indicadores nos projetos, e o painel soma pelo vínculo. Mudar o nome ou a
          unidade vale para todos os núcleos; arquivar tira das opções sem apagar o que já foi registrado.
        </p>
      )
    },
    {
      question: 'Como incluo alguém na gestão nacional?',
      answer: (
        <p>
          Em <strong>Nacional › Pessoas da gestão nacional</strong>, use <strong>Incluir pessoa</strong>. Se o e-mail já
          for o login de alguém de um núcleo, a pessoa ganha a permissão e continua com a mesma senha; se não, nasce uma
          conta só nacional, com link de primeiro acesso.
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
