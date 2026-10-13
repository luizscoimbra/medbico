-- =============================================================================
-- Assinatura e condições climáticas da Ordem de Serviço
-- =============================================================================
-- Frente do roadmap: (1) assinatura (biométrica via WebAuthn quando o
-- dispositivo suporta, senão assinatura por toque) gravada no encerramento da
-- OS; (2) registro das condições de aplicação capturadas no momento do
-- encerramento (temperatura, umidade, precipitação e vento via Open-Meteo).
--
-- Ambos ficam em colunas próprias de orders_of_service: a assinatura é a prova
-- de entrega do serviço e o clima é dado agronômico rastreável — não podem
-- viver só no JSON de apontamentos.
-- =============================================================================

ALTER TABLE public.orders_of_service
  ADD COLUMN IF NOT EXISTS assinatura_base64 text,
  ADD COLUMN IF NOT EXISTS assinado_em       timestamptz,
  ADD COLUMN IF NOT EXISTS assinado_por_nome text,
  ADD COLUMN IF NOT EXISTS assinatura_metodo text,
  ADD COLUMN IF NOT EXISTS clima             jsonb;

COMMENT ON COLUMN public.orders_of_service.assinatura_base64 IS
  'Assinatura do encerramento em PNG data-URL (canvas).';
COMMENT ON COLUMN public.orders_of_service.assinatura_metodo IS
  'Como a assinatura foi confirmada: biometrica (WebAuthn) ou toque.';
COMMENT ON COLUMN public.orders_of_service.clima IS
  'Condições climáticas capturadas no encerramento (Open-Meteo): temp, umidade, precipitação, vento.';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'orders_of_service_assinatura_metodo_check'
  ) THEN
    ALTER TABLE public.orders_of_service
      ADD CONSTRAINT orders_of_service_assinatura_metodo_check
      CHECK (assinatura_metodo IS NULL OR assinatura_metodo IN ('biometrica', 'toque'));
  END IF;
END $$;
