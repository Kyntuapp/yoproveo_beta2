ALTER TABLE public.provider_payouts
  ADD COLUMN IF NOT EXISTS gateway_fee bigint CHECK (gateway_fee >= 0);

ALTER TABLE public.provider_payouts
  DROP CONSTRAINT IF EXISTS provider_payouts_check;

ALTER TABLE public.provider_payouts
  ADD CONSTRAINT provider_payouts_amounts_check CHECK (
    (gateway_fee IS NULL AND status = 'held' AND net_amount = gross_amount - kyntu_commission)
    OR
    (gateway_fee IS NOT NULL AND net_amount = gross_amount - kyntu_commission - gateway_fee)
  );

COMMENT ON COLUMN public.provider_payouts.gateway_fee IS
  'Costo real de Mercado Pago o Transbank asignado proporcionalmente al proveedor.';
