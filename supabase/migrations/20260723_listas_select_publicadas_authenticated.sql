-- =============================================================================
-- Migración: lectura de cabeceras publicadas en public.listas
-- Proyecto:   Kyntü / yoproveo_beta2
-- Archivo:    20260723_listas_select_publicadas_authenticated.sql
--
-- Problema:
--   Proveedores autenticados leen listas_compras pero no cabeceras ajenas en
--   public.listas por RLS. ofertar_productos.js filtra filas con lista_id
--   exigiendo estado = 'publicada', y las oculta cuando la cabecera no es legible.
--
-- Solución:
--   Policy SELECT aditiva (no reemplaza policies del propietario).
--   Solo expone filas con estado exactamente 'publicada'.
--   Borradores, NULL u otros estados siguen ocultos para terceros.
-- =============================================================================

ALTER TABLE public.listas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS listas_select_publicadas_authenticated ON public.listas;

CREATE POLICY listas_select_publicadas_authenticated
  ON public.listas
  FOR SELECT
  TO authenticated
  USING (estado = 'publicada');

COMMENT ON POLICY listas_select_publicadas_authenticated ON public.listas IS
  'Permite a usuarios autenticados leer cabeceras de listas publicadas (no borradores).';
