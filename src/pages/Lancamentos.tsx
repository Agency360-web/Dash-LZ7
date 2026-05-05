import * as React from "react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, MoreHorizontal, Pencil, Trash } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

const isoDay = (d: Date) => format(d, "yyyy-MM-dd");

function DateField({ value, onChange }: { value: Date; onChange: (d: Date) => void }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className={cn("w-full justify-start text-left font-normal bg-card")}>
          <CalendarIcon className="mr-2 h-4 w-4" />
          {format(value, "PPP", { locale: ptBR })}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={value}
          onSelect={(d) => d && onChange(d)}
          initialFocus
          locale={ptBR}
          className={cn("p-3 pointer-events-auto")}
        />
      </PopoverContent>
    </Popover>
  );
}

export default function Lancamentos() {
  const qc = useQueryClient();
  const { isAdmin } = useAuth();

  // Métricas de campanha state
  const [dataInv, setDataInv] = React.useState<Date>(new Date());
  const [campanha, setCampanha] = React.useState("");
  const [conjunto, setConjunto] = React.useState("");
  const [valor, setValor] = React.useState("");
  const [conversas, setConversas] = React.useState("");

  // Leads card state
  const [dataLeads, setDataLeads] = React.useState<Date>(new Date());
  const [vendedorId, setVendedorId] = React.useState<string>("");
  const [leadsQual, setLeadsQual] = React.useState("");
  const [regiaoLead, setRegiaoLead] = React.useState("");

  // Editing states
  const [editMetrica, setEditMetrica] = React.useState<{id: string, data: string, campanha: string, conjunto: string} | null>(null);
  const [editInvValor, setEditInvValor] = React.useState("");
  const [editConversas, setEditConversas] = React.useState("");

  const [editLeadKey, setEditLeadKey] = React.useState<{data: string, vendedor_id: string, nome: string} | null>(null);
  const [editLeadTot, setEditLeadTot] = React.useState("");
  const [editLeadQual, setEditLeadQual] = React.useState("");

  // Deletion states
  const [deleteMetricaId, setDeleteMetricaId] = React.useState<string | null>(null);
  const [deleteLeadKey, setDeleteLeadKey] = React.useState<{data: string, vendedor_id: string} | null>(null);

  const vendedores = useQuery({
    queryKey: ["vendedores", "ativos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendedores")
        .select("*")
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return data;
    },
  });

  const historicoMetricas = useQuery({
    queryKey: ["historico_metricas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("metricas_campanhas")
        .select("*")
        .order("data", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
  });

  const historicoLeads = useQuery({
    queryKey: ["historico_leads"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads_vendedores")
        .select(`
          *,
          vendedores(nome)
        `)
        .order("data", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
  });

  const saveMetrica = useMutation({
    mutationFn: async () => {
      const numeric = Number(valor.replace(",", "."));
      if (!Number.isFinite(numeric) || numeric < 0) throw new Error("Valor inválido");
      const conv = Number(conversas || 0);
      const campanhaName = campanha.trim() || "Geral";
      const conjuntoName = conjunto.trim() || "Geral";
      const { error } = await supabase
        .from("metricas_campanhas")
        .upsert(
          { data: isoDay(dataInv), campanha: campanhaName, conjunto: conjuntoName, investimento: numeric, conversas: conv },
          { onConflict: "data,campanha,conjunto" }
        );
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Métricas salvas com sucesso");
      setValor("");
      setConversas("");
      setCampanha("");
      setConjunto("");
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["historico_metricas"] });
    },
    onError: (e: Error) => toast.error(e.message || "Falha ao salvar"),
  });

  const saveLeads = useMutation({
    mutationFn: async () => {
      if (!vendedorId) throw new Error("Selecione um vendedor");
      if (!regiaoLead) throw new Error("Selecione uma região");
      const qual = Number(leadsQual || 0);
      const { error } = await supabase
        .from("leads_vendedores")
        .upsert(
          {
            vendedor_id: vendedorId,
            data: isoDay(dataLeads),
            regiao: regiaoLead,
            leads_totais: 0,
            leads_qualificados: qual,
          },
          { onConflict: "vendedor_id,data,regiao" }
        );
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Agendamento registrado com sucesso");
      setLeadsQual("");
      setVendedorId("");
      setRegiaoLead("");
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["historico_leads"] });
    },
    onError: (e: Error) => toast.error(e.message || "Falha ao registrar"),
  });

  const updateMetrica = useMutation({
    mutationFn: async () => {
      if (!editMetrica) throw new Error("Registro não selecionado");
      const numeric = Number(editInvValor.toString().replace(",", "."));
      if (!Number.isFinite(numeric) || numeric < 0) throw new Error("Valor inválido");
      const conv = Number(editConversas || 0);
      
      const { error } = await supabase
        .from("metricas_campanhas")
        .update({ investimento: numeric, conversas: conv })
        .eq("id", editMetrica.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Métricas atualizadas com sucesso");
      setEditMetrica(null);
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["historico_metricas"] });
    },
    onError: (e: Error) => toast.error(e.message || "Falha ao atualizar"),
  });

  const deleteMetrica = useMutation({
    mutationFn: async () => {
      if (!deleteMetricaId) throw new Error("Registro não selecionado");
      const { error } = await supabase
        .from("metricas_campanhas")
        .delete()
        .eq("id", deleteMetricaId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Registro excluído com sucesso");
      setDeleteMetricaId(null);
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["historico_metricas"] });
    },
    onError: (e: Error) => toast.error(e.message || "Falha ao excluir"),
  });

  const updateLeads = useMutation({
    mutationFn: async () => {
      if (!editLeadKey) throw new Error("Registro não selecionado");
      const tot = Number(editLeadTot || 0);
      const qual = Number(editLeadQual || 0);
      if (qual > tot) throw new Error("Qualificados não pode exceder leads totais");

      const { error } = await supabase
        .from("leads_vendedores")
        .update({ leads_totais: tot, leads_qualificados: qual })
        .eq("vendedor_id", editLeadKey.vendedor_id)
        .eq("data", editLeadKey.data);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Leads atualizados com sucesso");
      setEditLeadKey(null);
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["historico_leads"] });
    },
    onError: (e: Error) => toast.error(e.message || "Falha ao atualizar"),
  });

  const deleteLeads = useMutation({
    mutationFn: async () => {
      if (!deleteLeadKey) throw new Error("Registro não selecionado");
      const { error } = await supabase
        .from("leads_vendedores")
        .delete()
        .eq("vendedor_id", deleteLeadKey.vendedor_id)
        .eq("data", deleteLeadKey.data);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Leads excluídos com sucesso");
      setDeleteLeadKey(null);
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["historico_leads"] });
    },
    onError: (e: Error) => toast.error(e.message || "Falha ao excluir"),
  });

  return (
    <div className="space-y-6 pb-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Lançamentos</h1>
        <p className="text-sm text-muted-foreground">
          Gerencie os investimentos em mídia e a distribuição de leads.
        </p>
      </div>

      <Tabs defaultValue="novo" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="novo">Novo Lançamento</TabsTrigger>
          <TabsTrigger value="historico">Histórico Recente</TabsTrigger>
        </TabsList>

        <TabsContent value="novo" className="mt-0">
          <div className={`grid gap-6 ${isAdmin ? "lg:grid-cols-2" : "grid-cols-1"}`}>
            {isAdmin && (
            <Card>
              <CardHeader>
                <CardTitle>Métricas de Campanha (Meta Ads)</CardTitle>
                <CardDescription>Investimento e conversas por campanha no dia selecionado.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Data da campanha</Label>
                  <DateField value={dataInv} onChange={setDataInv} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="campanha">Nome da Campanha</Label>
                    <Input
                      id="campanha"
                      type="text"
                      placeholder="Ex: Solar Residencial"
                      value={campanha}
                      onChange={(e) => setCampanha(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="conjunto">Nome do Conjunto</Label>
                    <Input
                      id="conjunto"
                      type="text"
                      placeholder="Ex: Demais Regiões"
                      value={conjunto}
                      onChange={(e) => setConjunto(e.target.value)}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="valor">Investimento (R$)</Label>
                    <Input
                      id="valor"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0,00"
                      value={valor}
                      onChange={(e) => setValor(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="conversas">Conversas</Label>
                    <Input
                      id="conversas"
                      type="number"
                      min="0"
                      placeholder="0"
                      value={conversas}
                      onChange={(e) => setConversas(e.target.value)}
                    />
                  </div>
                </div>
                <Button
                  className="w-full"
                  onClick={() => saveMetrica.mutate()}
                  disabled={saveMetrica.isPending || !valor}
                >
                  {saveMetrica.isPending ? "Salvando..." : "Salvar Métricas"}
                </Button>
              </CardContent>
            </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle>Registrar Agendamento</CardTitle>
                <CardDescription>Informe os agendamentos realizados por cada vendedor.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Data do recebimento</Label>
                  <DateField value={dataLeads} onChange={setDataLeads} />
                </div>
                <div className="space-y-2">
                  <Label>Vendedor</Label>
                  <Select value={vendedorId} onValueChange={setVendedorId}>
                    <SelectTrigger>
                      <SelectValue placeholder={vendedores.isLoading ? "Carregando..." : "Selecione um vendedor"} />
                    </SelectTrigger>
                    <SelectContent>
                      {(vendedores.data ?? []).length === 0 && (
                        <div className="px-2 py-3 text-xs text-muted-foreground">
                          Nenhum vendedor ativo. Cadastre na página Equipe.
                        </div>
                      )}
                      {(vendedores.data ?? []).map((v) => (
                        <SelectItem key={v.id} value={v.id}>{v.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Região</Label>
                  <Select value={regiaoLead} onValueChange={setRegiaoLead}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione uma região" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Londrina">Londrina</SelectItem>
                      <SelectItem value="Ponta Grossa">Ponta Grossa</SelectItem>
                      <SelectItem value="Wenceslau Braz">Wenceslau Braz</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="qual">Agendamentos</Label>
                  <Input
                    id="qual"
                    type="number"
                    min="0"
                    placeholder="0"
                    value={leadsQual}
                    onChange={(e) => setLeadsQual(e.target.value)}
                  />
                </div>
                <Button
                  className="w-full"
                  onClick={() => saveLeads.mutate()}
                  disabled={saveLeads.isPending || !vendedorId || !regiaoLead}
                >
                  {saveLeads.isPending ? "Registrando..." : "Registrar Agendamento"}
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="historico" className="mt-0 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Histórico de Métricas de Campanhas</CardTitle>
              <CardDescription>Últimos registros de investimento e conversas por campanha.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Campanha</TableHead>
                      <TableHead>Conjunto</TableHead>
                      <TableHead>Investimento</TableHead>
                      <TableHead>Conversas</TableHead>
                      <TableHead>Custo/Conv.</TableHead>
                      <TableHead className="w-[80px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {historicoMetricas.isLoading && (
                      <TableRow><TableCell colSpan={6} className="text-center py-4">Carregando...</TableCell></TableRow>
                    )}
                    {(!historicoMetricas.isLoading && historicoMetricas.data?.length === 0) && (
                      <TableRow><TableCell colSpan={6} className="text-center py-4">Nenhum registro encontrado.</TableCell></TableRow>
                    )}
                    {historicoMetricas.data?.map((m) => (
                      <TableRow key={m.id}>
                        <TableCell>{format(parseISO(m.data), "dd/MM/yyyy")}</TableCell>
                        <TableCell>{m.campanha}</TableCell>
                        <TableCell>{m.conjunto}</TableCell>
                        <TableCell>
                          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(m.investimento))}
                        </TableCell>
                        <TableCell>{m.conversas}</TableCell>
                        <TableCell>
                          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(m.custo_por_conversa || 0))}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" className="h-8 w-8 p-0">
                                <span className="sr-only">Abrir menu</span>
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Ações</DropdownMenuLabel>
                              <DropdownMenuItem
                                onClick={() => {
                                  setEditMetrica({ id: m.id, data: m.data, campanha: m.campanha, conjunto: m.conjunto });
                                  setEditInvValor(String(m.investimento));
                                  setEditConversas(String(m.conversas));
                                }}
                              >
                                <Pencil className="mr-2 h-4 w-4" />
                                Editar
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem 
                                className="text-destructive"
                                onClick={() => setDeleteMetricaId(m.id)}
                              >
                                <Trash className="mr-2 h-4 w-4" />
                                Excluir
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Histórico de Leads e Agendamentos</CardTitle>
              <CardDescription>Últimos registros da distribuição de leads.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Vendedor</TableHead>
                      <TableHead>Leads Brutos</TableHead>
                      <TableHead>Agendamentos</TableHead>
                      <TableHead className="w-[80px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {historicoLeads.isLoading && (
                      <TableRow><TableCell colSpan={5} className="text-center py-4">Carregando...</TableCell></TableRow>
                    )}
                    {(!historicoLeads.isLoading && historicoLeads.data?.length === 0) && (
                      <TableRow><TableCell colSpan={5} className="text-center py-4">Nenhum registro encontrado.</TableCell></TableRow>
                    )}
                    {historicoLeads.data?.map((lead) => (
                      <TableRow key={`${lead.data}-${lead.vendedor_id}`}>
                        <TableCell>{format(parseISO(lead.data), "dd/MM/yyyy")}</TableCell>
                        <TableCell>{lead.vendedores?.nome || "Desconhecido"}</TableCell>
                        <TableCell>{lead.leads_totais}</TableCell>
                        <TableCell>{lead.leads_qualificados}</TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" className="h-8 w-8 p-0">
                                <span className="sr-only">Abrir menu</span>
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Ações</DropdownMenuLabel>
                              <DropdownMenuItem
                                onClick={() => {
                                  setEditLeadKey({
                                    data: lead.data,
                                    vendedor_id: lead.vendedor_id,
                                    nome: lead.vendedores?.nome || "Desconhecido"
                                  });
                                  setEditLeadTot(String(lead.leads_totais));
                                  setEditLeadQual(String(lead.leads_qualificados));
                                }}
                              >
                                <Pencil className="mr-2 h-4 w-4" />
                                Editar
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem 
                                className="text-destructive"
                                onClick={() => setDeleteLeadKey({
                                  data: lead.data,
                                  vendedor_id: lead.vendedor_id
                                })}
                              >
                                <Trash className="mr-2 h-4 w-4" />
                                Excluir
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialog: Editar Métricas */}
      <Dialog open={!!editMetrica} onOpenChange={(open) => !open && setEditMetrica(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Métricas de Campanha</DialogTitle>
            <DialogDescription>Altere o investimento e conversas da campanha selecionada.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>Data</Label>
                <Input value={editMetrica?.data ? format(parseISO(editMetrica.data), "dd/MM/yyyy") : ""} disabled />
              </div>
              <div className="space-y-2">
                <Label>Campanha</Label>
                <Input value={editMetrica?.campanha || ""} disabled />
              </div>
              <div className="space-y-2">
                <Label>Conjunto</Label>
                <Input value={editMetrica?.conjunto || ""} disabled />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="editValor">Investimento (R$)</Label>
                <Input
                  id="editValor"
                  type="number"
                  step="0.01"
                  min="0"
                  value={editInvValor}
                  onChange={(e) => setEditInvValor(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="editConversas">Conversas</Label>
                <Input
                  id="editConversas"
                  type="number"
                  min="0"
                  value={editConversas}
                  onChange={(e) => setEditConversas(e.target.value)}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditMetrica(null)}>Cancelar</Button>
            <Button onClick={() => updateMetrica.mutate()} disabled={updateMetrica.isPending}>
              {updateMetrica.isPending ? "Salvando..." : "Salvar Alterações"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editLeadKey} onOpenChange={(open) => !open && setEditLeadKey(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Leads e Agendamentos</DialogTitle>
            <DialogDescription>Altere a quantidade de leads para o vendedor selecionado.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Data</Label>
                <Input value={editLeadKey?.data ? format(parseISO(editLeadKey.data), "dd/MM/yyyy") : ""} disabled />
              </div>
              <div className="space-y-2">
                <Label>Vendedor</Label>
                <Input value={editLeadKey?.nome || ""} disabled />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="editTot">Leads Recebidos</Label>
                <Input
                  id="editTot"
                  type="number"
                  min="0"
                  value={editLeadTot}
                  onChange={(e) => setEditLeadTot(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="editQual">Agendamentos</Label>
                <Input
                  id="editQual"
                  type="number"
                  min="0"
                  value={editLeadQual}
                  onChange={(e) => setEditLeadQual(e.target.value)}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditLeadKey(null)}>Cancelar</Button>
            <Button onClick={() => updateLeads.mutate()} disabled={updateLeads.isPending}>
              {updateLeads.isPending ? "Salvando..." : "Salvar Alterações"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AlertDialog: Excluir Métricas */}
      <AlertDialog open={!!deleteMetricaId} onOpenChange={(open) => !open && setDeleteMetricaId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Isso removerá permanentemente este registro de métricas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => { e.preventDefault(); deleteMetrica.mutate(); }}
              disabled={deleteMetrica.isPending}
            >
              {deleteMetrica.isPending ? "Excluindo..." : "Excluir Registro"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteLeadKey} onOpenChange={(open) => !open && setDeleteLeadKey(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Isso removerá permanentemente o registro de leads do dia {deleteLeadKey?.data ? format(parseISO(deleteLeadKey.data), "dd/MM/yyyy") : ""}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => { e.preventDefault(); deleteLeads.mutate(); }}
              disabled={deleteLeads.isPending}
            >
              {deleteLeads.isPending ? "Excluindo..." : "Excluir Registro"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}