# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Visão geral

Plataforma de gestão de projetos sociais do Engenheiros Sem Fronteiras (ESF): projetos, tarefas, voluntários,
indicadores, arquivos, relatórios em PDF e planilhas, com vários núcleos (Porto Alegre, Curitiba…) numa instalação só
e uma área de gestão nacional. Monólito: React + TypeScript (Vite) → ASP.NET Core 8 Web API → EF Core 8 → PostgreSQL 16.

O [README.md](README.md) é a especificação funcional, detalhada tela a tela (regras, rotas da API, perfis,
configuração). Consulte-o antes de mexer numa funcionalidade e atualize-o na mesma mudança.

Tudo é em português do Brasil: domínio, rotas da interface, mensagens, commits.

## Comandos

Backend (.NET 8):

```bash
cd backend && dotnet build
cd backend && dotnet test                                              # todos os testes
cd backend && dotnet test --filter "FullyQualifiedName~NucleoIsolationTests"   # uma classe
cd backend && dotnet test --filter "FullyQualifiedName~ProjectHoursTests.MemberLogsOwnHoursAndCoordinationSeesThem"
cd backend && ESF_TEST_POSTGRES="Host=...;Username=...;Password=..." dotnet test   # os mesmos testes num Postgres (o CI faz)
cd backend/Esf.Api && dotnet run                                       # API em :5080 (precisa de PostgreSQL)
cd backend/Esf.Api && dotnet ef migrations add NomeDaMigration         # nova migração (dotnet-ef global)
```

Frontend (não há ESLint, Prettier nem testes de frontend; a validação é typecheck + build + navegador):

```bash
cd frontend && npm run typecheck   # tsc --noEmit (strict, noUnusedLocals/Parameters)
cd frontend && npm run build       # tsc + vite build (gera também o /sw.js)
cd frontend && npm run dev         # :5173, proxy de /api e /uploads para :5080
```

Tudo junto: `docker compose up --build` (front :5173, API :5080/swagger, Postgres :5432, usuário `esf`). O compose
lê de um `.env` na raiz (fora do git, sem `.env.example`): `POSTGRES_PASSWORD`, `JWT_KEY` (mín. 32 caracteres, senão a
API não sobe) e `SEED_DEMO_PASSWORD`. Ele roda a API como `Development`.

A API aplica as migrações sozinha ao iniciar (`Database.Migrate()` com novas tentativas) e, com o banco vazio, o
`DbSeeder` cria a demonstração (dois núcleos e gestão nacional; senha `Esf@2026`; datas contadas a partir do dia da
criação). Para recriar: `docker compose down -v`. `Seed:Enabled` vem `true` no `appsettings.json`: num banco de
produção vazio, desligue antes de subir. Os acessos de demonstração também estão fixos na tela de login
(`pages/LoginPage.tsx`, login já preenchido): mudou o seed, mude lá.

## Arquitetura do backend (`backend/Esf.Api`)

- **Camadas:** `Controllers/` (HTTP, rotas, `[Authorize(Policy = ...)]`, sem regra) → `Services/` (regras; não
  conhecem HTTP) → `Data/EsfDbContext`. Entrada e saída só por `Dtos/`; a conversão fica em `Services/Mapping.cs` e
  entidades nunca saem na API. Serviço novo precisa ser registrado à mão em `Program.cs` (`AddScoped`).
- **Erros:** os serviços lançam `AppException` (`NotFound`, `Conflict`, `Forbidden`); o `ErrorHandlingMiddleware` e o
  `InvalidModelStateResponseFactory` devolvem sempre `{ message, errors }`, e o frontend mostra o `message`. As
  mensagens em inglês que o próprio ASP.NET gera (JSON em formato errado) não viram `message`: dê sempre um
  `ErrorMessage` em português aos atributos de validação.
- **Núcleos (multi-tenant):** `Organization` é o núcleo. No fim de `OnModelCreating` do `EsfDbContext` há um filtro
  global por núcleo em cada tabela, usando `CurrentOrganizationId` (claim `org` do JWT). `Volunteer`, `ProjectProgram`
  e `Project` implementam `IOrganizationOwned` e recebem o núcleo sozinhos no `SaveChanges`; `User` e `AuditEntry`
  também guardam `OrganizationId`, preenchido à mão (`User` fica sem núcleo na conta só nacional); as demais filtram
  pela navegação até o pai (`x.Project!.OrganizationId`…). Ao criar entidade nova:
  inclua o filtro e um caso em `Esf.Api.Tests` (`TwoNucleos` tem um registro de cada tabela em dois núcleos).
  `AllOrganizations = true` só para rotinas internas (seed, a fila ao pegar a próxima tarefa) e números agregados da
  gestão nacional;
  `IgnoreQueryFilters` só no login, no link de acesso, na checagem de e-mail único (e-mail é único na plataforma) e
  na página pública do programa (`PublicProgramService`: acha o programa pelo código do link e fixa
  `OrganizationOverride`, para o resto passar pelo filtro).
- **Perfis:** `Administrador`, `Coordenador`, `Usuario` (por núcleo) + permissão de gestão nacional (claim `nacional`,
  pode ser conta sem núcleo). Políticas: `ManageProjects` (admin/coord), `AdminOnly`, `National`; os nomes ficam em
  `Common/Policies.cs` e as regras em `Program.cs` (`AddAuthorization`), então política nova mexe nos dois. A gestão
  nacional só vê números agregados, nunca dados pessoais dos núcleos. O token vale 12 h e, nesse período, não
  reconfere a permissão nem se o acesso foi desativado (`CurrentUser` só lê as claims).
- **Datas:** o banco guarda em UTC e o servidor roda em UTC (que vira o dia às 21 h de Brasília). "Hoje" é
  `Mapping.Today` (dia de Brasília); para mostrar, `TextHelpers.BrasiliaTime`/`BrasiliaDay`; para filtrar um período
  em dias, `TextHelpers.BrasiliaDayStartUtc`. Nunca `ToLocalTime()`, `DateTime.UtcNow.Date` nem
  `DateOnly.FromDateTime(DateTime.UtcNow)`.
- **Histórico de alterações:** o `AuditInterceptor` (em `Services/AuditTrail.cs`) grava `AuditEntries` no mesmo
  `SaveChanges`, só quando há pessoa logada. Só entram as entidades e campos listados em `AuditTrail.Fields`; dados
  pessoais ficam em `MaskedFields` (registra que mudou, sem o valor). Campo novo que deve aparecer no histórico precisa
  entrar nesse dicionário.
- **Histórico dos indicadores:** à parte do de alterações, o `SaveChanges` do `EsfDbContext` grava uma
  `IndicatorValueChange` sempre que o valor de um indicador muda (data = `ValueUpdatedAt`). O relatório em PDF lê dele o
  valor no fim do período e a mudança no período (`Services/IndicatorHistory.cs`); quem grava valor não precisa fazer nada.
- **Tarefas em segundo plano:** o que demora (relatório em PDF) entra na fila `BackgroundJobs` pelo `JobQueue` e a
  rota responde 202 com a tarefa; o `JobWorker` (`BackgroundService` na própria API) processa uma de cada vez,
  chamando o serviço de sempre pelo `JobRunner` num escopo em que o `ICurrentUser` é quem pediu (`JobUser` via
  `CurrentUserOverride`). O frontend usa `runFileJob`/`waitForJob` (`api/jobs.ts`). Tipo novo de tarefa: valor em
  `BackgroundJobKind`, caso no `JobRunner` e no `NotifyAsync` do `JobWorker`, e o tipo em `types/api.ts`. O
  histórico de alterações pega quem age por `EsfDbContext.CurrentUserId`, nunca pelo `HttpContext`.
- **Endereço de quem acessa:** a API fica atrás de proxy; `app.UseForwardedHeaders()` (configurado em
  `Common/ClientAddress.cs`, chaves `ForwardedHeaders:*`) põe o endereço real em `Connection.RemoteIpAddress`. Use
  esse, nunca o `X-Forwarded-For` cru (o navegador pode inventar).
- **Arquivos:** ficam no banco (`StoredFiles`), não em disco, porque o disco do servidor some a cada deploy. Saem
  públicos em `/uploads/{nome}` (nome imutável, cache longo); documentos assinados são privados e só baixam com login.
- **Busca sem acento:** funções do Postgres `esf_fold`/`esf_fold_html` (migração `AddSearchFunctions`), mapeadas como
  `EsfDbContext.Fold`/`FoldHtml`; só funcionam dentro de consultas.
- **Texto formatado:** registros de andamento são HTML limpo no servidor (`Services/RichText.cs`, HtmlSanitizer) e
  desenhado no PDF por `Reports/RichTextPdf.cs`; o editor é TipTap.
- **PDF e planilhas:** QuestPDF em `Reports/` (relatório, certificado, termos). ClosedXML em `Spreadsheets/`;
  `SpreadsheetLayout.cs` é a fonte única do formato, usada para gerar e para ler. A importação só cria, nunca altera.
- **Enums** trafegam como string (`JsonStringEnumConverter`).

## Arquitetura do frontend (`frontend/src`)

- Sem framework de UI e sem biblioteca de estado. Páginas em `pages/`, componentes por área em `components/`,
  estado global só em `context/` (`AuthContext`, `ToastContext`).
- Toda chamada à API passa por `api/endpoints.ts` → `api/client.ts` (`http.request`/`http.download`): token em
  `localStorage` (`esf.token`), 401 dispara logout, erro vira `ApiError` com a mensagem do backend.
- `types/api.ts` espelha os DTOs à mão (enums como uniões de string): mudou um DTO, mude os dois lados. Rótulos dos
  enums e formatação de datas ficam em `utils/format.ts`.
- Permissões na tela: `useAuth()` → `canManage`, `isAdmin`, `isNational`.
- Janelas: `components/ui/Modal.tsx`. Janela de formulário nova recebe `guardChanges` (clique fora e Esc perguntam
  antes de descartar o que foi digitado). O texto do registro de andamento vira rascunho no aparelho
  (`utils/drafts.ts`, apagado no "Sair").
- Filtros, abas e visões ficam na query string da URL; links antigos são mantidos com redirecionamentos (ver README).
- CSS num arquivo só, `styles/globals.css`, com tokens em `:root`. No celular, tabelas viram cartões com as classes
  `table--cards`/`cell--*`; campos têm letra de 16px e 44px de altura (no iPhone, letra menor amplia a tela).
- Ícones em `components/ui/Icons.tsx` (SVG); os dos programas são Lucide, em `utils/programs.ts`.
- Partes pesadas são carregadas sob demanda (`lazy`): mapa Leaflet, quadro de tarefas (dnd-kit) e editor TipTap.
- Uso sem internet: `frontend/service-worker.js` vira `/sw.js` no build, por um plugin em `vite.config.ts` (só no build
  de produção, não no `npm run dev`); `offline/offline.ts` liga a faixa "Sem internet" pelo cabeçalho `X-Esf-Offline`.

## Nomes: código × interface

| No código | Na interface |
| --- | --- |
| `Activity`, tabela `Activities`, `/api/activities` | **Tarefa** (o nome mudou só na tela e no histórico) |
| `ActivityStatus.AFazer` | Não iniciada |
| `ActivityPriority.Alta` / `Media` | "Urgente" / normal (`Baixa` não é mais usada) |
| `ProjectUpdate`, `/api/projects/{id}/updates` | **registro** de andamento (aba "Andamento", ação "Registrar andamento") |
| `Organization` | núcleo |
| `ProjectProgram`, tabela `Programs` | programa |

- Há duas contas de horas que nunca se somam: horas gerais (dias como Ativo no `VolunteerStatusChange` × 6 h/semana) e
  horas lançadas por projeto (`ProjectHourEntry`).
- Indicador com valor vazio é "não informado", diferente de zero: não soma e não vai para o PDF. Os indicadores
  nacionais são obrigatórios em todo projeto.

## O que precisa andar junto

- Texto da política de privacidade em `pages/PrivacyPage.tsx` ↔ `Common/PrivacyTerms.CurrentVersion`. Mudar a versão
  obriga todos a aceitar de novo; não mude por simples troca de palavra.
- Cláusulas do termo de adesão ↔ `Reports/DocumentTemplates.VolunteerTermVersion`.
- Mudou um botão ou uma tela: confira a resposta correspondente em `pages/HelpPage.tsx`.
- Mudou comportamento: atualize o README.md.

## Testes e validação

- `backend/Esf.Api.Tests` (xUnit): os serviços são instanciados direto com o contexto e um `TestUser`
  (`ICurrentUser` com id, perfil e núcleo). Cobrem a separação entre núcleos, gestão nacional, acesso por link,
  planilhas, termo online, horas e certificado. Rode antes de mexer em consultas ou no `EsfDbContext`. Banco novo de
  teste sempre por `TestDatabase.CreateAsync()` (ou `TwoNucleos`), nunca `UseInMemoryDatabase` direto, senão o teste
  não roda no Postgres do CI.
- Na máquina, os testes usam EF InMemory, que não roda migrações nem funções do Postgres (`esf_fold`, `ILIKE`) e não
  confere FK, único nem tamanho. Com `ESF_TEST_POSTGRES` (o CI define) rodam num Postgres real: banco modelo migrado
  uma vez e uma cópia por teste. `[PostgresFact]` só roda assim. `LastMigrationMatchesTheModel` roda sempre e pega
  entidade mudada sem migração.
- CI (`.github/workflows/ci.yml`, a cada push): testes em memória e no Postgres 16, API subida como no deploy (banco
  vazio, migrações + demonstração) com `.github/scripts/smoke-api.sh` chamando as rotas principais por perfil, e
  typecheck + build do frontend. Rota ou tela nova importante: acrescente no script. Migração só conta como testada em
  Postgres depois do CI verde no commit; antes disso, diga que não foi.
- Frontend: typecheck, build e conferência no navegador em largura de computador e de celular.

## Convenções

- Comentários do código em português, sem acento. Texto visível (telas, PDFs, planilhas, mensagens de erro do
  `AppException` e dos atributos dos `Dtos/`) com acentuação correta. Logs ficam sem acento.
- `.editorconfig`: LF, 4 espaços em C#, 2 em TS/CSS/JSON.
- Commits no estilo Conventional Commits, em português sem acento, com escopo em português:
  `feat(tarefas): ...`, `fix(login): ...`. Quando um pedido é dividido em partes, numere: `feat(horas): 2/4 ...`.
  Branches `feat/...` e `fix/...` a partir da `main`.
