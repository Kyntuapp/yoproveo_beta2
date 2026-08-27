CREATE TABLE IF NOT EXISTS public.provider_payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_order_id uuid NOT NULL REFERENCES public.payment_orders(id),
  provider_profile_id uuid NOT NULL REFERENCES public.perfiles(id),
  payment_provider text NOT NULL CHECK (payment_provider IN ('mercadopago', 'transbank')),
  gross_amount bigint NOT NULL CHECK (gross_amount > 0),
  kyntu_commission bigint NOT NULL DEFAULT 0 CHECK (kyntu_commission >= 0),
  gateway_fee bigint CHECK (gateway_fee >= 0),
  net_amount bigint NOT NULL CHECK (net_amount > 0),
  status text NOT NULL DEFAULT 'ready'
    CHECK (status IN ('ready', 'processing', 'paid', 'failed', 'held')),
  transfer_reference text,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (payment_order_id, provider_profile_id),
  CHECK (
    (gateway_fee IS NULL AND status = 'held' AND net_amount = gross_amount - kyntu_commission)
    OR
    (gateway_fee IS NOT NULL AND net_amount = gross_amount - kyntu_commission - gateway_fee)
  ),
  CHECK (status <> 'paid' OR (paid_at IS NOT NULL AND transfer_reference IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS provider_payouts_status_created_idx
  ON public.provider_payouts(status, created_at DESC);

ALTER TABLE public.provider_payouts ENABLE ROW LEVEL SECURITY;

-- Recupera órdenes ya aprobadas antes de instalar este módulo.
INSERT INTO public.provider_payouts (
  payment_order_id,
  provider_profile_id,
  payment_provider,
  gross_amount,
  kyntu_commission,
  gateway_fee,
  net_amount,
  status
)
SELECT
  po.id,
  poi.provider_profile_id,
  po.provider,
  SUM(poi.amount),
  SUM(poi.commission),
  NULL,
  SUM(poi.provider_net),
  'held'
FROM public.payment_orders po
JOIN public.payment_order_items poi ON poi.order_id = po.id
WHERE po.status = 'approved'
GROUP BY po.id, poi.provider_profile_id, po.provider
ON CONFLICT (payment_order_id, provider_profile_id) DO NOTHING;

COMMENT ON TABLE public.provider_payouts IS
  'Liquidaciones generadas automáticamente al aprobar un pago; la transferencia externa se confirma desde el panel master.';
