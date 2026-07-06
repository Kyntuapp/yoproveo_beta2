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

const SECTION_COMPONENTS = {
  panorama: PanoramaSection,
  indicadores: IndicadoresSection,
  acciones: AccionesSection,
  encuestas: EncuestasSection,
  configuracion: ConfiguracionSection,
};

export default function MasterWarRoom() {
  const router = useRouter();
  const { authorized, loading: authLoading } = useRequireMaster();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeSection, setActiveSection] = useState('panorama');

  const cargarResumen = useCallback(async () => {
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

      const response = await fetch('/api/master/war-room/resumen', {
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
  }, []);

  useEffect(() => {
    if (!authorized) return;
    cargarResumen();
  }, [authorized, cargarResumen]);

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
        onRefresh={cargarResumen}
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
            {data.encuestas?.modo_medicion_label ||
            data.encuestas?.fecha_inicio_medicion ? (
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
                <span style={{ color: '#64748B' }}>
                  {' '}
                  · Filtro analítico War Room (configurable en{' '}
                  <code style={{ fontSize: 12 }}>lib/war-room/constants.js</code>
                  ). No modifica datos ni el flujo de encuesta del usuario.
                </span>
              </div>
            ) : null}
            <SectionComponent data={data} />
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
