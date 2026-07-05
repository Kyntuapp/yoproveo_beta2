import { supabaseAdmin } from '../supabaseAdmin';
import { fetchMasterReportPayload } from '../reportes/fetchReportData';

export async function fetchWarRoomResumen() {
  const { data: piloto, error: pilotoError } = await supabaseAdmin
    .from('pilotos')
    .select('*')
    .eq('activo', true)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (pilotoError) {
    throw new Error('Error al cargar piloto: ' + pilotoError.message);
  }

  const reporte = await fetchMasterReportPayload('7d');

  const { data: encuestaScoresSemanaPiloto, error: encuestaError } =
    await supabaseAdmin.from('v_encuesta_scores_semana_piloto').select('*');

  if (encuestaError) {
    throw new Error(
      'Error al cargar encuesta semana piloto: ' + encuestaError.message
    );
  }

  return {
    generado_en: new Date().toISOString(),
    piloto,
    kpis_operativos: {
      periodo: reporte.periodo,
      periodo_label: reporte.periodo_label,
      kpis: reporte.kpis,
    },
    encuesta_scores_semana_piloto: encuestaScoresSemanaPiloto || [],
  };
}
