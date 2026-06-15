import { useCallback, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabaseClient';
import { useRequireMaster } from '../../lib/useRequireMaster';

const ReportChartsSection = dynamic(
  () => import('../../components/master/reportes/ReportChartsSection'),
  {
    ssr: false,
    loading: () => (
      <div style={{ padding: 20, marginBottom: 28 }}>Cargando gráficos…</div>
    ),
  }
);

const PERIODOS = [
  { id: 'hoy', label: 'Hoy' },
  { id: '7d', label: '7 días' },
  { id: '30d', label: '30 días' },
  { id: 'total', label: 'Histórico' },
];

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
      <div style={styles.kpiGrid}>{children}</div>
    </section>
  );
}

export default function MasterReportes() {
  const router = useRouter();
  const { authorized, loading: authLoading } = useRequireMaster();
  const [periodo, setPeriodo] = useState('7d');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const cargarReportes = useCallback(async () => {
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

      const response = await fetch(
        `/api/master/reportes?periodo=${encodeURIComponent(periodo)}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const json = await response.json();

      if (!response.ok) {
        setError(json.error || 'Error al cargar reportes.');
        setData(null);
        return;
      }

      setData(json);
    } catch (err) {
      console.error(err);
      setError('Error inesperado al cargar reportes.');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [periodo]);

  useEffect(() => {
    if (!authorized) return;
    cargarReportes();
  }, [authorized, cargarReportes]);

  if (authLoading || !authorized) {
    return <div style={styles.loadingPage}>Verificando acceso...</div>;
  }

  const kpis = data?.kpis;

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
          <h1 style={styles.title}>Reportes operativos</h1>
          <p style={styles.subtitle}>
            Métricas MVP para validar el modelo de licitación. Sin pagos ni
            proyecciones.
          </p>
        </div>
        <button type="button" onClick={cargarReportes} style={styles.refreshButton}>
          {loading ? 'Actualizando…' : 'Actualizar'}
        </button>
      </div>

      <div style={styles.filters}>
        {PERIODOS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setPeriodo(p.id)}
            style={{
              ...styles.filterButton,
              ...(periodo === p.id ? styles.filterButtonActive : {}),
            }}
          >
            {p.label}
          </button>
        ))}
      </div>

      {data?.periodo_label ? (
        <p style={styles.periodLabel}>Periodo: {data.periodo_label}</p>
      ) : null}

      {error ? <div style={styles.errorBox}>{error}</div> : null}

      {loading && !data ? (
        <div style={styles.loadingBox}>Cargando métricas…</div>
      ) : null}

      {kpis ? (
        <>
          <KpiSection title="Actividad">
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
          </KpiSection>

          <KpiSection title="Liquidez">
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
              value={formatTiempo(kpis.liquidez.tiempo_promedio_primera_oferta_horas)}
              hint="Usa campo fecha de la oferta"
            />
          </KpiSection>

          <KpiSection title="Conversión">
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
          </KpiSection>

          <KpiSection title="Valor generado">
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
          </KpiSection>

          <KpiSection title="Finanzas estimadas">
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
          </KpiSection>

          <div style={styles.finanzasDisclaimerBox}>
            Indicadores estimados. No representan pagos confirmados hasta
            completar la integración de Mercado Pago.
          </div>

          <ReportChartsSection
            series={data.series}
            periodoLabel={data.periodo_label}
          />
        </>
      ) : null}

      <div style={styles.disclaimerBox}>
        <strong>Métricas operativas MVP</strong>
        <ul style={styles.disclaimerList}>
          <li>
            El periodo se ancla a la <strong>fecha de publicación</strong> de
            las listas (<code>fecha_creacion</code>).
          </li>
          <li>
            El ahorro es <strong>potencial</strong>: precio de referencia menos
            la mejor oferta no rechazada por producto.
          </li>
          <li>
            La tasa de cobertura mide recepción de ofertas por lote
            publicado, <strong>no aceptación ni pago</strong>.
          </li>
          <li>
            La tasa de aceptación mide intención de compra,{' '}
            <strong>no pagos confirmados</strong>.
          </li>
          <li>
            Finanzas estimadas: GMV potencial e ingresos Kyntü al 3 % son{' '}
            <strong>proyecciones operativas</strong>, no ingresos reales.
          </li>
          <li>No incluye Excel ni proyecciones financieras futuras.</li>
          <li>
            Los gráficos de evolución muestran tendencia operativa por bucket;
            no representan pagos confirmados.
          </li>
        </ul>
        {data?.generado_en ? (
          <p style={styles.generatedAt}>
            Última actualización:{' '}
            {new Date(data.generado_en).toLocaleString('es-CL', {
              timeZone: 'America/Santiago',
            })}
          </p>
        ) : null}
      </div>
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
  refreshButton: {
    padding: '10px 18px',
    backgroundColor: '#0A4DFF',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: 12,
    cursor: 'pointer',
    fontWeight: 700,
  },
  filters: {
    display: 'flex',
    gap: 10,
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  filterButton: {
    padding: '10px 16px',
    borderRadius: 10,
    border: '1px solid #DCE6FF',
    backgroundColor: '#FFFFFF',
    cursor: 'pointer',
    fontWeight: 600,
    color: '#071B3A',
  },
  filterButtonActive: {
    backgroundColor: '#071B3A',
    color: '#FFFFFF',
    borderColor: '#071B3A',
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
  finanzasDisclaimerBox: {
    marginBottom: 28,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#EEF4FF',
    border: '1px solid #B8CCFF',
    color: '#071B3A',
    fontSize: 14,
    lineHeight: 1.5,
    fontWeight: 600,
  },
  disclaimerBox: {
    marginTop: 12,
    padding: 20,
    borderRadius: 16,
    backgroundColor: '#FFF9E6',
    border: '1px solid #F5D565',
    color: '#5C4A00',
    lineHeight: 1.5,
  },
  disclaimerList: {
    margin: '10px 0 0',
    paddingLeft: 20,
  },
  generatedAt: {
    margin: '14px 0 0',
    fontSize: 13,
    color: '#7D8798',
  },
};
