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

O seed só roda quando o banco está vazio, então ele nunca sobrescreve dados reais. A tela de login lista esses acessos
e já vem preenchida com o do administrador, para facilitar a demonstração.

---

## O que a aplicação faz

**Início** — o que a pessoa logada tem para fazer. Abaixo do "Olá", uma linha com as tarefas dela (em aberto,
atrasadas, bloqueadas). **Minhas tarefas** agrupa por prazo (atrasadas, próximos 7 dias, depois, sem prazo; até 8, o
resto em Tarefas): a caixinha conclui na hora e clicar abre a tarefa ali mesmo. Ao lado, **Meus projetos** (os em
planejamento ou andamento em que a pessoa é responsável ou está na equipe, com progresso, último relato e o botão
**Registrar**, que abre o projeto já no registro de andamento), **Avisos recentes** (os 3 últimos do sininho) e os
**aniversariantes** dos últimos 10 dias e dos próximos 30. Sem voluntário vinculado, explica como pedir o vínculo. Para
a coordenação, entram também a faixa **Na organização** (tarefas atrasadas, bloqueadas, sem responsável e projetos
parados, isto é, em andamento sem relato há mais de 30 dias; cada número abre a lista filtrada) e **Quem está mais
carregado** (cada pessoa leva às tarefas dela).

**Projetos** — listagem com busca, filtros (status, só atrasados, incluir arquivados; o programa é a aba escolhida)
e ordenação. Cada linha mostra programa, status, responsável, progresso e **último relato**; editar, arquivar/reativar
e excluir ficam no menu **⋯** da linha. Vindo do Início, `?parados=1` mostra só os projetos em andamento sem relato há
mais de 30 dias. Busca, filtros, ordenação e visão ficam na URL, então voltar de um projeto (ou recarregar) mantém a
lista como estava. O **progresso** é calculado pelas tarefas concluídas (projeto concluído conta como 100%). O **novo
projeto** pede só o essencial (nome, programa, responsável, data de início e endereço; começa em planejamento); o resto
(descrição, objetivo, comunidade, público, previsão de término, status, observações) fica em Editar projeto.

**Mapa dos projetos** — em Projetos, a alternância **Lista | Mapa** mostra os projetos num mapa do OpenStreetMap
(gratuito, sem chave), com os mesmos filtros da lista. Cada pino tem o ícone e a cor do programa; clicar mostra nome,
programa, status e local, e o nome leva ao projeto. Embaixo ficam a legenda dos programas e quantos projetos ainda não
têm localização (com a lista deles). Para marcar o local, o projeto tem **"Marcar no mapa"** (no novo projeto e em
Editar projeto, no lugar das coordenadas digitadas): o mapa busca o endereço do formulário no OpenStreetMap (Nominatim,
só quando a pessoa clica em Buscar), aceita um clique no lugar certo e o pino pode ser arrastado; "Remover localização"
apaga o ponto. Em Sobre, "Ver no mapa" abre o mapa já centrado no projeto. O mapa (Leaflet) só é baixado quando é
aberto.

**Programas** — a tela Projetos é organizada por programa: no topo, uma aba para **Todos** e uma por programa (com
ícone, cor e número de projetos) e, para a coordenação, **+ Novo programa**. Em **Todos** aparece um cartão por
programa (projetos em andamento e concluídos e os resultados); escolhendo um programa aparece a **visão do programa**:
números (em andamento, concluídos) e os **resultados somados** — cada indicador padrão do modelo somado nos projetos
não arquivados do programa, comparando os nomes sem diferenciar maiúsculas nem acentos —, mais, para a coordenação,
**Modelo do programa**, **Editar** (nome, ícone e cor) e arquivar/reativar ou excluir (só sem projetos). A lista
embaixo mostra só os projetos daquele programa, e "Novo projeto" já vem com ele escolhido. Os endereços antigos
(`/programas`, `/programas/{id}` e `/configuracoes?aba=programas`) levam para cá; no topo de cada projeto, o nome do
programa abre a aba dele.

**Modelo do programa** — em Projetos › programa › "Modelo do programa" (`/programas/{id}/modelo`): **atividades padrão** (título, prioridade, descrição e
prazo opcional em dias após o início do projeto; sem prazo por padrão), **indicadores padrão** (nome e unidade) e
**textos sugeridos** (descrição, objetivo e público beneficiado). A coordenação inclui, edita, reordena e remove; cada
mudança grava na hora e não altera projetos que já existem. Ao criar um projeto de um programa com modelo, o formulário
mostra "Usar o modelo do programa" (já marcado, com o resumo do que será criado): as atividades entram sem responsável,
com o prazo contado da data de início, os indicadores entram zerados e os textos preenchem o que ficou em branco. Os
cards dos programas mostram o resumo do modelo ("Modelo: 5 atividades · 2 indicadores" ou "Sem modelo").

**Menu** — Início · Projetos · Tarefas · Voluntários · Relatórios · Configurações. Configurações aparece só para a
coordenação; o voluntário comum chega na própria conta pelo menu do avatar (e a lista de acessos, com e-mails, deixou
de ser visível para ele).

**Tarefas** — todas as tarefas dos projetos em planejamento ou em andamento, em **Lista** (agrupada por prazo:
vencidas, próximos 7 dias, depois e sem prazo; a caixinha conclui e o título abre a tarefa) ou **Quadro** (o kanban
abaixo). **Minhas | Todas** (o voluntário começa nas dele; a coordenação, em todas), busca e filtros de programa,
projeto e responsável, todos na URL. Atalhos com contagem: Atrasadas, Bloqueadas, Sem responsável e Concluídas nos
últimos 30 dias. Links antigos do quadro (`/projetos?visao=quadro`) levam para cá com os mesmos filtros.

**Quadro (em Tarefas)** — kanban com as atividades de todos os projetos em planejamento ou em andamento (não
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

**Janela da tarefa** — clicar numa tarefa, em qualquer lugar (Início, Tarefas, quadro, aba Tarefas do projeto,
avisos, busca), abre a janela dela **para ler**: status (muda na hora; bloquear pergunta o motivo), prioridade,
responsável, prazo, projeto, descrição e observações; ao lado (embaixo, no celular), **checklist** (itens para marcar,
com barra de progresso; incluir com Enter, remover no ×), **anexos** (vários arquivos de uma vez; imagens em miniatura)
e comentários. **Editar** troca para o formulário (Cancelar volta para a leitura); "Editar" no menu ⋯ da aba do projeto
abre direto no formulário. Status, checklist, anexos e comentários gravam na hora, sem depender do "Salvar". Os anexos
também aparecem na aba Arquivos do projeto, com o selo "da tarefa …"; excluir a tarefa mantém o arquivo no projeto. O
card do quadro e as listas mostram o resumo (`☑ 3/5 · 📎 1 · 💬 2`), verde quando o checklist está completo. Links
antigos (`?aba=atividades&atividade=…`) continuam abrindo a tarefa.

**Comentários nas atividades** — na mesma janela, abaixo do checklist e dos anexos: a conversa do dia a dia sobre a
atividade (não vai para o relatório, ao contrário dos relatos de Andamento). Digitar **@** abre a lista de pessoas com
acesso (a equipe do projeto primeiro, sem diferenciar acentos) e escolher insere o nome; Ctrl+Enter envia. Quem
escreveu edita (aparece "(editado)") e apaga o próprio comentário; a coordenação também apaga os dos outros. Avisos no
sininho: quem foi mencionado ("Ana mencionou você em…") e, num comentário novo, o responsável pela atividade ("Ana
comentou em…"); na edição, só quem foi mencionado agora. Todo aviso de atividade (atribuição, bloqueio, prazo,
comentário) abre direto a janela daquela atividade. O resumo nos cards ganha o contador de comentários.

**Busca geral** — campo fixo no topo de todas as telas (no celular, a lupa abre a busca ocupando a largura da tela);
**Ctrl+K** (⌘K no Mac) leva o cursor até ele. Procura ao mesmo tempo em projetos (nome, comunidade, bairro, cidade),
atividades (título e descrição), voluntários, programas e relatos de andamento, sem diferenciar maiúsculas nem acentos
("joao" acha "João"), e mostra até 5 de cada tipo, agrupados. Setas escolhem e Enter abre; uma atividade abre direto
na janela dela. Voluntários anonimizados, documentos assinados e o histórico de alterações ficam de fora. No banco, a
comparação usa a função `esf_fold` (criada pela migração, sem depender de extensão do Postgres).

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

**Termo de adesão e uso de imagem** — na página do voluntário, a coordenação (administrador e coordenador) gera o
termo em PDF, num documento só: adesão ao serviço voluntário (Lei 9.608/98) e autorização de uso de imagem, já com o
nome do voluntário e os dados da organização (CPF, RG e endereço ficam em branco, para preencher à mão — a plataforma
não guarda esses dados). Depois de assinado, envia a cópia (PDF, JPG ou PNG) com a data da assinatura, e a página
mostra "Assinado em dd/mm/aaaa". Na lista de voluntários, ativos e afastados sem termo ganham o selo "Termo
pendente", com o filtro "Só com termo pendente". Os documentos assinados não ficam em `/uploads`: só abrem pelo
download com login da coordenação. Quem assina pela organização (nome e cargo) é configurado em Configurações ›
Organização.

**Anonimizar voluntário** — na lista, a coordenação usa "Anonimizar" no lugar de excluir (quando a pessoa sai da
organização ou pede a exclusão dos dados): nome vira "Voluntário removido", saem e-mail, telefone, habilidades,
observações, aniversário e foto, a situação passa a ex-membro, o acesso vinculado é desfeito e os avisos da pessoa
são apagados. Projetos, atividades e documentos assinados continuam, sem identificar a pessoa, e o cadastro não pode
mais ser editado. A exclusão definitiva continua na API, só para administrador.

**Certificado de voluntariado** — na página do voluntário, "Gerar certificado" (coordenação) pede o período, as horas
por semana (6 por padrão) e, se quiser, o CPF, que só vai para o PDF e não fica salvo. O certificado sai em A4 deitado,
no modelo da organização: nome e CNPJ, CPF, o nome do voluntário em destaque, o período por extenso e o total de horas
— semanas do período (contando o primeiro e o último dia) vezes a carga semanal, arredondado para baixo; de 07/10 a
31/12/2025, com 6 h/semana, são 73 horas. Embaixo vão a assinatura (imagem enviada em Configurações › Organização, que
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

**Indicadores** — número simples de resultado por projeto (nome, valor e unidade, sem meta nem barra de progresso),
consolidado por nome no dashboard geral.

**Arquivos** — um lugar só para todos os arquivos do projeto, inclusive as fotos publicadas no Andamento (marcadas com
a data da atualização). Envio de um ou vários arquivos por seleção ou arrastar e soltar, legenda editável em qualquer
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
identificação, descrição, objetivo, período, status, responsável, localização, atividades, voluntários e
indicadores (sempre incluídos) e fotos (opcional).

**Configurações** — dados institucionais, logo, gestão de usuários e troca da própria senha. No formulário de
projeto, o botão "Novo" ao lado do Programa cria um programa num diálogo por cima, já escolhido ao salvar. A aba
aberta fica na URL (`?aba=organizacao`, `usuarios`, `historico` ou `conta`).

**Privacidade (LGPD)** — a política de privacidade e os termos de uso ficam em `/privacidade`, aberta a qualquer pessoa
(link na tela de login). No primeiro acesso, e de novo sempre que o texto muda, uma janela pede o aceite antes de usar
a plataforma; a data e a versão aceita ficam registradas. Para publicar uma nova versão, atualize o texto em
`pages/PrivacyPage.tsx` e a data em `PrivacyTerms.CurrentVersion` (API).

**Histórico de alterações** — toda criação, alteração ou exclusão feita por uma pessoa logada (projetos, atividades,
relatos, arquivos, indicadores, equipe, voluntários, histórico de status, documentos assinados, programas, usuários e dados da organização)
fica registrada automaticamente, com quem fez, quando e o valor antes e depois de cada campo. Em Configurações ›
Histórico (só administradores) a lista aparece em frases ("Ana alterou a atividade…"), com filtros por projeto, pessoa,
tipo e período, 50 por vez. Dados pessoais do cadastro de voluntário (nome, contatos, aniversário, observações, foto) só
registram que mudaram, sem o valor, e nomes de voluntários são resolvidos na hora de exibir — quem for anonimizado
aparece como "Voluntário removido" também no histórico. Senhas nunca entram. O que não vem de uma pessoa (dados de
demonstração, rotinas internas) não é registrado.

**Proteção do login** — depois de 10 senhas erradas seguidas, o acesso fica bloqueado por 15 minutos (nem a senha
certa entra nesse tempo, e a mensagem não diz se a senha estava certa); um acerto antes disso zera a contagem, e a
senha redefinida por um administrador libera o acesso na hora. Os campos de texto livre (observações e relatos) lembram
de não registrar dados sensíveis (saúde, religião, origem, opinião política) nem CPF.

**Topo da tela** — clicar na foto e no nome abre o menu da conta: **Meu perfil** (a página do voluntário vinculado ao
acesso; não aparece sem vínculo), **Minha conta** (Configurações › Minha conta) e **Sair**. Ao lado fica o **sininho**
de avisos, com a quantidade de não lidos: clicar abre a lista (todos os não lidos, destacados, e os lidos mais recentes
completando 15 itens; cada aviso com o projeto e há quanto tempo), e abrir um aviso o marca como lido e leva à aba
Atividades do projeto (ou ao projeto); há também "Marcar todas como lidas". Avisos lidos somem depois de 30 dias; os não
lidos ficam até 60, para quem passou um tempo sem entrar não perder nada. Os avisos são do voluntário vinculado ao acesso: atividade atribuída a você; sua atividade
bloqueada (com o motivo), concluída ou reaberta por outra pessoa; entrada na equipe de um projeto; definição como
responsável por um projeto; e atividade sua que vence amanhã ou hoje (o lembrete some quando ela é concluída). Ninguém
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
| `Programs` | programas (nome, situação, ícone, cor e os textos sugeridos do modelo) |
| `ProgramTemplateActivities` / `ProgramTemplateIndicators` | atividades e indicadores padrão do modelo de cada programa |
| `Activities` | atividades do projeto (FK `ProjectId`, responsável opcional) |
| `ActivityChecklistItems` | itens do checklist de cada atividade (texto, feito, ordem) |
| `ActivityComments` | comentários das atividades (autor, texto, voluntários mencionados, edição) |
| `Indicators` | indicadores do projeto (nome, valor e unidade) |
| `Volunteers` | cadastro de voluntários (inclui setor: Projetos, Juridico, Pessoas, Comunicacao, Qualidade ou Financeiro) |
| `VolunteerStatusChanges` | histórico de status dos voluntários (a partir de que dia valeu cada situação), base das horas de voluntariado |
| `ProjectVolunteers` | vínculo N:N projeto × voluntário, com papel no projeto |
| `ProjectFiles` | metadados dos arquivos enviados (o conteúdo fica em `StoredFiles`); pode pertencer direto ao projeto ou a uma atualização |
| `ProjectUpdates` | relatos de andamento do projeto (texto, autor, data, editável) |
| `Organizations` | dados institucionais (registro único) |
| `StoredFiles` | conteúdo dos arquivos enviados (fotos, documentos, logo), servido em `/uploads/{nome}`; os documentos assinados são privados e não saem por lá |
| `SignedDocuments` | termos de adesão de voluntários e autorizações de uso de imagem de projetos (arquivo assinado e data) |
| `AuditEntries` | histórico de alterações: quem fez, quando, o quê e os campos alterados (antes e depois) |
| `Notifications` | avisos do sininho para cada voluntário (atribuição, bloqueio, conclusão, reabertura, equipe, responsável, prazos de hoje/amanhã, menção e comentário), com data de leitura; os lidos são apagados após 30 dias e os não lidos após 60 |

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
| POST | `/api/auth/accept-terms` | registra o aceite da política de privacidade e dos termos de uso (versão vigente) |
| GET | `/api/dashboard` | números e listas da visão geral |
| GET | `/api/projects` | lista com `search`, `status`, `programId`, `onlyLate`, `onlyStale`, `includeArchived`, `sort` |
| GET/POST | `/api/programs` | lista e cria programas (agrupamento de projetos; `onlyActive=false` inclui os arquivados) |
| GET/PUT/DELETE | `/api/programs/{id}` | programa com contagens de projetos e resultados somados; edita nome, ícone e cor e arquiva/reativa; exclui só programa sem projetos |
| GET/PUT | `/api/programs/{id}/template` | modelo do programa (PUT grava o modelo inteiro; coordenação) |
| GET/POST | `/api/volunteers/{id}/documents` | termos assinados do voluntário (coordenação); `/template` gera o termo em PDF |
| GET/POST | `/api/projects/{id}/documents` | autorizações de uso de imagem do projeto (coordenação); `/template` gera o termo em PDF |
| POST | `/api/volunteers/{id}/certificate` | certificado de voluntariado em PDF (período, horas por semana e CPF opcional, que não é guardado) |
| POST/DELETE | `/api/organization/signature` | imagem da assinatura usada nos certificados (privada) |
| GET | `/api/audit` | histórico de alterações (só administradores), com filtros por projeto, pessoa, tipo e período |
| GET/DELETE | `/api/documents/{id}/download` · `/api/documents/{id}` | baixa (com login) ou remove um documento assinado |
| POST/GET/PUT/DELETE | `/api/projects[/{id}]` | CRUD de projetos (na criação, `useTemplate` aplica o modelo do programa) |
| PATCH | `/api/projects/{id}/status` | mudança de status |
| POST | `/api/projects/{id}/archive` · `/unarchive` | arquivar e reativar |
| GET/POST | `/api/projects/{id}/activities` | atividades do projeto |
| PUT/PATCH/DELETE | `/api/activities/{id}[/status]` | edição, status e exclusão |
| GET | `/api/activities/upcoming` | próximos prazos pendentes (`mine=true`: só os do usuário logado) |
| GET | `/api/activities/board` | quadro de atividades: projetos em planejamento ou em andamento, concluídas dos últimos 30 dias |
| GET | `/api/activities/{id}/details` | checklist, anexos e comentários da atividade |
| POST · PUT/DELETE | `/api/activities/{id}/checklist` · `/api/checklist/{itemId}` | inclui, marca/reescreve e remove itens do checklist |
| GET | `/api/activities/{id}/mentionable` | quem pode ser mencionado com @ (equipe primeiro) |
| GET | `/api/search?q=` | busca geral (projetos, atividades, voluntários, programas e relatos; mínimo 2 letras) |
| POST · PUT/DELETE | `/api/activities/{id}/comments` · `/api/comments/{commentId}` | comenta; edita (autor) e apaga (autor ou coordenação) |
| GET | `/api/notifications` · `/unread` | avisos do usuário logado (todos os não lidos, até 50, e os lidos completando 15) e a quantidade de não lidos |
| POST | `/api/notifications/{id}/read` · `/read-all` | marcar um aviso, ou todos, como lido |
| GET/POST/PUT | `/api/volunteers[/{id}]` | cadastro de voluntários (DELETE, exclusão definitiva, só administrador) |
| POST | `/api/volunteers/{id}/anonymize` | anonimiza os dados pessoais e mantém o histórico (LGPD) |
| POST/DELETE | `/api/volunteers/{id}/photo` | troca ou remove a foto do voluntário (imagem já recortada) |
| GET | `/api/volunteers/{id}/hours` | horas de voluntariado; o histórico de status só vem para a coordenação e para o próprio voluntário |
| POST/PUT/DELETE | `/api/volunteers/{id}/status-history[/{periodId}]` | inclui, edita ou remove um período do histórico de status (coordenação) |
| GET/POST/DELETE | `/api/projects/{id}/volunteers[/{volunteerId}]` | vínculo com projetos |
| GET/POST | `/api/projects/{id}/indicators` | indicadores do projeto |
| PUT/DELETE | `/api/indicators/{id}` | edição e exclusão |
| GET/POST | `/api/projects/{id}/files` | arquivos do projeto (upload multipart; com `activityId`, anexo de uma atividade) |
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