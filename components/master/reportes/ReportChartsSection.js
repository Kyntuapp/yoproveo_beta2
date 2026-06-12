import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const CHART_HEIGHT = 260;

function formatTooltipNumber(value) {
  return new Intl.NumberFormat('es-CL').format(value);
}

function formatTooltipPercent(value) {
  return (
    new Intl.NumberFormat('es-CL', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }).format(value) + ' %'
  );
}

function formatTooltipMoney(value) {
  return '$' + new Intl.NumberFormat('es-CL').format(value);
}

function ChartCard({ title, hint, children }) {
  return (
    <div style={styles.chartCard}>
      <h3 style={styles.chartTitle}>{title}</h3>
      {hint ? <p style={styles.chartHint}>{hint}</p> : null}
      <div style={styles.chartBody}>{children}</div>
    </div>
  );
}

function EmptyChart({ message }) {
  return <p style={styles.emptyChart}>{message}</p>;
}

function hasAnyData(puntos, key) {
  return (puntos || []).some((punto) => Number(punto[key]) > 0);
}

export default function ReportChartsSection({ series, periodoLabel }) {
  const puntos = series?.puntos || [];
  const granularidad = series?.granularidad || 'day';

  const granularidadLabel =
    granularidad === 'hour'
      ? 'por hora'
      : granularidad === 'month'
        ? 'por mes'
        : 'por día';

  if (puntos.length === 0) {
    return (
      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>Evolución</h2>
        <EmptyChart message="Sin datos en este periodo." />
      </section>
    );
  }

  return (
    <section style={styles.section}>
      <h2 style={styles.sectionTitle}>Evolución</h2>
      <p style={styles.sectionSubtitle}>
        {periodoLabel} · {granularidadLabel} · anclado a fecha de publicación
        de listas
      </p>

      <div style={styles.chartsGrid}>
        <ChartCard
          title="Listas publicadas"
          hint="Lotes publicados por bucket"
        >
          {hasAnyData(puntos, 'listas_publicadas') ? (
            <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
              <BarChart data={puntos}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E8EEFF" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip formatter={formatTooltipNumber} />
                <Bar dataKey="listas_publicadas" fill="#0A4DFF" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart message="Sin listas en este periodo." />
          )}
        </ChartCard>

        <ChartCard title="Ofertas recibidas" hint="Ofertas sobre listas del bucket">
          {hasAnyData(puntos, 'ofertas_recibidas') ? (
            <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
              <BarChart data={puntos}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E8EEFF" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip formatter={formatTooltipNumber} />
                <Bar dataKey="ofertas_recibidas" fill="#2563EB" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart message="Sin ofertas en este periodo." />
          )}
        </ChartCard>

        <ChartCard title="Tasa de cobertura" hint="Lotes con al menos una oferta">
          {hasAnyData(puntos, 'tasa_cobertura_pct') ? (
            <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
              <LineChart data={puntos}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E8EEFF" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                <Tooltip formatter={formatTooltipPercent} />
                <Line
                  type="monotone"
                  dataKey="tasa_cobertura_pct"
                  stroke="#071B3A"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart message="Sin cobertura registrada." />
          )}
        </ChartCard>

        <ChartCard
          title="Ahorro potencial acumulado"
          hint="Serie corrida por bucket"
        >
          {hasAnyData(puntos, 'ahorro_potencial_acumulado') ? (
            <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
              <LineChart data={puntos}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E8EEFF" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={formatTooltipMoney} />
                <Line
                  type="monotone"
                  dataKey="ahorro_potencial_acumulado"
                  stroke="#059669"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart message="Sin ahorro potencial en este periodo." />
          )}
        </ChartCard>

        <ChartCard title="GMV potencial" hint="Ofertas en flujo de compra">
          {hasAnyData(puntos, 'gmv_potencial') ? (
            <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
              <BarChart data={puntos}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E8EEFF" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={formatTooltipMoney} />
                <Bar dataKey="gmv_potencial" fill="#7C3AED" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart message="Sin GMV potencial en este periodo." />
          )}
        </ChartCard>
      </div>

      <p style={styles.seriesDisclaimer}>
        Series ancladas a <strong>fecha_creacion</strong> de listas. Ahorro
        acumulado es corrido; GMV es estimado y no representa pagos confirmados.
      </p>
    </section>
  );
}

const styles = {
  section: {
    marginBottom: 28,
  },
  sectionTitle: {
    margin: '0 0 8px',
    fontSize: 20,
    fontWeight: 800,
  },
  sectionSubtitle: {
    margin: '0 0 18px',
    color: '#4A5872',
    fontSize: 14,
  },
  chartsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
    gap: 18,
  },
  chartCard: {
    backgroundColor: '#FFFFFF',
    border: '1px solid #DCE6FF',
    borderRadius: 16,
    padding: 16,
    boxShadow: '0 8px 24px rgba(10, 77, 255, 0.06)',
  },
  chartTitle: {
    margin: '0 0 4px',
    fontSize: 15,
    fontWeight: 800,
    color: '#071B3A',
  },
  chartHint: {
    margin: '0 0 12px',
    fontSize: 12,
    color: '#7D8798',
  },
  chartBody: {
    width: '100%',
    minHeight: CHART_HEIGHT,
  },
  emptyChart: {
    margin: 0,
    padding: '48px 12px',
    textAlign: 'center',
    color: '#7D8798',
    fontSize: 14,
  },
  seriesDisclaimer: {
    margin: '16px 0 0',
    fontSize: 13,
    color: '#4A5872',
    lineHeight: 1.5,
  },
};
