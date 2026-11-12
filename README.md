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

`backend/Esf.Api.Tests` (xUnit; banco em memória na máquina, PostgreSQL no CI) verifica a **separação entre núcleos**: com dois
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
a pessoa fez), cada opção gera o PDF e o certificado por projeto exige que a pessoa participe dele. E a fila em segundo
plano: o relatório sai pronto para quem pediu e mais ninguém (nem do mesmo núcleo) vê ou baixa, a tarefa roda no núcleo
de quem pediu (a exportação entra no histórico em nome dela; a importação cria no núcleo dela e apaga o arquivo enviado), o aviso vai para o sininho só se a pessoa saiu da tela, a tarefa interrompida volta para a fila uma vez
e depois falha, as antigas são apagadas com os arquivos e o histórico de alterações fica em nome de quem pediu. E as fotos: miniatura com o maior lado em 640 px e versão do
PDF em 4:3 geradas em segundo plano, imagem que não pode ser lida fica com a original, o relatório usa a versão
pronta e apagar a foto apaga as versões (este, só no PostgreSQL).
Rode antes de mexer em consultas ou no `EsfDbContext`:

```bash
cd backend
dotnet test
```

Sem configuração, os testes usam o banco em memória, que não roda migrações nem as funções do PostgreSQL (busca sem
acento, `ILIKE`) e não confere chave estrangeira, campo único nem tamanho. Com a variável `ESF_TEST_POSTGRES` (conexão
com um servidor PostgreSQL, sem o nome do banco), os mesmos testes rodam no PostgreSQL: um banco modelo é criado uma
vez com todas as migrações e cada teste recebe uma cópia dele (`Esf.Api.Tests/TestDatabase.cs`). Os testes marcados
com `[PostgresFact]` (migrações do zero, busca sem acento) só rodam assim. O `LastMigrationMatchesTheModel` roda
sempre e falha quando uma entidade muda sem `dotnet ef migrations add`. No PostgreSQL, uma consulta que traz duas
coleções ou mais num SQL só (`Include` de tarefas e de arquivos, por exemplo) reprova o teste: o banco devolveria uma
linha para cada combinação. Use `AsSplitQuery()` nela.

```bash
ESF_TEST_POSTGRES="Host=localhost;Port=5432;Username=esf;Password=esf" dotnet test
```

**Contrato da API para o frontend** — os tipos do que a API devolve não são escritos à mão no frontend: saem do
documento OpenAPI (o mesmo do `/swagger`), guardado em `frontend/openapi.json`, que `npm run types` transforma em
`frontend/src/types/openapi.ts` (script sem dependências, `frontend/scripts/openapi-types.mjs`). O teste
`OpenApiContractTests` monta o documento com as definições do `Program.cs` (sem banco) e falha se ele mudou sem o
arquivo. Depois de mudar um DTO, uma rota ou um enum:

```bash
cd backend && ESF_UPDATE_OPENAPI=1 dotnet test --filter OpenApiContractTests
cd frontend && npm run types
```

### CI (GitHub Actions)

A cada push, em qualquer branch (commits que mexem só em `.md` não disparam), o GitHub roda
`.github/workflows/ci.yml`, e o commit ganha um check verde ou vermelho. Os detalhes ficam na aba **Actions** e cada
falha vira anotação no commit. Para rodar à mão: **Actions › CI › Run workflow**.

- **Backend:** compila; roda os testes no banco em memória; roda de novo num PostgreSQL 16 de verdade (serviço do
  próprio GitHub, descartado no fim); sobe a API como no deploy (`Production`, banco vazio: migrações e demonstração
  aplicadas ao iniciar) e roda `.github/scripts/smoke-api.sh`. O script entra com as contas de demonstração
  (administrador, perfil Usuário, gestão nacional, outro núcleo) e chama as rotas principais de cada tela. Faz também
  algumas gravações (tarefa, horas, registro, página pública), gera os PDFs e a planilha e confere as recusas por perfil
  e por núcleo. Se algo falha, o log da API aparece no fim.
- **Frontend:** `npm ci`, tipos gerados do contrato em dia (`npm run types` não pode mudar `src/types/openapi.ts`),
  typecheck e build.

Tudo roda nos servidores do GitHub (sem custo, o repositório é público), sem segredo e sem tocar no Render. As
migrações são testadas a partir de um banco vazio. Conversão de dados antigos de produção (migração que preenche ou
move dados existentes) só se testa com uma cópia do banco de produção, que não pode ir para o repositório.

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
com funções, tarefas com checklist, registros de andamento e indicadores com os mesmos nomes do modelo do programa,
para a página do programa somar os resultados. O programa de banheiros tem como parceiras as gestoras locais (ACONVI
/ Banco Comunitário Justa Troca e CPCA) e o de hortas, a associação de moradores, sem contato preenchido. Há
comentários com menção em duas tarefas e autorização de imagem
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
resto em Tarefas): a caixinha conclui na hora (fica riscada no lugar, com **Desfazer**, como em toda lista de
tarefas) e clicar abre a tarefa ali mesmo. Ao lado, **Meus projetos** (os em
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

**Projetos** — listagem com busca, filtros (status, **Meus | Todos** — "Meus" são os que a pessoa coordena ou de cuja equipe faz parte, como
no Início, `?meus=1`, só para quem tem voluntário vinculado —, só atrasados, incluir arquivados; o programa é a aba
escolhida)
e ordenação. No celular, busca, filtros e ordenação ficam recolhidos no botão "Filtros", que mostra quantos estão
ligados ("Filtros (2)"); o Lista|Mapa continua à mostra. Cada linha mostra programa, status, responsável, progresso e **último registro**; editar, arquivar/reativar
e excluir ficam no menu **⋯** da linha. Vindo do Início, `?parados=1` mostra só os projetos em andamento sem registro há
mais de 30 dias. Busca, filtros, ordenação e visão ficam na URL, então voltar de um projeto (ou recarregar) mantém a
lista como estava. O **progresso** é calculado pelas tarefas concluídas (projeto concluído conta como 100%); projeto em aberto sem
nenhuma tarefa mostra "sem tarefas" no lugar da barra em 0% (na lista, em Meus projetos, na faixa do projeto e na
página pública, que não mostra barra), porque 0% diria "nada feito" sobre um projeto que só não tem tarefas, como os
que entram pela planilha. O **novo
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
embaixo do nome, quantos projetos estão ativos (em planejamento, em andamento ou pausados, sem os arquivados) e
concluídos (com os arquivados); os cartões são só dos **resultados somados** — os indicadores nacionais e os padrão do modelo, pela regra de **Resultados somados** (abaixo
de Indicadores): "—" com "não informado" quando nenhum projeto informou, e "informado em 3 de 5 projetos" quando falta
algum; com **meta do programa**, embaixo do número vem uma barra e "de 55 · 22%" —, e, embaixo dos números,
"Como os resultados são somados" (abre a regra ao toque) e o link **Relatório do programa** (qualquer perfil: abre Relatórios com os projetos
do programa já marcados, menos cancelados e arquivados, e a lista filtrada nele). Para a coordenação, o topo tem
só **Página pública**, **Editar programa** e o **⋯** (arquivar/reativar e excluir, só sem projetos). A lista
embaixo mostra só os projetos daquele programa, e "Novo projeto" já vem com ele escolhido. Os endereços antigos
(`/programas`, `/programas/{id}` e `/configuracoes?aba=programas`) levam para cá; no topo de cada projeto, o nome do
programa abre a visão dele.

**Editar programa** — o lugar de tudo o que é do programa (`/programas/{id}/editar`, aba na URL), com as abas, nesta
ordem (quem é o programa primeiro, o operacional por último): **Sobre**, **Parceiros** (`?aba=parceiros`) e
**Modelo de projeto** (`?aba=modelo`, abaixo).

**Sobre** é a **ficha do programa**, escrita uma vez e usada em dois lugares. **Identidade**: nome, ícone e cor.
**Apresentação**: **O que o programa faz** (até 1.500 caracteres), **Objetivo** (até 1.000) e **Para quem** (até
300), cada um com uma dica curta e um exemplo dentro do campo. A ficha aparece na **página pública** ("O que fazemos",
Objetivo e Para quem) e, em **cada projeto novo**, a descrição e o objetivo em branco já vêm com o que o programa faz e
o objetivo dele — sempre, com ou sem o modelo marcado; dá para ajustar no projeto. O "Para quem" é do programa e não
vai para o "Quem se beneficia" do projeto, que é de cada um ("1 família, 5 pessoas"). A aba abre **para leitura**
(painel "Ficha do programa", com "Ainda não escrito." no que está em branco); **Editar** (coordenação) abre a janela
**Editar ficha do programa** (Identidade e Apresentação, com `guardChanges`), e **Salvar** grava tudo de uma vez, fecha
a janela, avisa "Ficha do programa salva." e a ficha já mostra o que ficou gravado. (Antes havia o
"Sobre o programa", só da página pública, e os "textos sugeridos" do modelo, que repetiam a mesma coisa; a migração
`ProgramSheet` juntou os dois: o texto da página pública, quando havia, virou o "o que faz", e os sugeridos viraram a
ficha.)

**Parceiros** são do programa (projetos não têm parceiros próprios): nome da
organização, **papel** (texto livre, com sugestões: Financiador, Apoiador, Parceiro técnico, Poder público, Gestora
local, Doador de material), pessoa de contato, e-mail, telefone (que liga ao toque, com o atalho do WhatsApp) e
observações. A coordenação inclui, edita, reordena (a ordem é a da página pública e do PDF) e remove; cada mudança
grava na hora. **O nome e o papel** aparecem na visão do programa ("Parceiros: …", só os nomes), na página pública e
no PDF; **contato e observações** ficam só dentro do núcleo (a gestão nacional não vê; no histórico de alterações
entram mascarados, como os dados de voluntário).

**+ Novo programa** abre uma janela curta (nome, ícone e cor) e, ao criar, já leva para a aba Modelo de
projeto do programa novo; o "Novo" ao lado do Programa no formulário de projeto continua criando por cima do
formulário. Quem não é da coordenação não tem o botão (pelo endereço, vê só a ficha, os parceiros e o modelo, sem
editar).

**Ícone e cor do programa** — no programa novo, o ícone sai do nome enquanto se digita: vale a primeira palavra
conhecida (banheiro, horta, cisterna, passarela, oficina, reforma, diagnóstico…; "Cisterna da Escola" é água, não
educação) e a cor vem junto, por assunto (água azul, natureza verde, obra laranja, energia amarela, educação roxa,
pessoas rosa). **Trocar** abre a grade com os 20 ícones e as cores; depois de escolher à mão, o nome não mexe mais. Os
ícones são desenhos de traço da biblioteca Lucide (licença ISC, em `frontend/src/components/programs/LUCIDE-LICENSE`),
iguais em qualquer aparelho (os emojis de antes mudavam de cara em cada sistema); as chaves antigas continuam valendo.

**Modelo de projeto** — em Projetos › programa › Editar programa › "Modelo de projeto" (`/programas/{id}/editar?aba=modelo`;
o endereço antigo `/programas/{id}/modelo` leva para lá): **tarefas padrão** (título, "Urgente", descrição e
prazo opcional em dias após o início do projeto; sem prazo por padrão) e **indicadores padrão** (nome, unidade e
**meta do programa** opcional: quanto todos os projetos juntos pretendem alcançar, ex.: 55 banheiros; a lista mostra
"un. · meta do programa: 55"; `ProgramTemplateIndicators.Target`). Os projetos não têm meta própria: cada um só soma o
seu valor. Um nacional ganha meta quando está na lista do modelo. Os
textos do projeto novo não ficam aqui: vêm da ficha do programa (aba Sobre). A coordenação inclui, edita, reordena e
remove; cada mudança grava na hora e não altera projetos que já existem. Ao criar um projeto de um programa com
modelo, o formulário mostra "Usar o modelo do programa" (já marcado, com o resumo do que será criado, "Cria 5 tarefas e
2 indicadores."): as tarefas entram sem responsável, com o prazo contado da data de início, e os indicadores entram em
branco (não informado; os nacionais, que o projeto já recebe, não se repetem).

**Menu** — Início · Projetos · Tarefas · Voluntários · Relatórios · Configurações. Configurações aparece só para a
coordenação; o voluntário comum chega na própria conta pelo menu do avatar (e a lista de acessos, com e-mails, deixou
de ser visível para ele).

**No celular** — uma barra fixa embaixo com **Início · Projetos · Tarefas · + Registrar** (o menu lateral continua no
botão do topo, para Voluntários, Relatórios e Configurações). **Registrar** pergunta o projeto (os da pessoa primeiro,
com busca) e abre o projeto já no registro de andamento, com o cursor no campo; o botão "Registrar" de Meus projetos,
no Início, faz o mesmo (`/projetos/{id}?registrar=1`). Os avisos de confirmação aparecem acima da barra. As listas em
tabela (Projetos, Voluntários, Relatórios, Acessos e as da área Nacional) viram cartões, um por
linha, sem rolar para o lado. Os campos têm letra de 16px e 44px de altura (no iPhone, letra menor faz a tela ampliar
sozinha a cada toque num campo). Dá para pôr a plataforma na tela de início do celular ("Adicionar à Tela de Início"
no Safari, "Instalar app" no Chrome): vira o ícone **CtrlESF** (o globo do logo da ESF) e abre em tela cheia
(`frontend/public/manifest.json` e `frontend/public/icons/`; a Ajuda explica o passo a passo). O mesmo globo, sem o
fundo branco (`icons/globe.png`), aparece num quadrado branco ao lado do nome no menu lateral, no login, no primeiro
acesso e na página pública sem logo do núcleo, e grande no painel verde do login.

**Sem internet (consulta)** — o que foi aberto com internet fica guardado no aparelho e continua abrindo sem conexão,
com a faixa "Sem internet" no topo; os projetos de "Meus projetos" ficam guardados sozinhos quando o Início abre, mesmo
os que a pessoa não abriu (o projeto, os 20 registros mais recentes e os arquivos). Tela nunca aberta mostra "Sem internet, e esta informação ainda não foi aberta neste
aparelho com internet". Salvar (registro, tarefa, horas) ainda precisa de internet: sem ela, o aviso de erro diz "Sem
internet. Conecte-se e tente de novo.". Tela que não carrega (sem internet e sem cópia guardada, ou o servidor fora
do ar) mostra o erro com **Tentar de novo** no lugar do conteúdo, e nunca uma lista vazia que parece "nada aqui"
("Nenhuma tarefa em aberto"): Tarefas, Projetos, Voluntários, Relatórios, o painel nacional, a página de um projeto ou
de um voluntário, o checklist, os anexos e os comentários da janela da tarefa (antes ficavam em "Carregando…" para
sempre) e a busca geral (componente `LoadError`, em `components/ui/Feedback.tsx`). No painel nacional, trocar o período
mostra "Atualizando os números…" enquanto os novos não chegam. Ao sair (ou entrar com outra pessoa), os dados guardados são apagados. Como
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
abaixo). **Concluir tarefa é igual em toda lista** (Tarefas, Início e aba Tarefas do projeto): a tarefa fica riscada no
mesmo lugar, com **Desfazer** ao lado, até a tela ser aberta de novo (mesmo que um filtro, como "atrasadas", já não a
pegasse); desmarcar ou Desfazer volta exatamente ao status de antes (em andamento continua em andamento; bloqueada
volta com o motivo). A caixinha tem área de toque de 44px, afastada do título (`.check-hit`, `useJustDone` em
`components/tasks/taskUtils.ts`). Embaixo do título, "7 em aberto · 2 atrasadas" (tocar nas atrasadas filtra só elas). Uma linha só de
controles: **Minhas | Todas** (o voluntário começa nas dele; a coordenação, em todas), a busca, o botão **Filtros** e,
no canto, **Lista | Quadro** (como o Lista | Mapa de Projetos; no celular, só os ícones). Filtros abre os campos com rótulo — **Situação** (atrasadas, bloqueadas ou
concluídas nos últimos 30 dias, com contagem), programa, projeto e responsável (com "Sem responsável") — num painel
preso ao botão; no celular, numa folha que sobe de baixo, com a busca e o botão "Ver N tarefas". No celular, onde as colunas de
responsável e status não cabem, cada linha mostra embaixo do título o primeiro nome do responsável (ou "Sem
responsável", em destaque) e o status quando é Em andamento ou Bloqueada. Os filtros ligados
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
com barra de progresso; incluir com Enter; o lápis corrige o texto do item; o × remove, e no lugar
fica "Item removido · Desfazer" por alguns segundos antes de a remoção ir para a API, ou ao fechar a janela; no
celular, os botões do item têm 36px e os campos, letra de 16px), **anexos** (vários arquivos de uma vez; imagens em miniatura)
e comentários. **Editar** troca para o formulário (Cancelar volta para a leitura; **Salvar
alterações** também volta para a leitura, já atualizada, em vez de fechar a janela). **Criar tarefa** abre a tarefa
nova para ler, para já montar o checklist, anexar e comentar (antes fechava a janela e era preciso achar a tarefa).
No rodapé da leitura, **Excluir** (com confirmação; os anexos ficam na aba Arquivos). Tarefa sem responsável mostra
**Assumir** ao lado de "Sem responsável": um toque e ela passa para quem está logado (que entra na equipe, se ainda
não estava). Endereços na descrição e nos comentários (`https://…`, `www.…`) viram links que abrem em outra aba
(`components/ui/Linkify.tsx`). Quem fechou a janela depois de criar, salvar, assumir ou excluir vê a lista
recarregada; o aviso de confirmação sai da própria janela; "Editar" no menu ⋯ da aba do projeto
abre direto no formulário. Status, checklist, anexos e comentários gravam na hora, sem depender do "Salvar". Os anexos
também aparecem na aba Arquivos do projeto, com o selo "da tarefa …"; excluir a tarefa mantém o arquivo no projeto. O
card do quadro e as listas mostram o resumo (`☑ 3/5 · 📎 1 · 💬 2`), verde quando o checklist está completo. Links
antigos (`?aba=atividades&atividade=…`) continuam abrindo a tarefa.

**Comentários nas tarefas** — na mesma janela, abaixo do checklist e dos anexos: a conversa do dia a dia sobre a
tarefa (não vai para o relatório, ao contrário dos registros de andamento). Digitar **@** abre a lista de pessoas com
acesso (a equipe do projeto primeiro, sem diferenciar acentos) e escolher insere o nome; Ctrl+Enter envia. O comentário que está sendo escrito vira **rascunho** no aparelho, como o registro de andamento:
fechar a janela sem querer (Esc, toque fora), recarregar ou perder a sessão não apaga, e ao abrir a tarefa de novo o
texto volta (com as menções) e o aviso "Comentário não enviado, guardado neste aparelho" com **Descartar**. Enviar
apaga o rascunho; "Sair" apaga todos (`utils/drafts.ts`). Quem
escreveu edita (aparece "(editado)") e apaga o próprio comentário; a coordenação também apaga os dos outros. Avisos no
sininho: quem foi mencionado ("Ana mencionou você em…") e, num comentário novo, o responsável pela tarefa ("Ana
comentou em…"); na edição, só quem foi mencionado agora. Aviso de comentário ou menção abre a tarefa já rolada até os comentários (`&comentarios=1`), e a
lista de comentários abre no mais recente (no celular, sem rolagem própria dentro da janela). Link de uma tarefa que
já foi excluída avisa "Essa tarefa não existe mais" em vez de não fazer nada. Todo aviso de tarefa (atribuição, bloqueio, prazo,
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
nome e valor com a unidade, e "atualizado há 3 dias" quando o valor tem
data (`Indicators.ValueUpdatedAt`, gravado só quando o número muda, inclusive na importação; os de antes desse campo
ficam sem data; migração `AddIndicatorValueUpdatedAt`); tocar num deles abre a janela para atualizar o valor ali mesmo — nome, unidade e exclusão
ficam na aba Sobre; sem indicadores, a coordenação vê o convite, que abre o cadastro do primeiro, e os demais não veem a
linha) e cinco abas: **Andamento** (a inicial), **Tarefas**, **Equipe**, **Arquivos** e **Sobre** (descrição, objetivo,
período, comunidade ou família atendida, quem se beneficia, local e indicadores; programa e responsável já estão no
topo). A aba aberta fica na URL (`?aba=tarefas`, `?aba=equipe`…),
então links diretos e recarregar a página caem no lugar certo. No celular, quando as abas não cabem, aparece uma seta
com degradê na borda onde há mais abas (tocar nela rola a barra), e a aba aberta é trazida para a parte visível. **Gerar relatório** abre as mesmas opções da tela Relatórios
(componente `components/reports/ReportOptions.tsx`: período, tarefas concluídas, fotos e observação), já com o projeto
escolhido e sempre no formato Completo.

**Concluir ou cancelar o projeto** — escolher Concluído ou Cancelado no badge do topo abre uma confirmação: avisa
quantas tarefas ainda estão em aberto (com atrasadas e bloqueadas, e o botão "Ver tarefas"), pede o **dia em que
terminou** ("Concluído em" / "Cancelado em", hoje por padrão; não pode ser depois de hoje, e a conclusão não pode ser
antes do início) e, sem obrigar, um **registro de encerramento** (ou o motivo do cancelamento), que é publicado no
Andamento como um registro comum e por isso entra no relatório. Ao concluir, a janela mostra também os **resultados do
projeto**: cada indicador com o valor atual num campo, para conferir os números finais (é quando se sabe o resultado;
diz quantos ainda estão "não informado", e em branco continua não informado). Os números são gravados antes do status:
se um falhar, nada muda. O dia fica guardado no projeto (`Projects.ClosedOn`): o topo passa a dizer "Concluído em
12/09/2026", Sobre mostra o período até esse dia, o PDF imprime "Período do projeto" até ele (em aberto, até a previsão,
com "(previsão)"), a página pública mostra "De mar/2026 a mai/2026", o certificado por projeto termina nele e a planilha
o exporta em "Término (ou previsão)" (e, na importação, essa coluna vira o dia do encerramento dos concluídos e
cancelados). Voltar a um status aberto apaga o dia; em **Editar projeto**, um projeto encerrado ganha o campo para
corrigir o dia. Projetos encerrados antes de o campo existir ficam sem ele (aparece a previsão, como antes) até alguém
preencher em Editar projeto. Os outros status mudam direto. Quando todas as tarefas estão concluídas e o projeto ainda está em
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
escolhido ("2 tarefas em aberto, 1 atrasada."). O filtro de responsável fica na URL
(`?aba=tarefas&responsavel={voluntário}`; `responsavel=sem` para as sem responsável), junto com o "Só atrasadas"
(`filtro=atrasadas`).

**Visitas** — tarefa do tipo **Visita** (à obra, à família): no formulário da tarefa, o campo **Tipo** alterna entre
Tarefa e Visita, e a aba Tarefas do projeto tem também o botão **Nova visita**. A visita pede o **dia** (é o prazo da
tarefa), o **turno** (manhã, tarde ou noite), a **hora** combinada (opcional) e **sempre duas pessoas**: o
responsável e o **acompanhante** (diferentes; a API recusa sem um deles). Os dois entram na equipe do projeto, recebem
o aviso "marcou você para a visita X (qui, 20/11 à tarde)", os de mudança de status e de comentário e, na véspera e
no dia, o lembrete "Visita X amanhã/hoje à tarde". A visita conta para os dois em Minhas tarefas, no filtro de
responsável, na carga mostrada ao escolher o responsável, em "Quem está sem tarefa" e na saída do núcleo (liberar as
tarefas tira a pessoa da visita, como responsável ou acompanhante). Nas listas e no quadro, a visita tem o selo
**Visita**, as duas fotos sobrepostas com "Ana e Bruno" e, no lugar do prazo, o dia e o turno ("qui 20/11 · tarde");
na janela, **Quando** ("quinta, 20/11/2026 à tarde, 14:30") e **Quem vai**. Voltar para Tarefa apaga turno, hora e
acompanhante. No PDF, as tarefas concluídas da visita mostram as duas pessoas.

**Equipe** — uma linha por pessoa, o responsável pelo projeto primeiro: foto, nome (leva à página do voluntário, onde
fica o contato) com o setor ao lado, em cinza, e embaixo a função no projeto ("Responsável · projeto elétrico"); à
direita, as tarefas em aberto no projeto ("3 tarefas · 1 atrasada", só o "atrasada" em vermelho; tocar abre a aba
Tarefas filtrada pela pessoa) e as horas lançadas. O "⋯" de cada linha tem **Definir função**/**Mudar função** (o campo
abre na própria linha: Enter ou sair do campo salva; Esc desiste; `PUT /api/projects/{id}/volunteers/{voluntario}`,
sem desvincular e vincular de novo, o que perdia a data de entrada) e **Desvincular** (o responsável pelo projeto só
depois de trocado em Editar projeto). No celular, tarefas e horas descem para uma linha só, embaixo da função, e o que
está vazio some. **Vincular voluntário** abre uma lista dos voluntários ativos que ainda não estão na equipe, com
foto, nome e, embaixo, o setor e as tarefas em aberto em todos os projetos (para ver quem está livre); a partir de 7
pessoas aparece a busca pelo nome ou pelo setor, sem diferenciar acentos. Abaixo da equipe, o painel de horas (ver
Horas por projeto).

**Andamento** — a tela inicial de cada projeto. No topo, o campo "Registrar andamento" para publicar um registro com
formatação básica (negrito, itálico, sublinhado, listas e links) e uma ou mais fotos anexadas; o HTML é limpo no
servidor, só essas formatações são aceitas, e elas também aparecem no relatório PDF. Abaixo,
o feed com data e autor, do mais recente para o mais antigo, 20 registros por vez: no fim, **Ver registros
anteriores (N)** traz os próximos (`GET /api/projects/{id}/updates?skip=&take=`). A página do projeto não traz os
registros nem os arquivos, só quantos são (o número das abas): cada aba busca os seus ao abrir, e de novo depois de
cada mudança, mantendo abertos os registros que já estavam na tela. **Quando aconteceu**: abaixo do texto, o dia do que o
registro conta (hoje por padrão, com os atalhos "ontem" e "hoje"; não pode ser depois de hoje, e também se muda ao
editar). O mutirão de sábado registrado na segunda fica no sábado: o feed e a linha do tempo do PDF seguem esse dia, o
período do relatório filtra por ele, e as horas do registro ("Suas horas nesse dia") são lançadas nele. Quando o dia é
outro, o registro mostra os dois ("07/11 · registrado em 09/11, 14:32"). Os registros de antes do campo
(`ProjectUpdates.HappenedOn`, migração `AddProjectUpdateHappenedOn`) usam o dia em que foram publicados. O que mede uso
da plataforma (último registro, projetos parados, registros no painel nacional) continua pela data de publicação.
Editável depois
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
vinculado. A busca olha nome, e-mail e competências, sem diferenciar maiúsculas nem acentos ("joao" acha "João",
"autocad" acha quem sabe AutoCAD; função `esf_fold`, como a busca geral). Filtros: **situação** (por padrão, ativos e
afastados, isto é, quem faz parte do núcleo hoje; também só ativos, só afastados, inativos, ex-membros e "Todos", o único
que mostra os anonimizados), **setor** e, para a coordenação, **acesso à plataforma** (sem acesso, aguardando o primeiro
acesso, com acesso, acesso desativado: depois de importar uma planilha, mostra a quem falta dar acesso). Busca e filtros
ficam na URL (`?busca=`, `?situacao=`, `?setor=`, `?acesso=`, `?termo=pendente`), então voltar da página de uma pessoa
mantém a lista como estava. Sem resultado, a lista diz "Nenhum voluntário com esses filtros" com **Limpar filtros**
("Nenhum voluntário cadastrado" só quando o núcleo não tem ninguém). O aviso dos termos pendentes separa por que cada um
ainda não assinou ("2 sem o termo: 1 sem acesso à plataforma, 1 aguardando o primeiro acesso"), sem repetir nada por
linha. No celular, busca e filtros ficam no botão "Filtros", como em Tarefas e Projetos. **Contato em um toque**: na lista, a coluna Contato tem ícones de e-mail (abre o programa de
e-mail) e WhatsApp (só quando o telefone é celular do Brasil: DDD + 9 + 8 dígitos; sem o 55, ele é incluído);
na página do voluntário, o e-mail e o telefone por extenso viram links (o telefone liga ao toque), com "WhatsApp" ao
lado do celular (a aba Equipe do projeto não mostra contato: o nome leva à página da pessoa). A lista não tem coluna de ações: editar e anonimizar ficam na página da
pessoa. A **página do voluntário** traz primeiro o contato e o perfil (e-mail, telefone, aniversário, competências) e
os projetos atuais e anteriores; ao lado (embaixo, no celular), a parte administrativa: acesso, horas e termo. A função de quem já está na equipe muda no "⋯" da
pessoa na aba Equipe do projeto (ver Equipe, acima). O vínculo com projetos (e a função exercida em cada um) pode ser feito
tanto pela aba de voluntários de cada projeto quanto diretamente ao editar o voluntário, sempre entre projeto e
voluntário já cadastrados. O cadastro guarda o aniversário (só dia e mês): no dia, a pessoa ganha o selo "Aniversário
hoje" na lista (a linha fica rosa-clara) e no detalhe; o Início lista os aniversariantes. A foto (opcional) é o primeiro
item do formulário: escolhida do computador e enquadrada num círculo (arrastar e zoom) antes de ser usada; o navegador
envia só o recorte, um quadrado de 400x400, gravado ao salvar o voluntário (com o enquadramento aberto, o Salvar fica
desligado até "Usar foto" ou cancelar, para a foto não se perder). O formulário explica cada campo que tem
consequência: o nome é o do documento (vai no termo e no certificado, e a assinatura do termo exige o nome igual), o
e-mail é o login de quem tiver acesso e o telefone vai com DDD (celular com o 9 ganha o atalho do WhatsApp). No
**cadastro novo** há também **No núcleo desde** (hoje por padrão; não pode ser depois de hoje): o histórico de situação,
e com ele as horas de voluntariado, começa nesse dia, para quem já estava no núcleo não começar com as horas zeradas.
Ao salvar um voluntário novo, a tela abre a página dele, onde estão os próximos passos (Dar acesso, vincular a
projetos). A foto aparece como uma bolinha na
lista de voluntários, no detalhe, na aba Equipe dos projetos e no canto superior direito (para o voluntário vinculado
à conta logada); sem foto, aparecem as iniciais. Quando o acesso está vinculado a um voluntário, a plataforma mostra o
nome e a foto desse voluntário no topo, na barra lateral, no "Olá" do Início, como autor dos registros de andamento
e em "Enviado por" dos arquivos; sem vínculo, usa o nome do próprio usuário.

**Disponibilidade para visitas** — cada voluntário pode informar o **bairro e a cidade** onde mora (nunca o
endereço), **como se desloca** (carro ou transporte público) e a **grade da semana** com os turnos em que costuma estar
livre (segunda a domingo × manhã, tarde e noite; toque em cada casa para marcar). Quem preenche é a própria pessoa
(Minha conta e o próprio perfil) ou a coordenação (painel **Disponibilidade para visitas** na página do voluntário).
Só a coordenação e a própria pessoa veem e mudam esses dados: a lista de voluntários não os traz e, para os demais
perfis, a página do voluntário não mostra o painel (`VolunteerDto.availability` vem vazio). Ao salvar, o navegador
procura o bairro no OpenStreetMap (só o texto "bairro, cidade", sem o nome de ninguém) e manda o centro aproximado
dele, usado para a distância até a obra nas sugestões de visita; sem mudar bairro nem cidade, a busca não se repete e o
ponto de antes fica. Bairro não achado: salva assim mesmo e avisa para conferir o nome. No Início, quem nunca preencheu
(ou preencheu há mais de seis meses, quando o horário de aula costuma mudar) vê o convite **Quando você costuma estar
livre?** (ou **Seus turnos livres ainda valem?**), que abre a mesma janela. Anonimizar apaga bairro, ponto,
deslocamento e turnos. No histórico de alterações, esses campos entram como dado pessoal (registra que mudou, sem o
valor). A grade fica guardada num número só (`Volunteers.AvailabilityMask`, um bit por dia e turno; ver
`Services/VolunteerAvailability.cs`).

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

**Saída do núcleo** — ao editar um voluntário e mudar a situação para **Inativo** ou **Ex-membro**, o formulário mostra
"Saindo do núcleo" com duas caixinhas, já marcadas: **Desativar o acesso à plataforma** (a pessoa deixa de entrar e de
ver os contatos de todos; reativa em Configurações › Acessos) e **Deixar sem responsável as N tarefas em aberto dela**
(as dos projetos em planejamento ou em andamento, não arquivados: o mesmo recorte da carga no Início; ficam em Tarefas ›
Responsável: Sem responsável, para reatribuir). Tudo grava junto com a situação. Ninguém desativa o próprio acesso, e o
de um administrador só outro administrador desativa (para o coordenador, a janela explica no lugar da caixinha).
Afastado não pergunta nada: é temporário. Para apagar os dados pessoais, continua o Anonimizar.

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
projeto" — sugerido pelo objetivo — e "Atuação" — sugerida pela função na equipe e pelo que a pessoa lançou que fez;
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
status atual desde a data do cadastro; o cadastro novo começa no dia de **No núcleo desde**. Todos veem o total; o histórico só aparece para a coordenação e para o próprio
voluntário, e só a coordenação edita. O certificado já abre com o período do primeiro ao último período como Ativo.

**Horas por projeto** — além das horas gerais (que saem do histórico de status), cada projeto tem as horas lançadas
por quem trabalhou nele: dia, horas (de 0,25 a 24) e, se quiser, o que fez. Quem está na equipe lança as próprias, na aba
Equipe ou junto com o registro de andamento ("Suas horas hoje", opcional: o texto do registro vira o "o que fez");
administrador e coordenador lançam, corrigem e apagam as de qualquer um da equipe. A aba Equipe mostra o total do projeto,
as horas de cada pessoa e os lançamentos. O relatório em PDF ganha a coluna Horas na equipe de cada projeto (no período de
referência, quando há) e o total no bloco Resultados; o certificado por projeto usa essas horas. As duas contas ficam
separadas, para a mesma hora não contar duas vezes.

**Indicadores** — número simples de resultado por projeto (nome, valor e unidade, sem meta nem barra de progresso: a
meta é do programa, no modelo de projeto, e aparece nos resultados somados).
Todo projeto tem os **indicadores nacionais** ativos (vêm primeiro, com a etiqueta "nacional"); os demais são
específicos do projeto (**Novo indicador**, na aba Sobre). O valor pode ficar **em branco**: "não informado", que é
diferente de zero — não entra nas somas e não aparece no PDF. O nacional não sai do projeto nem vira específico; só o
valor muda (a janela mostra o "como contar" da gestão nacional).

**Resultados somados** — a visão do programa, o bloco Resultados do PDF de vários projetos, a página pública e o painel
nacional somam do mesmo jeito (`Services/ResultTotals.cs`), para o mesmo programa nunca mostrar números diferentes:
os indicadores nacionais somam pelo vínculo e os padrão do modelo do programa pelo nome (sem diferenciar maiúsculas nem
acentos); só somam os valores informados (em branco não vira zero; se nenhum projeto informou, o resultado fica sem
valor: "—" na tela, fora do PDF e da página pública); e cada resultado sabe em quantos projetos foi informado
("informado em 3 de 5 projetos", na tela e no PDF). Entram todos os projetos menos os cancelados, inclusive os
arquivados: arquivar só tira o projeto da lista, o que ele entregou continua sendo resultado. No PDF, entram os projetos
escolhidos.

**Arquivos** — um lugar só para todos os arquivos do projeto, em dois grupos: **Documentos** primeiro (plantas,
orçamentos, listas de presença: são poucos e é o que mais se procura) e **Fotos** depois, com o filtro **Tudo |
Documentos | Fotos** (cada um com a quantidade) acima, para a planta não sumir no meio de 200 fotos de obra. As fotos
aparecem 48 por vez (**Mostrar mais fotos (N)** abre as próximas), para não pesar no celular. Todos os arquivos, inclusive as fotos publicadas no Andamento (marcadas com
a data do registro). Envio de um ou vários arquivos por seleção ou arrastar e soltar, legenda editável em qualquer
arquivo (é ela que aparece embaixo da foto no relatório), visualizador de fotos em tela cheia, download e exclusão.
Os arquivos ficam guardados no próprio banco (tabela `StoredFiles`), então não se perdem quando o servidor é recriado
a cada deploy. Fotos grandes são reduzidas no navegador antes do envio (JPEG com o maior lado em 2048 px). Logo
depois do envio, cada foto (JPEG, PNG ou WebP) ganha em segundo plano uma **miniatura** (a foto inteira com o maior
lado em 640 px), usada nas listas, na galeria e no Andamento, e a **versão do PDF** (4:3, até 1200 px), que o
relatório usa sem precisar reduzir centenas de fotos na hora. O visualizador em tela cheia e o download continuam
com a original. Enquanto a miniatura não fica pronta (alguns segundos), ou se a imagem não puder ser lida, aparece a
original. As versões ficam em `StoredFiles` com o nome da original mais `.t.jpg` e `.r.jpg` e são apagadas junto com
ela. As fotos enviadas antes disso entram na mesma fila depois do deploy (migração `AddFilePreviews`).

**Autorização de imagem dos beneficiários** — na aba Sobre de cada projeto, a coordenação gera o termo de autorização
de uso de imagem em PDF (com o nome e o local do projeto e espaço para os dados de quem autoriza e das crianças e
adolescentes de quem é responsável), colhe a assinatura de cada família e envia as cópias, que ficam privadas como os
termos de adesão. Enquanto não houver autorização registrada, a aba Arquivos de um projeto com fotos e a tela de
Relatórios (quando o registro fotográfico está marcado) mostram um aviso; o PDF do relatório não muda.

**Localização** — endereço, bairro, cidade, estado e, quando houver coordenadas, mapa embutido (OpenStreetMap, sem chave de API).

**Relatórios** — uma tela em três passos. **1 Recorte**: programa (a mesma lista com ícone de Projetos; "Todos os
programas" por padrão) e período de referência (o seletor de período, abaixo). **2 Formato**: **Resumo** ou **Completo** (no
Completo, as caixinhas de tarefas concluídas e registro fotográfico) e a observação livre. **3 Projetos**: ao abrir e
a cada troca de programa, vêm marcados os projetos do recorte, menos cancelados e arquivados; sem formato escolhido, o
sugerido é o Resumo quando há mais de 10 marcados e o Completo até 10. Cada projeto mostra o que tem no período
("3 registros · 4 fotos · 1 tarefa concluída", as fotos só quando entram no PDF, ou "Sem andamento no período", pela
rota `period-counts`). **Marcar todos** soma os que estão na lista aos já marcados (dá para buscar um, marcar, buscar
outro e marcar), **Limpar** desmarca tudo, **Só marcados** mostra os marcados e, quando há marcados sem andamento no
período, uma linha oferece **Desmarcar os N**. Busca, status e **Incluir arquivados e cancelados** ficam no botão
**Filtros** no celular. Autorização de imagem: com fotos no PDF, cada projeto marcado que tem foto no período e não
tem autorização registrada ganha a marca "Sem autorização de imagem", e um aviso só com a contagem leva a eles (**Ver
quais** ou o filtro **Sem autorização de imagem**); o PDF não muda. Embaixo da tela fica preso o resumo do que vai
sair ("12 projetos · Resumo · Trimestre") com o **Gerar PDF**. Programa, período, formato e filtros ficam na
URL (`?programa=`, `?periodo=` com o atalho — `30-dias`, `trimestre`, `semestre`, `ano` —, ou `?de=`/`?ate=` do
personalizado, sem `ate` quando é "sem data final", `?formato=resumo|completo`, `?busca=`, `?status=`, `?arquivados=1`):
como o período vai pelo nome do atalho, o mesmo link mostra os últimos 3 meses de quando for aberto. Links antigos
(`?periodo=trimestre-passado`, `mes-passado`, `este-ano`, `ano-passado`, `ultimos-3-meses`) abrem com as datas que
esses nomes davam; sem período na URL (ou o antigo `tudo`), vale o padrão. Os projetos marcados não vão para a URL. O
**Relatório do programa** (Projetos › programa) abre esta tela com `?programa=`. O PDF é montado **em segundo plano**:
o **Gerar PDF** põe o pedido na fila e a faixa de baixo mostra a situação ("Na fila (1 na frente)", "Gerando…"); quando
fica pronto, o download começa sozinho, mesmo que a pessoa tenha ido para outra tela da plataforma. Quem fechou a
plataforma recebe o aviso no sininho ("Seu relatório ficou pronto", que leva a esta tela). **Gerados recentemente**,
embaixo da lista, mostra os relatórios da própria pessoa dos últimos 7 dias, para baixar de novo; só quem pediu vê e
baixa (ver **Tarefas em segundo plano**, em Arquitetura). O PDF é **consolidado**, em dois
formatos (`format`): **Completo**, com um
capítulo por projeto, e **Resumo**, só a abertura (Resultados e Resumo dos projetos, mesmo com um projeto só), sem
capítulos, linha do tempo nem fotos, para quem quer os números de um programa inteiro. Os projetos saem sempre por
programa e depois por nome (sem diferenciar acento nem maiúscula), não na ordem em que foram marcados. A primeira
página abre com o logo do núcleo (quando há, num formato que o PDF desenha), o nome dele e quem emitiu, e o título pelo
recorte: **Relatório do projeto** (o nome dele), **do programa** (o nome do programa) ou **dos programas** (os nomes,
até três; mais, a contagem), com o período por extenso quando é um mês, trimestre ou ano fechado ("3º trimestre de
2026 · 01/07/2026 a 30/09/2026"; `Reports/ReportPeriod.cs`; sem período, "Situação em 10/11/2026"). As demais páginas
têm só uma linha com o núcleo, o título e o período. Relatório de um programa só abre com a ficha dele (**Sobre o
programa**: O que faz, Objetivo, Para quem, as mesmas da página pública). No Completo, cada projeto começa numa página
nova (dá para imprimir ou mandar só o dele), e a tabela **Resumo dos projetos** serve de sumário: o nome leva ao
capítulo e a última coluna diz a página. O PDF termina com **Quem somos** (razão social, missão, apresentação e
contatos do núcleo, de Configurações). O arquivo leva o recorte e o período
(`relatorio-banheiro-direito-da-gente-2026-t3.pdf`, `relatorio-projetos-20261110.pdf`), e o título vai também nas
propriedades do PDF. O capítulo de
cada projeto segue a ordem em que o parceiro lê a história: identificação (nome, programa e, embaixo, a linha
**Parceiros:** com os parceiros do programa — nome e papel, sem contato —, e o status), os dados em duas colunas
(responsável, período, comunidade atendida, quem se beneficia e localização, uma vez só; rótulo pequeno e cinza em
cima, valor escuro embaixo; campo vazio não sai), objetivo, descrição, indicadores, linha do tempo com as fotos,
tarefas concluídas, **Próximas etapas** (até 5 tarefas em aberto, pelo prazo, sem responsável; só em projeto que não
terminou), equipe (nome, função no projeto e horas; sem e-mail nem telefone, porque o relatório vai para fora) e
observações. Indicadores, linha do tempo e equipe sempre entram; tarefas (concluídas e próximas etapas) e fotos são
opcionais, marcados por padrão. O **período de
referência** (o seletor de período, abaixo; padrão: últimos 30 dias) aparece no topo de todas as páginas e filtra a linha do
tempo (registros e as fotos deles) e as tarefas concluídas; projeto sem registro no período mostra "Nenhum registro de
andamento no período". Os **indicadores** são acumulados (120 pessoas desde o início) e saem pelo **histórico dos
valores** (`IndicatorValueChanges`, gravado no `SaveChanges` do `EsfDbContext` sempre que o número muda — tela,
conclusão do projeto, planilha —, com a data do `ValueUpdatedAt`): com o período terminando antes de hoje (o trimestre
passado), o valor é o que valia no último dia dele; indo até hoje, ou sem período, o de hoje. O título diz "Indicadores ·
acumulados até 30/09/2026", e cada cartão diz quanto o número mudou no período ("+12 no período", comparando com a
véspera do início; o que ainda não estava informado conta como zero, sem nada quando não mudou) e desde quando vale
("atualizado em 05/09/2026"). A migração `AddIndicatorValueChanges` começa o histórico com o valor de hoje de cada
indicador, valendo desde o `ValueUpdatedAt` (ou a criação do indicador, sem ele): em períodos anteriores a isso, esses
indicadores saem como não informados. A equipe sai como está hoje. Projeto sem nenhum indicador informado mostra
"Nenhum indicador informado ainda" ("até 30/09/2026" num período que já terminou). As datas
seguem o horário de Brasília, o mesmo usado para imprimir as datas no PDF, e os números saem com ponto no milhar e
vírgula nos decimais ("1.234", "10,57"; `TextHelpers.Number`, fixo, porque a API roda sem dados de cultura). Com mais de um projeto (ou no Resumo), o PDF
abre com **Resultados**: quantos projetos (e quantos em cada status), voluntários nas equipes (sem repetir quem está em
mais de um), horas lançadas e tarefas concluídas e, para cada programa, a linha **Parceiros:** e os
indicadores nacionais e os padrão do modelo somados nos projetos do relatório, pela regra de **Resultados somados** (o
que nenhum projeto informou fica de fora; quando falta algum, o cartão diz "informado em 3 de 5 projetos"). Com período,
o que aconteceu nele fica separado do que é acumulado: primeiro os projetos ("situação em 10/11/2026: 2 em andamento ·
1 concluído") e a equipe; depois a faixa **No período** (projetos concluídos no período, pelo dia do encerramento,
tarefas concluídas e horas lançadas, quando há); depois **Indicadores acumulados até 30/09/2026**,
com os programas e, em cada cartão, a mudança no período (a mesma soma feita com os valores da véspera do início).
Depois vem o
**Resumo dos projetos**: uma linha por projeto (com a cidade embaixo; com mais de um programa, agrupadas sob uma
linha com o nome de cada programa), status, equipe, **última atualização** (o dia do último registro de andamento até
o fim do período: mostra que o projeto está vivo; a contagem de registros saiu do PDF porque mede a documentação da
equipe e não diz nada a quem é de fora) e uma coluna por indicador nacional, com o valor do fim do período ("–" é não
informado, diferente de zero). A letra é de 10 pt no texto e de no mínimo 8 pt nos detalhes, num cinza escuro, para a
leitura impressa. Nos cartões de indicador, a unidade some quando é genérica ("un.") ou quando o nome já diz ("3" e
"Famílias atendidas", não "3 famílias · Famílias atendidas"); "10,57 m² · Área construída" continua. **Realizado ×
previsto**: nos resultados de cada programa, o indicador com **meta do programa** ganha no cartão "22% da meta de 55"
(acima de 100% também). A comparação é sempre com o programa todo (sem os cancelados), com os valores do fim do período:
quando o relatório tem só parte dos projetos, o cartão diz "programa todo: 12 de 55 (22%)", para um relatório de 3
projetos não dizer que o programa está em 2% da meta. Os projetos não têm meta própria. Títulos
de seção não ficam sozinhos no pé da página, os cartões de indicadores não se dividem entre duas páginas e as
linhas das tabelas também não. Na linha do tempo, cada registro leva até 4 fotos (as primeiras enviadas), com tamanho
conforme a quantidade — uma foto larga (60% da linha), duas lado a lado, três numa linha, quatro em 2 × 2 —, todas no
mesmo formato: o `ReportImageProcessor` endireita pela orientação da câmera (EXIF), corta em 4:3 (foto em pé guarda a
parte de cima) e reduz para até 1200 px. Um registro só começa numa página se couberem nela a data, o texto e a
primeira fileira de fotos (antes, as fotos iam para a página seguinte e deixavam meia página em branco); com 4 fotos, a
segunda fileira pode ir para a página seguinte. O título "Linha do tempo" vai junto do primeiro registro, e num
relatório de um projeto só o nome dele não se repete no topo do capítulo (já é o título da primeira página).

**Seletor de período** (tela Relatórios, "Gerar relatório" do projeto e painel nacional; `components/ui/PeriodPicker.tsx`
e `utils/periods.ts`) — um botão com o calendário num quadradinho verde, o nome do período ("30 dias", "Trimestre"…,
"Personalizado") e as datas embaixo ("13/10/2026 – 12/11/2026"); embaixo do botão, uma linha só: "Entram os
registros, fotos, tarefas e horas desse período". Tocar abre os atalhos, contados para trás a partir de hoje: **30 dias** (o padrão), **Trimestre** (últimos 3 meses),
**Semestre** (últimos 6) e **Ano** (últimos 12), e por último **Personalizado**, que abre uma janela com a
data inicial e a final (digitadas ou escolhidas no calendário do próprio campo) e a caixinha **Sem data final**:
marcada, a data final fica cinza, travada em hoje. Data final antes da inicial não deixa aplicar. Não há mais "Tudo"
nem os períodos fechados (mês, trimestre e ano passados): para eles, Personalizado.

**Acesso por link** — o acesso nasce do cadastro do voluntário: na página dele, **Dar acesso** (ou, em
Configurações › Acessos, **Novo acesso**, escolhendo o voluntário) pede o perfil e usa como login
o e-mail do cadastro (sem e-mail, não dá). Quem dá acesso e gera link é a coordenação: o administrador, com qualquer
perfil; o coordenador, só com perfil Usuário ou Coordenador, e ele não gera link novo para o acesso de um administrador
(com o link, criaria a senha de quem tem mais permissão que ele; a API recusa as duas coisas e a tela nem oferece).
Editar perfil e situação e excluir um acesso continuam só com a administração. Sai um **link de primeiro acesso** (`/acesso/{código}`), mostrado uma vez,
com botões para copiar, mandar pelo WhatsApp (celular do cadastro, já com a mensagem) ou por e-mail. A pessoa abre,
cria a própria senha, aceita a política de privacidade e já entra; ninguém define nem repassa senha de outra pessoa.
O link vale 7 dias e uma vez só; só o hash do código fica no banco (tabela `AccessLinks`). Enquanto não for usado, o
acesso aparece como "Aguardando o primeiro acesso" com a validade do link ("o link vale até 12/11" ou "o link venceu
em 05/11: gere outro"), na página do voluntário e em Acessos, e o login com senha é recusado. Quem abre um link que
não vale mais (usado, vencido ou trocado) vê "Este link não vale mais", com **Entrar com e-mail e senha** como botão
principal (o caso mais comum é quem já criou a senha e tocou no link de novo) e, embaixo, como pedir um link novo. Para quem perdeu o link ou esqueceu
a senha, **Gerar link de acesso** (página do voluntário ou ícone da chave em Acessos) faz um link novo e anula os
anteriores ainda não usados. As rotas públicas do link aceitam 20 tentativas por minuto por endereço (o endereço real de quem acessa, não o do
proxy; ver `ForwardedHeaders` em Configuração). A lista de
voluntários mostra um ícone de pessoa com visto ao lado de quem tem acesso (cinza enquanto aguarda o primeiro acesso), e a página do
voluntário mostra o perfil e a situação do acesso. Acessos antigos, com senha definida antes, continuam valendo. O nome e
o e-mail do acesso vêm do cadastro do voluntário: mudar o e-mail no cadastro muda o login (não pode ficar em branco
nem repetir o de outro acesso, de qualquer núcleo). Em **Configurações › Acessos** a lista mostra a pessoa (com o
e-mail de login), o perfil e a situação, e editar muda só o perfil e se o acesso está ativo; um acesso antigo, sem
cadastro de voluntário, pode ser ligado a um ali.

**Gestão nacional** — a área **Nacional** do menu (só para quem tem a permissão; `/nacional`) tem as abas:
- **Painel** (a primeira): os números de todos os núcleos, no total (cartões) e numa tabela por núcleo — projetos
  ativos (em planejamento, em andamento ou pausados, sem os arquivados) e concluídos (com os arquivados: arquivar não
  apaga resultado), voluntários ativos, horas de voluntariado **estimadas** (dias como Ativo × 6 h/semana, a mesma regra
  do perfil do voluntário; não são as horas lançadas nos projetos), tarefas concluídas, registros de andamento, data da
  última atividade (último registro ou tarefa concluída: mostra quem está usando de fato) e uma coluna por indicador
  nacional. Os indicadores nacionais aparecem também somados em cartões, pela regra de **Resultados somados** (pelo
  vínculo com o nacional): "—" quando nenhum projeto informou, nunca zero, e "informado em 3 de 5 projetos" quando falta
  algum, no cartão e em cada núcleo. Horas, tarefas e registros contam no **período** escolhido (de início, os
  últimos 30 dias, com o mesmo seletor de período dos relatórios); projetos, voluntários e indicadores são a situação de
  hoje (o histórico dos valores dos indicadores só é usado no relatório em PDF). A tabela por núcleo começa por quem está há mais tempo sem atividade
  (nenhuma primeiro), com a **última atividade** logo depois do nome, em tempo relativo ("ontem", "25/09"), e a marca
  **parado** a partir de 30 dias (ou quando nunca houve). Só
  números: nada de nomes de pessoas nem de projetos.
- **Núcleos**: cada núcleo com cidade/UF, voluntários ativos, projetos ativos e quem o administra (nome,
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
desligar invalida o link (ligar de novo gera outro, `/publico/{código}`). Mostra o programa (nome, ícone, logo abaixo
do nome a linha **"Desde 2019 · Porto Alegre e Canoas"** — calculada dos projetos, ninguém digita: o ano do primeiro
projeto que já começou, sem contar planejados para depois de hoje, e as cidades onde o programa atua, da que tem mais
projetos para a que tem menos, até três e "e mais N cidades"; cancelados não contam, arquivados sim — e a ficha:
o que o programa faz no topo e, embaixo, **Objetivo** e **Para quem** lado a lado — o que estiver em branco não
aparece), os **parceiros** (nome e papel, na ordem da lista, logo abaixo; nunca o contato), os **resultados até hoje** (quantos projetos concluídos, em
andamento, em preparação e pausados; os indicadores nacionais e os do modelo do programa somados, só os que têm valor,
com a barra "de 55 · 22%" quando o indicador tem meta do programa;
quantos voluntários participaram, sem repetir, e as horas lançadas), um cartão por projeto (nome, situação, bairro e
cidade, início e previsão de término, progresso das tarefas, os indicadores informados e quando foi o último registro)
e, no rodapé, o nome, o CNPJ e o e-mail do núcleo. Projetos cancelados ficam de fora; os arquivados não ganham cartão,
mas entram nos números e nos resultados (arquivar só tira o projeto da lista). Nunca aparecem
endereço, mapa, nomes de voluntários, tarefas, o texto dos registros, fotos nem arquivos. O código do link não vai para
o histórico (só que a página foi ligada, desligada ou trocada). Na tela (`pages/PublicProgramPage.tsx`, fora do login),
"Planejamento" aparece como "Em preparação", a barra de progresso só aparece em andamento e pausado, e o link desligado
mostra "Página indisponível" (sem mandar para o login). A página fica fora dos buscadores (`noindex`), tem o nome do
programa no título da aba e não instala o uso sem internet (quem é de fora não precisa guardar o app). Para a
coordenação, a visão do programa (Projetos › programa) tem o botão **Página pública**. A janela explica o que aparece
e mostra o "o que o programa faz" atual, com o atalho para a apresentação em Editar programa › Sobre (ou um aviso, se
ainda não há texto). Sem link, **Gerar link** liga a
página na hora e o link aparece ali mesmo, com **Copiar link** e **Ver como o público vê**; com link, **Desligar link**
(com confirmação) faz ele parar de abrir, e gerar de novo cria outro; desligar não apaga o texto. Com o link ligado, a
visão do programa diz "página pública ligada".

**Configurações** — dados institucionais, logo, gestão de usuários (editar perfil, voluntário vinculado e ativo;
senha só por link) e troca da própria senha. No formulário de
projeto, o botão "Novo" ao lado do Programa cria um programa num diálogo por cima, já escolhido ao salvar. A aba
aberta fica na URL (`?aba=organizacao`, `acessos`, `planilhas`, `historico` ou `conta`; o antigo `usuarios` leva a
Acessos).

**Planilhas (exportar e importar)** — em Configurações › Planilhas (só administradores, porque o arquivo leva dados
pessoais). **Exportar planilha** abre uma lista do que entra no arquivo do Excel (.xlsx): **Projetos** (um por linha, com
situação, datas, responsável, uma coluna para cada indicador nacional, até três pares Indicador/Valor para os
específicos — mais, se algum programa tiver mais —, equipe com a função de cada um, local e a autorização de imagem; vem
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
entre a conferência e a confirmação). Exportação, conferência e importação rodam **em segundo plano** (fila; ver
Arquitetura): o arquivo enviado fica guardado, privado, só enquanto a tarefa roda; a exportação baixa sozinha quando
fica pronta e aparece em **Exportadas recentemente** por 7 dias; fechar a janela no meio da importação não a
interrompe, e o resumo ("Entraram 2 projetos…") vem num aviso, ou no sininho para quem saiu da plataforma. O arquivo é reconhecido pela aba oculta **Listas** (tipo e versão do modelo) e
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
senha criada por um link de acesso libera o acesso na hora. Cada endereço também tem um limite de 20 tentativas de
login por minuto, em qualquer conta (contra quem testa uma senha comum em muitos e-mails). Embaixo do "Entrar" fica **Esqueci minha senha**, que
explica o caminho (não há envio por e-mail): pedir à coordenação do núcleo um link novo de acesso, que chega pelo
WhatsApp ou por e-mail e deixa criar uma senha nova. Depois de uma senha recusada, de um acesso bloqueado ou desativado,
a explicação já aparece aberta. A Ajuda tem a mesma resposta. Todo campo de senha (entrar, criar a senha pelo link
e trocar em Minha conta) tem o olho de **Mostrar a senha** dentro dele, à direita (`PasswordInput`, em
`components/ui/Field.tsx`): no celular, digitar sem ver é o que mais faz errar. Os campos de texto livre (observações e registros de andamento) lembram
de não registrar dados sensíveis (saúde, religião, origem, opinião política) nem CPF.

**Depois de entrar** — a pessoa volta para a tela que tentou abrir sem sessão, com o endereço inteiro (um link de
tarefa recebido pelo WhatsApp, `/projetos/{id}?aba=tarefas&tarefa=…`, ou a tela em que estava quando a sessão de 12 h
venceu); sem isso, vai para o Início. O `ProtectedRoute` guarda o caminho e a tela de entrada só aceita caminhos de
dentro do app. **Sair** vai direto para a entrada sem guardar a tela atual: quem entrar depois no mesmo aparelho começa
pelo Início.

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

Monólito simples, sem microserviços, cache distribuído ou CQRS. A única fila é a das tarefas longas, dentro da própria
API (ver **Tarefas em segundo plano**, abaixo). As responsabilidades ficam separadas assim:

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
resto (tarefas, indicadores, registros, arquivos, equipe, comentários, checklist, avisos, documentos, modelos e
parceiros de programa, links de acesso) herda o do projeto, do voluntário, da tarefa ou do programa. A separação fica no
`EsfDbContext`, num **filtro global por núcleo** em todas essas tabelas: toda consulta só enxerga o núcleo de quem está
logado (vem no token, claim `org`), sem depender de cada tela lembrar. Registro novo de voluntário, programa ou
projeto entra sozinho no núcleo atual ao salvar, e as validações de "existe?" usam consultas filtradas, então um id de
outro núcleo é recusado. Só quatro pontos olham todos os núcleos, de propósito e com `IgnoreQueryFilters`: o login (o
e-mail é único na plataforma inteira), o link de acesso (rota pública), a checagem de e-mail repetido e a página
pública do programa (acha o programa pelo código do link e, dali em diante, fixa o núcleo dele em
`OrganizationOverride`, então o resto da consulta passa pelo filtro normal). Rotinas
internas (dados de demonstração, a fila em segundo plano ao pegar a próxima tarefa) usam `AllOrganizations`. Sessões de antes dos núcleos (token sem `org`) pedem para
entrar de novo. Na atualização, a migração `AddNucleos` põe todos os dados existentes no núcleo já cadastrado (o
mesmo registro usado nos termos e certificados); um banco com dados e sem esse registro ganha um.

**Tarefas em segundo plano (fila)** — o que demora (o relatório em PDF, a exportação e a importação de planilha) não roda durante a requisição. A rota grava o
pedido na tabela `BackgroundJobs` (tipo, opções em JSON, quem pediu com nome e perfil, núcleo) e responde na hora (202)
com a tarefa; a tela pergunta por ela (`GET /api/jobs/{id}`) e baixa o resultado quando fica pronta. Quem processa é o
`JobWorker` (`Services/JobWorker.cs`), um `BackgroundService` dentro da própria API, sem servidor a mais: pega uma
tarefa de cada vez (dois relatórios grandes não somam memória) e roda o mesmo serviço da rota (`JobRunner`) num escopo
em que o usuário atual é quem pediu (`JobUser` em `CurrentUserOverride`): filtro por núcleo, perfil e histórico de
alterações funcionam como numa requisição. O arquivo gerado fica em `StoredFiles`, privado. Enquanto processa, o
`JobWorker` renova um prazo (`LeaseUntil`) a cada 30 s; se o servidor cair, o prazo de 2 min vence e a tarefa volta
para a fila. Na segunda queda, ela falha com explicação. No desligamento normal (deploy), a tarefa volta para a fila
sem contar tentativa. Dois servidores não pegam a mesma tarefa: a coluna `Stamp` é o controle de concorrência. Quando
termina e a tela não pergunta há mais de 20 s (a pessoa saiu), vai um aviso para o sininho de quem pediu. Tarefas e
arquivos com mais de 7 dias são apagados uma vez por hora. Uma segunda rotina do mesmo `JobWorker`, independente da
fila de tarefas (uma foto não espera um relatório grande), procura a cada 5 s as fotos com `PreviewState = Pending` e
gera a miniatura e a versão do PDF (`Reports/ImagePreviews.cs`), uma por vez. O histórico de alterações (`AuditInterceptor`) lê quem age
pelo próprio contexto (`EsfDbContext.CurrentUserId`), que na fila é quem pediu.

**Bibliotecas usadas:** Npgsql/EF Core (persistência), BCrypt.Net (hash de senha), JwtBearer (autenticação),
QuestPDF (relatórios), ClosedXML (planilhas, licença MIT), Swashbuckle (Swagger). No frontend: React, React Router e CSS próprio — sem framework de UI.

**Telas sob demanda (frontend)** — só o login e o Início vêm no arquivo principal; cada outra tela é um arquivo `.js`
próprio, baixado ao ser aberta (`lazy` em `App.tsx`, com o menu e o topo na tela enquanto ela chega). O mapa, o quadro
de tarefas e o editor de texto também. O service worker guarda todos no primeiro acesso, então sem internet as telas
continuam abrindo. Depois de um deploy, uma aba aberta com a versão anterior que pede uma tela que mudou recarrega
sozinha uma vez (`vite:preloadError`, em `main.tsx`).

---

## Estrutura de diretórios

```
ESF_Plataforma_V0/
├─ .github/
│  ├─ workflows/ci.yml    CI: testes (memória e PostgreSQL), API no ar e build do frontend
│  └─ scripts/smoke-api.sh  rotas principais chamadas na API no ar
├─ backend/
│  ├─ Dockerfile
│  ├─ Esf.Api.sln
│  ├─ Esf.Api.Tests/      testes (xUnit; memória ou PostgreSQL): separação entre núcleos e regras
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
│     │  ├─ national/     abas da gestão nacional (painel, núcleos, indicadores, pessoas)
│     │  ├─ projects/     formulários e abas do projeto
│     │  ├─ settings/     abas de Configurações (organização, acessos, planilhas, histórico, conta)
│     │  └─ ui/           botões, campos, tabela, badges, modal, estados
│     ├─ context/         autenticação e avisos
│     ├─ pages/           login, dashboard, projetos, detalhe, voluntários,
│     │                   relatórios, configurações
│     ├─ styles/          sistema visual em CSS: globals.css importa um arquivo por área (tokens em base.css)
│     ├─ types/           openapi.ts (gerado do contrato da API) e api.ts (nomes das telas e o que a tela envia)
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
| `Programs` | programas (nome, situação, ícone, cor, a ficha — `Description` "o que faz", `Objective`, `Audience` "para quem" — e o código do link da página pública, vazio com ela desligada) |
| `ProgramTemplateActivities` / `ProgramTemplateIndicators` | tarefas e indicadores padrão do modelo de cada programa (o indicador com a meta do programa, opcional) |
| `ProgramPartners` | parceiros de cada programa (ordem, nome, papel, pessoa de contato, e-mail, telefone, observações) |
| `Activities` | tarefas do projeto (FK `ProjectId`, responsável opcional; na visita, `Kind = Visita`, turno, hora e o acompanhante `CompanionVolunteerId`) |
| `ActivityChecklistItems` | itens do checklist de cada tarefa (texto, feito, ordem) |
| `ActivityComments` | comentários das tarefas (autor, texto, voluntários mencionados, edição) |
| `Indicators` | indicadores do projeto (nome, valor — vazio é "não informado" — e unidade; `NationalIndicatorId` quando é um indicador nacional) |
| `IndicatorValueChanges` | histórico do valor de cada indicador (novo valor e desde quando vale), gravado sozinho no `SaveChanges` quando o número muda; o relatório em PDF lê dele o valor no fim do período |
| `NationalIndicators` | indicadores nacionais da gestão nacional (nome, unidade, como contar, arquivado); sem núcleo |
| `Volunteers` | cadastro de voluntários (inclui setor: Projetos, Juridico, Pessoas, Comunicacao, Qualidade ou Financeiro; bairro, cidade, ponto aproximado, deslocamento e a grade de turnos livres) |
| `VolunteerStatusChanges` | histórico de status dos voluntários (a partir de que dia valeu cada situação), base das horas de voluntariado |
| `ProjectVolunteers` | vínculo N:N projeto × voluntário, com a função no projeto |
| `ProjectFiles` | metadados dos arquivos enviados (o conteúdo fica em `StoredFiles`); pode pertencer direto ao projeto ou a um registro de andamento; `PreviewState` diz se a foto já tem miniatura e versão do PDF |
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
A documentação interativa fica em `/swagger`, só no ambiente `Development` (o do `docker compose` e do `dotnet run`)
ou com `Swagger:Enabled` ligado. No servidor ela fica desligada para não mostrar o mapa das rotas a qualquer pessoa.

Erros sempre vêm como `{ message, errors }`, com a mensagem em português. Duas pessoas gravando a mesma coisa ao mesmo
tempo (registro repetido, alterado ou excluído no meio) recebem 409 com o que fazer, não "Erro interno". Arquivo maior
que o limite da rota recebe 413.

| Método | Rota | Descrição |
| --- | --- | --- |
| POST | `/api/auth/login` | autentica e devolve o token |
| GET | `/api/auth/me` | usuário da sessão |
| POST | `/api/auth/change-password` | troca a própria senha |
| POST | `/api/auth/accept-terms` | registra o aceite da política de privacidade e dos termos de uso (versão vigente) |
| GET | `/api/dashboard` | dados do Início (minhas tarefas, meus projetos, resumo da organização e carga da equipe) |
| GET | `/api/projects` | lista com `search`, `status`, `programId`, `onlyLate`, `onlyStale`, `includeArchived`, `sort` |
| GET/POST | `/api/programs` | lista e cria programas (agrupamento de projetos; `onlyActive=false` inclui os arquivados) |
| GET/PUT/DELETE | `/api/programs/{id}` | programa com contagens de projetos, a ficha, nomes dos parceiros e resultados somados; edita nome, ícone, cor e a ficha (`description`, `objective`, `audience`, sempre os três atuais) e arquiva/reativa; exclui só programa sem projetos |
| GET/PUT | `/api/programs/{id}/template` | modelo de projeto: tarefas e indicadores padrão (PUT grava o modelo inteiro; coordenação) |
| GET/PUT | `/api/programs/{id}/partners` | parceiros do programa, na ordem (PUT grava a lista inteira: com `id` altera, sem `id` cria, os que faltarem são apagados; coordenação) |
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
| POST/GET/PUT/DELETE | `/api/projects[/{id}]` | CRUD de projetos (na criação, `useTemplate` aplica o modelo do programa). O detalhe traz tarefas, equipe e indicadores; registros e arquivos só a contagem (`updatesCount`, `filesCount`) |
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
| GET/PUT | `/api/volunteers/{id}/availability` | bairro, cidade, ponto aproximado, deslocamento e turnos livres (a coordenação, de todos; os demais, só os próprios) |
| GET | `/api/volunteers/{id}/hours` | horas de voluntariado; o histórico de status só vem para a coordenação e para o próprio voluntário |
| POST/PUT/DELETE | `/api/volunteers/{id}/status-history[/{periodId}]` | inclui, edita ou remove um período do histórico de status (coordenação) |
| GET/POST/DELETE | `/api/projects/{id}/volunteers[/{volunteerId}]` | vínculo com projetos |
| GET/POST | `/api/projects/{id}/indicators` | indicadores do projeto |
| PUT/DELETE | `/api/indicators/{id}` | edição e exclusão |
| GET/POST | `/api/projects/{id}/files` | arquivos do projeto (upload multipart; com `activityId`, anexo de uma tarefa) |
| GET/PUT/DELETE | `/api/files/{id}[/download]` | download, edição da legenda e exclusão |
| GET/POST | `/api/projects/{id}/updates` | registros de andamento: GET em páginas (`skip`, `take` até 100; devolve `{ items, total }`); POST com texto + fotos e, opcional, as horas do dia (multipart) |
| GET/POST | `/api/projects/{id}/hours` | horas lançadas no projeto (total, por pessoa e lançamentos) e novo lançamento |
| PUT/DELETE | `/api/hours/{id}` | corrige ou apaga um lançamento de horas (a própria pessoa ou a coordenação) |
| PUT/DELETE | `/api/updates/{id}` | edição e exclusão do registro |
| POST/DELETE | `/api/updates/{id}/attachments[/{fileId}]` | anexar ou remover uma foto do registro |
| GET | `/api/reports/period-counts` | o que cada projeto do núcleo tem no período `from`/`to` (opcional): registros de andamento, fotos que entram no PDF (até 4 por registro) e tarefas concluídas |
| POST | `/api/reports/projects` | pede o PDF consolidado (projetos, formato `Completo`/`Resumo`, partes incluídas e período de referência `from`/`to`, opcional): responde 202 com a tarefa em segundo plano; o PDF sai em `/api/jobs/{id}/download` |
| GET | `/api/jobs?kind=` | tarefas em segundo plano de quem está logado nos últimos 7 dias, as mais novas primeiro (`kind` repetível: `Report`, `SpreadsheetExport`, `SpreadsheetImport`) |
| GET | `/api/jobs/{id}` | situação da tarefa (`Queued`, `Running`, `Done`, `Failed`), quantas estão na frente, nome do arquivo, erro ou resposta; só de quem pediu |
| GET | `/api/jobs/{id}/download` | arquivo gerado pela tarefa (só quem pediu) |
| POST | `/api/spreadsheets/export` | pede a planilha .xlsx com o que foi escolhido (`projects`, `volunteers`): responde 202 com a tarefa em segundo plano, e o arquivo sai em `/api/jobs/{id}/download`; entra no histórico (administrador) |
| GET | `/api/spreadsheets/template` | modelo vazio de importação, com as listas do núcleo (administrador) |
| POST | `/api/spreadsheets/import?confirm=` | planilha preenchida (multipart, .xlsx até 10 MB): sem `confirm`, só a conferência linha a linha; com `confirm=true`, cria o que é novo e sem erro. Responde 202 com a tarefa em segundo plano; o resultado de cada linha vem em `result` (administrador) |
| GET/PUT/DELETE | `/api/users[/{id}]` | gestão de usuários (acesso novo só pelo voluntário, abaixo) |
| POST | `/api/volunteers/{id}/access` | dá acesso ao voluntário (perfil; login = e-mail do cadastro) e devolve o link de primeiro acesso (administrador) |
| POST | `/api/users/{id}/access-link` | link novo de acesso (primeiro acesso perdido ou senha esquecida); anula os anteriores (administrador) |
| GET/POST | `/api/access/{código}` | públicas: dados do link e criação da senha (com o aceite da política), já devolvendo o login |
| GET/PUT | `/api/programs/{id}/public-page` | página pública do programa (coordenação): se está ligada e o código do link; o PUT liga/desliga (desligar invalida o link; ligar de novo gera outro). Os textos do topo são a ficha do programa |
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
| **Coordenador** | criar e editar projetos, voluntários e indicadores; arquivar projetos; dar acesso (perfil Usuário ou Coordenador) e gerar link novo (menos para administrador) |
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
| `Jwt:Key` | vazio (no `Development`, uma chave só para o computador) | assinatura do token, mín. 32 caracteres. **Obrigatória no servidor** (`Jwt__Key`): sem ela, ou com uma chave de exemplo do repositório, a API não sobe. Trocar a chave obriga todos a entrar de novo |
| `Jwt:ExpiresMinutes` | 720 | validade do token |
| `Swagger:Enabled` | `true` só no `Development` | documentação interativa das rotas em `/swagger` |
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
- **API:** `Jwt__Key` com um texto aleatório próprio (64 caracteres ou mais; sem ela a API não sobe),
  `ForwardedHeaders__ClientIpHeader=True-Client-IP` (ver a tabela acima) e `Seed__Enabled=false` num banco de
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