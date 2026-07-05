import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabaseClient';
import { useRequireMaster } from '../../lib/useRequireMaster';

function formatNumber(value) {
  if (value === null || value === undefined) return '—';
  return new Intl.NumberFormat('es-CL').format(value);
}

function formatPercent(value) {
  if (value === null || value === undefined) return '—';
  return (
    new Intl.NumberFormat('es-CL', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }).format(value) + ' %'
  );
}

function formatMoney(value) {
  if (value === null || value === undefined) return '—';
  return '$' + new Intl.NumberFormat('es-CL').format(value);
}

function formatTiempo(horas) {
  if (horas === null || horas === undefined) return 'Sin datos';
  if (horas < 1) {
    return `${Math.round(horas * 60)} min`;
  }
  if (horas < 24) {
    return `${horas} h`;
  }
  return `${(horas / 24).toFixed(1)} d`;
}

function formatScore(value) {
  if (value === null || value === undefined) return '—';
  return new Intl.NumberFormat('es-CL', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDate(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('es-CL', {
    timeZone: 'America/Santiago',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(value.includes('T') ? value : `${value}T12:00:00`));
}

function KpiCard({ label, value, hint }) {
  return (
    <div style={styles.kpiCard}>
      <p style={styles.kpiLabel}>{label}</p>
      <p style={styles.kpiValue}>{value}</p>
      {hint ? <p style={styles.kpiHint}>{hint}</p> : null}
    </div>
  );
}

function KpiSection({ title, children }) {
  return (
    <section style={styles.section}>
      <h2 style={styles.sectionTitle}>{title}</h2>
      {children}
    </section>
  );
}

function buildValidacionResumen(rows, pilotoCodigo) {
  const filtered = (rows || []).filter(
    (row) => !pilotoCodigo || row.piloto_codigo === pilotoCodigo
  );

  if (filtered.length === 0) {
    return null;
  }

  const resumirTipo = (tipo) => {
    const tipoRows = filtered.filter((row) => row.tipo_usuario === tipo);

    if (tipoRows.length === 0) {
      return { score_promedio: null, n_respuestas: 0 };
    }

    const nRespuestas = tipoRows.reduce(
      (sum, row) => sum + Number(row.n_respuestas || 0),
      0
    );

    if (nRespuestas === 0) {
      return { score_promedio: null, n_respuestas: 0 };
    }

    const scorePonderado = tipoRows.reduce(
      (sum, row) =>
        sum + Number(row.score_promedio || 0) * Number(row.n_respuestas || 0),
      0
    );

    return {
      score_promedio: scorePonderado / nRespuestas,
      n_respuestas: nRespuestas,
    };
  };

  return {
    comprador: resumirTipo('comprador'),
    proveedor: resumirTipo('proveedor'),
  };
}

export default function MasterWarRoom() {
  const router = useRouter();
  const { authorized, loading: authLoading } = useRequireMaster();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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

  const validacion = useMemo(
    () =>
      buildValidacionResumen(
        data?.encuesta_scores_semana_piloto,
        data?.piloto?.codigo
      ),
    [data]
  );

  if (authLoading || !authorized) {
    return <div style={styles.loadingPage}>Verificando acceso...</div>;
  }

  const kpis = data?.kpis_operativos?.kpis;

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div>
          <button
            type="button"
            onClick={() => router.push('/master')}
            style={styles.backButton}
          >
            ← Volver al panel
          </button>
          <p style={styles.kicker}>Panel interno</p>
          <h1 style={styles.title}>War Room</h1>
          <p style={styles.subtitle}>
            Validación del piloto y seguimiento de hipótesis del marketplace.
          </p>
        </div>
        <div style={styles.headerActions}>
          <button type="button" onClick={cargarResumen} style={styles.refreshButton}>
            {loading ? 'Actualizando…' : 'Actualizar'}
          </button>
        </div>
      </div>

      {error ? <div style={styles.errorBox}>{error}</div> : null}

      {loading && !data ? (
        <div style={styles.loadingBox}>Cargando War Room…</div>
      ) : null}

      {data ? (
        <>
          <KpiSection title="Piloto">
            {data.piloto ? (
              <div style={styles.kpiGrid}>
                <KpiCard label="Nombre" value={data.piloto.nombre || '—'} />
                <KpiCard
                  label="Estado"
                  value={String(data.piloto.estado || '—')}
                />
                <KpiCard
                  label="Fecha inicio"
                  value={formatDate(data.piloto.fecha_inicio)}
                />
              </div>
            ) : (
              <div style={styles.emptyBox}>
                No hay un piloto activo configurado en este momento.
              </div>
            )}
          </KpiSection>

          {data.kpis_operativos?.periodo_label ? (
            <p style={styles.periodLabel}>
              KPIs operativos · Periodo: {data.kpis_operativos.periodo_label}
            </p>
          ) : null}

          {kpis ? (
            <KpiSection title="KPIs operativos">
              <div style={styles.kpiGrid}>
                <KpiCard
                  label="Listas publicadas"
                  value={formatNumber(kpis.actividad.listas_publicadas)}
                  hint="Lotes (usuario + fecha de envío)"
                />
                <KpiCard
                  label="Productos publicados"
                  value={formatNumber(kpis.actividad.productos_publicados)}
                />
                <KpiCard
                  label="Compradores activos"
                  value={formatNumber(kpis.actividad.compradores_activos)}
                />
                <KpiCard
                  label="Proveedores activos"
                  value={formatNumber(kpis.actividad.proveedores_activos)}
                  hint="Con ofertas sobre listas del periodo"
                />
                <KpiCard
                  label="Ofertas recibidas"
                  value={formatNumber(kpis.liquidez.ofertas_recibidas)}
                />
                <KpiCard
                  label="Promedio ofertas por lista"
                  value={formatNumber(kpis.liquidez.promedio_ofertas_por_lista)}
                  hint="Ofertas ÷ lotes publicados"
                />
                <KpiCard
                  label="Tiempo promedio hasta 1.ª oferta"
                  value={formatTiempo(
                    kpis.liquidez.tiempo_promedio_primera_oferta_horas
                  )}
                  hint="Usa campo fecha de la oferta"
                />
                <KpiCard
                  label="Tasa de cobertura"
                  value={formatPercent(kpis.conversion.tasa_cobertura_pct)}
                  hint="Lotes publicados que recibieron al menos una oferta"
                />
                <KpiCard
                  label="Tasa de aceptación"
                  value={formatPercent(kpis.conversion.tasa_aceptacion_pct)}
                  hint="Ofertas aceptadas o en flujo de compra"
                />
                <KpiCard
                  label="Listas sin ofertas"
                  value={formatNumber(kpis.conversion.listas_sin_ofertas)}
                />
                <KpiCard
                  label="Listas con 1 oferta"
                  value={formatNumber(kpis.conversion.listas_con_1_oferta)}
                />
                <KpiCard
                  label="Listas con 2+ ofertas"
                  value={formatNumber(kpis.conversion.listas_con_2_o_mas_ofertas)}
                />
                <KpiCard
                  label="Ahorro potencial promedio"
                  value={formatMoney(kpis.valor.ahorro_potencial_promedio)}
                />
                <KpiCard
                  label="Ahorro potencial acumulado"
                  value={formatMoney(kpis.valor.ahorro_potencial_acumulado)}
                />
                <KpiCard
                  label="Mejor ahorro registrado"
                  value={formatMoney(kpis.valor.mejor_ahorro_registrado)}
                />
                <KpiCard
                  label="GMV potencial"
                  value={formatMoney(kpis.finanzas_estimadas.gmv_potencial)}
                  hint="Suma de precio_ofertado en ofertas aceptadas, pendientes de pago o confirmadas"
                />
                <KpiCard
                  label="Ingresos Kyntü estimados"
                  value={formatMoney(kpis.finanzas_estimadas.ingresos_kyntu_estimados)}
                  hint="Fee estimado del 3 % sobre GMV potencial"
                />
              </div>
            </KpiSection>
          ) : null}

          <KpiSection title="Validación">
            {validacion &&
            (validacion.comprador.n_respuestas > 0 ||
              validacion.proveedor.n_respuestas > 0) ? (
              <div style={styles.kpiGrid}>
                <KpiCard
                  label="Score promedio comprador"
                  value={formatScore(validacion.comprador.score_promedio)}
                  hint="Promedio ponderado (escala 1–4)"
                />
                <KpiCard
                  label="Score promedio proveedor"
                  value={formatScore(validacion.proveedor.score_promedio)}
                  hint="Promedio ponderado (escala 1–4)"
                />
                <KpiCard
                  label="Cantidad de respuestas"
                  value={formatNumber(
                    validacion.comprador.n_respuestas +
                      validacion.proveedor.n_respuestas
                  )}
                  hint="Total encuestas respondidas en el piloto"
                />
              </div>
            ) : (
              <div style={styles.emptyBox}>
                Aún no hay respuestas de encuesta registradas para el piloto
                activo. Los indicadores aparecerán cuando compradores y
                proveedores completen la encuesta semanal.
              </div>
            )}
          </KpiSection>

          {data.generado_en ? (
            <p style={styles.generatedAt}>
              Última actualización:{' '}
              {new Date(data.generado_en).toLocaleString('es-CL', {
                timeZone: 'America/Santiago',
              })}
            </p>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    padding: 32,
    fontFamily: 'Arial, sans-serif',
    background:
      'linear-gradient(135deg, #F5F8FF 0%, #EEF4FF 45%, #FFFFFF 100%)',
    color: '#071B3A',
  },
  loadingPage: {
    padding: 32,
    fontFamily: 'Arial, sans-serif',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 20,
    marginBottom: 24,
    flexWrap: 'wrap',
  },
  backButton: {
    marginBottom: 12,
    padding: '8px 14px',
    borderRadius: 8,
    border: '1px solid #DCE6FF',
    backgroundColor: '#FFFFFF',
    cursor: 'pointer',
    fontWeight: 600,
  },
  kicker: {
    margin: '0 0 6px',
    color: '#0A4DFF',
    fontSize: 13,
    fontWeight: 700,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  title: {
    margin: '0 0 8px',
    fontSize: 32,
    fontWeight: 800,
  },
  subtitle: {
    margin: 0,
    color: '#4A5872',
    maxWidth: 640,
    lineHeight: 1.5,
  },
  headerActions: {
    display: 'flex',
    gap: 10,
    flexWrap: 'wrap',
  },
  refreshButton: {
    padding: '10px 18px',
    backgroundColor: '#0A4DFF',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: 12,
    cursor: 'pointer',
    fontWeight: 700,
  },
  periodLabel: {
    margin: '0 0 20px',
    color: '#4A5872',
    fontWeight: 600,
  },
  errorBox: {
    padding: 14,
    marginBottom: 20,
    borderRadius: 10,
    backgroundColor: '#FEE2E2',
    color: '#991B1B',
  },
  loadingBox: {
    padding: 20,
    marginBottom: 20,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    border: '1px solid #DCE6FF',
  },
  emptyBox: {
    padding: 20,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    border: '1px solid #DCE6FF',
    color: '#4A5872',
    lineHeight: 1.5,
  },
  section: {
    marginBottom: 28,
  },
  sectionTitle: {
    margin: '0 0 14px',
    fontSize: 20,
    fontWeight: 800,
  },
  kpiGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
    gap: 16,
  },
  kpiCard: {
    backgroundColor: '#FFFFFF',
    border: '1px solid #DCE6FF',
    borderRadius: 16,
    padding: 18,
    boxShadow: '0 8px 24px rgba(10, 77, 255, 0.06)',
  },
  kpiLabel: {
    margin: '0 0 8px',
    fontSize: 13,
    fontWeight: 700,
    color: '#4A5872',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  kpiValue: {
    margin: 0,
    fontSize: 28,
    fontWeight: 800,
    color: '#071B3A',
  },
  kpiHint: {
    margin: '8px 0 0',
    fontSize: 12,
    color: '#7D8798',
    lineHeight: 1.4,
  },
  generatedAt: {
    margin: '14px 0 0',
    fontSize: 13,
    color: '#7D8798',
  },
};
