import * as React from "react";
import { Pencil, Plus } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Vendedor = { id: string; nome: string; ativo: boolean };

export default function Equipe() {
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = React.useState(false);
  const [novoNome, setNovoNome] = React.useState("");
  const [editing, setEditing] = React.useState<Vendedor | null>(null);
  const [editNome, setEditNome] = React.useState("");

  const vendedores = useQuery({
    queryKey: ["vendedores", "all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("vendedores").select("*").order("nome");
      if (error) throw error;
      return data as Vendedor[];
    },
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["vendedores"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
  };

  const addVendedor = useMutation({
    mutationFn: async () => {
      if (!novoNome.trim()) throw new Error("Informe o nome");
      const { error } = await supabase.from("vendedores").insert({ nome: novoNome.trim() });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Vendedor adicionado");
      setNovoNome("");
      setAddOpen(false);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleAtivo = useMutation({
    mutationFn: async (v: Vendedor) => {
      const { error } = await supabase.from("vendedores").update({ ativo: !v.ativo }).eq("id", v.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Status atualizado");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const renomear = useMutation({
    mutationFn: async () => {
      if (!editing) return;
      if (!editNome.trim()) throw new Error("Informe o nome");
      const { error } = await supabase.from("vendedores").update({ nome: editNome.trim() }).eq("id", editing.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Nome atualizado");
      setEditing(null);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Equipe</h1>
          <p className="text-sm text-muted-foreground">Gerencie os vendedores que recebem leads.</p>
        </div>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" /> Adicionar Vendedor
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Novo Vendedor</DialogTitle>
              <DialogDescription>Cadastre um novo membro da equipe SDR.</DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="novo">Nome</Label>
              <Input
                id="novo"
                value={novoNome}
                onChange={(e) => setNovoNome(e.target.value)}
                placeholder="Ex.: Maria Silva"
                autoFocus
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddOpen(false)}>Cancelar</Button>
              <Button onClick={() => addVendedor.mutate()} disabled={addVendedor.isPending}>
                {addVendedor.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead className="w-32">Status</TableHead>
              <TableHead className="w-40 text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {vendedores.isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-8 w-24 ml-auto" /></TableCell>
                </TableRow>
              ))
            ) : (vendedores.data ?? []).length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="h-32 text-center text-sm text-muted-foreground">
                  Nenhum vendedor cadastrado ainda.
                </TableCell>
              </TableRow>
            ) : (
              vendedores.data!.map((v) => (
                <TableRow key={v.id} className="hover:bg-muted/40">
                  <TableCell className="font-medium text-foreground">{v.nome}</TableCell>
                  <TableCell>
                    {v.ativo ? (
                      <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-0">Ativo</Badge>
                    ) : (
                      <Badge variant="secondary" className="text-muted-foreground">Inativo</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-3">
                      <Switch
                        checked={v.ativo}
                        onCheckedChange={() => toggleAtivo.mutate(v)}
                        aria-label="Alternar status"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setEditing(v);
                          setEditNome(v.nome);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Vendedor</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="edit">Nome</Label>
            <Input id="edit" value={editNome} onChange={(e) => setEditNome(e.target.value)} autoFocus />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button onClick={() => renomear.mutate()} disabled={renomear.isPending}>
              {renomear.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}