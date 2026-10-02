-- Vincular abastecimentos a uma Ordem de Serviço (custo agregado à OS)

ALTER TABLE public.equipment_fuel_refuelings ADD COLUMN IF NOT EXISTS os_id text;

CREATE INDEX IF NOT EXISTS idx_eqf_refuelings_os_id ON public.equipment_fuel_refuelings(os_id);
