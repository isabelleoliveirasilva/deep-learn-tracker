# Study Flow

PRD — App de Controle de Frequência de Estudos

1. Objetivo do Produto

Aplicação web para o usuário registrar e acompanhar sua rotina de estudos: matérias estudadas, método utilizado, tempo dedicado, datas, se fez resumo e/ou revisão do conteúdo, e desempenho em questões/simulados (número de acertos e total). O produto deve permitir visualizar a frequência de estudo ao longo do tempo e o histórico por matéria.

2. Stack Técnica

Backend/Banco de dados: Supabase (Postgres). O agente deve modelar as tabelas conforme especificado na Seção 4.

UI: shadcn/ui para os componentes.

Fora de escopo nesta etapa: autenticação de usuários e configuração de conexão com o banco. Modelar as tabelas já prevendo uma coluna user_id (uuid, nullable por enquanto) para facilitar a adição de auth/RLS no futuro, mas não implementar login, sessão ou proteção de rotas agora.

3. Entidades e Modelo de Dados

3.1 subjects (matérias)

Campo Tipo Regras id uuid (PK, default gen_random_uuid()) — user_id uuid, nullable reservado para uso futuro com auth name text, not null único por usuário (case-insensitive); ex.: "Português", "Matemática" color text, nullable cor hex usada para identificar a matéria em gráficos/listas; se não informado, atribuir automaticamente uma cor de uma paleta fixa, em ordem de criação created_at timestamptz, default now() —

Regra de negócio: matérias são criadas de duas formas — (a) pré-cadastradas/seed inicial com uma lista comum (Português, Matemática, História, Geografia, Física, Química, Biologia, Inglês, Redação — o agente pode ajustar essa lista padrão), e (b) criadas pelo usuário ad-hoc dentro do modal de nova sessão, ao digitar um nome que não existe na lista.

3.2 study_sessions (sessões de estudo)

Campo Tipo Regras id uuid (PK, default gen_random_uuid()) — user_id uuid, nullable reservado para uso futuro com auth subject_id uuid, FK → subjects.id, not null on delete restrict (ver caso extremo 5.4) session_date date, not null não pode ser data futura duration_minutes integer, not null > 0; input do usuário em horas/minutos, convertido para minutos ao salvar study_method text, nullable valor de uma lista fixa: leitura, videoaula, exercicios, flashcards, aula_ao_vivo, outro. Se outro, permitir texto livre em campo auxiliar study_method_other made_summary boolean, not null, default false checkbox "fez resumo" made_review boolean, not null, default false checkbox "fez revisão" practice_type text, not null, default 'none' enum: none, questions, simulado questions_total integer, nullable obrigatório se practice_type != none; > 0 questions_correct integer, nullable obrigatório se practice_type != none; >= 0 e <= questions_total notes text, nullable campo livre opcional created_at timestamptz, default now() — updated_at timestamptz, default now() atualizado a cada edição

Observação: practice_type = 'questions' representa "resolveu N questões" e practice_type = 'simulado' representa um simulado completo — estruturalmente usam os mesmos campos (questions_total/questions_correct), diferenciando-se apenas na rotulagem exibida na UI ("X questões" vs. "Simulado: X/Y").

3.3 Campos derivados (calculados, não persistidos)

accuracy_rate = questions_correct / questions_total (quando practice_type != 'none').

Frequência semanal/mensal por matéria: agregações sobre study_sessions (contagem de sessões e soma de duration_minutes agrupadas por subject_id e por período).

4. Funcionalidades

4.1 Home / Dashboard

Componentes:

Gráfico de frequência

Entrada: todas as study_sessions do usuário.

Eixo X: data (agrupado por dia; se o período visualizado for muito longo — acima de 60 dias — agrupar por semana).

Eixo Y: minutos estudados no período (soma de duration_minutes).

Filtro padrão: últimos 30 dias. Permitir troca para 7 dias / 30 dias / 90 dias / tudo.

Estado vazio: se não houver nenhuma sessão, exibir mensagem "Nenhum estudo registrado ainda" com CTA para abrir o modal de nova sessão.

Tabela "Últimas matérias"

Mostra as 5 matérias com sessão mais recente, uma linha por matéria (não uma linha por sessão).

Colunas: Matéria, Data da última sessão, Tempo total estudado (soma de todas as sessões daquela matéria), Última prática (ex.: "Simulado 8/10" ou "12 questões" ou "—" se practice_type = none), Resumo/Revisão feitos na última sessão (ícones ou texto).

Ordenação: por session_date da sessão mais recente de cada matéria, decrescente.

Se houver menos de 5 matérias com sessões registradas, mostrar apenas as existentes.

Cada linha é clicável e leva à página de frequência filtrada por aquela matéria (ver 4.3).

Botão "Nova sessão de estudo" — visível no topo do Dashboard, abre o modal descrito em 4.2.

4.2 Modal "Nova sessão de estudo"

Campos de entrada (nesta ordem):

Matéria — combobox com busca. Lista as matérias existentes (subjects); se o texto digitado não corresponder a nenhuma matéria existente, exibir opção "Criar matéria: '{texto}'" que cria um novo registro em subjects ao ser selecionada.

Data — date picker, padrão = hoje, não permite datas futuras.

Tempo de estudo — input de horas e minutos (ou minutos totais), > 0.

Método de estudo — select com as opções da lista fixa (ver 3.2); se "outro", exibir campo de texto livre.

Checkbox "Fiz um resumo do conteúdo" → made_summary.

Checkbox "Fiz revisão do conteúdo" → made_review.

Prática (opcional) — seletor com 3 estados: "Nenhuma" / "Questões resolvidas" / "Simulado".

Se "Questões resolvidas" ou "Simulado": exibir dois campos numéricos — "Total de questões" e "Acertos". Validar acertos <= total e ambos > 0 (total) e >= 0 (acertos).

Observações — textarea opcional.

Ações:

Botão "Salvar" — valida os campos obrigatórios (matéria, data, tempo > 0; se prática != nenhuma, total e acertos válidos) e insere um registro em study_sessions. Fecha o modal e atualiza Dashboard/lista sem reload de página.

Botão "Cancelar" — fecha sem salvar.

Saída: novo registro em study_sessions, refletido imediatamente no Dashboard (gráfico e tabela) e na página de frequência por matéria.

4.3 Página "Frequência por matéria"

Lista todas as matérias (subjects) com estatísticas agregadas: tempo total estudado, número de sessões, % de resumos feitos, % de revisões feitas, taxa média de acerto em questões/simulados (quando houver prática registrada).

Ao selecionar uma matéria, exibir o histórico de sessões daquela matéria em ordem cronológica decrescente, com todos os campos capturados no modal (data, tempo, método, resumo/revisão, prática e resultado, observações).

Cada sessão listada deve permitir edição (reabre o modal da seção 4.2 preenchido) e exclusão (com confirmação).

Suporta o mesmo botão "Nova sessão de estudo" do Dashboard, pré-selecionando a matéria caso a página já esteja filtrada por uma.

5. Fluxos Principais

Registrar sessão de estudo: usuário clica em "Nova sessão de estudo" → preenche o modal → salva → sessão é persistida → Dashboard e página de frequência são atualizados.

Criar matéria durante o cadastro: usuário digita nome inexistente no campo Matéria → seleciona "Criar matéria" → matéria é criada e automaticamente selecionada no formulário → fluxo de salvar sessão continua normalmente.

Consultar progresso geral: usuário abre o Dashboard → visualiza gráfico de frequência e tabela das 5 últimas matérias estudadas.

Consultar progresso por matéria: usuário acessa a página de frequência → seleciona uma matéria → visualiza estatísticas agregadas e histórico completo de sessões.

Editar/excluir sessão: usuário localiza a sessão na página de frequência por matéria → edita ou exclui → dados agregados e gráficos são recalculados.

6. Casos Extremos e Regras de Validação

5.1. Tempo de estudo inválido: bloquear envio se duration_minutes <= 0; exibir erro no campo.

5.2. Acertos maiores que o total: bloquear envio se questions_correct > questions_total; exibir erro.

5.3. Matéria duplicada: ao criar matéria, comparar nome de forma case-insensitive e ignorando espaços extras; se já existir, reaproveitar a matéria existente em vez de criar duplicata.

5.4. Exclusão de matéria com sessões vinculadas: por padrão, impedir a exclusão de uma matéria que possua study_sessions associadas; exibir aviso explicando que é necessário remover ou reatribuir as sessões antes. (Reatribuição de sessões para outra matéria é uma melhoria futura, não obrigatória nesta versão.)

5.5. Data futura: o campo de data não deve aceitar valores posteriores ao dia atual.

5.6. Nenhuma sessão registrada (estado vazio): Dashboard, gráfico e tabela devem exibir estados vazios amigáveis em vez de gráficos quebrados ou tabelas em branco sem contexto.

5.7. Menos de 5 matérias com histórico: a tabela de "últimas matérias" deve exibir apenas as matérias existentes, sem preencher linhas vazias.

5.8. Prática marcada sem números preenchidos: se o usuário selecionar "Questões resolvidas" ou "Simulado" mas não preencher total/acertos, bloquear o salvamento até que os campos sejam preenchidos ou a prática seja revertida para "Nenhuma".

5.9. Método de estudo "outro" sem texto: se selecionado "outro" e o campo de texto livre estiver vazio, bloquear envio.

5.10. Edição de sessão: ao editar, todas as validações acima se aplicam da mesma forma que na criação; o campo updated_at deve ser atualizado.

7. Design

Todos os componentes de UI (botões, modais, inputs, selects, checkboxes, tabelas, comboboxes) devem usar shadcn/ui.

Tokens de estilização específicos (cores, tipografia, espaçamentos) não foram fornecidos nesta versão do PRD — o agente deve usar o tema padrão do shadcn (incluindo suporte a modo claro/escuro) até que tokens customizados sejam especificados.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://deep-learn-tracker.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/aeec9e8d-ed11-4179-b239-dc807047418b).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
