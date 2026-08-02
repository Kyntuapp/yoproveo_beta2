-- =============================================================================
-- Backfill propuesto: ofertas calificadas aún en recepcion_conforme → pagada
-- NO aplicar en producción sin revisar el conteo previo.
-- =============================================================================

-- Conteo de filas afectadas (ejecutar primero):
-- SELECT COUNT(*) AS filas_a_backfillear
-- FROM public.ofertas_productos o
-- INNER JOIN public.calificaciones_proveedor c ON c.oferta_id = o.id
-- WHERE lower(trim(o.estado)) = 'recepcion_conforme';

-- Detalle opcional:
-- SELECT o.id, o.lista_id, o.estado, c.id AS calificacion_id, c.created_at
-- FROM public.ofertas_productos o
-- INNER JOIN public.calificaciones_proveedor c ON c.oferta_id = o.id
-- WHERE lower(trim(o.estado)) = 'recepcion_conforme'
-- ORDER BY c.created_at DESC;

-- Backfill (aplicar solo tras revisión manual):
-- UPDATE public.ofertas_productos o
-- SET estado = 'pagada'
-- FROM public.calificaciones_proveedor c
-- WHERE c.oferta_id = o.id
--   AND lower(trim(o.estado)) = 'recepcion_conforme';
