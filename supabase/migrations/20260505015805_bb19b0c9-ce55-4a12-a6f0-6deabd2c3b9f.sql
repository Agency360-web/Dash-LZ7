
CREATE TABLE public.vendedores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.gasto_diario (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data DATE NOT NULL UNIQUE,
  valor_investido NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.leads_vendedores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendedor_id UUID NOT NULL REFERENCES public.vendedores(id) ON DELETE CASCADE,
  data DATE NOT NULL,
  leads_totais INT NOT NULL DEFAULT 0,
  leads_qualificados INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (vendedor_id, data)
);

CREATE INDEX idx_leads_vendedores_data ON public.leads_vendedores(data);
CREATE INDEX idx_gasto_diario_data ON public.gasto_diario(data);

ALTER TABLE public.vendedores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gasto_diario ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads_vendedores ENABLE ROW LEVEL SECURITY;

-- Acesso público (sem auth nesta fase). Pode ser endurecido depois.
CREATE POLICY "Public read vendedores" ON public.vendedores FOR SELECT USING (true);
CREATE POLICY "Public write vendedores" ON public.vendedores FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Public read gasto_diario" ON public.gasto_diario FOR SELECT USING (true);
CREATE POLICY "Public write gasto_diario" ON public.gasto_diario FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Public read leads_vendedores" ON public.leads_vendedores FOR SELECT USING (true);
CREATE POLICY "Public write leads_vendedores" ON public.leads_vendedores FOR ALL USING (true) WITH CHECK (true);

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_gasto_diario_updated BEFORE UPDATE ON public.gasto_diario
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_leads_vendedores_updated BEFORE UPDATE ON public.leads_vendedores
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
