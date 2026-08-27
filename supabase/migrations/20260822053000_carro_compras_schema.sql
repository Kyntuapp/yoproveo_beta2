-- =============================================================================
-- Carro de Compras — schema (Ticket 1)
-- PREPARED LOCALLY — DO NOT APPLY until reviewed.
--
-- Scope:
--   * trazabilidad de rechazo/adjudicación en ofertas_productos
--   * adjudicacion_eventos (append-only)
--   * ordenes_checkout + ordenes_checkout_items
--   * pagos.orden_id
--   * RLS de tablas nuevas
--   * backfill seguro estado_motivo='legado' en rechazadas históricas
--
-- Out of scope (tickets siguientes):
--   * RPC adjudicar / revertir / crear orden / confirmar
--   * cambios frontend
--   * cancelación de pagos pendientes existentes
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1) ofertas_productos — columnas de trazabilidad
-- ---------------------------------------------------------------------------

ALTER TABLE public.ofertas_productos
  ADD COLUMN IF NOT EXISTS estado_motivo text,
  ADD COLUMN IF NOT EXISTS adjudicacion_origen_id uuid,
  ADD COLUMN IF NOT EXISTS adjudicada_en timestamptz,
  ADD COLUMN IF NOT EXISTS adjudicada_por_auth_id uuid;

COMMENT ON COLUMN public.ofertas_productos.estado_motivo IS
  'Motivo del estado cuando aplica (rechazo/cancelación). Valores: manual | adjudicacion_automatica | cancelacion_carro | legado.';

COMMENT ON COLUMN public.ofertas_productos.adjudicacion_origen_id IS
  'Si estado_motivo=adjudicacion_automatica, apunta a la oferta ganadora que provocó el rechazo.';

COMMENT ON COLUMN public.ofertas_productos.adjudicada_en IS
  'Timestamp de aceptación/adjudicación a pendiente_pago.';

COMMENT ON COLUMN public.ofertas_productos.adjudicada_por_auth_id IS
  'auth.users.id del comprador que aceptó la oferta.';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ofertas_productos_estado_motivo_check'
      AND conrelid = 'public.ofertas_productos'::regclass
  ) THEN
    ALTER TABLE public.ofertas_productos
      ADD CONSTRAINT ofertas_productos_estado_motivo_check
      CHECK (
        estado_motivo IS NULL
        OR estado_motivo IN (
          'manual',
          'adjudicacion_automatica',
          'cancelacion_carro',
          'legado'
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ofertas_productos_adjudicacion_origen_id_fkey'
      AND conrelid = 'public.ofertas_productos'::regclass
  ) THEN
    ALTER TABLE public.ofertas_productos
      ADD CONSTRAINT ofertas_productos_adjudicacion_origen_id_fkey
      FOREIGN KEY (adjudicacion_origen_id)
      REFERENCES public.ofertas_productos(id)
      ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ofertas_productos_adjudicada_por_auth_id_fkey'
      AND conrelid = 'public.ofertas_productos'::regclass
  ) THEN
    ALTER TABLE public.ofertas_productos
      ADD CONSTRAINT ofertas_productos_adjudicada_por_auth_id_fkey
      FOREIGN KEY (adjudicada_por_auth_id)
      REFERENCES auth.users(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS ofertas_productos_pendiente_pago_idx
  ON public.ofertas_productos (lista_id)
  WHERE lower(trim(coalesce(estado, ''))) = 'pendiente_pago';

CREATE INDEX IF NOT EXISTS ofertas_productos_adjudicacion_origen_idx
  ON public.ofertas_productos (adjudicacion_origen_id)
  WHERE adjudicacion_origen_id IS NOT NULL;

-- Máximo UNA oferta adjudicada activa por producto (listas_compras.id).
-- Cubre exactamente los estados de public.solicitud_esta_adjudicada().
-- Requiere datos sin duplicados (caso legacy f4dcb099 normalizado antes de apply).
CREATE UNIQUE INDEX IF NOT EXISTS ofertas_productos_una_adjudicacion_activa_por_lista
  ON public.ofertas_productos (lista_id)
  WHERE lower(trim(coalesce(estado, ''))) IN (
    'pendiente_pago',
    'en_espera_confirmacion',
    'confirmada',
    'pago_recibido',
    'recepcion_conforme',
    'pagada'
  )
  AND lista_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 2) Backfill seguro de rechazos históricos
-- ---------------------------------------------------------------------------

UPDATE public.ofertas_productos
SET estado_motivo = 'legado'
WHERE lower(trim(coalesce(estado, ''))) = 'rechazada'
  AND estado_motivo IS NULL;

COMMENT ON COLUMN public.ofertas_productos.estado_motivo IS
  'Motivo del estado cuando aplica. legado = rechazo histórico sin evidencia de causa; NUNCA auto-reactivar.';

-- ---------------------------------------------------------------------------
-- 3) adjudicacion_eventos (append-only)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.adjudicacion_eventos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  oferta_id uuid NOT NULL REFERENCES public.ofertas_productos(id) ON DELETE CASCADE,
  evento text NOT NULL,
  actor_auth_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT adjudicacion_eventos_evento_check CHECK (
    evento IN (
      'aceptada',
      'revertida',
      'pago_confirmado',
      'orden_creada',
      'orden_cancelada'
    )
  )
);

CREATE INDEX IF NOT EXISTS adjudicacion_eventos_oferta_id_created_idx
  ON public.adjudicacion_eventos (oferta_id, created_at DESC);

COMMENT ON TABLE public.adjudicacion_eventos IS
  'Historial append-only de aceptación/reversión/pago. Rivales auto se reconstruyen vía adjudicacion_origen_id.';

ALTER TABLE public.adjudicacion_eventos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS adjudicacion_eventos_select_own ON public.adjudicacion_eventos;
CREATE POLICY adjudicacion_eventos_select_own
  ON public.adjudicacion_eventos
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.ofertas_productos o
      JOIN public.listas_compras lc ON lc.id = o.lista_id
      WHERE o.id = adjudicacion_eventos.oferta_id
        AND lc.usuario_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.ofertas_productos o
      JOIN public.perfiles p ON p.id = o.proveedor_id
      WHERE o.id = adjudicacion_eventos.oferta_id
        AND p.auth_id = auth.uid()
    )
  );

-- Sin INSERT/UPDATE/DELETE para authenticated: solo RPC/service role (tickets siguientes).

-- ---------------------------------------------------------------------------
-- 4) ordenes_checkout + items
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.ordenes_checkout (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comprador_auth_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  estado text NOT NULL DEFAULT 'abierta',
  total_ofertas numeric NOT NULL DEFAULT 0,
  total_comision numeric NOT NULL DEFAULT 0,
  total_pagar numeric NOT NULL DEFAULT 0,
  idempotency_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  confirmed_at timestamptz,
  cancelled_at timestamptz,
  CONSTRAINT ordenes_checkout_estado_check CHECK (
    estado IN ('abierta', 'confirmada', 'cancelada')
  ),
  CONSTRAINT ordenes_checkout_idempotency_key_key UNIQUE (idempotency_key)
);

COMMENT ON TABLE public.ordenes_checkout IS
  'Checkout agrupado del comprador. El carro en sí es la proyección de ofertas pendiente_pago.';

CREATE UNIQUE INDEX IF NOT EXISTS ordenes_checkout_una_abierta_por_comprador
  ON public.ordenes_checkout (comprador_auth_id)
  WHERE estado = 'abierta';

CREATE INDEX IF NOT EXISTS ordenes_checkout_comprador_created_idx
  ON public.ordenes_checkout (comprador_auth_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.ordenes_checkout_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  orden_id uuid NOT NULL REFERENCES public.ordenes_checkout(id) ON DELETE CASCADE,
  oferta_id uuid NOT NULL REFERENCES public.ofertas_productos(id),
  proveedor_id uuid REFERENCES public.perfiles(id),
  lista_compras_id uuid REFERENCES public.listas_compras(id),
  producto_snapshot text,
  formato_snapshot text,
  marca_snapshot text,
  cantidad_snapshot bigint,
  monto_oferta numeric NOT NULL,
  comision_kyntu numeric NOT NULL DEFAULT 0,
  impuesto_snapshot numeric,
  total_item numeric NOT NULL,
  estado_item text NOT NULL DEFAULT 'incluido',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ordenes_checkout_items_estado_check CHECK (
    estado_item IN ('incluido', 'confirmado', 'liberado')
  ),
  CONSTRAINT ordenes_checkout_items_orden_oferta_key UNIQUE (orden_id, oferta_id)
);

COMMENT ON TABLE public.ordenes_checkout_items IS
  'Detalle de orden con snapshot financiero/producto. Congela datos al crear checkout.';

COMMENT ON COLUMN public.ordenes_checkout_items.estado_item IS
  'incluido = oferta congelada en orden abierta. Al confirmar orden → confirmado. Al cancelar orden → liberado. Transiciones vía RPC futuras.';

COMMENT ON COLUMN public.ordenes_checkout_items.monto_oferta IS
  'Snapshot de precio_ofertado al crear la orden. No recalcular tras confirmación.';

COMMENT ON COLUMN public.ordenes_checkout_items.comision_kyntu IS
  'Snapshot de comisión al crear la orden (fórmula vigente al momento del checkout).';

COMMENT ON COLUMN public.ordenes_checkout_items.impuesto_snapshot IS
  'Snapshot opcional de impuesto al crear la orden. Nullable; sin fórmula nueva en este ticket.';

COMMENT ON COLUMN public.ordenes_checkout_items.formato_snapshot IS
  'Snapshot de formato del producto/oferta al crear la orden.';

COMMENT ON COLUMN public.ordenes_checkout_items.marca_snapshot IS
  'Snapshot de marca del producto/oferta al crear la orden.';

-- Congela: una oferta solo puede estar "incluida" en una orden a la vez.
-- Tras confirmar/cancelar, las RPC deben pasar el item a confirmado/liberado.
CREATE UNIQUE INDEX IF NOT EXISTS ordenes_checkout_items_oferta_incluida_unique
  ON public.ordenes_checkout_items (oferta_id)
  WHERE estado_item = 'incluido';

CREATE INDEX IF NOT EXISTS ordenes_checkout_items_orden_id_idx
  ON public.ordenes_checkout_items (orden_id);

ALTER TABLE public.ordenes_checkout ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ordenes_checkout_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ordenes_checkout_select_own ON public.ordenes_checkout;
CREATE POLICY ordenes_checkout_select_own
  ON public.ordenes_checkout
  FOR SELECT
  TO authenticated
  USING (comprador_auth_id = auth.uid());

DROP POLICY IF EXISTS ordenes_checkout_items_select_own ON public.ordenes_checkout_items;
CREATE POLICY ordenes_checkout_items_select_own
  ON public.ordenes_checkout_items
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.ordenes_checkout o
      WHERE o.id = ordenes_checkout_items.orden_id
        AND o.comprador_auth_id = auth.uid()
    )
  );

-- Sin INSERT/UPDATE/DELETE para authenticated en órdenes/items:
-- mutaciones solo vía RPC (tickets siguientes).

-- ---------------------------------------------------------------------------
-- 5) pagos.orden_id
-- ---------------------------------------------------------------------------

ALTER TABLE public.pagos
  ADD COLUMN IF NOT EXISTS orden_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'pagos_orden_id_fkey'
      AND conrelid = 'public.pagos'::regclass
  ) THEN
    ALTER TABLE public.pagos
      ADD CONSTRAINT pagos_orden_id_fkey
      FOREIGN KEY (orden_id)
      REFERENCES public.ordenes_checkout(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS pagos_orden_id_idx
  ON public.pagos (orden_id)
  WHERE orden_id IS NOT NULL;

COMMENT ON COLUMN public.pagos.orden_id IS
  'Orden de checkout agrupado que originó/agrupa este pago por oferta. Nullable para pagos legacy.';

-- Nota: pagos.oferta_id no tiene FK hoy; no se agrega en este ticket para no
-- alterar datos legacy. pagos.estado_pago pendientes existentes NO se cancelan aquí.
