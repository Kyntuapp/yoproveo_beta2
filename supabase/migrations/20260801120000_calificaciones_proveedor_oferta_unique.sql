-- =============================================================================
-- Una calificación por oferta (calificaciones_proveedor.oferta_id)
-- =============================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.calificaciones_proveedor
    GROUP BY oferta_id
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION
      'calificaciones_proveedor tiene oferta_id duplicados; resolver antes de aplicar UNIQUE';
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS calificaciones_proveedor_oferta_id_unique
  ON public.calificaciones_proveedor (oferta_id);

COMMENT ON INDEX public.calificaciones_proveedor_oferta_id_unique IS
  'Impide calificar dos veces la misma oferta.';
