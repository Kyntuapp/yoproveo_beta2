ALTER TABLE public.payment_orders
  ADD COLUMN IF NOT EXISTS checkout_order_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'payment_orders_checkout_order_id_fkey'
      AND conrelid = 'public.payment_orders'::regclass
  ) THEN
    ALTER TABLE public.payment_orders
      ADD CONSTRAINT payment_orders_checkout_order_id_fkey
      FOREIGN KEY (checkout_order_id)
      REFERENCES public.ordenes_checkout(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS payment_orders_checkout_order_idx
  ON public.payment_orders (checkout_order_id, created_at DESC)
  WHERE checkout_order_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS payment_orders_one_active_checkout_unique
  ON public.payment_orders (checkout_order_id)
  WHERE checkout_order_id IS NOT NULL
    AND status IN ('pending', 'processing', 'approved');

COMMENT ON COLUMN public.payment_orders.checkout_order_id IS
  'Orden agrupada del carrito que originó el intento de pago en la pasarela.';
