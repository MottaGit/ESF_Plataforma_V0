# ESF — Plataforma de gestão de projetos (V0)

Primeira versão funcional de uma aplicação web para o **Engenheiros Sem Fronteiras** (núcleo Porto Alegre) centralizar
seus projetos sociais: o programa de banheiros Direito da Gente e as hortas comunitárias.

Hoje essas informações costumam ficar espalhadas entre planilhas, documentos e fotos. Aqui elas ficam no mesmo lugar,
com andamento, responsáveis, tarefas, voluntários, indicadores, arquivos, localização e relatórios em PDF.

> Esta é uma **V0**: pequena, funcional e organizada o suficiente para ser usada por uma equipe real e evoluir depois
> conforme os problemas encontrados no uso.

---

## Sumário

- [Como executar](#como-executar)
- [Acessos de demonstração](#acessos-de-demonstração)
- [O que a aplicação faz](#o-que-a-aplicação-faz)
- [Arquitetura](#arquitetura)
- [Estrutura de diretórios](#estrutura-de-diretórios)
- [Modelo de dados](#modelo-de-dados)
- [API](#api)
- [Perfis de acesso](#perfis-de-acesso)
- [Configuração](#configuração)
- [Evolução prevista](#evolução-prevista)

---

## Como executar

### Opção 1 — Docker Compose (recomendada)

Requer Docker Desktop (ou Docker Engine) com Compose v2.

```bash
docker compose up --build
```

Na primeira execução o backend aplica as migrations e cria os dados de demonstração automaticamente.

| Serviço | Endereço |
| --- | --- |
| Aplicação (frontend) | http://localhost:5173 |
| API + Swagger | http://localhost:5080/swagger |
| PostgreSQL | localhost:5432 (`esf` / `esf`) |

Para parar: `docker compose down`. Para apagar também o banco e os arquivos enviados: `docker compose down -v`.

### Opção 2 — Execução local (sem Docker para a aplicação)

Requisitos: **.NET SDK 8**, **Node.js 20+** e um **PostgreSQL 14+** acessível.

1. Suba apenas o banco (se não tiver um local):

   ```bash
   docker compose up -d db
   ```

2. Backend:

   ```bash
   cd backend/Esf.Api
   dotnet restore
   dotnet run
   ```

   A API sobe em `http://localhost:5080`. A string de conexão padrão está em `appsettings.json`
   (`Host=localhost;Port=5432;Database=esf_plataforma;Username=esf;Password=esf`).

3. Frontend, em outro terminal:

   ```bash
   cd frontend
   npm install
   npm run dev
   ```

   A interface sobe em `http://localhost:5173` e o Vite já faz proxy de `/api` e `/uploads` para a API.

### Migrations

As migrations do EF Core já estão versionadas em `backend/Esf.Api/Data/Migrations` e são aplicadas na inicialização
(`Database.Migrate()`), com espera automática pelo banco. Para trabalhar com elas manualmente:

```bash
dotnet tool install --global dotnet-ef        # uma vez
cd backend/Esf.Api
dotnet ef database update                     # aplicar
dotnet ef migrations add NomeDaMigration      # criar a próxima
```

### Testes

`backend/Esf.Api.Tests` (xUnit, banco em memória, sem PostgreSQL) verifica a **separação entre núcleos**: com dois
núcleos que têm um registro em cada tabela, quem é de um núcleo não lê (lista, busca por id, inclusão pelo
relacionamento), não cria e não referencia dados do outro (tarefa, responsável, programa, equipe, ficha de
voluntário, acesso, relatório); o login acha qualquer núcleo e o token leva o núcleo; o e-mail é único na plataforma.
Também cobre a planilha: o modelo e a exportação são reconhecidos, reimportar uma exportação não cria nada, a
importação cria programa, projeto (com indicadores e equipe) e voluntário (com o histórico das datas), linha com erro e
linha repetida ficam de fora, outro arquivo é recusado e cada núcleo só compara e cria no próprio. E o termo assinado
online: sem aceite, sem a resposta sobre imagem, com nome diferente do cadastro ou CPF inválido não assina; o PDF sai
com o registro e o SHA-256 bate; assina uma vez só; a coordenação vê o termo assinado. E as horas por projeto: cada um lança as próprias (só estando
na equipe), não lança nem corrige as dos outros, a coordenação lança e corrige qualquer uma, o registro de andamento leva
as horas do dia e o relatório soma no período. E o certificado: o período completo e os projetos vêm sugeridos (período, horas, o que
a pessoa fez), cada opção gera o PDF e o certificado por projeto exige que a pessoa participe dele.
Rode antes de mexer em consultas ou no `EsfDbContext`:

```bash
cd backend
dotnet test
```

O banco em memória não roda as funções do PostgreSQL (busca sem acento, `ILIKE`), então as telas que dependem delas
ficam de fora desses testes.

---

## Acessos de demonstração

O seed cria **dois núcleos** — ESF Porto Alegre (o principal: 3 usuários, 13 voluntários e 5 projetos) e ESF Curitiba
(menor: 1 administradora, 4 voluntários, o programa próprio "Reforma de moradias" e 2 projetos) —, dois **indicadores
nacionais** (Famílias atendidas e Pessoas beneficiadas, com a regra de como contar) ligados aos indicadores dos dois
núcleos, e uma **conta só da gestão nacional**. Assim dá para ver a separação (cada administrador só enxerga o próprio
núcleo) e o painel nacional somando os dois. A horta de Porto Alegre chamava de "Famílias envolvidas" o mesmo
resultado; ligada ao indicador nacional, ganha o nome dele.

Os voluntários cobrem os seis setores e vêm com e-mail, telefone, competências, observações, aniversário e histórico
de situação (as horas de voluntariado saem dele). Há um afastado, um ex-membro e um que já teve afastamento e voltou.
Oito têm o termo de adesão assinado online; ficam pendentes as três contas de demonstração (Ana, Leonardo e Fausto),
para dar para assinar, e Carol e Alice, sem acesso. Dois aniversários
caem perto do dia em que o banco é criado, para o painel de aniversariantes do Início não ficar vazio.

Os projetos mostram uma situação diferente cada um:

| Projeto | Programa | Situação |
| --- | --- | --- |
| Sra. Julia (banheiro acessível) | Banheiro Direito da Gente | Concluído |
| Sra. Beatriz (módulo sanitário, troca de construtor) | Banheiro Direito da Gente | Em andamento, com tarefa bloqueada |
| Sra. Rosangela (banheiro com caixa d'água) | Banheiro Direito da Gente | Planejamento, com tarefa vencida |
| Horta Comunitária do Cristal | Horta comunitária | Concluído |
| Horta Comunitária Vila Farrapos | Horta comunitária | Em andamento |

Os de banheiro vêm dos registros reais do programa (INFOBANs); os de horta são estimados. Cada projeto tem equipe
com papéis, tarefas com checklist, registros de andamento e indicadores com os mesmos nomes do modelo do programa,
para a página do programa somar os resultados. Há comentários com menção em duas tarefas e autorização de imagem
assinada em dois projetos. As datas contam a partir do dia em que o banco é criado, então sempre há tarefas
concluídas, vencidas e próximas perto de "hoje". Os projetos de banheiro ficam sem ponto no mapa de propósito (são
casas de famílias); as hortas marcam o bairro.

Acessos (os de núcleo são voluntários cadastrados):

| E-mail | Núcleo | Perfil | Senha |
| --- | --- | --- | --- |
| leonardo.motta@esf.org.br | Porto Alegre | Administrador | `Esf@2026` |
| ana.aumond@esf.org.br | Porto Alegre | Coordenador | `Esf@2026` |
| fausto.silva@esf.org.br | Porto Alegre | Usuário | `Esf@2026` |
| marina.costa@esf.org.br | Curitiba | Administradora | `Esf@2026` |
| nacional@esf.org.br | — (só gestão nacional) | Gestão nacional | `Esf@2026` |

O seed só roda quando o banco está vazio, então ele nunca sobrescreve dados reais. A tela de login lista esses acessos
e já vem preenchida com o do administrador, para facilitar a demonstração.

Para recriar os dados de demonstração, apague o banco e suba a API de novo: as migrations recriam as tabelas e o seed
preenche. Localmente, `docker compose down -v`. Num Postgres hospedado (como o do Render), rode no banco
`DROP SCHEMA public CASCADE; CREATE SCHEMA public;` e reinicie a API, ou crie um banco novo e troque a string de
conexão da API. Isso apaga tudo, inclusive os arquivos enviados, que ficam no banco.

---

## O que a aplicação faz

**Início** — o que a pessoa logada tem para fazer. Abaixo do "Olá", uma linha com as tarefas dela (em aberto,
atrasadas, bloqueadas). **Minhas tarefas** agrupa por prazo (atrasadas, próximos 7 dias, depois, sem prazo; até 8, o
resto em Tarefas): a caixinha conclui na hora e clicar abre a tarefa ali mesmo. Ao lado, **Meus projetos** (os em
planejamento ou andamento em que a pessoa é responsável ou está na equipe, com progresso, último registro e o botão
**Registrar**, que abre o projeto já no registro de andamento) e os **aniversariantes** dos últimos 5 dias e dos
próximos 14 (o bloco some quando não há nenhum). Os avisos ficam só no sininho. Sem voluntário vinculado, explica como
pedir o vínculo.
Datas recentes aparecem em tempo relativo até uma semana ("há 3 dias", "ontem") e, depois disso, como data curta
("último registro em 09/10"; o ano só aparece quando não é o atual), igual em todas as telas. O "hoje" das contas
(atrasada, vence hoje, prazo vencido) e as datas e horas do PDF, das planilhas, do histórico e dos períodos seguem o
horário de Brasília, mesmo com o servidor em UTC: o que é feito às 22 h fica no próprio dia. Para
a coordenação, entram também a faixa **Na organização** (tarefas atrasadas, tarefas bloqueadas e projetos parados,
isto é, em andamento sem registro há mais de 30 dias; cada número abre a lista filtrada) e **Quem está sem tarefa**
(voluntários ativos sem nenhuma tarefa em aberto, primeiro quem não está em nenhum projeto; mostra 6 e "Ver todas";
cada nome leva à página da pessoa). Num núcleo que ainda não tem nenhum projeto, a administração vê no
lugar da faixa os **Primeiros passos**: dados do núcleo (CNPJ e quem assina), um programa, mais alguém com acesso e o
primeiro projeto; cada passo se marca sozinho e o quadro some quando o primeiro projeto é criado.

**Projetos** — listagem com busca, filtros (status, só atrasados, incluir arquivados; o programa é a aba escolhida)
e ordenação. No celular, busca, filtros e ordenação ficam recolhidos no botão "Filtros", que mostra quantos estão
ligados ("Filtros (2)"); o Lista|Mapa continua à mostra. Cada linha mostra programa, status, responsável, progresso e **último registro**; editar, arquivar/reativar
e excluir ficam no menu **⋯** da linha. Vindo do Início, `?parados=1` mostra só os projetos em andamento sem registro há
mais de 30 dias. Busca, filtros, ordenação e visão ficam na URL, então voltar de um projeto (ou recarregar) mantém a
lista como estava. O **progresso** é calculado pelas tarefas concluídas (projeto concluído conta como 100%). O **novo
projeto** pede só o essencial (nome, programa, responsável, data de início e endereço, com o estado do núcleo já
preenchido; a cidade fica em branco, porque há projetos em cidades da região; começa em planejamento); o resto
(descrição, objetivo, comunidade, quem se beneficia, previsão de término, observações) fica em Editar projeto. O status
muda só no badge do topo do projeto.

**Mapa dos projetos** — em Projetos, a alternância **Lista | Mapa** mostra os projetos num mapa do OpenStreetMap
(gratuito, sem chave), com os mesmos filtros da lista. Cada pino tem o ícone e a cor do programa; clicar mostra nome,
programa, status e local, e o nome leva ao projeto. Embaixo ficam a legenda dos programas e quantos projetos ainda não
têm localização (com a lista deles). Para marcar o local, o projeto tem **"Marcar no mapa"** (no novo projeto e em
Editar projeto, no lugar das coordenadas digitadas): o mapa busca o endereço do formulário no OpenStreetMap (Nominatim,
só quando a pessoa clica em Buscar), aceita um clique no lugar certo e o pino pode ser arrastado; "Remover localização"
apaga o ponto. Em Sobre, "Ver no mapa" abre o mapa já centrado no projeto. O mapa (Leaflet) só é baixado quando é
aberto.

**Programas** — a tela Projetos é organizada por programa: no topo, a **lista de programas** (um botão com o ícone e
o nome do escolhido, ou "Todos os programas"). Ao abrir, ela mostra cada programa com ícone e número de projetos, os
ativos primeiro e os **arquivados** num grupo embaixo; com 8 programas ou mais aparece a busca (sem diferenciar acentos)
e dá para escolher pelo teclado (setas e Enter). No rodapé, para a coordenação, **+ Novo programa**. As abas de antes
não cabiam num núcleo com dezenas de programas (a maioria de um projeto só). Em **Todos os programas** vem direto a
lista de projetos; escolhendo um programa aparece a **visão do programa**:
números (em andamento, concluídos) e os **resultados somados** — cada indicador padrão do modelo somado nos projetos
não arquivados do programa, comparando os nomes sem diferenciar maiúsculas nem acentos —, mais, para a coordenação,
**Modelo do programa**, **Editar** (nome, ícone e cor) e arquivar/reativar ou excluir (só sem projetos). A lista
embaixo mostra só os projetos daquele programa, e "Novo projeto" já vem com ele escolhido. Os endereços antigos
(`/programas`, `/programas/{id}` e `/configuracoes?aba=programas`) levam para cá; no topo de cada projeto, o nome do
programa abre a visão dele.

**Ícone e cor do programa** — no programa novo, o ícone sai do nome enquanto se digita: vale a primeira palavra
conhecida (banheiro, horta, cisterna, passarela, oficina, reforma, diagnóstico…; "Cisterna da Escola" é água, não
educação) e a cor vem junto, por assunto (água azul, natureza verde, obra laranja, energia amarela, educação roxa,
pessoas rosa). **Trocar** abre a grade com os 20 ícones e as cores; depois de escolher à mão, o nome não mexe mais. Os
ícones são desenhos de traço da biblioteca Lucide (licença ISC, em `frontend/src/components/programs/LUCIDE-LICENSE`),
iguais em qualquer aparelho (os emojis de antes mudavam de cara em cada sistema); as chaves antigas continuam valendo.

**Modelo do programa** — em Projetos › programa › "Modelo do programa" (`/programas/{id}/modelo`): **tarefas padrão** (título, "Urgente", descrição e
prazo opcional em dias após o início do projeto; sem prazo por padrão), **indicadores padrão** (nome e unidade) e
**textos sugeridos** (descrição, objetivo e quem se beneficia). A coordenação inclui, edita, reordena e remove; cada
mudança grava na hora e não altera projetos que já existem. Ao criar um projeto de um programa com modelo, o formulário
mostra "Usar o modelo do programa" (já marcado, com o resumo do que será criado): as tarefas entram sem responsável,
com o prazo contado da data de início, os indicadores entram em branco (não informado; os nacionais, que o projeto
já recebe, não se repetem) e os textos preenchem o que ficou em branco. Os
cards dos programas mostram o resumo do modelo ("Modelo: 5 tarefas · 2 indicadores" ou "Sem modelo").

**Menu** — Início · Projetos · Tarefas · Voluntários · Relatórios · Configurações. Configurações aparece só para a
coordenação; o voluntário comum chega na própria conta pelo menu do avatar (e a lista de acessos, com e-mails, deixou
de ser visível para ele).

**No celular** — uma barra fixa embaixo com **Início · Projetos · Tarefas · + Registrar** (o menu lateral continua no
botão do topo, para Voluntários, Relatórios e Configurações). **Registrar** pergunta o projeto (os da pessoa primeiro,
com busca) e abre o projeto já no registro de andamento, com o cursor no campo; o botão "Registrar" de Meus projetos,
no Início, faz o mesmo (`/projetos/{id}?registrar=1`). Os avisos de confirmação aparecem acima da barra. As listas em
tabela (Projetos, Voluntários, Equipe do projeto, Relatórios, Acessos e as da área Nacional) viram cartões, um por
linha, sem rolar para o lado. Os campos têm letra de 16px e 44px de altura (no iPhone, letra menor faz a tela ampliar
sozinha a cada toque num campo). Dá para pôr a plataforma na tela de início do celular ("Adicionar à Tela de Início"
no Safari, "Instalar app" no Chrome): vira o ícone **CtrlESF** (o globo do logo da ESF) e abre em tela cheia
(`frontend/public/manifest.json` e `frontend/public/icons/`; a Ajuda explica o passo a passo).

**Sem internet (consulta)** — o que foi aberto com internet fica guardado no aparelho e continua abrindo sem conexão,
com a faixa "Sem internet" no topo; os projetos de "Meus projetos" ficam guardados sozinhos quando o Início abre, mesmo
os que a pessoa não abriu. Tela nunca aberta mostra "Sem internet, e esta informação ainda não foi aberta neste
aparelho com internet". Salvar (registro, tarefa, horas) ainda precisa de internet: sem ela, o aviso de erro diz "Sem
internet. Conecte-se e tente de novo.". Ao sair (ou entrar com outra pessoa), os dados guardados são apagados. Como
funciona: `frontend/service-worker.js` vira o `/sw.js` no build (o `vite.config.ts` põe a lista de arquivos e a
versão); só existe no build de produção, não no `npm run dev`.
- App (HTML, JS, CSS, ícones): guardado inteiro no primeiro acesso. A página vem da rede primeiro (com a rede lenta,
  depois de 4 s, da cópia); a versão nova assume assim que termina de se guardar, e a cópia da anterior fica até a
  próxima versão (abas abertas com ela continuam achando os arquivos dela).
- Dados (`GET /api/...` em JSON, menos a busca e os links de acesso): da rede, guardando cada resposta (até 300);
  sem internet ou depois de 8 s sem resposta, a última cópia, com o cabeçalho `X-Esf-Offline: 1` (é o que liga a
  faixa). Fotos e arquivos (`/uploads/...`): cópia guardada primeiro (até 200), já que o nome nunca muda.
- O nginx manda `Cache-Control: no-cache` para `index.html` e `sw.js` (o navegador sempre confere se há versão nova).
- Para desligar numa emergência: publicar um `sw.js` que só faz `self.registration.unregister()` no `activate`
  (está no comentário do topo do `service-worker.js`).
- Só cobre a API no mesmo endereço do site (como no nginx do Docker); com `VITE_API_URL` apontando para outro
  domínio, os dados não ficam guardados.

**Tarefas** — todas as tarefas dos projetos em planejamento ou em andamento, em **Lista** (agrupada por prazo:
atrasadas, próximos 7 dias, depois e sem prazo; a caixinha conclui e o título abre a tarefa) ou **Quadro** (o kanban
abaixo). Embaixo do título, "7 em aberto · 2 atrasadas" (tocar nas atrasadas filtra só elas). Uma linha só de
controles: **Minhas | Todas** (o voluntário começa nas dele; a coordenação, em todas), a busca, o botão **Filtros** e,
no canto, Lista e Quadro (ícones). Filtros abre os campos com rótulo — **Situação** (atrasadas, bloqueadas ou
concluídas nos últimos 30 dias, com contagem), programa, projeto e responsável (com "Sem responsável") — num painel
preso ao botão; no celular, numa folha que sobe de baixo, com a busca e o botão "Ver N tarefas". Os filtros ligados
aparecem como **etiquetas com ×** embaixo da barra (no celular, a busca também) e "Limpar tudo" tira todos menos
Minhas | Todas. Tudo fica na URL; links antigos (`?recorte=sem-responsavel`, `/projetos?visao=quadro`) continuam
funcionando.

**Quadro (em Tarefas)** — kanban com as tarefas de todos os projetos em planejamento ou em andamento (não
arquivados), em quatro colunas: **Não iniciadas**, **Em andamento**, **Bloqueadas** e **Concluídas** (só as dos últimos 30
dias). Levar um card para Bloqueadas pergunta, sem obrigar, o que está travando; o motivo aparece no card. Nas
colunas em aberto, as atrasadas vêm primeiro, depois o prazo mais próximo e a prioridade; nas concluídas, as mais
recentes. Cada card mostra título, a etiqueta "Urgente" (quando é), projeto (link para a aba Tarefas dele),
responsável com foto (ou "Sem responsável" em destaque) e prazo como data curta ("até 14/07"); quando o prazo venceu,
só o texto fica vermelho, e o detalhe ("atrasada 3 dias") fica na dica do mouse. O mesmo vale para a lista da aba
Tarefas e para o Início. Para mudar o status, arraste o card para outra coluna (com o mouse; no celular,
segure o card um instante e arraste, e o quadro rola sozinho ao chegar na borda) ou, no celular, use o selo de status
do card. Clicar no card abre a janela da tarefa, e o botão "Nova tarefa" cria uma pelo próprio quadro,
escolhendo o projeto no formulário (filtrando por um programa, só os projetos dele aparecem); o responsável é
escolhido depois do projeto, entre a equipe dele. O quadro só é baixado quando a visão Quadro é aberta. Os filtros são os da tela Tarefas. No celular as colunas ficam lado a lado e o quadro rola na
horizontal, uma coluna por vez. O status do projeto em si é alterado na página do projeto. O arrastar e soltar usa
[dnd-kit](https://dndkit.com/) (`@dnd-kit/core`).

**Janela da tarefa** — clicar numa tarefa, em qualquer lugar (Início, Tarefas, quadro, aba Tarefas do projeto,
avisos, busca), abre a janela dela **para ler**: status (muda na hora; bloquear pergunta o motivo), "Urgente" (quando
é), responsável, prazo, projeto e descrição; ao lado (embaixo, no celular), **checklist** (itens para marcar,
com barra de progresso; incluir com Enter, remover no ×), **anexos** (vários arquivos de uma vez; imagens em miniatura)
e comentários. **Editar** troca para o formulário (Cancelar volta para a leitura); "Editar" no menu ⋯ da aba do projeto
abre direto no formulário. Status, checklist, anexos e comentários gravam na hora, sem depender do "Salvar". Os anexos
também aparecem na aba Arquivos do projeto, com o selo "da tarefa …"; excluir a tarefa mantém o arquivo no projeto. O
card do quadro e as listas mostram o resumo (`☑ 3/5 · 📎 1 · 💬 2`), verde quando o checklist está completo. Links
antigos (`?aba=atividades&atividade=…`) continuam abrindo a tarefa.

**Comentários nas tarefas** — na mesma janela, abaixo do checklist e dos anexos: a conversa do dia a dia sobre a
tarefa (não vai para o relatório, ao contrário dos registros de andamento). Digitar **@** abre a lista de pessoas com
acesso (a equipe do projeto primeiro, sem diferenciar acentos) e escolher insere o nome; Ctrl+Enter envia. Quem
escreveu edita (aparece "(editado)") e apaga o próprio comentário; a coordenação também apaga os dos outros. Avisos no
sininho: quem foi mencionado ("Ana mencionou você em…") e, num comentário novo, o responsável pela tarefa ("Ana
comentou em…"); na edição, só quem foi mencionado agora. Todo aviso de tarefa (atribuição, bloqueio, prazo,
comentário) abre direto a janela daquela tarefa. O resumo nos cards ganha o contador de comentários.

**Busca geral** — campo fixo no topo de todas as telas (no celular, a lupa abre a busca ocupando a largura da tela);
**Ctrl+K** (⌘K no Mac) leva o cursor até ele. Procura ao mesmo tempo em projetos (nome, comunidade, bairro, cidade),
tarefas (título e descrição), voluntários, programas e registros de andamento, sem diferenciar maiúsculas nem acentos
("joao" acha "João"), e mostra até 5 de cada tipo, agrupados. Setas escolhem e Enter abre; uma tarefa abre direto
na janela dela. Voluntários anonimizados, documentos assinados e o histórico de alterações ficam de fora. No banco, a
comparação usa a função `esf_fold` (criada pela migração, sem depender de extensão do Postgres).

**Detalhes do projeto** — cabeçalho com o status (alterado no próprio badge) e o prazo em texto ("faltam 45 dias",
"atrasado há 5 dias"), uma **faixa de situação** visível em todas as abas (progresso, tarefas atrasadas,
bloqueadas e equipe, cada uma levando à aba correspondente; embaixo, na largura toda, os **indicadores** do projeto,
nome e valor com a unidade; tocar num deles abre a janela para atualizar o valor ali mesmo — nome, unidade e exclusão
ficam na aba Sobre; sem indicadores, a coordenação vê o convite, que abre o cadastro do primeiro, e os demais não veem a
linha) e cinco abas: **Andamento** (a inicial), **Tarefas**, **Equipe**, **Arquivos** e **Sobre** (descrição, objetivo,
período, comunidade ou família atendida, quem se beneficia, local e indicadores; programa e responsável já estão no
topo). A aba aberta fica na URL (`?aba=tarefas`, `?aba=equipe`…),
então links diretos e recarregar a página caem no lugar certo. No celular, quando as abas não cabem, aparece uma seta
com degradê na borda onde há mais abas (tocar nela rola a barra), e a aba aberta é trazida para a parte visível. **Gerar relatório** abre as mesmas opções da tela Relatórios
(componente `components/reports/ReportOptions.tsx`), já com o projeto escolhido.

**Concluir ou cancelar o projeto** — escolher Concluído ou Cancelado no badge do topo abre uma confirmação: avisa
quantas tarefas ainda estão em aberto (com atrasadas e bloqueadas, e o botão "Ver tarefas") e pede, sem obrigar, um
**registro de encerramento** (ou o motivo do cancelamento), que é publicado no Andamento como um registro comum e por
isso entra no relatório. Os outros status mudam direto. Quando todas as tarefas estão concluídas e o projeto ainda está em
planejamento, em andamento ou pausado, aparece abaixo da faixa de situação a sugestão "Todas as tarefas estão
concluídas…" com **Concluir projeto** (abre a mesma confirmação) e **Agora não** (some daquele projeto até fechar o
navegador).

**Tarefas** — título, descrição, responsável, status (não iniciada / em andamento / bloqueada / concluída; ao bloquear, um motivo opcional), prioridade
("Urgente" ou normal: só a urgente ganha etiqueta, em laranja) e prazo. Não há mais "observações" (o que havia foi para
o fim da descrição) nem prioridade baixa (virou normal): a tarefa tem descrição, checklist e comentários. A lista tem duas seções sempre visíveis: **Em aberto** (não iniciadas
primeiro, depois em andamento e bloqueadas, reordenando na hora quando o status muda) e **Concluídas**. Há caixinha para concluir em
um clique e "Desfazer" logo em seguida; a tarefa concluída fica riscada no lugar e só passa para "Concluídas" quando
a aba é aberta de novo. O botão "Nova tarefa" abre o
formulário com título, responsável, prazo, "Urgente" e descrição. O responsável é escolhido entre a
equipe do projeto; ao atribuir alguém de fora, a pessoa entra na equipe automaticamente (o responsável pelo projeto
também faz parte dela e só pode ser desvinculado depois de trocado). Na lista de responsáveis, cada nome mostra a
carga da pessoa ("Fausto da Silva · 2 em aberto", "Edu Grehs · afastado"), contada como no Início (tarefas em aberto
de projetos em planejamento ou em andamento, não arquivados), e embaixo do campo aparece o resumo de quem foi
escolhido ("2 tarefas em aberto, 1 atrasada.").

**Andamento** — a tela inicial de cada projeto. No topo, o campo "Registrar andamento" para publicar um registro com
formatação básica (negrito, itálico, sublinhado, listas e links) e uma ou mais fotos anexadas; o HTML é limpo no
servidor, só essas formatações são aceitas, e elas também aparecem no relatório PDF. Abaixo,
o feed com data e autor, do mais recente para o mais antigo. Editável depois
de publicado, e cada registro pode ganhar novos anexos com o tempo. O feed fica numa coluna centralizada, com
largura confortável de leitura. Os anexos aparecem compactos (até 4 miniaturas, depois "+N"; documentos numa linha) e
as fotos abrem num visualizador em tela cheia (setas ou deslizar no celular). Editar, anexar e excluir ficam no menu
"..." de cada registro, e remover um anexo pede confirmação. O texto que está sendo escrito vira **rascunho** guardado
no aparelho (localStorage, por pessoa e por projeto, a cada letra): trocar de tela, recarregar, fechar o navegador ou
perder a sessão não apaga, e ao abrir o projeto de novo o texto volta com o aviso "Rascunho guardado neste aparelho" e
"Descartar rascunho". Publicar apaga o rascunho; as horas do dia entram nele, as fotos escolhidas não. Os rascunhos
somem no "Sair" (o aparelho pode ser compartilhado) e depois de 30 dias esquecidos (`utils/drafts.ts`). Os nomes são
sempre os mesmos: **Andamento** é a aba,
**Registrar andamento** é a ação e cada item publicado é um **registro** ("Publicar registro", "Último registro").

**Voluntários** — gestão das pessoas da organização: nome, contato, setor (Projetos, Jurídico, Pessoas, Comunicação,
Qualidade ou Financeiro), situação (ativo/inativo) e observações. A listagem mostra em quais projetos cada um está
vinculado, com filtro por setor e por situação (no celular, busca e filtros ficam no botão "Filtros", como em
Tarefas e Projetos). **Contato em um toque**: na lista, a coluna Contato tem ícones de e-mail (abre o programa de
e-mail) e WhatsApp (só quando o telefone é celular do Brasil: DDD + 9 + 8 dígitos; sem o 55, ele é incluído);
na página do voluntário e na aba Equipe do projeto, o e-mail e o telefone por extenso viram links (o telefone liga ao
toque), com "WhatsApp" ao lado do celular. A lista não tem coluna de ações: editar e anonimizar ficam na página da
pessoa. A **página do voluntário** traz primeiro o contato e o perfil (e-mail, telefone, aniversário, competências) e
os projetos atuais e anteriores; ao lado (embaixo, no celular), a parte administrativa: acesso, horas e termo. O vínculo com projetos (e o papel exercido em cada um) pode ser feito
tanto pela aba de voluntários de cada projeto quanto diretamente ao editar o voluntário, sempre entre projeto e
voluntário já cadastrados. O cadastro guarda o aniversário (só dia e mês): no dia, a pessoa ganha o selo "Aniversário
hoje" na lista e no detalhe, e um aviso no topo da página lista os aniversariantes. A foto (opcional) é o primeiro
item do formulário: escolhida do computador e enquadrada num círculo (arrastar e zoom) antes de ser usada; o navegador
envia só o recorte, um quadrado de 400x400, gravado ao salvar o voluntário. A foto aparece como uma bolinha na
lista de voluntários, no detalhe, na aba Equipe dos projetos e no canto superior direito (para o voluntário vinculado
à conta logada); sem foto, aparecem as iniciais. Quando o acesso está vinculado a um voluntário, a plataforma mostra o
nome e a foto desse voluntário no topo, na barra lateral, no "Olá" do Início, como autor dos registros de andamento
e em "Enviado por" dos arquivos; sem vínculo, usa o nome do próprio usuário.

**Termo de adesão e uso de imagem** — quem assina é sempre o próprio voluntário, online, na conta dele (qualquer perfil
de acesso, inclusive administrador e coordenador): o Início mostra "Assine seu termo de adesão" (ativos e afastados sem
termo), e Configurações › Minha conta e o próprio perfil têm o botão "Ler e assinar" e, depois, o download da via
assinada. Para assinar, ele lê o texto na tela (o mesmo do PDF: adesão ao serviço voluntário, Lei 9.608/98, e
autorização de uso de imagem), responde se autoriza o uso da imagem, informa o CPF, marca "Li e concordo" e digita o nome
completo igual ao do cadastro (assinatura eletrônica simples, MP 2.200-2/2001, art. 10, § 2º). A plataforma gera na
hora o PDF com o registro da assinatura no fim (nome, CPF, conta, data e hora de Brasília, endereço de rede — o que o
nosso proxy informou; se a cadeia trazia outros antes dele, vão junto como "não conferido") e guarda
junto o navegador, a versão do texto (`DocumentTemplates.VolunteerTermVersion`: mude a data ao mudar as cláusulas) e o
SHA-256 do arquivo. O CPF só fica dentro do PDF, não numa coluna. Assina uma vez só, e o termo assinado não pode ser
apagado. A coordenação (administrador e coordenador) não gera nem envia termo: na página do voluntário, vê a situação
("Aguardando a assinatura online", ou o que falta, como dar acesso à plataforma) e baixa a via assinada. Na lista de
voluntários, a coordenação vê no topo quantos ativos e afastados estão sem termo, com o botão "Ver quem falta" (filtra a
lista), e cada um deles ganha um ponto vermelho com "!" no canto da foto. Os documentos assinados não ficam em
`/uploads`: só abrem pelo download com login. Quem responde pela organização (nome e cargo) é configurado em
Configurações › Organização. Termos enviados como arquivo antes da assinatura online continuam valendo e aparecem como
"Assinado em dd/mm/aaaa".

**Anonimizar voluntário** — na página do voluntário, a coordenação usa "Anonimizar dados" (no menu "⋯" ao lado de "Editar voluntário")
no lugar de excluir (quando a pessoa sai da
organização ou pede a exclusão dos dados): nome vira "Voluntário removido", saem e-mail, telefone, habilidades,
observações, aniversário e foto, a situação passa a ex-membro, o acesso vinculado é desfeito e os avisos da pessoa
são apagados. Projetos, tarefas e documentos assinados continuam, sem identificar a pessoa, e o cadastro não pode
mais ser editado. A exclusão definitiva continua na API, só para administrador.

**Certificado de voluntariado** — na página do voluntário, "Gerar certificado" (coordenação) abre três opções, além do
CPF opcional (só vai para o PDF e não fica salvo): **período completo** (do início ao fim dos períodos como Ativo no
histórico, com as horas que a plataforma calcula: as mesmas da página do voluntário), **período específico** (datas e
horas por semana, 6 por padrão; o total é semanas do período, contando o primeiro e o último dia, vezes a carga semanal,
arredondado para baixo: de 07/10 a 31/12/2025, com 6 h/semana, são 73 horas) e **por projeto** (um dos projetos da
pessoa: o certificado diz o projeto, o programa, o período e as horas lançadas nele, quando há, seguidos de "Sobre o
projeto" — sugerido pelo objetivo — e "Atuação" — sugerida pelo papel na equipe e pelo que a pessoa lançou que fez;
os dois textos são editáveis, até 300 e 400 caracteres, e o período sugerido vai da entrada na equipe ou da primeira
hora lançada até hoje ou até o fim do projeto). O certificado sai em A4 deitado, no modelo da organização: nome e CNPJ,
CPF, o nome do voluntário em destaque e o texto da opção escolhida. Embaixo vão a assinatura (imagem enviada em Configurações › Organização, que
fica privada; sem ela, a linha sai em branco para assinar à mão), o nome, o cargo e uma linha opcional (ex.: "Gestão
2025") de quem assina, e o logo da organização.

**Horas de voluntariado** — a página do voluntário mostra o total de horas: dias como Ativo vezes 6 h por semana (a
mesma conta do certificado). Os dias saem do histórico de status, que a plataforma registra sozinha quando a situação
muda no cadastro (a partir daquele dia). A coordenação corrige ou completa o passado em "Incluir período" (status, de e
até; sem "até", continua até hoje): o período substitui o que havia nessas datas e, depois dele, volta o status
anterior; um afastamento de um mês no passado é só "Afastado, de 01/08 a 31/08". Editar um período é como tirá-lo e
incluir de novo; remover faz o status anterior valer também nessas datas. Datas fora do histórico (antes do primeiro
registro ou entre um período antigo e a volta da pessoa) não contam horas. Voluntários que já existiam começam com o
status atual desde a data do cadastro. Todos veem o total; o histórico só aparece para a coordenação e para o próprio
voluntário, e só a coordenação edita. O certificado já abre com o período do primeiro ao último período como Ativo.

**Horas por projeto** — além das horas gerais (que saem do histórico de status), cada projeto tem as horas lançadas
por quem trabalhou nele: dia, horas (de 0,25 a 24) e, se quiser, o que fez. Quem está na equipe lança as próprias, na aba
Equipe ou junto com o registro de andamento ("Suas horas hoje", opcional: o texto do registro vira o "o que fez");
administrador e coordenador lançam, corrigem e apagam as de qualquer um da equipe. A aba Equipe mostra o total do projeto,
as horas de cada pessoa e os lançamentos. O relatório em PDF ganha a coluna Horas na equipe de cada projeto (no período de
referência, quando há) e o total no bloco Resultados; o certificado por projeto usa essas horas. As duas contas ficam
separadas, para a mesma hora não contar duas vezes.

**Indicadores** — número simples de resultado por projeto (nome, valor e unidade, sem meta nem barra de progresso).
Todo projeto tem os **indicadores nacionais** ativos (vêm primeiro, com a etiqueta "nacional"); os demais são
específicos do projeto (**Novo indicador**, na aba Sobre). O valor pode ficar **em branco**: "não informado", que é
diferente de zero — não entra nas somas e não aparece no PDF. O nacional não sai do projeto nem vira específico; só o
valor muda (a janela mostra o "como contar" da gestão nacional).

**Arquivos** — um lugar só para todos os arquivos do projeto, inclusive as fotos publicadas no Andamento (marcadas com
a data do registro). Envio de um ou vários arquivos por seleção ou arrastar e soltar, legenda editável em qualquer
arquivo (é ela que aparece embaixo da foto no relatório), visualizador de fotos em tela cheia, download e exclusão.
Os arquivos ficam guardados no próprio banco (tabela `StoredFiles`), então não se perdem quando o servidor é recriado
a cada deploy. Fotos grandes são reduzidas no navegador antes do envio (JPEG com o maior lado em 2048 px).

**Autorização de imagem dos beneficiários** — na aba Sobre de cada projeto, a coordenação gera o termo de autorização
de uso de imagem em PDF (com o nome e o local do projeto e espaço para os dados de quem autoriza e das crianças e
adolescentes de quem é responsável), colhe a assinatura de cada família e envia as cópias, que ficam privadas como os
termos de adesão. Enquanto não houver autorização registrada, a aba Arquivos de um projeto com fotos e a tela de
Relatórios (quando o registro fotográfico está marcado) mostram um aviso; o PDF do relatório não muda.

**Localização** — endereço, bairro, cidade, estado e, quando houver coordenadas, mapa embutido (OpenStreetMap, sem chave de API).

**Relatórios** — seleção de um ou vários projetos, observação livre e geração de um **PDF consolidado** com
identificação, descrição, objetivo, período, status, responsável, localização, voluntários e
indicadores (sempre incluídos), tarefas concluídas e fotos (opcionais, marcados por padrão). O **período de
referência** (De/Até, cada ponta pode ficar em branco, com atalhos **Mês passado**, **Últimos 3 meses**, **Este
ano** e **Todo o histórico**) aparece no topo de todas as páginas e filtra a linha do
tempo (registros e as fotos deles) e as tarefas concluídas; projeto sem registro no período mostra "Nenhum registro de
andamento no período". Indicadores e equipe saem como estão hoje (os indicadores não guardam histórico). As datas
seguem o horário de Brasília, o mesmo usado para imprimir as datas no PDF. Com mais de um projeto, o PDF abre com
**Resultados**: quantos projetos (e quantos em cada status), voluntários nas equipes (sem repetir quem está em mais
de um), registros de andamento e tarefas concluídas no período e, para cada programa com indicadores padrão no
modelo, esses indicadores somados nos projetos do relatório (mesma comparação de nomes da visão do programa). Títulos
de seção não ficam sozinhos no pé da página, e os cartões de indicadores não se dividem entre duas páginas.

**Acesso por link** — o acesso nasce do cadastro do voluntário: na página dele, **Dar acesso** (ou, em
Configurações › Acessos, **Novo acesso**, escolhendo o voluntário; só administradores) pede o perfil e usa como login
o e-mail do cadastro (sem e-mail, não dá). Sai um **link de primeiro acesso** (`/acesso/{código}`), mostrado uma vez,
com botões para copiar, mandar pelo WhatsApp (celular do cadastro, já com a mensagem) ou por e-mail. A pessoa abre,
cria a própria senha, aceita a política de privacidade e já entra; ninguém define nem repassa senha de outra pessoa.
O link vale 7 dias e uma vez só; só o hash do código fica no banco (tabela `AccessLinks`). Enquanto não for usado, o
acesso aparece como "Aguardando o primeiro acesso" e o login com senha é recusado. Para quem perdeu o link ou esqueceu
a senha, **Gerar link de acesso** (página do voluntário ou ícone da chave em Acessos) faz um link novo e anula os
anteriores ainda não usados. As rotas públicas do link aceitam 20 tentativas por minuto por endereço (o endereço real de quem acessa, não o do
proxy; ver `ForwardedHeaders` em Configuração). A lista de
voluntários mostra uma chave ao lado de quem tem acesso (cinza enquanto aguarda o primeiro acesso), e a página do
voluntário mostra o perfil e a situação do acesso. Acessos antigos, com senha definida antes, continuam valendo. O nome e
o e-mail do acesso vêm do cadastro do voluntário: mudar o e-mail no cadastro muda o login (não pode ficar em branco
nem repetir o de outro acesso, de qualquer núcleo). Em **Configurações › Acessos** a lista mostra a pessoa (com o
e-mail de login), o perfil e a situação, e editar muda só o perfil e se o acesso está ativo; um acesso antigo, sem
cadastro de voluntário, pode ser ligado a um ali.

**Gestão nacional** — a área **Nacional** do menu (só para quem tem a permissão; `/nacional`) tem as abas:
- **Painel** (a primeira): os números de todos os núcleos, no total (cartões) e numa tabela por núcleo — projetos em
  andamento e concluídos, voluntários ativos, horas de voluntariado (dias como Ativo × 6 h/semana, a mesma regra do
  perfil do voluntário), tarefas concluídas, registros de andamento, data da última atividade (último registro ou
  tarefa concluída: mostra quem está usando de fato) e uma coluna por indicador nacional. Os indicadores nacionais
  aparecem também somados em cartões. Horas, tarefas e registros contam no **período** escolhido (de início, o ano
  corrente); projetos, voluntários e indicadores são a situação de hoje (os indicadores não guardam histórico;
  somam os projetos não arquivados pelo vínculo com o indicador nacional). Só números: nada de nomes de pessoas
  nem de projetos.
- **Núcleos**: cada núcleo com cidade/UF, voluntários ativos, projetos em andamento e quem o administra (nome,
  e-mail, situação do acesso). **Novo núcleo** pede nome, cidade, estado e quem vai administrar: a pessoa entra como
  voluntária e administradora do núcleo novo e recebe o link de primeiro acesso; os demais dados do núcleo (CNPJ, logo,
  quem assina) ela completa em Configurações. No menu ⋯ do núcleo, **Editar núcleo** (nome e local) e **Novo
  administrador** (se a pessoa já for voluntária do núcleo, o acesso nasce do cadastro dela; se já tiver acesso, só
  passa a administradora). A chave ao lado de cada administrador gera um link novo.
- **Indicadores nacionais**: os resultados comuns a todos os núcleos (nome, unidade e **como contar**), **obrigatórios
  em todo projeto**. Cada nacional ativo entra sozinho em todos os projetos de todos os núcleos (no projeto novo, ao
  criar o nacional, ao reativá-lo e, para os projetos que já existiam, pela migração `MandatoryNationalIndicators`), com
  o valor em branco até o núcleo informar. O nacional traz nome e unidade (o núcleo só informa o valor), aparece com a
  etiqueta "nacional", vale uma vez por projeto, não pode ser excluído nem desligado e entra na soma do painel pelo
  vínculo, não pelo nome; em branco não soma. No modelo do programa, escolher um nacional só serve para somá-lo na
  visão do programa. Mudar nome ou unidade de um nacional atualiza os indicadores ligados em todos os núcleos;
  arquivar deixa de exigir (projeto novo não recebe e o núcleo pode tirar), e os já ligados continuam valendo.
- **Pessoas da gestão nacional**: quem tem a permissão. **Incluir pessoa** dá a permissão a um login de núcleo (mesma
  senha; o menu Nacional aparece quando a pessoa entrar de novo) ou cria uma conta só nacional, com link. **Tirar**
  remove a permissão (a conta só nacional fica desativada); ninguém tira a própria.

A gestão nacional não vê voluntários, projetos, tarefas nem registros de dentro dos núcleos: só contagens e quem
administra cada núcleo. A primeira conta vem da configuração do servidor (`Nacional:AdminEmail` e
`Nacional:AdminPassword`, ver Configuração), criada na subida enquanto não existe nenhuma.

**Janelas de formulário** — depois que algo foi digitado ou escolhido numa janela de formulário (projeto, tarefa,
voluntário, programa, indicador, horas, equipe, certificado, termo, núcleo, acesso…), clicar fora dela ou apertar Esc
pergunta "Descartar o que foi preenchido?" (Continuar preenchendo | Descartar), porque esses dois fecham a janela sem
querer. O X e o Cancelar continuam fechando direto. Janela em que nada foi mexido fecha como antes. Fica no componente
`Modal` (`guardChanges`), que percebe a digitação pelos eventos dos campos, inclusive o editor de texto.

**Página pública do programa** — um link que abre sem login e só para leitura, para mandar a parceiros e financiadores
no lugar do PDF (ou virar QR code na placa da obra). Fica desligada em todo programa; a coordenação liga e desliga, e
desligar invalida o link (ligar de novo gera outro, `/publico/{código}`). Mostra o programa (nome, ícone e o "Sobre o
programa", texto escrito para quem não conhece o núcleo), os **resultados até hoje** (quantos projetos concluídos, em
andamento, em preparação e pausados; os indicadores nacionais e os do modelo do programa somados, só os que têm valor;
quantos voluntários participaram, sem repetir, e as horas lançadas), um cartão por projeto (nome, situação, bairro e
cidade, início e previsão de término, progresso das tarefas, os indicadores informados e quando foi o último registro)
e, no rodapé, o nome, o CNPJ e o e-mail do núcleo. Projetos cancelados e arquivados ficam de fora. Nunca aparecem
endereço, mapa, nomes de voluntários, tarefas, o texto dos registros, fotos nem arquivos. O código do link não vai para
o histórico (só que a página foi ligada, desligada ou trocada). Na tela (`pages/PublicProgramPage.tsx`, fora do login),
"Planejamento" aparece como "Em preparação", a barra de progresso só aparece em andamento e pausado, e o link desligado
mostra "Página indisponível" (sem mandar para o login). A página fica fora dos buscadores (`noindex`), tem o nome do
programa no título da aba e não instala o uso sem internet (quem é de fora não precisa guardar o app). Para a
coordenação, a visão do programa (Projetos › programa) tem o botão **Página pública**. A janela explica o que aparece
e tem o "Sobre o programa" (até 1.500 caracteres, salvo sozinho ao sair do campo). Sem link, **Gerar link** liga a
página na hora e o link aparece ali mesmo, com **Copiar link** e **Ver como o público vê**; com link, **Desligar link**
(com confirmação) faz ele parar de abrir, e gerar de novo cria outro. As gravações vão uma de cada vez, na ordem (sair
do texto e clicar num botão logo depois não se atropelam). Com o link ligado, a visão do programa diz "página pública
ligada".

**Configurações** — dados institucionais, logo, gestão de usuários (editar perfil, voluntário vinculado e ativo;
senha só por link) e troca da própria senha. No formulário de
projeto, o botão "Novo" ao lado do Programa cria um programa num diálogo por cima, já escolhido ao salvar. A aba
aberta fica na URL (`?aba=organizacao`, `acessos`, `planilhas`, `historico` ou `conta`; o antigo `usuarios` leva a
Acessos).

**Planilhas (exportar e importar)** — em Configurações › Planilhas (só administradores, porque o arquivo leva dados
pessoais). **Exportar planilha** abre uma lista do que entra no arquivo do Excel (.xlsx): **Projetos** (um por linha, com
situação, datas, responsável, uma coluna para cada indicador nacional, até três pares Indicador/Valor para os
específicos — mais, se algum programa tiver mais —, equipe com o papel de cada um, local e a autorização de imagem; vem
junto a aba **Programas**, um resumo só de consulta) e **Voluntários** (contatos, setor, situação, entrada e saída tiradas
do histórico de status, aniversário, termo, horas e acesso; anonimizados ficam de fora). O mesmo atalho é o botão **Exportar** ao lado
de Novo projeto e de Novo voluntário (já marcado com o que é daquela tela). Cada exportação entra no histórico de
alterações. **Importar** tem três passos: baixar o **modelo vazio** (o mesmo formato, sem linhas e sem as colunas
calculadas, com as listas suspensas de programas, pessoas e indicadores do núcleo), preencher (à mão ou entregando o
modelo e anotações soltas a uma IA: a aba **Instruções** tem regras numeradas, como reconhecer o que já existe, um
dicionário com cada coluna e um exemplo de texto solto virando linhas — foi testada com agentes que não conheciam a
plataforma) e enviar. Antes de gravar aparece a **conferência**: para cada linha, Novo, Já existe ou Erro, com os erros
e avisos (pessoa não encontrada, homônimo, Saiu em ignorado…), filtro "Erros e avisos" e os programas que serão criados.
A importação **só cria**: voluntário é reconhecido pelo e-mail (sem e-mail aqui ou lá, pelo nome completo), projeto pelo
nome dentro do programa e programa pelo nome (sem diferença de acento e maiúscula); o que já existe é ignorado, nunca
alterado — reimportar uma exportação não duplica nada. Programa novo recebe o ícone e a cor sugeridos pelo nome e entra
arquivado quando todos os projetos dele estão concluídos ou cancelados; projeto novo recebe todos os nacionais (vazio =
não informado), não recebe as tarefas do modelo do programa e não gera avisos. Voluntário novo ganha o histórico de
status a partir das datas (Ativo desde Entrou em; Ex-membro a partir do dia seguinte a Saiu em), que dá as horas. Linha
com erro fica de fora e as outras entram; ao confirmar, o arquivo é enviado e conferido de novo (nada fica guardado
entre a conferência e a confirmação). O arquivo é reconhecido pela aba oculta **Listas** (tipo e versão do modelo) e
pelos títulos das colunas; outro arquivo é recusado com a explicação, e uma planilha de outro núcleo gera um aviso. O
formato fica num lugar só (`Spreadsheets/SpreadsheetLayout.cs`), usado para gerar e para ler.

**Privacidade (LGPD)** — a política de privacidade e os termos de uso ficam em `/privacidade`, aberta a qualquer pessoa
(link na tela de login). No primeiro acesso, e de novo sempre que o texto muda, uma janela pede o aceite antes de usar
a plataforma; a data e a versão aceita ficam registradas. Para publicar uma nova versão, atualize o texto em
`pages/PrivacyPage.tsx` e a data em `PrivacyTerms.CurrentVersion` (API).

**Histórico de alterações** — toda criação, alteração ou exclusão feita por uma pessoa logada (projetos, tarefas,
registros de andamento, arquivos, indicadores, equipe, voluntários, histórico de status, documentos assinados, programas, usuários e dados da organização)
fica registrada automaticamente, com quem fez, quando e o valor antes e depois de cada campo, e também cada exportação de
planilha ("exportou a planilha (projetos e voluntários)"). Em Configurações ›
Histórico (só administradores) a lista aparece em frases ("Ana alterou a tarefa…"), com filtros por projeto, pessoa,
tipo e período, 50 por vez. Dados pessoais do cadastro de voluntário (nome, contatos, aniversário, observações, foto) só
registram que mudaram, sem o valor, e nomes de voluntários são resolvidos na hora de exibir — quem for anonimizado
aparece como "Voluntário removido" também no histórico. Senhas nunca entram. O que não vem de uma pessoa (dados de
demonstração, rotinas internas) não é registrado.

**Proteção do login** — depois de 10 senhas erradas seguidas, o acesso fica bloqueado por 15 minutos (nem a senha
certa entra nesse tempo, e a mensagem não diz se a senha estava certa); um acerto antes disso zera a contagem, e a
senha criada por um link de acesso libera o acesso na hora. Embaixo do "Entrar" fica **Esqueci minha senha**, que
explica o caminho (não há envio por e-mail): pedir à coordenação do núcleo um link novo de acesso, que chega pelo
WhatsApp ou por e-mail e deixa criar uma senha nova. Depois de uma senha recusada, de um acesso bloqueado ou desativado,
a explicação já aparece aberta. A Ajuda tem a mesma resposta. Os campos de texto livre (observações e registros de andamento) lembram
de não registrar dados sensíveis (saúde, religião, origem, opinião política) nem CPF.

**Topo da tela** — mostra o nome da seção, igual ao item marcado no menu ("Projetos" também dentro de um projeto),
sempre numa linha só. Clicar na foto e no nome abre o menu da conta: **Meu perfil** (a página do voluntário vinculado ao
acesso; não aparece sem vínculo), **Minha conta** (Configurações › Minha conta; para o perfil Usuário, a página se chama
só "Minha conta", sem abas), **Ajuda** e **Sair**.

**Ajuda** (`/ajuda`) — perguntas frequentes que abrem ao toque, agrupadas em Primeiros passos (celular e ícone na
tela, uso sem internet, busca), Tarefas, Projetos e andamento (registro, fotos, relatório) e Avisos e sua conta
(sininho, perfil e horas, termo, senha). A coordenação vê também "Para a coordenação" (acompanhar a organização,
programa e modelo, indicador nacional, cadastro e acesso de voluntário, certificado, importar planilha); a gestão
nacional, a seção dela. Respostas curtas, de uma ou duas frases: só entra o que não dá para descobrir olhando a tela
(onde fica, o que não é óbvio). O texto fica em `pages/HelpPage.tsx`: ao mudar um botão ou uma tela, confira se a
resposta correspondente continua certa. Ao lado fica o **sininho**
de avisos, com a quantidade de não lidos: clicar abre a lista (todos os não lidos, destacados, e os lidos mais recentes
completando 15 itens; cada aviso com o projeto e há quanto tempo), e abrir um aviso o marca como lido e leva à aba
Tarefas do projeto (ou ao projeto); há também "Marcar todas como lidas". Avisos lidos somem depois de 30 dias; os não
lidos ficam até 60, para quem passou um tempo sem entrar não perder nada. Os avisos são do voluntário vinculado ao acesso: tarefa atribuída a você; sua tarefa
bloqueada (com o motivo), concluída ou reaberta por outra pessoa; entrada na equipe de um projeto; definição como
responsável por um projeto; e tarefa sua que vence amanhã ou hoje (o lembrete some quando ela é concluída). Ninguém
recebe aviso do que ele mesmo fez. O contador é conferido a cada minuto, ao trocar de tela e ao voltar para a aba do
navegador. Sem voluntário vinculado, o painel explica como pedir o vínculo. Não há e-mail nem notificação no celular.

---

## Arquitetura

```
React + TypeScript (Vite)
          ↓  REST/JSON + JWT
ASP.NET Core 8 Web API  (Controllers → Services → DTOs)
          ↓
Entity Framework Core 8
          ↓
PostgreSQL 16
```

Monólito simples, sem microserviços, filas, cache distribuído ou CQRS. As responsabilidades ficam separadas assim:

| Camada | Pasta | Responsabilidade |
| --- | --- | --- |
| Controllers | `Controllers/` | HTTP, rotas, autorização, status codes. Sem regra de negócio. |
| Serviços | `Services/` | Regras de aplicação, validações de negócio e orquestração. |
| Entidades | `Domain/` | Modelo de domínio e enums. |
| Persistência | `Data/` | `DbContext`, configuração do modelo, migrations e seed. |
| DTOs | `Dtos/` | Contratos de entrada e saída. Entidades nunca são expostas na API. |
| Infra comum | `Common/` | Erros, opções de configuração, JWT, usuário atual, políticas. |
| Relatórios | `Reports/` | Composição do PDF (QuestPDF), isolada do resto. |
| Planilhas | `Spreadsheets/` | Formato da planilha (colunas, listas), montagem do .xlsx e leitura das células (ClosedXML). |

Os serviços não conhecem HTTP e os controllers não conhecem EF Core. É esse acoplamento baixo que permite, na V1,
reorganizar o projeto em módulos com Clean Architecture e DDD sem reescrever as regras.

**Núcleos (vários núcleos numa plataforma só)** — o registro `Organizations` é o núcleo (nome, CNPJ, logo, quem
assina). Voluntários, programas, projetos, acessos e o histórico de alterações guardam o núcleo (`OrganizationId`); o
resto (tarefas, indicadores, registros, arquivos, equipe, comentários, checklist, avisos, documentos, modelos de
programa, links de acesso) herda o do projeto, do voluntário, da tarefa ou do programa. A separação fica no
`EsfDbContext`, num **filtro global por núcleo** em todas essas tabelas: toda consulta só enxerga o núcleo de quem está
logado (vem no token, claim `org`), sem depender de cada tela lembrar. Registro novo de voluntário, programa ou
projeto entra sozinho no núcleo atual ao salvar, e as validações de "existe?" usam consultas filtradas, então um id de
outro núcleo é recusado. Só quatro pontos olham todos os núcleos, de propósito e com `IgnoreQueryFilters`: o login (o
e-mail é único na plataforma inteira), o link de acesso (rota pública), a checagem de e-mail repetido e a página
pública do programa (acha o programa pelo código do link e, dali em diante, fixa o núcleo dele em
`OrganizationOverride`, então o resto da consulta passa pelo filtro normal). Rotinas
internas (dados de demonstração) usam `AllOrganizations`. Sessões de antes dos núcleos (token sem `org`) pedem para
entrar de novo. Na atualização, a migração `AddNucleos` põe todos os dados existentes no núcleo já cadastrado (o
mesmo registro usado nos termos e certificados); um banco com dados e sem esse registro ganha um.

**Bibliotecas usadas:** Npgsql/EF Core (persistência), BCrypt.Net (hash de senha), JwtBearer (autenticação),
QuestPDF (relatórios), ClosedXML (planilhas, licença MIT), Swashbuckle (Swagger). No frontend: React, React Router e CSS próprio — sem framework de UI.

---

## Estrutura de diretórios

```
ESF_Plataforma_V0/
├─ backend/
│  ├─ Dockerfile
│  ├─ Esf.Api.sln
│  ├─ Esf.Api.Tests/      testes (xUnit, banco em memória): separação entre núcleos
│  └─ Esf.Api/
│     ├─ Common/          AppException, middleware de erros, JWT, opções, políticas
│     ├─ Controllers/     auth, dashboard, projects, activities, volunteers,
│     │                   indicators, files, reports, users, organization
│     ├─ Data/            EsfDbContext, DbSeeder, Migrations/
│     ├─ Domain/          Entities/ e Enums
│     ├─ Dtos/            contratos da API
│     ├─ Reports/         ProjectReportBuilder (PDF) e ReportModel
│     ├─ Spreadsheets/    formato da planilha, montagem do .xlsx e leitura (exportar/importar)
│     ├─ Services/        regras de aplicação
│     ├─ Program.cs       composição da aplicação
│     └─ appsettings.json
├─ frontend/
│  ├─ Dockerfile, nginx.conf, vite.config.ts
│  └─ src/
│     ├─ api/             cliente HTTP e endpoints
│     ├─ components/
│     │  ├─ layout/       AppLayout, Sidebar, ProtectedRoute
│     │  ├─ projects/     formulários e abas do projeto
│     │  └─ ui/           botões, campos, tabela, badges, modal, estados
│     ├─ context/         autenticação e avisos
│     ├─ pages/           login, dashboard, projetos, detalhe, voluntários,
│     │                   relatórios, configurações
│     ├─ styles/          sistema visual em CSS
│     ├─ types/           tipos espelhando os DTOs
│     └─ utils/           formatação de datas, números e rótulos
└─ docker-compose.yml
```

---

## Modelo de dados

| Tabela | Conteúdo |
| --- | --- |
| `Users` | acesso à plataforma (nome, e-mail, hash da senha — vazio até o primeiro acesso —, perfil, ativo, voluntário vinculado) |
| `AccessLinks` | links de acesso (hash do código, validade, uso), para criar a senha no primeiro acesso ou depois de esquecê-la |
| `Projects` | dados do projeto, localização, datas, status, arquivamento (o progresso é calculado, não armazenado) |
| `Programs` | programas (nome, situação, ícone, cor, os textos sugeridos do modelo e a página pública: código do link — vazio com ela desligada — e o "Sobre o programa") |
| `ProgramTemplateActivities` / `ProgramTemplateIndicators` | tarefas e indicadores padrão do modelo de cada programa |
| `Activities` | tarefas do projeto (FK `ProjectId`, responsável opcional) |
| `ActivityChecklistItems` | itens do checklist de cada tarefa (texto, feito, ordem) |
| `ActivityComments` | comentários das tarefas (autor, texto, voluntários mencionados, edição) |
| `Indicators` | indicadores do projeto (nome, valor — vazio é "não informado" — e unidade; `NationalIndicatorId` quando é um indicador nacional) |
| `NationalIndicators` | indicadores nacionais da gestão nacional (nome, unidade, como contar, arquivado); sem núcleo |
| `Volunteers` | cadastro de voluntários (inclui setor: Projetos, Juridico, Pessoas, Comunicacao, Qualidade ou Financeiro) |
| `VolunteerStatusChanges` | histórico de status dos voluntários (a partir de que dia valeu cada situação), base das horas de voluntariado |
| `ProjectVolunteers` | vínculo N:N projeto × voluntário, com papel no projeto |
| `ProjectFiles` | metadados dos arquivos enviados (o conteúdo fica em `StoredFiles`); pode pertencer direto ao projeto ou a um registro de andamento |
| `ProjectUpdates` | registros de andamento do projeto (texto, autor, data, editável) |
| `Organizations` | núcleos: dados institucionais de cada um (nome, CNPJ, logo, quem assina); voluntários, programas, projetos, acessos e histórico apontam para o núcleo (`OrganizationId`) |
| `StoredFiles` | conteúdo dos arquivos enviados (fotos, documentos, logo), servido em `/uploads/{nome}`; os documentos assinados são privados e não saem por lá |
| `SignedDocuments` | termos de adesão de voluntários e autorizações de uso de imagem de projetos (arquivo assinado e data) |
| `AuditEntries` | histórico de alterações: quem fez, quando, o quê e os campos alterados (antes e depois) |
| `Notifications` | avisos do sininho para cada voluntário (atribuição, bloqueio, conclusão, reabertura, equipe, responsável, prazos de hoje/amanhã, menção e comentário), com data de leitura; os lidos são apagados após 30 dias e os não lidos após 60 |

Chaves estrangeiras com `ON DELETE CASCADE` para o que pertence ao projeto (tarefas, indicadores, vínculos, arquivos)
e `SET NULL` para referências a usuários (excluir um usuário não apaga o projeto dele).

---

## API

Base: `http://localhost:5080`. Todas as rotas exigem `Authorization: Bearer <token>`, exceto o login.
A documentação interativa fica em `/swagger`.

| Método | Rota | Descrição |
| --- | --- | --- |
| POST | `/api/auth/login` | autentica e devolve o token |
| GET | `/api/auth/me` | usuário da sessão |
| POST | `/api/auth/change-password` | troca a própria senha |
| POST | `/api/auth/accept-terms` | registra o aceite da política de privacidade e dos termos de uso (versão vigente) |
| GET | `/api/dashboard` | dados do Início (minhas tarefas, meus projetos, resumo da organização e carga da equipe) |
| GET | `/api/projects` | lista com `search`, `status`, `programId`, `onlyLate`, `onlyStale`, `includeArchived`, `sort` |
| GET/POST | `/api/programs` | lista e cria programas (agrupamento de projetos; `onlyActive=false` inclui os arquivados) |
| GET/PUT/DELETE | `/api/programs/{id}` | programa com contagens de projetos e resultados somados; edita nome, ícone e cor e arquiva/reativa; exclui só programa sem projetos |
| GET/PUT | `/api/programs/{id}/template` | modelo do programa (PUT grava o modelo inteiro; coordenação) |
| GET | `/api/volunteers/{id}/documents` | termo assinado do voluntário (coordenação; quem assina é o voluntário, em `/api/me/term`) |
| GET/POST | `/api/projects/{id}/documents` | autorizações de uso de imagem do projeto (coordenação); `/template` gera o termo em PDF |
| GET | `/api/volunteers/{id}/certificate/options` | período completo e projetos da pessoa, já calculados, para a janela do certificado |
| POST | `/api/volunteers/{id}/certificate` | certificado em PDF: período completo, período específico ou por projeto (CPF opcional, não é guardado) |
| POST/DELETE | `/api/organization/signature` | imagem da assinatura usada nos certificados (privada) |
| GET | `/api/audit` | histórico de alterações (só administradores), com filtros por projeto, pessoa, tipo e período |
| GET/DELETE | `/api/documents/{id}/download` · `/api/documents/{id}` | baixa (com login) um documento assinado ou remove uma autorização de imagem (o termo de adesão não se apaga) |
| GET | `/api/me/term` | termo de adesão do voluntário logado: texto, se falta assinar e quando assinou |
| POST | `/api/me/term/sign` | assina online (nome completo, CPF, resposta sobre imagem, aceite); gera e guarda o PDF |
| GET | `/api/me/term/download` | baixa a via assinada do próprio termo |
| POST/GET/PUT/DELETE | `/api/projects[/{id}]` | CRUD de projetos (na criação, `useTemplate` aplica o modelo do programa) |
| PATCH | `/api/projects/{id}/status` | mudança de status |
| POST | `/api/projects/{id}/archive` · `/unarchive` | arquivar e reativar |
| GET/POST | `/api/projects/{id}/activities` | tarefas do projeto |
| PUT/PATCH/DELETE | `/api/activities/{id}[/status]` | edição, status e exclusão |
| GET | `/api/activities/upcoming` | próximos prazos pendentes (`mine=true`: só os do usuário logado) |
| GET | `/api/activities/board` | quadro de tarefas: projetos em planejamento ou em andamento, concluídas dos últimos 30 dias |
| GET | `/api/activities/{id}/details` | checklist, anexos e comentários da tarefa |
| POST · PUT/DELETE | `/api/activities/{id}/checklist` · `/api/checklist/{itemId}` | inclui, marca/reescreve e remove itens do checklist |
| GET | `/api/activities/{id}/mentionable` | quem pode ser mencionado com @ (equipe primeiro) |
| GET | `/api/search?q=` | busca geral (projetos, tarefas, voluntários, programas e registros; mínimo 2 letras) |
| POST · PUT/DELETE | `/api/activities/{id}/comments` · `/api/comments/{commentId}` | comenta; edita (autor) e apaga (autor ou coordenação) |
| GET | `/api/notifications` · `/unread` | avisos do usuário logado (todos os não lidos, até 50, e os lidos completando 15) e a quantidade de não lidos |
| POST | `/api/notifications/{id}/read` · `/read-all` | marcar um aviso, ou todos, como lido |
| GET/POST/PUT | `/api/volunteers[/{id}]` | cadastro de voluntários (DELETE, exclusão definitiva, só administrador) |
| GET | `/api/volunteers/load` | situação e tarefas em aberto (e atrasadas) de cada voluntário, para escolher o responsável |
| POST | `/api/volunteers/{id}/anonymize` | anonimiza os dados pessoais e mantém o histórico (LGPD) |
| POST/DELETE | `/api/volunteers/{id}/photo` | troca ou remove a foto do voluntário (imagem já recortada) |
| GET | `/api/volunteers/{id}/hours` | horas de voluntariado; o histórico de status só vem para a coordenação e para o próprio voluntário |
| POST/PUT/DELETE | `/api/volunteers/{id}/status-history[/{periodId}]` | inclui, edita ou remove um período do histórico de status (coordenação) |
| GET/POST/DELETE | `/api/projects/{id}/volunteers[/{volunteerId}]` | vínculo com projetos |
| GET/POST | `/api/projects/{id}/indicators` | indicadores do projeto |
| PUT/DELETE | `/api/indicators/{id}` | edição e exclusão |
| GET/POST | `/api/projects/{id}/files` | arquivos do projeto (upload multipart; com `activityId`, anexo de uma tarefa) |
| GET/PUT/DELETE | `/api/files/{id}[/download]` | download, edição da legenda e exclusão |
| GET/POST | `/api/projects/{id}/updates` | registros de andamento (texto + fotos e, opcional, as horas do dia; multipart) |
| GET/POST | `/api/projects/{id}/hours` | horas lançadas no projeto (total, por pessoa e lançamentos) e novo lançamento |
| PUT/DELETE | `/api/hours/{id}` | corrige ou apaga um lançamento de horas (a própria pessoa ou a coordenação) |
| PUT/DELETE | `/api/updates/{id}` | edição e exclusão do registro |
| POST/DELETE | `/api/updates/{id}/attachments[/{fileId}]` | anexar ou remover uma foto do registro |
| POST | `/api/reports/projects` | gera o PDF consolidado (projetos, partes incluídas e período de referência `from`/`to`, opcional) |
| POST | `/api/spreadsheets/export` | planilha .xlsx com o que foi escolhido (`projects`, `volunteers`); entra no histórico (administrador) |
| GET | `/api/spreadsheets/template` | modelo vazio de importação, com as listas do núcleo (administrador) |
| POST | `/api/spreadsheets/import?confirm=` | planilha preenchida (multipart): sem `confirm`, só a conferência linha a linha; com `confirm=true`, cria o que é novo e sem erro (administrador) |
| GET/PUT/DELETE | `/api/users[/{id}]` | gestão de usuários (acesso novo só pelo voluntário, abaixo) |
| POST | `/api/volunteers/{id}/access` | dá acesso ao voluntário (perfil; login = e-mail do cadastro) e devolve o link de primeiro acesso (administrador) |
| POST | `/api/users/{id}/access-link` | link novo de acesso (primeiro acesso perdido ou senha esquecida); anula os anteriores (administrador) |
| GET/POST | `/api/access/{código}` | públicas: dados do link e criação da senha (com o aceite da política), já devolvendo o login |
| GET/PUT | `/api/programs/{id}/public-page` | página pública do programa (coordenação): se está ligada, o código do link e o "Sobre o programa"; o PUT liga/desliga (desligar invalida o link; ligar de novo gera outro) e grava o texto |
| GET | `/api/public/programs/{código}` | pública, sem login (60 acessos por minuto por endereço): a página pública do programa, só com os dados liberados |
| GET | `/api/national/panel?from=&to=` | gestão nacional: painel com os números de todos os núcleos (total e por núcleo) e os indicadores nacionais somados; o período vale para horas, tarefas e registros |
| GET/POST/PUT | `/api/national/nucleos[/{id}]` | gestão nacional: núcleos com números gerais e administradores; núcleo novo já com quem administra (devolve o link) |
| POST | `/api/national/nucleos/{id}/admins[/{userId}/access-link]` | gestão nacional: mais um administrador para o núcleo; link novo para um administrador |
| GET/POST/DELETE | `/api/national/people[/{userId}]` | gestão nacional: quem faz parte, incluir (conta nova com link ou permissão para um login de núcleo) e tirar |
| POST | `/api/national/people/{userId}/access-link` | gestão nacional: link novo para uma conta só nacional |
| GET | `/api/national-indicators` | indicadores nacionais ativos (qualquer acesso, para escolher; `includeArchived` só para a gestão nacional) |
| POST/PUT | `/api/national-indicators[/{id}]` | gestão nacional: cria e edita (nome e unidade novos atualizam os ligados em todos os núcleos) |
| POST | `/api/national-indicators/{id}/archive` e `/unarchive` | gestão nacional: arquiva ou reativa |
| GET/PUT | `/api/organization` · `POST /logo` | dados institucionais |

Erros seguem sempre o mesmo formato:

```json
{ "message": "A previsão de término não pode ser anterior à data de início.", "errors": { "campo": ["..."] } }
```

O `message` é o que a tela mostra, sempre em português com acento. As mensagens que o próprio ASP.NET gera em inglês
(um valor em formato que ele não reconhece) não viram `message`: no lugar, "Algum campo veio num formato que não foi
reconhecido". Sem resposta da API (sem internet, servidor reiniciando, arquivo grande demais para o proxy), a tela
explica o motivo em vez de um erro técnico.

---

## Perfis de acesso

| Perfil | O que pode fazer |
| --- | --- |
| **Administrador** | tudo, incluindo usuários, dados institucionais e exclusão de projetos |
| **Coordenador** | criar e editar projetos, voluntários e indicadores; arquivar projetos |
| **Usuário** | consultar tudo, criar e atualizar tarefas, indicadores, arquivos, registros de andamento e status |
| **Gestão nacional** (permissão, não perfil) | área Nacional: núcleos e quem os administra, pessoas da gestão nacional (e, nas próximas partes, indicadores nacionais e o painel) |

Os três perfis valem dentro do núcleo da pessoa. A gestão nacional é uma permissão à parte (`Users.IsNational`, claim
`nacional` no token, política `National`): pode estar numa conta só nacional (sem núcleo) ou no acesso de alguém de um
núcleo, que continua com o mesmo login e ganha o item **Nacional** no menu. Conta só nacional vê apenas a área
Nacional, Ajuda e Minha conta (o resto é de dentro de um núcleo).

Autenticação por JWT (HS256), senha com BCrypt. As regras ficam em `Common/Policies.cs` e nos atributos
`[Authorize(Policy = ...)]` dos controllers.

---

## Configuração

Tudo por `appsettings.json` ou variáveis de ambiente (prefixo com `__` para seções, como no `docker-compose.yml`):

| Chave | Padrão | Para quê |
| --- | --- | --- |
| `ConnectionStrings:Default` | Postgres local | conexão com o banco |
| `Jwt:Key` | valor de desenvolvimento | assinatura do token — **troque em produção** (mín. 32 caracteres) |
| `Jwt:ExpiresMinutes` | 720 | validade do token |
| `Storage:UploadsPath` | `App_Data/uploads` | pasta onde versões anteriores gravavam os arquivos; os que ainda existirem são copiados para o banco ao iniciar |
| `Storage:MaxFileSizeMb` | 15 | tamanho máximo por arquivo |
| `Cors:AllowedOrigins` | localhost 5173/4173 | origens liberadas |
| `Seed:Enabled` | `true` | criar dados de demonstração em banco vazio |
| `Seed:DemoPassword` | `Esf@2026` | senha dos usuários de demonstração |
| `Nacional:AdminEmail` | (vazio) | conta inicial da gestão nacional, criada na subida do servidor enquanto não existe nenhuma; se o e-mail já for o login de alguém, essa pessoa ganha a permissão |
| `Nacional:AdminPassword` | (vazio) | senha dessa conta inicial (mín. 6 caracteres; troque em Minha conta depois de entrar) |
| `Nacional:AdminName` | `Gestão nacional` | nome da conta inicial |
| `ForwardedHeaders:ForwardLimit` | `1` | quantos proxies nossos ficam na frente da API (nginx do Docker = 1). O endereço de quem acessa sai do fim do `X-Forwarded-For`, que é o que o nosso proxy acrescentou; o que o navegador mandou antes não vale |
| `ForwardedHeaders:ClientIpHeader` | (vazio = `X-Forwarded-For`) | cabeçalho com o endereço real, quando a hospedagem preenche um. No Render (Cloudflare na frente, e o `X-Forwarded-For` só acrescenta), use `True-Client-IP` e confira |

No frontend, `VITE_API_URL` só é necessário se a API não estiver atrás do proxy (Vite em desenvolvimento, nginx em Docker).

### Hospedagem no Render

- **Frontend como Static Site:** precisa da regra **Redirects/Rewrites** com Source `/*`, Destination `/index.html` e
  Action **Rewrite** (não Redirect). Sem ela, o Render só conhece os arquivos do build e qualquer endereço aberto
  direto dá "Not Found": a página pública (`/publico/...`), o link de primeiro acesso (`/acesso/...`) e recarregar uma
  tela (`/projetos/...`). As telas abertas clicando dentro do app funcionam mesmo sem a regra, por isso o problema só
  aparece em link mandado para alguém ou ao recarregar. No Docker isso não acontece (o `nginx.conf` já devolve o
  `index.html`).
- **API:** `ForwardedHeaders__ClientIpHeader=True-Client-IP` (ver a tabela acima) e `Seed__Enabled=false` num banco de
  produção.

---

## Fluxo de desenvolvimento

A `main` é a branch principal do projeto.

### Nova funcionalidade ou alteração maior

Crie uma branch a partir da `main`:

```bash
git checkout main
git pull
git checkout -b feature/nome-da-funcionalidade
```

Exemplo:

```bash
git checkout -b feature/relatorios
```

Após desenvolver e testar:

```bash
git add .
git commit -m "Add project reports"
git push -u origin feature/relatorios
```

Depois, no GitHub:

1. Acesse **Pull requests → New pull request**.
2. Selecione `main` como **base** e sua branch como **compare**.
3. Revise as alterações.
4. Clique em **Create pull request**.
5. Após a revisão, faça o **Merge**.

Depois do merge:

```bash
git checkout main
git pull
```

### Alterações pequenas

Alterações simples podem ser feitas diretamente na `main`:

```bash
git checkout main
git pull

git add .
git commit -m "Descrição da alteração"
git push
```

### Padrão de branches

- `feature/...` — nova funcionalidade
- `fix/...` — correção
- `refactor/...` — refatoração
- `chore/...` — configuração ou infraestrutura