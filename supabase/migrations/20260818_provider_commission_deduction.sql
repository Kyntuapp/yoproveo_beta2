-- La comisión de Kyntü se retiene al proveedor. El comprador paga el monto
-- ofertado y el neto queda persistido para su posterior liquidación.
ALTER TABLE public.payment_order_items
  ADD COLUMN IF NOT EXISTS provider_net bigint;

UPDATE public.payment_order_items
SET provider_net = amount - commission
WHERE provider_net IS NULL;

ALTER TABLE public.payment_order_items
  ALTER COLUMN provider_net SET NOT NULL;

ALTER TABLE public.payment_order_items
  DROP CONSTRAINT IF EXISTS payment_order_items_provider_net_check;

ALTER TABLE public.payment_order_items
  ADD CONSTRAINT payment_order_items_provider_net_check
  CHECK (provider_net > 0 AND provider_net = amount - commission);

COMMENT ON COLUMN public.payment_order_items.provider_net IS
  'Monto a liquidar al proveedor después de descontar la comisión de Kyntü con IVA.';
