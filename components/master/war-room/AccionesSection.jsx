import { INDICATOR_ICONS, SECTION_ICONS } from '../../../lib/war-room/constants';
import { Card, EmptyState, SectionHeader, StatusBadge } from './shared';
import { layout } from './theme';

export default function AccionesSection({ data }) {
  const { alertas, acciones_priorizadas, seguimiento_acciones, conclusiones_semana } =
    data;

  return (
    <div>
      <SectionHeader
        icon="⚡"
        title="Acciones y conclusiones"
        subtitle="Solo indicadores que requieren intervención (observación o riesgo)"
      />

      <Card
        icon={SECTION_ICONS.hallazgos}
        title="A. Hallazgos clave"
        style={{ marginBottom: 16 }}
      >
        {alertas.length === 0 ? (
          <EmptyState icon="✅">
            No hay indicadores en observación o riesgo en este momento. El piloto
            avanza sin alertas activas.
          </EmptyState>
        ) : (
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {alertas.map((a) => (
              <li
                key={a.indicador}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 12px',
                  borderRadius: 10,
                  backgroundColor: a.estado?.bg || '#F8FAFC',
                  borderLeft: `4px solid ${a.estado?.color || '#D97706'}`,
                }}
              >
                <span style={{ fontSize: 20 }} aria-hidden="true">
                  {INDICATOR_ICONS[a.indicador_id] || '⚠️'}
                </span>
                <div style={{ flex: 1 }}>
                  <strong>{a.indicador}</strong>
                </div>
                <TrafficLight estado={a.estado} />
                <StatusBadge estado={a.estado} />
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card
        icon={SECTION_ICONS.acciones_priorizadas}
        title="B. Acciones priorizadas"
        style={{ marginBottom: 16 }}
      >
        {acciones_priorizadas.length === 0 ? (
          <EmptyState icon="📌">
            Sin acciones pendientes por indicadores en alerta. Cuando un indicador entre
            en observación o riesgo, aparecerá aquí con prioridad, icono y detalle.
          </EmptyState>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {acciones_priorizadas.map((accion) => (
              <div
                key={accion.indicador}
                style={{
                  border: '1px solid #E2E8F0',
                  borderRadius: 12,
                  padding: 14,
                  borderLeft: `5px solid ${accion.estado?.color || '#D97706'}`,
                  backgroundColor: accion.estado?.bg || '#FFFFFF',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 8,
                    marginBottom: 10,
                    flexWrap: 'wrap',
                    alignItems: 'center',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 22 }} aria-hidden="true">
                      {INDICATOR_ICONS[accion.indicador_id] || '⚠️'}
                    </span>
                    <div>
                      <strong>{accion.indicador}</strong>
                      <p style={{ margin: '2px 0 0', fontSize: 11, color: '#64748B' }}>
                        Indicador: {accion.indicador_id}
                      </p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <TrafficLight estado={accion.estado} />
                    <StatusBadge estado={accion.estado} />
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        padding: '3px 8px',
                        borderRadius: 6,
                        backgroundColor:
                          accion.prioridad === 'Alta' ? '#FEE2E2' : '#FFF7ED',
                        color: accion.prioridad === 'Alta' ? '#991B1B' : '#9A3412',
                      }}
                    >
                      {accion.prioridad}
                    </span>
                  </div>
                </div>
                <div style={layout.grid3}>
                  <Field label="Valor actual" value={String(accion.valor_actual ?? '—')} />
                  <Field label="Esperado" value={String(accion.esperado ?? '—')} />
                  <Field label="Brecha" value={String(accion.brecha ?? '—')} />
                  <Field label="Causa probable" value={accion.causa_probable} />
                  <Field label="Acción sugerida" value={accion.accion_sugerida} />
                  <Field label="Responsable" value={accion.responsable} />
                  <Field label="Plazo sugerido" value={accion.plazo_sugerido} />
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card
        icon={SECTION_ICONS.seguimiento}
        title="C. Seguimiento de acciones"
        style={{ marginBottom: 16 }}
      >
        {seguimiento_acciones.length === 0 ? (
          <EmptyState icon="📋">
            Sin historial persistente de acciones (pendiente de implementación).
          </EmptyState>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr>
                {['Acción', 'Responsable', 'Estado', 'Fecha revisión', 'Comentario'].map(
                  (h) => (
                    <th
                      key={h}
                      style={{
                        textAlign: 'left',
                        padding: '8px 6px',
                        borderBottom: '1px solid #E2E8F0',
                      }}
                    >
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {seguimiento_acciones.map((row, i) => (
                <tr key={i}>
                  <td style={{ padding: '8px 6px' }}>{row.accion}</td>
                  <td style={{ padding: '8px 6px' }}>{row.responsable}</td>
                  <td style={{ padding: '8px 6px' }}>{row.estado}</td>
                  <td style={{ padding: '8px 6px' }}>{row.fecha_revision}</td>
                  <td style={{ padding: '8px 6px' }}>{row.comentario}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card icon={SECTION_ICONS.conclusiones} title="D. Conclusiones de la semana">
        <div style={layout.grid2}>
          <div>
            <h4 style={{ margin: '0 0 8px' }}>Hipótesis validadas</h4>
            {conclusiones_semana.hipotesis_validadas.length === 0 ? (
              <p style={{ margin: 0, color: '#64748B', fontSize: 13 }}>
                Ninguna hipótesis en estado validado aún.
              </p>
            ) : (
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
                {conclusiones_semana.hipotesis_validadas.map((h) => (
                  <li key={h}>{h}</li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <h4 style={{ margin: '0 0 8px' }}>Hipótesis en observación</h4>
            {conclusiones_semana.hipotesis_observacion.length === 0 ? (
              <p style={{ margin: 0, color: '#64748B', fontSize: 13 }}>
                Sin hipótesis en observación o riesgo.
              </p>
            ) : (
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
                {conclusiones_semana.hipotesis_observacion.map((h) => (
                  <li key={h}>{h}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
        <div style={{ marginTop: 16 }}>
          <h4 style={{ margin: '0 0 8px' }}>Decisiones sugeridas</h4>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.6 }}>
            {conclusiones_semana.decisiones_sugeridas.map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
        </div>
      </Card>
    </div>
  );
}

function TrafficLight({ estado }) {
  const color = estado?.color || '#94A3B8';
  return (
    <span
      title={estado?.label || 'Estado'}
      style={{
        width: 12,
        height: 12,
        borderRadius: '50%',
        backgroundColor: color,
        boxShadow: `0 0 0 2px ${color}33`,
        flexShrink: 0,
      }}
    />
  );
}

function Field({ label, value }) {
  return (
    <div>
      <p style={{ margin: 0, fontSize: 11, color: '#64748B', fontWeight: 600 }}>
        {label}
      </p>
      <p style={{ margin: '2px 0 0', fontSize: 13 }}>{value}</p>
    </div>
  );
}
