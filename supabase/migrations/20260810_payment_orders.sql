CREATE TABLE IF NOT EXISTS public.payment_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_auth_id uuid NOT NULL,
  provider text NOT NULL CHECK (provider IN ('mercadopago', 'transbank')),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'approved', 'rejected', 'cancelled', 'refunded')),
  currency text NOT NULL DEFAULT 'CLP',
  subtotal bigint NOT NULL CHECK (subtotal > 0),
  commission bigint NOT NULL DEFAULT 0 CHECK (commission >= 0),
  total bigint NOT NULL CHECK (total > 0),
  external_id text,
  provider_payment_id text,
  provider_payload jsonb,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.payment_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.payment_orders(id) ON DELETE CASCADE,
  offer_id uuid NOT NULL REFERENCES public.ofertas_productos(id),
  provider_profile_id uuid NOT NULL REFERENCES public.perfiles(id),
  title text NOT NULL,
  amount bigint NOT NULL CHECK (amount > 0),
  commission bigint NOT NULL DEFAULT 0 CHECK (commission >= 0),
  total bigint NOT NULL CHECK (total > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (order_id, offer_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS payment_orders_provider_external_id_unique
  ON public.payment_orders(provider, external_id)
  WHERE external_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS payment_orders_buyer_created_idx
  ON public.payment_orders(buyer_auth_id, created_at DESC);

CREATE INDEX IF NOT EXISTS payment_order_items_offer_idx
  ON public.payment_order_items(offer_id);

ALTER TABLE public.payment_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "buyers_read_own_payment_orders"
  ON public.payment_orders FOR SELECT TO authenticated
  USING (buyer_auth_id = auth.uid());

CREATE POLICY "buyers_read_own_payment_order_items"
  ON public.payment_order_items FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.payment_orders payment_order
      WHERE payment_order.id = payment_order_items.order_id
        AND payment_order.buyer_auth_id = auth.uid()
    )
  );

COMMENT ON TABLE public.payment_orders IS
  'Órdenes de checkout creadas y actualizadas exclusivamente por APIs con service role.';
COMMENT ON TABLE public.payment_order_items IS
  'Ofertas incluidas en cada orden; las ofertas no incluidas permanecen pendientes.';
