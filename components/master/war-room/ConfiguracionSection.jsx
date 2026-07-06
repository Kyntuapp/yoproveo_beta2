import { SECTION_ICONS } from '../../../lib/war-room/constants';
import { formatDateDMY } from './format';
import { Card, SectionHeader } from './shared';
import { layout } from './theme';

export default function ConfiguracionSection({ data, warRoomControls }) {
  const config = data.configuracion;

  if (!config) {
    return (
      <div>
        <SectionHeader
          icon="⚙️"
          title="Configuración del piloto"
          subtitle="Parámetros y exportaciones del War Room"
        />
        <Card>Sin datos de configuración disponibles.</Card>
      </div>
    );
  }

  const { general, participantes, encuestas, indicadores_visibles } = config;

  return (
    <div>
      <SectionHeader
        icon="⚙️"
        title="Configuración del piloto"
        subtitle="Vista informativa — sin edición persistente por ahora"
      />

      <p
        style={{
          margin: '0 0 20px',
          padding: '12px 16px',
          borderRadius: 10,
          backgroundColor: '#FFF7ED',
          border: '1px solid #FED7AA',
          fontSize: 13,
          color: '#9A3412',
          lineHeight: 1.5,
          fontWeight: 600,
        }}
      >
        Esta pantalla es informativa en esta versión. La edición de fechas, participantes,
        metas, activación de encuesta y exportaciones reales se implementará en el
        siguiente bloque.
      </p>

      <Card title="A. General" style={{ marginBottom: 16 }}>
        <InfoGrid
          rows={[
            ['Código', general.codigo],
            ['Nombre del piloto', general.nombre],
            ['Tipo', general.tipo],
            ['Estado', general.estado],
            ['Encuesta activa', general.activo],
            ['Fecha inicio', formatDateDMY(general.fecha_inicio)],
            ['Fecha término', formatDateDMY(general.fecha_termino)],
            ['Modo medición', general.modo_medicion],
            ['Fecha inicio medición', formatDateDMY(general.fecha_inicio_medicion)],
            [
              'Operación desde',
              formatDateDMY(general.operacional_desde),
            ],
            [
              'Operación hasta',
              formatDateDMY(general.operacional_hasta),
            ],
            ['Criterio operacional', general.operacional_criterio],
            [
              'Meta tiempo primera oferta (horas)',
              general.meta_tiempo_primera_oferta_horas ??
                general.tiempo_meta_primera_oferta_horas,
            ],
            ['Meta listas publicadas', general.objetivo_listas],
            ['Meta productos publicados', general.objetivo_productos],
            ['Meta ofertas', general.objetivo_ofertas ?? '—'],
            ['Meta cobertura productos (%)', general.meta_cobertura_productos],
            ['Meta tasa cierre productos (%)', general.meta_tasa_cierre_productos],
            [
              'Meta productos con cierre (%)',
              general.meta_productos_con_cierre_pct,
            ],
            ['Meta conexiones por usuario', general.meta_conexiones_por_usuario],
            ['Meta frecuencia semanal', general.meta_frecuencia_semanal],
          ]}
        />
      </Card>

      <Card title="B. Participantes" style={{ marginBottom: 16 }}>
        <InfoGrid
          rows={[
            ['Compradores esperados', participantes.compradores_esperados],
            ['Proveedores esperados', participantes.proveedores_esperados],
            ['Usuarios elegibles (encuestas)', participantes.usuarios_elegibles],
            ['Criterio actual de medición', participantes.criterio],
          ]}
        />
      </Card>

      <Card title="C. Periodo de medición" style={{ marginBottom: 16 }}>
        <p
          style={{
            margin: '0 0 14px',
            fontSize: 13,
            color: '#64748B',
            lineHeight: 1.5,
          }}
        >
          Rango temporal local (sin persistencia en BD) para evaluar indicadores con los
          datos del periodo seleccionado.
        </p>
        {warRoomControls ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>
              Fecha inicio
              <input
                type="date"
                value={warRoomControls.periodoDraft.desde}
                onChange={(e) =>
                  warRoomControls.setPeriodoDraft((prev) => ({
                    ...prev,
                    desde: e.target.value,
                  }))
                }
                disabled={warRoomControls.loading}
                style={{
                  display: 'block',
                  marginTop: 6,
                  padding: '8px 10px',
                  borderRadius: 8,
                  border: '1px solid #CBD5E1',
                  fontSize: 13,
                  width: '100%',
                  maxWidth: 280,
                }}
              />
            </label>
            <label style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>
              Fecha término
              <input
                type="date"
                value={warRoomControls.periodoDraft.hasta}
                onChange={(e) =>
                  warRoomControls.setPeriodoDraft((prev) => ({
                    ...prev,
                    hasta: e.target.value,
                  }))
                }
                disabled={warRoomControls.loading}
                style={{
                  display: 'block',
                  marginTop: 6,
                  padding: '8px 10px',
                  borderRadius: 8,
                  border: '1px solid #CBD5E1',
                  fontSize: 13,
                  width: '100%',
                  maxWidth: 280,
                }}
              />
            </label>
            <button
              type="button"
              onClick={warRoomControls.onApplyPeriodo}
              disabled={warRoomControls.loading}
              style={{
                alignSelf: 'flex-start',
                padding: '10px 16px',
                borderRadius: 8,
                border: 'none',
                backgroundColor: '#0A4DFF',
                color: '#FFFFFF',
                fontWeight: 700,
                fontSize: 13,
                cursor: warRoomControls.loading ? 'wait' : 'pointer',
                opacity: warRoomControls.loading ? 0.7 : 1,
              }}
            >
              Aplicar periodo de medición
            </button>
            {warRoomControls.periodoAplicado ? (
              <p style={{ margin: 0, fontSize: 13, color: '#059669', fontWeight: 600 }}>
                Periodo de medición aplicado:{' '}
                {formatDateDMY(warRoomControls.periodoAplicado.desde)}{' '}
                a {formatDateDMY(warRoomControls.periodoAplicado.hasta)}
              </p>
            ) : null}
          </div>
        ) : (
          <p style={{ margin: 0, color: '#64748B', fontSize: 13 }}>
            Controles no disponibles.
          </p>
        )}
      </Card>

      <Card title="D. Encuestas" style={{ marginBottom: 16 }}>
        <InfoGrid
          rows={[
            ['Estado encuesta', encuestas.estado_encuesta],
            ['Código piloto encuesta', encuestas.piloto_codigo],
            ['Modo medición', encuestas.modo_medicion],
            ['Fecha inicio medición', formatDateDMY(encuestas.fecha_inicio_medicion)],
          ]}
        />
      </Card>

      <Card title="E. Indicadores visibles" style={{ marginBottom: 16 }}>
        {indicadores_visibles?.length ? (
          <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.7, fontSize: 13 }}>
            {indicadores_visibles.map((nombre) => (
              <li key={nombre}>{nombre}</li>
            ))}
          </ul>
        ) : (
          <p style={{ margin: 0, color: '#64748B' }}>Sin indicadores configurados.</p>
        )}
      </Card>

      <Card icon={SECTION_ICONS.export_resumen} title="F. Exportaciones">
        <p
          style={{
            margin: '0 0 8px',
            fontSize: 13,
            color: '#64748B',
            fontWeight: 600,
            lineHeight: 1.5,
          }}
        >
          Exportaciones pendientes de implementación funcional.
        </p>
        <p style={{ margin: '0 0 16px', fontSize: 13, color: '#94A3B8', lineHeight: 1.5 }}>
          Los botones están preparados visualmente. La descarga real estará disponible
          próximamente.
        </p>
        <div style={{ ...layout.grid2, gap: 12 }}>
          <ExportButton
            icon={SECTION_ICONS.export_resumen}
            label="Descargar resumen ejecutivo"
            hint="Futuro PDF o Excel con estado general, hipótesis, indicadores, GMV, encuestas y acciones."
          />
          <ExportButton
            icon={SECTION_ICONS.export_encuestas}
            label="Descargar base de encuestas"
            hint="Futuro Excel con una fila por encuesta: piloto, semana, fecha, usuario, tipo, preguntas y comentario."
          />
        </div>
      </Card>
    </div>
  );
}

function InfoGrid({ rows }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {rows.map(([label, value]) => (
        <div
          key={label}
          style={{
            display: 'grid',
            gridTemplateColumns: '220px 1fr',
            gap: 12,
            fontSize: 13,
            alignItems: 'start',
          }}
        >
          <span style={{ color: '#64748B', fontWeight: 600 }}>{label}</span>
          <span style={{ fontWeight: 700 }}>{value ?? '—'}</span>
        </div>
      ))}
    </div>
  );
}

function ExportButton({ icon, label, hint }) {
  return (
    <div
      style={{
        padding: 14,
        borderRadius: 12,
        border: '1px dashed #CBD5E1',
        backgroundColor: '#F8FAFC',
      }}
    >
      <button
        type="button"
        disabled
        title="Próximamente"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          width: '100%',
          padding: '10px 14px',
          borderRadius: 8,
          border: '1px solid #E2E8F0',
          backgroundColor: '#FFFFFF',
          color: '#94A3B8',
          fontWeight: 700,
          fontSize: 13,
          cursor: 'not-allowed',
          marginBottom: 8,
        }}
      >
        <span aria-hidden="true">{icon}</span>
        {label}
        <span
          style={{
            marginLeft: 'auto',
            fontSize: 11,
            padding: '2px 8px',
            borderRadius: 999,
            backgroundColor: '#F1F5F9',
          }}
        >
          Próximamente
        </span>
      </button>
      <p style={{ margin: 0, fontSize: 12, color: '#94A3B8', lineHeight: 1.4 }}>{hint}</p>
    </div>
  );
}
