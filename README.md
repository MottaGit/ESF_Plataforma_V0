# ESF — Plataforma de gestão de projetos (V0)

Primeira versão funcional de uma aplicação web para o **Engenheiros Sem Fronteiras** (núcleo Porto Alegre) centralizar
seus projetos sociais: o programa de banheiros Direito da Gente e as hortas comunitárias.

Hoje essas informações costumam ficar espalhadas entre planilhas, documentos e fotos. Aqui elas ficam no mesmo lugar,
com andamento, responsáveis, atividades, voluntários, indicadores, arquivos, localização e relatórios em PDF.

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

---

## Acessos de demonstração

O seed cria a organização (Porto Alegre/RS), 3 usuários, 19 voluntários e 15 projetos (10 do programa Banheiro
Direito da Gente, baseados em registros reais, e 5 de horta comunitária) com atividades, indicadores, vínculos e
atualizações de andamento — o suficiente para navegar pela aplicação já na primeira execução.

| E-mail | Perfil | Senha |
| --- | --- | --- |
| leonardo.motta@esf.org.br | Administrador | `Esf@2026` |
| ana.aumond@esf.org.br | Coordenador | `Esf@2026` |
| fausto.silva@esf.org.br | Usuário | `Esf@2026` |

O seed só roda quando o banco está vazio, então ele nunca sobrescreve dados reais. A tela de login não mostra nem
preenche esses acessos; em produção, troque as senhas de demonstração (ou defina `Seed:DemoPassword` antes do primeiro
deploy).

---

## O que a aplicação faz

**Visão geral (dashboard)** — focada no trabalho do dia a dia: atividades e voluntários. Abaixo do "Olá", uma linha
resume as suas atividades (em aberto, atrasadas, bloqueadas) ou, sem voluntário vinculado, as da organização. No topo,
quatro números: atividades atrasadas, concluídas no mês (últimos 30 dias, levando ao quadro), em andamento e voluntários
ativos (com quantos estão sem atividade em aberto). O bloco **Precisa de atenção** lista as atividades atrasadas,
bloqueadas (com o motivo) ou sem responsável, com filtros e link para o projeto; **Equipe** mostra quem está com mais
atividades em aberto. À direita, **Minhas atividades** (as próximas em aberto de quem está logado, com atalho para o
quadro; sem voluntário vinculado, explica como pedir o vínculo) e os **aniversariantes do mês** (voluntários ativos e
afastados).

**Projetos** — listagem com busca, filtros (status, programa, só atrasados, incluir arquivados) e ordenação; criação,
edição, mudança de status, arquivamento e exclusão. Busca, filtros, ordenação e visão ficam na URL, então voltar de um
projeto (ou recarregar) mantém a lista como estava. O **progresso** é calculado pelas atividades concluídas (projeto
concluído conta como 100%). A tela tem duas abas: **Lista de projetos** (a tabela) e **Quadro de atividades**.

**Quadro de atividades** — kanban com as atividades de todos os projetos em planejamento ou em andamento (não
arquivados), em quatro colunas: **Não iniciadas**, **Em andamento**, **Bloqueadas** e **Concluídas** (só as dos últimos 30
dias). Levar um card para Bloqueadas pergunta, sem obrigar, o que está travando; o motivo aparece no card. Nas
colunas em aberto, as atrasadas vêm primeiro, depois o prazo mais próximo e a prioridade; nas concluídas, as mais
recentes. Cada card mostra título, prioridade (só "Alta" é destacada), projeto (link para a aba Atividades dele),
responsável com foto (ou "Sem responsável" em destaque) e prazo como data curta ("até 14/07"); quando o prazo venceu,
só o texto fica vermelho, e o detalhe ("atrasada 3 dias") fica na dica do mouse. O mesmo vale para a lista da aba
Atividades e para a Visão geral. Para mudar o status, arraste o card para outra coluna (com o mouse; no celular,
segure o card um instante e arraste, e o quadro rola sozinho ao chegar na borda) ou, no celular, use o selo de status
do card. Clicar no card abre a atividade para editar, e o botão "Nova atividade" cria uma pelo próprio quadro,
escolhendo o projeto no formulário (filtrando por um programa, só os projetos dele aparecem); o responsável é
escolhido depois do projeto, entre a equipe dele. O quadro é carregado só quando a aba é aberta. Filtros: busca por
atividade ou projeto, Todas/Minhas (sem voluntário vinculado, "Minhas" explica como pedir o vínculo), programa,
responsável, prioridade e só atrasadas, todos na URL. No celular as colunas ficam lado a lado e o quadro rola na
horizontal, uma coluna por vez. O status do projeto em si é alterado na página do projeto. O arrastar e soltar usa
[dnd-kit](https://dndkit.com/) (`@dnd-kit/core`).

**Detalhes do projeto** — cabeçalho com o status (alterado no próprio badge) e o prazo em texto ("faltam 45 dias",
"atrasado há 5 dias"), uma **faixa de situação** visível em todas as abas (progresso, atividades atrasadas,
bloqueadas e equipe, cada uma levando à aba correspondente) e cinco abas: **Andamento** (a inicial), **Atividades**, **Equipe**, **Arquivos** e **Sobre**
(descrição, objetivo, dados cadastrais e indicadores). A aba aberta fica na URL (`?aba=atividades`, `?aba=equipe`…),
então links diretos e recarregar a página caem no lugar certo. Relatório do projeto em um clique.

**Atividades** — título, descrição, responsável, status (não iniciada / em andamento / bloqueada / concluída; ao bloquear, um motivo opcional), prioridade
(baixa / média / alta), prazo e observações. A lista tem duas seções sempre visíveis: **Em aberto** (não iniciadas
primeiro, depois em andamento e bloqueadas, reordenando na hora quando o status muda) e **Concluídas**. Há caixinha para concluir em
um clique e "Desfazer" logo em seguida; a atividade concluída fica riscada no lugar e só passa para "Concluídas" quando
a aba é aberta de novo. O botão "Nova atividade" abre o
formulário com título, responsável, prazo, prioridade e descrição. O responsável é escolhido entre a
equipe do projeto; ao atribuir alguém de fora, a pessoa entra na equipe automaticamente (o responsável pelo projeto
também faz parte dela e só pode ser desvinculado depois de trocado).

**Andamento** — a tela inicial de cada projeto. No topo, o campo "Registrar andamento" para publicar um relato com
formatação básica (negrito, itálico, sublinhado, listas e links) e uma ou mais fotos anexadas; o HTML é limpo no
servidor, só essas formatações são aceitas, e elas também aparecem no relatório PDF. Abaixo,
o feed com data e autor, do mais recente para o mais antigo. Editável depois
de publicado, e cada atualização pode ganhar novos anexos com o tempo. O feed fica numa coluna centralizada, com
largura confortável de leitura. Os anexos aparecem compactos (até 4 miniaturas, depois "+N"; documentos numa linha) e
as fotos abrem num visualizador em tela cheia (setas ou deslizar no celular). Editar, anexar e excluir ficam no menu
"..." de cada atualização, e remover um anexo pede confirmação.

**Voluntários** — gestão das pessoas da organização: nome, contato, setor (Projetos, Jurídico, Pessoas, Comunicação,
Qualidade ou Financeiro), situação (ativo/inativo) e observações. A listagem mostra em quais projetos cada um está
vinculado, com filtro por setor e por situação. O vínculo com projetos (e o papel exercido em cada um) pode ser feito
tanto pela aba de voluntários de cada projeto quanto diretamente ao editar o voluntário, sempre entre projeto e
voluntário já cadastrados. O cadastro guarda o aniversário (só dia e mês): no dia, a pessoa ganha o selo "Aniversário
hoje" na lista e no detalhe, e um aviso no topo da página lista os aniversariantes. A foto (opcional) é o primeiro
item do formulário: escolhida do computador e enquadrada num círculo (arrastar e zoom) antes de ser usada; o navegador
envia só o recorte, um quadrado de 400x400, gravado ao salvar o voluntário. A foto aparece como uma bolinha na
lista de voluntários, no detalhe, na aba Equipe dos projetos e no canto superior direito (para o voluntário vinculado
à conta logada); sem foto, aparecem as iniciais. Quando o acesso está vinculado a um voluntário, a plataforma mostra o
nome e a foto desse voluntário no topo, na barra lateral, no "Olá" da visão geral, como autor dos relatos de andamento
e em "Enviado por" dos arquivos; sem vínculo, usa o nome do próprio usuário.

**Indicadores** — número simples de resultado por projeto (nome, valor e unidade, sem meta nem barra de progresso),
consolidado por nome no dashboard geral.

**Arquivos** — um lugar só para todos os arquivos do projeto, inclusive as fotos publicadas no Andamento (marcadas com
a data da atualização). Envio de um ou vários arquivos por seleção ou arrastar e soltar, legenda editável em qualquer
arquivo (é ela que aparece embaixo da foto no relatório), visualizador de fotos em tela cheia, download e exclusão.
Os arquivos ficam guardados no próprio banco (tabela `StoredFiles`), então não se perdem quando o servidor é recriado
a cada deploy. Fotos grandes são reduzidas no navegador antes do envio (JPEG com o maior lado em 2048 px).

**Localização** — endereço, bairro, cidade, estado e, quando houver coordenadas, mapa embutido (OpenStreetMap, sem chave de API).

**Relatórios** — seleção de um ou vários projetos, observação livre e geração de um **PDF consolidado** com
identificação, descrição, objetivo, período, status, responsável, localização, atividades, voluntários e
indicadores (sempre incluídos) e fotos (opcional).

**Configurações** — dados institucionais, logo, **programas** (criar, renomear, arquivar e excluir os que não têm
projetos; arquivado, o programa sai das opções de novos projetos), gestão de usuários e troca da própria senha. No
formulário de projeto, o botão "Novo" ao lado do Programa cria um programa num diálogo por cima, já escolhido ao salvar.

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

Os serviços não conhecem HTTP e os controllers não conhecem EF Core. É esse acoplamento baixo que permite, na V1,
reorganizar o projeto em módulos com Clean Architecture e DDD sem reescrever as regras.

**Bibliotecas usadas:** Npgsql/EF Core (persistência), BCrypt.Net (hash de senha), JwtBearer (autenticação),
QuestPDF (relatórios), Swashbuckle (Swagger). No frontend: React, React Router e CSS próprio — sem framework de UI.

---

## Estrutura de diretórios

```
ESF_Plataforma_V0/
├─ backend/
│  ├─ Dockerfile
│  ├─ Esf.Api.sln
│  └─ Esf.Api/
│     ├─ Common/          AppException, middleware de erros, JWT, opções, políticas
│     ├─ Controllers/     auth, dashboard, projects, activities, volunteers,
│     │                   indicators, files, reports, users, organization
│     ├─ Data/            EsfDbContext, DbSeeder, Migrations/
│     ├─ Domain/          Entities/ e Enums
│     ├─ Dtos/            contratos da API
│     ├─ Reports/         ProjectReportBuilder (PDF) e ReportModel
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
| `Users` | acesso à plataforma (nome, e-mail, hash da senha, perfil, ativo, voluntário vinculado) |
| `Projects` | dados do projeto, localização, datas, status, arquivamento (o progresso é calculado, não armazenado) |
| `Activities` | atividades do projeto (FK `ProjectId`, responsável opcional) |
| `Indicators` | indicadores do projeto (nome, valor e unidade) |
| `Volunteers` | cadastro de voluntários (inclui setor: Projetos, Juridico, Pessoas, Comunicacao, Qualidade ou Financeiro) |
| `ProjectVolunteers` | vínculo N:N projeto × voluntário, com papel no projeto |
| `ProjectFiles` | metadados dos arquivos enviados (o conteúdo fica em `StoredFiles`); pode pertencer direto ao projeto ou a uma atualização |
| `ProjectUpdates` | relatos de andamento do projeto (texto, autor, data, editável) |
| `Organizations` | dados institucionais (registro único) |
| `StoredFiles` | conteúdo dos arquivos enviados (fotos, documentos, logo), servido em `/uploads/{nome}` |

Chaves estrangeiras com `ON DELETE CASCADE` para o que pertence ao projeto (atividades, indicadores, vínculos, arquivos)
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
| GET | `/api/dashboard` | números e listas da visão geral |
| GET | `/api/projects` | lista com `search`, `status`, `programId`, `onlyLate`, `includeArchived`, `sort` |
| GET/POST | `/api/programs` | lista e cria programas (agrupamento de projetos; `onlyActive=false` inclui os arquivados) |
| PUT/DELETE | `/api/programs/{id}` | renomeia e arquiva/reativa; exclui só programa sem projetos |
| POST/GET/PUT/DELETE | `/api/projects[/{id}]` | CRUD de projetos |
| PATCH | `/api/projects/{id}/status` | mudança de status |
| POST | `/api/projects/{id}/archive` · `/unarchive` | arquivar e reativar |
| GET/POST | `/api/projects/{id}/activities` | atividades do projeto |
| PUT/PATCH/DELETE | `/api/activities/{id}[/status]` | edição, status e exclusão |
| GET | `/api/activities/upcoming` | próximos prazos pendentes (`mine=true`: só os do usuário logado) |
| GET | `/api/activities/board` | quadro de atividades: projetos em planejamento ou em andamento, concluídas dos últimos 30 dias |
| GET/POST/PUT/DELETE | `/api/volunteers[/{id}]` | cadastro de voluntários |
| POST/DELETE | `/api/volunteers/{id}/photo` | troca ou remove a foto do voluntário (imagem já recortada) |
| GET/POST/DELETE | `/api/projects/{id}/volunteers[/{volunteerId}]` | vínculo com projetos |
| GET/POST | `/api/projects/{id}/indicators` | indicadores do projeto |
| PUT/DELETE | `/api/indicators/{id}` | edição e exclusão |
| GET/POST | `/api/projects/{id}/files` | arquivos do projeto (upload multipart) |
| GET/PUT/DELETE | `/api/files/{id}[/download]` | download, edição da legenda e exclusão |
| GET/POST | `/api/projects/{id}/updates` | relatos de andamento (texto + fotos, multipart) |
| PUT/DELETE | `/api/updates/{id}` | edição e exclusão do relato |
| POST/DELETE | `/api/updates/{id}/attachments[/{fileId}]` | anexar ou remover uma foto do relato |
| POST | `/api/reports/projects` | gera o PDF consolidado |
| GET/POST/PUT/DELETE | `/api/users[/{id}]` | gestão de usuários |
| GET/PUT | `/api/organization` · `POST /logo` | dados institucionais |

Erros seguem sempre o mesmo formato:

```json
{ "message": "A previsao de termino nao pode ser anterior a data de inicio.", "errors": { "campo": ["..."] } }
```

---

## Perfis de acesso

| Perfil | O que pode fazer |
| --- | --- |
| **Administrador** | tudo, incluindo usuários, dados institucionais e exclusão de projetos |
| **Coordenador** | criar e editar projetos, voluntários e indicadores; arquivar projetos |
| **Usuário** | consultar tudo, criar e atualizar atividades, indicadores, arquivos, relatos de andamento e status |

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

No frontend, `VITE_API_URL` só é necessário se a API não estiver atrás do proxy (Vite em desenvolvimento, nginx em Docker).

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