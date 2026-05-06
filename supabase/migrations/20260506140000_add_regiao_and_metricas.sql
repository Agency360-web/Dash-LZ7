
-- Garantir que a função set_updated_at existe
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Adicionar coluna regiao em leads_vendedores
ALTER TABLE public.leads_vendedores ADD COLUMN IF NOT EXISTS regiao TEXT NOT NULL DEFAULT 'Geral';

-- Atualizar restrição de unicidade em leads_vendedores
ALTER TABLE public.leads_vendedores DROP CONSTRAINT IF EXISTS leads_vendedores_vendedor_id_data_key;
ALTER TABLE public.leads_vendedores DROP CONSTRAINT IF EXISTS leads_vendedores_vendedor_id_data_regiao_key;
ALTER TABLE public.leads_vendedores ADD CONSTRAINT leads_vendedores_vendedor_id_data_regiao_key UNIQUE (vendedor_id, data, regiao);

-- Criar tabela metricas_campanhas se não existir
CREATE TABLE IF NOT EXISTS public.metricas_campanhas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data DATE NOT NULL,
  campanha TEXT NOT NULL DEFAULT 'Geral',
  conjunto TEXT NOT NULL DEFAULT 'Geral',
  investimento NUMERIC NOT NULL DEFAULT 0,
  conversas INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (data, campanha, conjunto)
);

-- Habilitar RLS para metricas_campanhas
ALTER TABLE public.metricas_campanhas ENABLE ROW LEVEL SECURITY;

-- Políticas para metricas_campanhas (usando DROP para garantir criação sem DO block)
DROP POLICY IF EXISTS "Public read metricas_campanhas" ON public.metricas_campanhas;
CREATE POLICY "Public read metricas_campanhas" ON public.metricas_campanhas FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public write metricas_campanhas" ON public.metricas_campanhas;
CREATE POLICY "Public write metricas_campanhas" ON public.metricas_campanhas FOR ALL USING (true) WITH CHECK (true);

-- Trigger para updated_at em metricas_campanhas
DROP TRIGGER IF EXISTS trg_metricas_campanhas_updated ON public.metricas_campanhas;
CREATE TRIGGER trg_metricas_campanhas_updated BEFORE UPDATE ON public.metricas_campanhas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
