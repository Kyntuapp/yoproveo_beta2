import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabaseClient';
import { useRequireMaster } from '../../lib/useRequireMaster';
import WarRoomSidebar from '../../components/master/war-room/WarRoomSidebar';
import PanoramaSection from '../../components/master/war-room/PanoramaSection';
import IndicadoresSection from '../../components/master/war-room/IndicadoresSection';
import AccionesSection from '../../components/master/war-room/AccionesSection';
import EncuestasSection from '../../components/master/war-room/EncuestasSection';
import ConfiguracionSection from '../../components/master/war-room/ConfiguracionSection';
import { formatDateDMY } from '../../components/master/war-room/format';
import { layout } from '../../components/master/war-room/theme';
import { isoDateToday } from '../../lib/war-room/utils';

const SECTION_COMPONENTS = {
  panorama: PanoramaSection,
  indicadores: IndicadoresSection,
  acciones: AccionesSection,
  encuestas: EncuestasSection,
  configuracion: ConfiguracionSection,
};

function defaultPeriodoDraft(data) {
  const inicio =
    data?.configuracion?.general?.fecha_inicio_medicion ||
    data?.encuestas?.fecha_inicio_medicion ||
    '2020-01-01';
  return {
    desde: String(inicio).slice(0, 10),
    hasta: isoDateToday(),
  };
}

export default function MasterWarRoom() {
  const router = useRouter();
  const { authorized, loading: authLoading } = useRequireMaster();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeSection, setActiveSection] = useState('panorama');
  const [periodoDraft, setPeriodoDraft] = useState(() => ({
    desde: '2020-01-01',
    hasta: isoDateToday(),
  }));
  const [periodoAplicado, setPeriodoAplicado] = useState(null);

  const cargarResumen = useCallback(async (periodo = periodoAplicado) => {
    setLoading(true);
    setError('');

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const token = session?.access_token;

      if (!token) {
        setError('No hay sesión activa.');
        return;
      }

      const params = new URLSearchParams();
      if (periodo?.desde && periodo?.hasta) {
        params.set('desde', periodo.desde);
        params.set('hasta', periodo.hasta);
      }

      const url = params.toString()
        ? `/api/master/war-room/resumen?${params.toString()}`
        : '/api/master/war-room/resumen';

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const json = await response.json();

      if (!response.ok) {
        setError(json.error || 'Error al cargar War Room.');
        setData(null);
        return;
      }

      setData(json);
    } catch (err) {
      console.error(err);
      setError('Error inesperado al cargar War Room.');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [periodoAplicado]);

  useEffect(() => {
    if (!authorized) return;
    cargarResumen();
  }, [authorized, cargarResumen]);

  useEffect(() => {
    if (!data || periodoAplicado) return;
    setPeriodoDraft(defaultPeriodoDraft(data));
  }, [data, periodoAplicado]);

  const handleApplyPeriodo = () => {
    if (!periodoDraft.desde || !periodoDraft.hasta) {
      setError('Completa ambas fechas del periodo de medición.');
      return;
    }
    if (periodoDraft.desde > periodoDraft.hasta) {
      setError('La fecha inicio debe ser anterior o igual a la fecha término.');
      return;
    }
    setError('');
    const next = { desde: periodoDraft.desde, hasta: periodoDraft.hasta };
    setPeriodoAplicado(next);
    cargarResumen(next);
  };

  if (authLoading || !authorized) {
    return (
      <div style={{ padding: 32, fontFamily: 'Arial, sans-serif' }}>
        Verificando acceso...
      </div>
    );
  }

  const SectionComponent = SECTION_COMPONENTS[activeSection] || PanoramaSection;

  return (
    <div style={layout.shell}>
      <WarRoomSidebar
        activeSection={activeSection}
        onSelect={setActiveSection}
        piloto={data?.piloto}
        onBack={() => router.push('/master')}
        onRefresh={() => cargarResumen(periodoAplicado)}
        loading={loading}
      />

      <main style={layout.main}>
        {error ? (
          <div
            style={{
              padding: 14,
              marginBottom: 20,
              borderRadius: 10,
              backgroundColor: '#FEE2E2',
              color: '#991B1B',
            }}
          >
            {error}
          </div>
        ) : null}

        {loading && !data ? (
          <div style={{ ...layout.card }}>Cargando War Room…</div>
        ) : null}

        {data ? (
          <>
            {data.periodo_medicion?.aplicado ? (
              <div
                style={{
                  marginBottom: 12,
                  padding: '12px 16px',
                  borderRadius: 10,
                  backgroundColor: '#ECFDF5',
                  border: '1px solid #A7F3D0',
                  fontSize: 13,
                  color: '#065F46',
                  lineHeight: 1.5,
                  fontWeight: 600,
                }}
              >
                Periodo de medición aplicado:{' '}
                {formatDateDMY(data.periodo_medicion.desde)} a{' '}
                {formatDateDMY(data.periodo_medicion.hasta)}
              </div>
            ) : null}

            {data.piloto?.nombre || data.encuestas?.modo_medicion_label ? (
              <div
                style={{
                  marginBottom: 20,
                  padding: '12px 16px',
                  borderRadius: 10,
                  backgroundColor: '#EEF4FF',
                  border: '1px solid #DCE6FF',
                  fontSize: 13,
                  color: '#1E3A8A',
                  lineHeight: 1.5,
                }}
              >
                {data.piloto?.nombre ? (
                  <>
                    <strong>Piloto:</strong> {data.piloto.nombre}
                    {data.piloto?.codigo ? (
                      <span style={{ color: '#64748B' }}>
                        {' '}
                        ({data.piloto.codigo})
                      </span>
                    ) : null}
                    {' · '}
                  </>
                ) : null}
                {data.encuestas?.modo_medicion_label ? (
                  <>
                    <strong>Modo medición:</strong>{' '}
                    {data.encuestas.modo_medicion_label}
                    {' · '}
                  </>
                ) : null}
                {data.encuestas?.fecha_inicio_medicion ? (
                  <>
                    <strong>Fecha inicio medición:</strong>{' '}
                    {formatDateDMY(data.encuestas.fecha_inicio_medicion)}
                  </>
                ) : null}
                {data.indice_general?.etiqueta_modo ? (
                  <span style={{ color: '#64748B' }}>
                    {' '}
                    · Evaluación: {data.indice_general.etiqueta_modo}
                  </span>
                ) : null}
                {!data.periodo_medicion?.aplicado && data.limitaciones?.operacional ? (
                  <span style={{ color: '#64748B' }}>
                    {' '}
                    · {data.limitaciones.operacional}
                  </span>
                ) : null}
              </div>
            ) : null}

            <SectionComponent
              data={data}
              warRoomControls={{
                periodoDraft,
                setPeriodoDraft,
                periodoAplicado,
                onApplyPeriodo: handleApplyPeriodo,
                loading,
              }}
            />

            {data.generado_en ? (
              <p style={{ margin: '24px 0 0', fontSize: 12, color: '#94A3B8' }}>
                Última actualización:{' '}
                {new Date(data.generado_en).toLocaleString('es-CL', {
                  timeZone: 'America/Santiago',
                })}
                {data.meta?.productos_en_scope !== undefined
                  ? ` · ${data.meta.productos_en_scope} productos · ${data.meta.ofertas_en_scope} ofertas en scope`
                  : ''}
              </p>
            ) : null}
          </>
        ) : null}

        {!loading && !data && !error ? (
          <div style={layout.card}>
            No se pudo cargar la información del War Room.
          </div>
        ) : null}
      </main>
    </div>
  );
}
