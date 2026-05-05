import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { DollarSign, Users2, Target, ArrowDownNarrowWide, ChevronDown, ChevronRight, CornerDownRight, Search } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  LabelList,
} from "recharts";

import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { DateRangePicker, presetToRange, type Preset } from "@/components/DateRangePicker";
import { formatBRL, formatBRLOrNA, formatInt, safeDivide } from "@/lib/format";
import type { DateRange } from "react-day-picker";

const isoDay = (d: Date) => format(d, "yyyy-MM-dd");

function KpiCard({
  title,
  value,
  icon: Icon,
  loading,
  subtitle,
}: {
  title: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  loading?: boolean;
  subtitle?: string;
}) {
  return (
    <Card className="border-border">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-8 w-32" />
        ) : (
          <div className="text-2xl font-semibold tracking-tight text-foreground">{value}</div>
        )}
        {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const [preset, setPreset] = React.useState<Preset>("7d");
  const [range, setRange] = React.useState<DateRange | undefined>(presetToRange("7d"));
  const [searchQuery, setSearchQuery] = React.useState("");
  const [expandedCampanhas, setExpandedCampanhas] = React.useState<Set<string>>(new Set());

  const toggleExpand = (campanha: string) => {
    setExpandedCampanhas((prev) => {
      const next = new Set(prev);
      if (next.has(campanha)) next.delete(campanha);
      else next.add(campanha);
      return next;
    });
  };

  const onPresetChange = (p: Preset) => {
    setPreset(p);
    if (p !== "custom") setRange(presetToRange(p));
  };

  const from = range?.from ? isoDay(range.from) : undefined;
  const to = range?.to ? isoDay(range.to) : from;

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard", from, to],
    enabled: !!from && !!to,
    queryFn: async () => {
      const [metricasRes, leadsRes, vendedoresRes] = await Promise.all([
        supabase.from("metricas_campanhas").select("*").gte("data", from!).lte("data", to!),
        supabase
          .from("leads_vendedores")
          .select("*, vendedores(nome)")
          .gte("data", from!)
          .lte("data", to!),
        supabase.from("vendedores").select("*"),
      ]);
      if (metricasRes.error) throw metricasRes.error;
      if (leadsRes.error) throw leadsRes.error;
      if (vendedoresRes.error) throw vendedoresRes.error;
      return {
        metricas: metricasRes.data ?? [],
        leads: leadsRes.data ?? [],
        vendedores: vendedoresRes.data ?? [],
      };
    },
  });

  const investimento = (data?.metricas ?? []).reduce((s, m) => s + Number(m.investimento || 0), 0);
  const conversasTotal = (data?.metricas ?? []).reduce((s, m) => s + Number(m.conversas || 0), 0);
  const leadsBrutos = conversasTotal;
  const leadsQual = (data?.leads ?? []).reduce((s, l) => s + (l.leads_qualificados || 0), 0);
  const cpl = safeDivide(investimento, leadsBrutos);
  const taxaConversao = leadsBrutos > 0 ? (leadsQual / leadsBrutos) * 100 : 0;
  const custoConv = safeDivide(investimento, conversasTotal);

  // Chart A: por dia
  const dailyMap = new Map<string, { data: string; investimento: number; agendamentos: number; conversas: number }>();
  (data?.metricas ?? []).forEach((m) => {
    const k = m.data;
    const cur = dailyMap.get(k) ?? { data: k, investimento: 0, agendamentos: 0, conversas: 0 };
    cur.investimento += Number(m.investimento || 0);
    cur.conversas += Number(m.conversas || 0);
    dailyMap.set(k, cur);
  });
  (data?.leads ?? []).forEach((l) => {
    const k = l.data;
    const cur = dailyMap.get(k) ?? { data: k, investimento: 0, agendamentos: 0 };
    cur.agendamentos += l.leads_qualificados || 0;
    dailyMap.set(k, cur);
  });
  const lineData = Array.from(dailyMap.values())
    .sort((a, b) => a.data.localeCompare(b.data))
    .map((d) => ({ ...d, label: format(new Date(d.data + "T00:00:00"), "dd/MM") }));

  // Chart B: por vendedor
  const vendMap = new Map<string, { nome: string; totais: number; qualificados: number }>();
  (data?.vendedores ?? []).forEach((v) => vendMap.set(v.id, { nome: v.nome, totais: 0, qualificados: 0 }));
  (data?.leads ?? []).forEach((l) => {
    const cur = vendMap.get(l.vendedor_id);
    if (cur) {
      cur.totais += l.leads_totais || 0;
      cur.qualificados += l.leads_qualificados || 0;
    }
  });
  const barData = Array.from(vendMap.values()).filter((v) => v.totais > 0 || v.qualificados > 0);

  // Chart C: Agendamentos por Região
  const regiaoMap = new Map<string, { nome: string; agendamentos: number }>();
  ["Londrina", "Ponta Grossa", "Wenceslau Braz"].forEach(r => regiaoMap.set(r, { nome: r, agendamentos: 0 }));

  (data?.leads ?? []).forEach((l) => {
    const r = l.regiao || "Não informada";
    if (regiaoMap.has(r)) {
      regiaoMap.get(r)!.agendamentos += l.leads_qualificados || 0;
    } else if (r !== "Não informada" && r !== "Geral") {
      regiaoMap.set(r, { nome: r, agendamentos: l.leads_qualificados || 0 });
    }
  });

  const regiaoData = Array.from(regiaoMap.values()).filter(r => r.nome !== "Não informada" || r.agendamentos > 0);

  // Tabela: por campanha e conjunto
  type ConjuntoData = { nome: string; investimento: number; conversas: number };
  type CampanhaData = { campanha: string; investimento: number; conversas: number; conjuntos: Map<string, ConjuntoData> };

  const campMap = new Map<string, CampanhaData>();
  (data?.metricas ?? []).forEach((m) => {
    const k = m.campanha || "Geral";
    const conjName = m.conjunto || "Geral";

    const cur = campMap.get(k) ?? { campanha: k, investimento: 0, conversas: 0, conjuntos: new Map() };
    cur.investimento += Number(m.investimento || 0);
    cur.conversas += Number(m.conversas || 0);

    const conj = cur.conjuntos.get(conjName) ?? { nome: conjName, investimento: 0, conversas: 0 };
    conj.investimento += Number(m.investimento || 0);
    conj.conversas += Number(m.conversas || 0);
    cur.conjuntos.set(conjName, conj);

    campMap.set(k, cur);
  });

  const queryLower = searchQuery.toLowerCase();

  const campanhasData = Array.from(campMap.values())
    .map((c) => {
      const filteredConjuntos = Array.from(c.conjuntos.values())
        .map((cj) => ({ ...cj, custoPorConversa: safeDivide(cj.investimento, cj.conversas) }))
        .filter((cj) => cj.nome.toLowerCase().includes(queryLower) || c.campanha.toLowerCase().includes(queryLower))
        .sort((a, b) => b.investimento - a.investimento);
      return {
        ...c,
        custoPorConversa: safeDivide(c.investimento, c.conversas),
        conjuntosArr: filteredConjuntos,
      };
    })
    .filter((c) => c.conjuntosArr.length > 0)
    .sort((a, b) => b.investimento - a.investimento);

  const tableInvestimento = campanhasData.reduce((acc, c) => acc + c.investimento, 0);
  const tableConversas = campanhasData.reduce((acc, c) => acc + c.conversas, 0);
  const tableCustoConv = safeDivide(tableInvestimento, tableConversas);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Visão Geral</h1>
          <p className="text-sm text-muted-foreground">
            Métricas de investimento e funil de qualificação no período selecionado.
          </p>
        </div>
        <DateRangePicker
          preset={preset}
          onPresetChange={onPresetChange}
          range={range}
          onRangeChange={setRange}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KpiCard title="Investimento Total" value={formatBRL(investimento)} icon={DollarSign} loading={isLoading} subtitle={`${formatInt(conversasTotal)} conversas`} />
        <KpiCard title="Leads Brutos" value={formatInt(leadsBrutos)} icon={Users2} loading={isLoading} subtitle={`${formatInt(leadsQual)} agendamentos`} />
        <KpiCard title="Custo por Lead (CPL)" value={formatBRLOrNA(cpl)} icon={Target} loading={isLoading} />
        <KpiCard title="Taxa de Conversão" value={`${taxaConversao.toFixed(1).replace('.', ',')}%`} icon={ArrowDownNarrowWide} loading={isLoading} subtitle="Lead → Agendamento" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">Evolução: Investimento vs Agendamentos</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-72 w-full" />
            ) : lineData.length === 0 ? (
              <EmptyState text="Sem dados no período." />
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={lineData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis yAxisId="left" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis yAxisId="right" orientation="right" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    formatter={(value: number, name: string) =>
                      name === "Investimento" ? formatBRL(value) : formatInt(value)
                    }
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line yAxisId="left" type="monotone" dataKey="investimento" name="Investimento" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                  <Line yAxisId="right" type="monotone" dataKey="agendamentos" name="Agendamentos" stroke="hsl(215 25% 27%)" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">Performance por Vendedor</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-72 w-full" />
            ) : barData.length === 0 ? (
              <EmptyState text="Nenhum lead registrado no período." />
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={barData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="nome" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="qualificados" name="Agendamentos" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">Agendamentos por Região</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-72 w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={regiaoData} margin={{ top: 20, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="nome" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="agendamentos" name="Agendamentos" fill="hsl(150, 40%, 40%)" radius={[4, 4, 0, 0]}>
                    <LabelList dataKey="agendamentos" position="top" fill="hsl(var(--foreground))" fontSize={12} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Seção Campanhas Ativas */}
      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-base font-semibold">Campanhas Ativas — Meta Ads</CardTitle>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Buscar campanha ou conjunto..."
              className="pl-8"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : campanhasData.length === 0 ? (
            <EmptyState text="Nenhuma campanha encontrada no período selecionado." />
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Campanha</TableHead>
                    <TableHead className="text-right">Investimento</TableHead>
                    <TableHead className="text-right">Conversas</TableHead>
                    <TableHead className="text-right">Custo por Conversa</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {campanhasData.map((c) => {
                    const isExpanded = expandedCampanhas.has(c.campanha);
                    const hasConjuntos = c.conjuntosArr.length > 0 && !(c.conjuntosArr.length === 1 && c.conjuntosArr[0].nome === "Geral");

                    return (
                      <React.Fragment key={c.campanha}>
                        <TableRow 
                          className={`cursor-pointer transition-colors hover:bg-muted/50 ${hasConjuntos ? "bg-muted/10" : ""}`}
                          onClick={() => hasConjuntos && toggleExpand(c.campanha)}
                        >
                          <TableCell className="font-medium flex items-center gap-2">
                            {hasConjuntos ? (
                              isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <div className="w-4" />
                            )}
                            {c.campanha}
                          </TableCell>
                          <TableCell className="text-right">{formatBRL(c.investimento)}</TableCell>
                          <TableCell className="text-right">{formatInt(c.conversas)}</TableCell>
                          <TableCell className="text-right">{formatBRLOrNA(c.custoPorConversa)}</TableCell>
                        </TableRow>
                        
                        {isExpanded && hasConjuntos && c.conjuntosArr.map((cj) => (
                          <TableRow key={`${c.campanha}-${cj.nome}`} className="bg-transparent hover:bg-transparent">
                            <TableCell className="pl-8 text-sm text-muted-foreground flex items-center gap-2 py-2 border-b-0">
                              <CornerDownRight className="h-4 w-4 opacity-50" />
                              {cj.nome}
                            </TableCell>
                            <TableCell className="text-right text-sm py-2 text-muted-foreground border-b-0">{formatBRL(cj.investimento)}</TableCell>
                            <TableCell className="text-right text-sm py-2 text-muted-foreground border-b-0">{formatInt(cj.conversas)}</TableCell>
                            <TableCell className="text-right text-sm py-2 text-muted-foreground border-b-0">{formatBRLOrNA(cj.custoPorConversa)}</TableCell>
                          </TableRow>
                        ))}
                      </React.Fragment>
                    );
                  })}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell>Total</TableCell>
                    <TableCell className="text-right">{formatBRL(tableInvestimento)}</TableCell>
                    <TableCell className="text-right">{formatInt(tableConversas)}</TableCell>
                    <TableCell className="text-right">{formatBRLOrNA(tableCustoConv)}</TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex h-72 items-center justify-center text-sm text-muted-foreground">
      {text}
    </div>
  );
}