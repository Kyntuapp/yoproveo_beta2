-- =============================================================================
-- Ticket 3 — Hardening seguridad ofertas_productos + pagos
-- Mutaciones sensibles vía RPC; SELECT con RLS; revoca CRUD directo cliente.
-- NO integra pasarela. NO UI del carro.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Helpers de ownership (STABLE, usable en policies)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.es_dueno_lista_compras(p_lista_compras_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.listas_compras lc
    LEFT JOIN public.listas l ON l.id = lc.lista_id
    WHERE lc.id = p_lista_compras_id
      AND (
        lc.usuario_id = auth.uid()
        OR l.usuario_id = auth.uid()
      )
  );
$$;

COMMENT ON FUNCTION public.es_dueno_lista_compras(uuid) IS
  'True si auth.uid() es dueño de listas_compras o de la lista padre.';

REVOKE ALL ON FUNCTION public.es_dueno_lista_compras(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.es_dueno_lista_compras(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.es_dueno_lista_compras(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.es_proveedor_perfil(p_proveedor_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.perfiles p
    WHERE p.id = p_proveedor_id
      AND p.auth_id = auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION public.es_proveedor_perfil(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.es_proveedor_perfil(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.es_proveedor_perfil(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- RPC: crear_oferta_producto (proveedor)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.crear_oferta_producto(
  p_lista_compras_id uuid,
  p_precio_ofertado numeric,
  p_incluye_despacho boolean DEFAULT false,
  p_tiempo_despacho_horas integer DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auth_id uuid := auth.uid();
  v_proveedor_id uuid;
  v_lc public.listas_compras%ROWTYPE;
  v_oferta_id uuid;
BEGIN
  IF v_auth_id IS NULL THEN
    RAISE EXCEPTION 'No autenticado' USING ERRCODE = '42501';
  END IF;

  IF p_lista_compras_id IS NULL THEN
    RAISE EXCEPTION 'Solicitud inválida';
  END IF;

  IF p_precio_ofertado IS NULL OR p_precio_ofertado <= 0 THEN
    RAISE EXCEPTION 'Precio de oferta inválido';
  END IF;

  SELECT p.id
  INTO v_proveedor_id
  FROM public.perfiles p
  WHERE p.auth_id = v_auth_id
    AND lower(trim(coalesce(p.tipo, ''))) = 'proveedor'
  LIMIT 1;

  IF v_proveedor_id IS NULL THEN
    RAISE EXCEPTION 'Perfil de proveedor no encontrado'
      USING ERRCODE = '42501';
  END IF;

  SELECT lc.*
  INTO v_lc
  FROM public.listas_compras lc
  WHERE lc.id = p_lista_compras_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Solicitud no encontrada';
  END IF;

  IF public.solicitud_esta_adjudicada(p_lista_compras_id) THEN
    RAISE EXCEPTION 'Esta solicitud ya fue adjudicada y no admite nuevas ofertas.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.ofertas_productos o
    WHERE o.lista_id = p_lista_compras_id
      AND o.proveedor_id = v_proveedor_id
  ) THEN
    RAISE EXCEPTION 'Ya enviaste una oferta para este producto';
  END IF;

  INSERT INTO public.ofertas_productos (
    lista_id,
    proveedor_id,
    producto,
    formato,
    marca,
    precio_ofertado,
    incluye_despacho,
    tiempo_despacho_horas,
    estado,
    estado_motivo,
    adjudicacion_origen_id,
    adjudicada_en,
    adjudicada_por_auth_id
  )
  VALUES (
    p_lista_compras_id,
    v_proveedor_id,
    v_lc.producto,
    v_lc.formato,
    v_lc.marca,
    p_precio_ofertado,
    coalesce(p_incluye_despacho, false),
    CASE
      WHEN coalesce(p_incluye_despacho, false) THEN p_tiempo_despacho_horas
      ELSE NULL
    END,
    'pendiente',
    NULL,
    NULL,
    NULL,
    NULL
  )
  RETURNING id INTO v_oferta_id;

  RETURN v_oferta_id;
END;
$$;

COMMENT ON FUNCTION public.crear_oferta_producto(uuid, numeric, boolean, integer) IS
  'Crea oferta del proveedor autenticado. Fuerza proveedor_id, estado=pendiente y limpia trazabilidad de adjudicación.';

REVOKE ALL ON FUNCTION public.crear_oferta_producto(uuid, numeric, boolean, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.crear_oferta_producto(uuid, numeric, boolean, integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.crear_oferta_producto(uuid, numeric, boolean, integer) TO authenticated;

-- ---------------------------------------------------------------------------
-- RPC: rechazar_oferta (comprador — rechazo manual)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.rechazar_oferta(p_oferta_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auth_id uuid := auth.uid();
  v_oferta public.ofertas_productos%ROWTYPE;
BEGIN
  IF v_auth_id IS NULL THEN
    RAISE EXCEPTION 'No autenticado' USING ERRCODE = '42501';
  END IF;

  IF p_oferta_id IS NULL THEN
    RAISE EXCEPTION 'Oferta inválida';
  END IF;

  SELECT o.*
  INTO v_oferta
  FROM public.ofertas_productos o
  WHERE o.id = p_oferta_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Oferta no encontrada';
  END IF;

  IF NOT public.es_dueno_lista_compras(v_oferta.lista_id) THEN
    RAISE EXCEPTION 'No autorizado' USING ERRCODE = '42501';
  END IF;

  IF lower(trim(coalesce(v_oferta.estado, ''))) <> 'pendiente' THEN
    RAISE EXCEPTION 'Solo se pueden rechazar ofertas pendientes';
  END IF;

  UPDATE public.ofertas_productos
  SET
    estado = 'rechazada',
    estado_motivo = 'manual',
    adjudicacion_origen_id = NULL
  WHERE id = p_oferta_id
    AND lower(trim(coalesce(estado, ''))) = 'pendiente';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No se pudo rechazar la oferta';
  END IF;

  INSERT INTO public.notificaciones (
    usuario_id,
    rol,
    titulo,
    mensaje,
    ruta,
    leida,
    tipo_evento,
    referencia_id
  )
  VALUES (
    v_oferta.proveedor_id,
    'proveedor',
    'Oferta rechazada',
    format(
      'Tu oferta para %s fue rechazada.',
      coalesce(nullif(trim(v_oferta.producto), ''), 'tu producto')
    ),
    '/proveedor/ofertas_enviadas',
    false,
    'oferta_rechazada_manual',
    p_oferta_id
  );

  RETURN p_oferta_id;
END;
$$;

COMMENT ON FUNCTION public.rechazar_oferta(uuid) IS
  'Rechazo manual del comprador dueño: pendiente → rechazada/manual. No toca rivales ni adjudicaciones.';

REVOKE ALL ON FUNCTION public.rechazar_oferta(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rechazar_oferta(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.rechazar_oferta(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- RPC: confirmar_recepcion_oferta
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.confirmar_recepcion_oferta(p_oferta_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auth_id uuid := auth.uid();
  v_oferta public.ofertas_productos%ROWTYPE;
BEGIN
  IF v_auth_id IS NULL THEN
    RAISE EXCEPTION 'No autenticado' USING ERRCODE = '42501';
  END IF;

  SELECT o.*
  INTO v_oferta
  FROM public.ofertas_productos o
  WHERE o.id = p_oferta_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Oferta no encontrada';
  END IF;

  IF NOT public.es_dueno_lista_compras(v_oferta.lista_id) THEN
    RAISE EXCEPTION 'No autorizado' USING ERRCODE = '42501';
  END IF;

  IF lower(trim(coalesce(v_oferta.estado, ''))) <> 'pago_recibido' THEN
    RAISE EXCEPTION 'La oferta no está en estado pago_recibido';
  END IF;

  UPDATE public.ofertas_productos
  SET estado = 'recepcion_conforme'
  WHERE id = p_oferta_id
    AND lower(trim(coalesce(estado, ''))) = 'pago_recibido';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No se pudo confirmar la recepción';
  END IF;

  RETURN p_oferta_id;
END;
$$;

REVOKE ALL ON FUNCTION public.confirmar_recepcion_oferta(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.confirmar_recepcion_oferta(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.confirmar_recepcion_oferta(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- RPC: marcar_oferta_pagada (cierre post-calificación)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.marcar_oferta_pagada(p_oferta_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auth_id uuid := auth.uid();
  v_oferta public.ofertas_productos%ROWTYPE;
BEGIN
  IF v_auth_id IS NULL THEN
    RAISE EXCEPTION 'No autenticado' USING ERRCODE = '42501';
  END IF;

  SELECT o.*
  INTO v_oferta
  FROM public.ofertas_productos o
  WHERE o.id = p_oferta_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Oferta no encontrada';
  END IF;

  IF NOT public.es_dueno_lista_compras(v_oferta.lista_id) THEN
    RAISE EXCEPTION 'No autorizado' USING ERRCODE = '42501';
  END IF;

  IF lower(trim(coalesce(v_oferta.estado, ''))) <> 'recepcion_conforme' THEN
    RAISE EXCEPTION 'La oferta no está en recepción conforme';
  END IF;

  UPDATE public.ofertas_productos
  SET estado = 'pagada'
  WHERE id = p_oferta_id
    AND lower(trim(coalesce(estado, ''))) = 'recepcion_conforme';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No se pudo marcar la oferta como pagada';
  END IF;

  RETURN p_oferta_id;
END;
$$;

REVOKE ALL ON FUNCTION public.marcar_oferta_pagada(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.marcar_oferta_pagada(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.marcar_oferta_pagada(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- RPC: obtener_o_crear_pago_pendiente (flujo legacy hasta "Pagar")
-- Montos calculados server-side con fórmula legacy actual.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.obtener_o_crear_pago_pendiente(p_oferta_id uuid)
RETURNS TABLE (
  id bigint,
  oferta_id uuid,
  proveedor_id uuid,
  monto_oferta numeric,
  comision_kyntu numeric,
  total_pagado numeric,
  estado_pago text,
  orden_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auth_id uuid := auth.uid();
  v_oferta public.ofertas_productos%ROWTYPE;
  v_monto numeric;
  v_comision numeric;
  v_total numeric;
  v_pago public.pagos%ROWTYPE;
BEGIN
  IF v_auth_id IS NULL THEN
    RAISE EXCEPTION 'No autenticado' USING ERRCODE = '42501';
  END IF;

  SELECT o.*
  INTO v_oferta
  FROM public.ofertas_productos o
  WHERE o.id = p_oferta_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Oferta no encontrada';
  END IF;

  IF NOT public.es_dueno_lista_compras(v_oferta.lista_id) THEN
    RAISE EXCEPTION 'No autorizado' USING ERRCODE = '42501';
  END IF;

  IF lower(trim(coalesce(v_oferta.estado, ''))) <> 'pendiente_pago' THEN
    RAISE EXCEPTION 'La oferta no está pendiente de pago';
  END IF;

  IF v_oferta.precio_ofertado IS NULL OR v_oferta.precio_ofertado <= 0 THEN
    RAISE EXCEPTION 'Precio de oferta inválido';
  END IF;

  -- Fórmula legacy pages/comprador.js (no rediseñar en este ticket).
  v_monto := v_oferta.precio_ofertado;
  v_comision := 0;
  v_total := v_monto;

  SELECT p.*
  INTO v_pago
  FROM public.pagos p
  WHERE p.oferta_id = p_oferta_id
    AND lower(trim(coalesce(p.estado_pago, ''))) = 'pendiente'
  ORDER BY p.id DESC
  LIMIT 1
  FOR UPDATE;

  IF FOUND THEN
    -- Reusar solo si montos/proveedor coinciden y sin gateway iniciado.
    IF v_pago.proveedor_id IS NOT DISTINCT FROM v_oferta.proveedor_id
       AND v_pago.monto_oferta IS NOT DISTINCT FROM v_monto
       AND v_pago.comision_kyntu IS NOT DISTINCT FROM v_comision
       AND v_pago.total_pagado IS NOT DISTINCT FROM v_total
       AND nullif(trim(v_pago.mercadopago_preference_id), '') IS NULL
       AND nullif(trim(v_pago.mercadopago_payment_id), '') IS NULL
       AND nullif(trim(v_pago.fintoc_payment_id), '') IS NULL
       AND nullif(trim(v_pago.fintoc_checkout_id), '') IS NULL THEN
      RETURN QUERY
      SELECT
        v_pago.id,
        v_pago.oferta_id,
        v_pago.proveedor_id,
        v_pago.monto_oferta,
        v_pago.comision_kyntu,
        v_pago.total_pagado,
        v_pago.estado_pago,
        v_pago.orden_id;
      RETURN;
    END IF;

    UPDATE public.pagos
    SET estado_pago = 'cancelado'
    WHERE id = v_pago.id
      AND lower(trim(coalesce(estado_pago, ''))) = 'pendiente';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.pagos p
    WHERE p.oferta_id = p_oferta_id
      AND lower(trim(coalesce(p.estado_pago, ''))) IN ('pagado', 'approved')
  ) THEN
    RAISE EXCEPTION 'La oferta ya tiene un pago confirmado';
  END IF;

  INSERT INTO public.pagos (
    oferta_id,
    proveedor_id,
    monto_oferta,
    comision_kyntu,
    total_pagado,
    estado_pago
  )
  VALUES (
    p_oferta_id,
    v_oferta.proveedor_id,
    v_monto,
    v_comision,
    v_total,
    'pendiente'
  )
  RETURNING * INTO v_pago;

  RETURN QUERY
  SELECT
    v_pago.id,
    v_pago.oferta_id,
    v_pago.proveedor_id,
    v_pago.monto_oferta,
    v_pago.comision_kyntu,
    v_pago.total_pagado,
    v_pago.estado_pago,
    v_pago.orden_id;
END;
$$;

COMMENT ON FUNCTION public.obtener_o_crear_pago_pendiente(uuid) IS
  'Crea o reutiliza pago pendiente del comprador para oferta pendiente_pago. Montos server-side (fórmula legacy).';

REVOKE ALL ON FUNCTION public.obtener_o_crear_pago_pendiente(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.obtener_o_crear_pago_pendiente(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.obtener_o_crear_pago_pendiente(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- RLS + grants
-- ---------------------------------------------------------------------------

ALTER TABLE public.ofertas_productos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pagos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ofertas_productos_select_related ON public.ofertas_productos;
CREATE POLICY ofertas_productos_select_related
  ON public.ofertas_productos
  FOR SELECT
  TO authenticated
  USING (
    public.es_usuario_master()
    OR public.es_proveedor_perfil(proveedor_id)
    OR public.es_dueno_lista_compras(lista_id)
  );

DROP POLICY IF EXISTS pagos_select_related ON public.pagos;
CREATE POLICY pagos_select_related
  ON public.pagos
  FOR SELECT
  TO authenticated
  USING (
    public.es_usuario_master()
    OR public.es_proveedor_perfil(proveedor_id)
    OR EXISTS (
      SELECT 1
      FROM public.ofertas_productos o
      WHERE o.id = pagos.oferta_id
        AND public.es_dueno_lista_compras(o.lista_id)
    )
  );

-- Sin policies INSERT/UPDATE/DELETE para authenticated/anon:
-- mutaciones solo vía SECURITY DEFINER RPC o service_role.

REVOKE ALL ON TABLE public.ofertas_productos FROM PUBLIC;
REVOKE ALL ON TABLE public.ofertas_productos FROM anon;
REVOKE ALL ON TABLE public.ofertas_productos FROM authenticated;
GRANT SELECT ON TABLE public.ofertas_productos TO authenticated;
GRANT ALL ON TABLE public.ofertas_productos TO service_role;

REVOKE ALL ON TABLE public.pagos FROM PUBLIC;
REVOKE ALL ON TABLE public.pagos FROM anon;
REVOKE ALL ON TABLE public.pagos FROM authenticated;
GRANT SELECT ON TABLE public.pagos TO authenticated;
GRANT ALL ON TABLE public.pagos TO service_role;

-- secuencias de pagos.id (bigint identity/serial) para service_role/RPC owner
DO $$
DECLARE
  v_seq text;
BEGIN
  SELECT pg_get_serial_sequence('public.pagos', 'id') INTO v_seq;
  IF v_seq IS NOT NULL THEN
    EXECUTE format('GRANT USAGE, SELECT ON SEQUENCE %s TO service_role', v_seq);
  END IF;
END $$;
