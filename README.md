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

O seed só roda quando o banco está vazio, então ele nunca sobrescreve dados reais.

---

## O que a aplicação faz

**Visão geral (dashboard)** — total de projetos, em andamento, em planejamento, concluídos, atrasados, atividades
pendentes, voluntários envolvidos, indicadores consolidados por nome, projetos ativos e próximos prazos.

**Projetos** — listagem com busca, filtros (status, categoria, só atrasados, incluir arquivados) e ordenação; criação,
edição, mudança de status, atualização de progresso, arquivamento e exclusão. Duas formas de visualizar: **lista**
(tabela) ou **quadro Kanban geral** (um card por projeto, colunas por status, arrastar e soltar para mudar o status).

**Detalhes do projeto** — abas de visão geral, atividades, voluntários, indicadores, fotos e documentos, e localização,
com geração de relatório do projeto em um clique.

**Atividades** — título, descrição, responsável, status (a fazer / em andamento / concluída), prioridade
(baixa / média / alta), prazo e observações, em lista com status editável inline.

**Andamento** — dentro da própria aba de Atividades: um relato de atualização (texto livre, com uma ou mais fotos
anexadas), com data e autor. Editável depois de publicado, e cada atualização pode ganhar novos anexos com o tempo.
É a linha do tempo de execução do projeto, separada das tarefas.

**Voluntários** — gestão das pessoas da organização: nome, contato, setor (Projetos, Jurídico, Pessoas, Comunicação,
Qualidade ou Financeiro), situação (ativo/inativo) e observações. A listagem mostra em quais projetos cada um está
vinculado, com filtro por setor e por situação. O vínculo com projetos (e o papel exercido em cada um) pode ser feito
tanto pela aba de voluntários de cada projeto quanto diretamente ao editar o voluntário, sempre entre projeto e
voluntário já cadastrados.

**Indicadores** — número simples de resultado por projeto (nome, valor e unidade, sem meta nem barra de progresso),
consolidado por nome no dashboard geral.

**Fotos e documentos** — envio por seleção ou arrastar e soltar, pré-visualização de imagens, download e exclusão.

**Localização** — endereço, bairro, cidade, estado e, quando houver coordenadas, mapa embutido (OpenStreetMap, sem chave de API).

**Relatórios** — seleção de um ou vários projetos, observação livre e geração de um **PDF consolidado** com
identificação, descrição, objetivo, período, status, responsável, localização, atividades, voluntários e
indicadores (sempre incluídos) e fotos (opcional).

**Configurações** — dados institucionais, logo, gestão de usuários e troca da própria senha.

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
| `Users` | acesso à plataforma (nome, e-mail, hash da senha, perfil, ativo) |
| `Projects` | dados do projeto, localização, datas, status, progresso, arquivamento |
| `Activities` | atividades do projeto (FK `ProjectId`, responsável opcional) |
| `Indicators` | indicadores do projeto (nome, valor e unidade) |
| `Volunteers` | cadastro de voluntários (inclui setor: Projetos, Juridico, Pessoas, Comunicacao, Qualidade ou Financeiro) |
| `ProjectVolunteers` | vínculo N:N projeto × voluntário, com papel no projeto |
| `ProjectFiles` | metadados dos arquivos enviados (o binário fica em disco); pode pertencer direto ao projeto ou a uma atualização |
| `ProjectUpdates` | relatos de andamento do projeto (texto, autor, data, editável) |
| `Organizations` | dados institucionais (registro único) |

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
| GET | `/api/projects` | lista com `search`, `status`, `category`, `onlyLate`, `includeArchived`, `sort` |
| GET | `/api/projects/categories` | categorias disponíveis |
| POST/GET/PUT/DELETE | `/api/projects[/{id}]` | CRUD de projetos |
| PATCH | `/api/projects/{id}/status` · `/progress` | mudança de status e progresso |
| POST | `/api/projects/{id}/archive` · `/unarchive` | arquivar e reativar |
| GET/POST | `/api/projects/{id}/activities` | atividades do projeto |
| PUT/PATCH/DELETE | `/api/activities/{id}[/status]` | edição, status e exclusão |
| GET | `/api/activities/upcoming` | próximos prazos pendentes |
| GET/POST/PUT/DELETE | `/api/volunteers[/{id}]` | cadastro de voluntários |
| GET/POST/DELETE | `/api/projects/{id}/volunteers[/{volunteerId}]` | vínculo com projetos |
| GET/POST | `/api/projects/{id}/indicators` | indicadores do projeto |
| PUT/DELETE | `/api/indicators/{id}` | edição e exclusão |
| GET/POST | `/api/projects/{id}/files` | arquivos do projeto (upload multipart) |
| GET/DELETE | `/api/files/{id}[/download]` | download e exclusão |
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
| **Usuário** | consultar tudo, criar e atualizar atividades, indicadores, arquivos, relatos de andamento, status e progresso |

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
| `Storage:UploadsPath` | `App_Data/uploads` | onde os arquivos são gravados |
| `Storage:MaxFileSizeMb` | 15 | tamanho máximo por arquivo |
| `Cors:AllowedOrigins` | localhost 5173/4173 | origens liberadas |
| `Seed:Enabled` | `true` | criar dados de demonstração em banco vazio |
| `Seed:DemoPassword` | `Esf@2026` | senha dos usuários de demonstração |

No frontend, `VITE_API_URL` só é necessário se a API não estiver atrás do proxy (Vite em desenvolvimento, nginx em Docker).

---

## Evolução prevista

- **V0 (esta versão)** — produto funcional, em uso, para validar o conceito com a equipe.
- **V1** — monólito modular com Clean Architecture e DDD, a partir das fronteiras já separadas aqui.
- **V2** — infraestrutura, observabilidade e escala.
- **V3** — processamento assíncrono/eventos, quando houver necessidade real.
- **V4** — extração de serviços, se e quando houver justificativa.

### Limites conhecidos desta V0

Assumidos de propósito, para serem revistos com base no uso real:

- arquivos em disco local (troca por armazenamento externo isolada em `FileStorageService`);
- sem paginação nas listagens (adequado à ordem de grandeza atual de projetos e voluntários);
- progresso do projeto informado manualmente, com o percentual de atividades concluídas exibido ao lado;
- permissões simples, sem granularidade por projeto;
- sem recuperação de senha por e-mail — a redefinição é feita por um administrador.
