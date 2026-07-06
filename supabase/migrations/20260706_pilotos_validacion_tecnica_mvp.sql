-- Modo de medición en el piloto único mvp_2026 (War Room + encuestas)
-- No crea pilotos adicionales; extiende la fila existente.

ALTER TABLE public.pilotos
  ADD COLUMN IF NOT EXISTS modo_medicion text NULL;

ALTER TABLE public.pilotos
  ADD COLUMN IF NOT EXISTS tipo text NULL
  CHECK (tipo IS NULL OR tipo IN ('prueba', 'oficial'));

ALTER TABLE public.pilotos
  ADD COLUMN IF NOT EXISTS fecha_inicio_medicion_encuestas date NULL;

COMMENT ON COLUMN public.pilotos.modo_medicion IS
  'validacion_tecnica | piloto_oficial — filtro analítico War Room sobre el mismo piloto mvp_2026.';

COMMENT ON COLUMN public.pilotos.tipo IS
  'Clasificación del piloto (prueba | oficial). mvp_2026 permanece como piloto oficial del MVP.';

COMMENT ON COLUMN public.pilotos.fecha_inicio_medicion_encuestas IS
  'Ancla de medición en modo validacion_tecnica. Permite incluir encuestas/operación de prueba.';

UPDATE public.pilotos
SET
  nombre = 'Piloto MVP Kyntü 2026',
  fecha_inicio = DATE '2026-07-13',
  fecha_termino = DATE '2026-09-30',
  estado = 'activo',
  activo = true,
  modo_medicion = 'validacion_tecnica',
  tipo = 'oficial',
  fecha_inicio_medicion_encuestas = DATE '2020-01-01'
WHERE codigo = 'mvp_2026';
