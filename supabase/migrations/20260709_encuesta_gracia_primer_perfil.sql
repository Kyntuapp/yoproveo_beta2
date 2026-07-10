-- Gracia de 7 días desde creación del perfil antes de la primera encuesta.
-- La cadencia entre respuestas (7 días desde la última) se mantiene igual.

DROP FUNCTION IF EXISTS public.encuesta_esta_vencida(timestamptz);

CREATE OR REPLACE FUNCTION public.encuesta_esta_vencida(
  p_ultima timestamptz,
  p_creado timestamptz
)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT
    CASE
      WHEN p_ultima IS NULL THEN now() >= p_creado + interval '7 days'
      ELSE now() >= p_ultima + interval '7 days'
    END;
$$;

COMMENT ON FUNCTION public.encuesta_esta_vencida(timestamptz, timestamptz) IS
  'True si la encuesta puede mostrarse o enviarse: sin respuestas previas, solo después de 7 días desde p_creado (fecha creación del perfil); con respuestas previas, 7 días desde p_ultima.';

GRANT EXECUTE ON FUNCTION public.encuesta_esta_vencida(timestamptz, timestamptz) TO authenticated;
