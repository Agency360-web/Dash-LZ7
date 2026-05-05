
# SaaS de Gestão de Tráfego e Funil de Vendas (SDR)

Aplicação enterprise minimalista (estilo Linear/Stripe) para acompanhar investimento em Meta Ads, distribuição de leads entre vendedores e qualificação (agendamentos).

## Backend (Lovable Cloud / Supabase)

Habilitar Lovable Cloud e criar 3 tabelas via migration:

- **vendedores**: `id` (uuid pk), `nome` (text), `ativo` (bool default true), `created_at`.
- **gasto_diario**: `id` (uuid pk), `data` (date unique), `valor_investido` (numeric).
- **leads_vendedores**: `id` (uuid pk), `vendedor_id` (fk vendedores), `data` (date), `leads_totais` (int default 0), `leads_qualificados` (int default 0).

RLS habilitada nas três tabelas. Como o app não terá autenticação nesta fase inicial, as policies permitirão leitura/escrita pública (acesso via anon key) — observação clara para o usuário de que isso pode ser endurecido depois adicionando login.

## Layout Global

- Sidebar fixa esquerda (shadcn `Sidebar`, colapsável) com NavLinks + ícones Lucide:
  - Visão Geral (`/`) — `LayoutDashboard`
  - Lançamentos (`/lancamentos`) — `PlusCircle`
  - Equipe (`/equipe`) — `Users`
- Área principal `bg-slate-50`, conteúdo em cards `bg-white border-slate-200 rounded-lg`, padding `p-8`.
- Header superior com `SidebarTrigger` sempre visível.
- Tipografia Inter, texto principal `text-slate-900`, secundário `text-slate-500`, destaque `indigo-600`.
- Toasts via `sonner`. Skeletons durante loading. Hover suave em rows/buttons.

## Rota 1 — Dashboard `/`

- Header: "Visão Geral" + DateRangePicker global com presets (Hoje, 7 dias, Mês, Ano, Personalizado). Estado mantido em contexto/URL.
- 4 KPI Cards:
  1. Investimento Total — soma `gasto_diario.valor_investido` no range. Formato BRL.
  2. Leads Brutos — soma `leads_totais`.
  3. CPL — investimento / leads brutos. Se divisor 0 → "N/A".
  4. CPQ — investimento / leads qualificados. Se 0 → "N/A".
- Gráfico A (Recharts LineChart): "Evolução Investimento vs Agendamentos" — duas séries por dia (eixo Y duplo se necessário).
- Gráfico B (Recharts BarChart): "Performance por Vendedor" — agrupado, barras `Leads Totais` (slate-300) e `Leads Qualificados` (indigo-600).
- Recálculo instantâneo ao mudar range (React Query invalidation).

## Rota 2 — Lançamentos `/lancamentos`

Dois Cards lado a lado (grid responsivo):

**Card 1 — Investimento do Dia (Meta Ads)**
- DatePicker (data) + Input numérico R$ + Botão "Salvar Investimento".
- Upsert por `data` (overwrite se já existir, com confirmação Toast).

**Card 2 — Distribuição e Qualificação de Leads**
- DatePicker + Select de vendedores ativos + Inputs "Leads Recebidos" e "Agendamentos" + Botão "Registrar Leads".
- Insert (ou upsert por `vendedor_id + data`).

UX: Toast de sucesso/erro, limpa inputs mas mantém a data para múltiplos lançamentos consecutivos.

## Rota 3 — Equipe `/equipe`

- Header com botão "Adicionar Vendedor" (abre Dialog com campo Nome).
- Tabela shadcn: Nome | Status (Badge verde Ativo / cinza Inativo) | Ações (Switch ativar/inativar, ícone editar nome → Dialog).

## Lógica e Estado

- React Query para fetching/cache.
- Helper `formatBRL` e `safeDivide` para evitar NaN/Infinity.
- Tipos TypeScript gerados a partir do schema.
- Skeletons em KPIs, gráficos e tabela.

## Entrega em Fases

1. Estrutura: layout, sidebar, rotas, páginas com mock data e UI completa.
2. Backend: habilitar Cloud, migration das 3 tabelas + RLS.
3. Integração: hooks Supabase substituindo o mock, toasts, loading states.

## Detalhes Técnicos

- Stack: Vite + React + TS + Tailwind + shadcn/ui + Recharts + `@tanstack/react-query` + `date-fns` + Supabase client (via Lovable Cloud).
- Roteamento: React Router já configurado em `App.tsx`.
- Design tokens centralizados em `index.css` (tons slate + indigo) — substituir paleta padrão atual.

## Pontos em aberto

- Autenticação não foi solicitada — assumindo acesso aberto inicialmente. Posso adicionar login Supabase depois se desejar.
