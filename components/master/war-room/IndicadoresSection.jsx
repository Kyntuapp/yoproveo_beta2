import { formatMoney, formatPercent } from './format';
import {
  Card,
  DimensionBlock,
  Legend,
  SectionHeader,
} from './shared';
import { DIMENSION_THEMES } from '../../../lib/war-room/constants';
import { layout } from './theme';

export default function IndicadoresSection({ data }) {
  const { indicadores, gmv, alertas } = data;

  return (
    <div>
      <SectionHeader
        icon="📊"
        title="Indicadores detallados"
        subtitle="Métricas del piloto agrupadas por dimensión (unidad comercial: producto)"
      />

      <div
        className="war-room-indicadores-layout"
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) 320px',
          gap: 20,
          alignItems: 'start',
        }}
      >
        <div>
          <DimensionBlock
            title="A. Tracción / Uso"
            items={indicadores.traccion}
            theme={DIMENSION_THEMES.traccion}
          />
          <DimensionBlock
            title="B. Liquidez / Respuesta"
            items={indicadores.liquidez}
            theme={DIMENSION_THEMES.liquidez}
          />
          <DimensionBlock
            title="C. Conversión / Ventas"
            items={indicadores.conversion}
            theme={DIMENSION_THEMES.conversion}
          />
          <DimensionBlock
            title="D. Valor / Satisfacción"
            items={indicadores.valor}
            theme={DIMENSION_THEMES.valor}
          />
          <DimensionBlock
            title="E. Adopción / Recurrencia"
            items={indicadores.adopcion}
            theme={DIMENSION_THEMES.adopcion}
          />
        </div>

        <div style={{ position: 'sticky', top: 20 }}>
          <Card title="GMV: Análisis e interpretación">
            <GmvRow label="GMV Potencial" value={formatMoney(gmv.potencial)} />
            <GmvRow
              label="GMV Potencial con cierre"
              value={formatMoney(gmv.potencial_con_cierre)}
            />
            <GmvRow label="GMV Real" value={formatMoney(gmv.real)} />
            <GmvRow
              label="GMV Real vs Potencial con cierre"
              value={
                gmv.real_vs_potencial_con_cierre_pct !== null
                  ? formatPercent(gmv.real_vs_potencial_con_cierre_pct)
                  : '—'
              }
            />
            <GmvRow
              label="GMV Real vs Potencial"
              value={
                gmv.real_vs_potencial_pct !== null
                  ? formatPercent(gmv.real_vs_potencial_pct)
                  : '—'
              }
            />
            <p
              style={{
                margin: '16px 0',
                padding: 12,
                backgroundColor: '#F8FAFC',
                borderRadius: 10,
                fontSize: 13,
                lineHeight: 1.5,
              }}
            >
              <strong>Interpretación:</strong> {gmv.interpretacion}
            </p>
          </Card>

          <Card title="Leyenda de estados" style={{ marginTop: 16 }}>
            <Legend />
          </Card>

          {alertas.length > 0 ? (
            <Card title="Próximas acciones clave" style={{ marginTop: 16 }}>
              <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.6, fontSize: 13 }}>
                {alertas.slice(0, 4).map((a) => (
                  <li key={a.indicador}>
                    <strong>{a.indicador}</strong>: {a.accion_sugerida}
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function GmvRow({ label, value }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        padding: '8px 0',
        borderBottom: '1px solid #F1F5F9',
        fontSize: 13,
      }}
    >
      <span style={{ color: '#64748B' }}>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
