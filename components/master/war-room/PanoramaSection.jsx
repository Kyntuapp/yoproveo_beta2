import { formatDate, formatNumber, formatPercent } from './format';
import { Card, ProgressBar, SectionHeader, StatusBadge } from './shared';
import { SECTION_ICONS, HIPOTESIS_ICONS } from '../../../lib/war-room/constants';
import { layout } from './theme';

const TRACK_PAD = 52;

export default function PanoramaSection({ data }) {
  const {
    timeline,
    indice_general,
    proximo_hito,
    hipotesis,
    resumen_ejecutivo,
    universo_encuestas,
  } = data;

  return (
    <div>
      <SectionHeader
        icon="🗺️"
        title="Panorama general"
        subtitle="Estado ejecutivo del piloto y avance de hipótesis"
      />

      <Card icon={SECTION_ICONS.timeline} title="Línea de tiempo del piloto" style={{ marginBottom: 16 }}>
        <TimelineBar timeline={timeline} />
      </Card>

      <div style={{ ...layout.grid2, marginBottom: 16 }}>
        <Card icon={SECTION_ICONS.estado_general} title="Estado general del piloto">
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              marginBottom: 12,
              flexWrap: 'wrap',
            }}
          >
            {indice_general.indice !== null ? (
              <p style={{ margin: 0, fontSize: 48, fontWeight: 800, lineHeight: 1 }}>
                {formatPercent(indice_general.indice)}
              </p>
            ) : null}
            <StatusBadge estado={indice_general.estado} />
          </div>
          <p style={{ margin: '0 0 8px', color: '#64748B', lineHeight: 1.5 }}>
            {indice_general.interpretacion}
          </p>
          {indice_general.criterio ? (
            <p style={{ margin: '0 0 8px', fontSize: 12, color: '#94A3B8', lineHeight: 1.5 }}>
              {indice_general.criterio}
            </p>
          ) : null}
          {indice_general.indice_meta_final !== null &&
          indice_general.indice_meta_final !== undefined ? (
            <p style={{ margin: 0, fontSize: 13, color: '#94A3B8' }}>
              Avance vs meta final (referencia):{' '}
              <strong style={{ color: '#64748B' }}>
                {formatPercent(indice_general.indice_meta_final)}
              </strong>
              {' · '}
              No define el estado actual del piloto.
            </p>
          ) : null}
        </Card>

        <Card title="Ponderación del índice general">
          <p style={{ margin: '0 0 12px', fontSize: 12, color: '#64748B' }}>
            Cada dimensión usa cumplimiento a la fecha (valor actual / esperado hoy).
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {indice_general.detalle.map((item) => (
              <div key={item.id}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginBottom: 4,
                    fontSize: 13,
                    fontWeight: 600,
                  }}
                >
                  <span>{item.label}</span>
                  <span>
                    {item.valor !== null ? formatPercent(item.valor) : '—'} · {item.peso}%
                  </span>
                </div>
                <ProgressBar value={item.valor ?? 0} color={item.color} height={6} />
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div style={{ ...layout.grid2, marginBottom: 16 }}>
        <Card icon={SECTION_ICONS.resumen} title="Resumen ejecutivo">
          <ResumenEjecutivoBlock resumen={resumen_ejecutivo} />
        </Card>
        <Card icon={SECTION_ICONS.proximo_hito} title="Próximo hito">
          <p style={{ margin: '0 0 6px', fontSize: 18, fontWeight: 800 }}>
            {proximo_hito.nombre}
          </p>
          <p style={{ margin: '0 0 4px', color: '#64748B' }}>
            {formatNumber(proximo_hito.dias_restantes)} días restantes
          </p>
          <p style={{ margin: 0, fontSize: 13 }}>
            Fecha estimada: {formatDate(proximo_hito.fecha_estimada)}
          </p>
        </Card>
      </div>

      <Card icon={SECTION_ICONS.hipotesis}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: 16,
            marginBottom: 16,
            flexWrap: 'wrap',
          }}
        >
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>
            Estado de hipótesis del piloto
          </h3>
          {universo_encuestas ? (
            <p
              style={{
                margin: 0,
                fontSize: 13,
                color: '#64748B',
                lineHeight: 1.5,
                textAlign: 'right',
              }}
            >
              Encuestas:{' '}
              <strong style={{ color: '#0F172A' }}>
                {formatNumber(universo_encuestas.respondidas)}
              </strong>{' '}
              / {formatNumber(universo_encuestas.esperadas_fecha)} esperadas a la
              fecha · {formatNumber(universo_encuestas.esperadas_cierre)} esperadas
              al cierre
            </p>
          ) : null}
        </div>
        <div style={layout.grid3}>
          {hipotesis.map((h) => (
            <div
              key={h.id}
              style={{
                border: '1px solid #E2E8F0',
                borderRadius: 12,
                padding: 14,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 20 }} aria-hidden="true">
                    {HIPOTESIS_ICONS[h.id] || '🧪'}
                  </span>
                  <span style={{ fontWeight: 800, color: '#0A4DFF' }}>H{h.id}</span>
                </div>
                <StatusBadge estado={h.estado} />
              </div>
              <p style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 600, lineHeight: 1.4 }}>
                {h.nombre}
              </p>
              <p style={{ margin: '0 0 8px', fontSize: 24, fontWeight: 800 }}>
                {h.estado.id === 'prep' ? '—' : formatPercent(h.porcentaje)}
              </p>
              {h.estado.id !== 'prep' ? (
                <ProgressBar value={h.porcentaje} color={h.estado.color} />
              ) : null}
              <p style={{ margin: '8px 0 4px', fontSize: 12, color: '#64748B' }}>
                Evidencia: {h.evidencia}
              </p>
              <p style={{ margin: 0, fontSize: 11, color: '#94A3B8' }}>
                Peso: {h.peso}%
              </p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function ResumenEjecutivoBlock({ resumen }) {
  if (!resumen || typeof resumen === 'string') {
    return <p style={{ margin: 0, lineHeight: 1.6 }}>{resumen || '—'}</p>;
  }

  const sections = [
    { key: 'A', title: 'Estado general', content: resumen.estado_general, list: false },
    { key: 'B', title: 'Principales fortalezas', content: resumen.fortalezas, list: true },
    { key: 'C', title: 'Principales riesgos', content: resumen.riesgos, list: true },
    {
      key: 'D',
      title: 'Próxima prioridad',
      content: resumen.proxima_prioridad,
      list: false,
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {sections.map((sec) => (
        <div key={sec.key}>
          <p style={{ margin: '0 0 6px', fontSize: 12, fontWeight: 800, color: '#0A4DFF' }}>
            {sec.key}. {sec.title}
          </p>
          {sec.list ? (
            <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.6, fontSize: 13 }}>
              {(sec.content || []).map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          ) : (
            <p style={{ margin: 0, lineHeight: 1.6, fontSize: 13 }}>{sec.content}</p>
          )}
        </div>
      ))}
    </div>
  );
}

function trackPosition(pct) {
  return `calc(${TRACK_PAD}px + (100% - ${TRACK_PAD * 2}px) * ${Math.min(100, Math.max(0, pct)) / 100})`;
}

function TimelineBar({ timeline }) {
  const progress = timeline.pre_inicio
    ? 0
    : Math.min(100, Math.max(0, timeline.porcentaje_tiempo));
  const LINE_TOP = 28;

  return (
    <div style={{ overflow: 'hidden' }}>
      {timeline.pre_inicio ? (
        <p
          style={{
            margin: '0 0 12px',
            padding: '10px 12px',
            borderRadius: 8,
            backgroundColor: '#F1F5F9',
            color: '#64748B',
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          Preparación — el piloto inicia el {formatDate(timeline.inicio)}. Estado no
          evaluable hasta esa fecha.
        </p>
      ) : null}

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginBottom: 12,
          fontSize: 12,
          color: '#64748B',
          paddingLeft: TRACK_PAD,
          paddingRight: TRACK_PAD,
        }}
      >
        <span>Inicio · {formatDate(timeline.inicio)}</span>
        <span>Fin · {formatDate(timeline.fin)}</span>
      </div>

      <div
        style={{
          position: 'relative',
          minHeight: 168,
          marginBottom: 16,
          paddingBottom: 8,
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: TRACK_PAD,
            right: TRACK_PAD,
            top: LINE_TOP,
            height: 6,
            borderRadius: 999,
            backgroundColor: '#CBD5E1',
          }}
        />
        {!timeline.pre_inicio ? (
          <div
            style={{
              position: 'absolute',
              left: TRACK_PAD,
              top: LINE_TOP,
              width: `calc((100% - ${TRACK_PAD * 2}px) * ${progress / 100})`,
              height: 6,
              borderRadius: 999,
              background: 'linear-gradient(90deg, #059669 0%, #0A4DFF 100%)',
              zIndex: 1,
            }}
          />
        ) : null}

        <div
          style={{
            position: 'absolute',
            left: trackPosition(progress),
            top: LINE_TOP - 6,
            width: 18,
            height: 18,
            borderRadius: '50%',
            backgroundColor: timeline.pre_inicio ? '#64748B' : '#0A4DFF',
            border: '3px solid #FFFFFF',
            boxShadow: timeline.pre_inicio
              ? '0 0 0 2px #64748B'
              : '0 0 0 2px #0A4DFF',
            transform: 'translateX(-50%)',
            zIndex: 4,
          }}
          title={timeline.pre_inicio ? 'Preparación' : 'Hoy'}
        />

        {timeline.hitos.map((hito) => (
          <HitoMarker key={hito.id} hito={hito} lineTop={LINE_TOP} />
        ))}

        <FinMarker timeline={timeline} lineTop={LINE_TOP} />
      </div>

      <div
        style={{
          padding: 14,
          borderRadius: 12,
          backgroundColor: '#F8FAFC',
          border: '1px solid #E2E8F0',
        }}
      >
        <div style={{ marginBottom: 10 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginBottom: 6,
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            <span>Tiempo transcurrido</span>
            <span>
              {timeline.pre_inicio ? '0%' : formatPercent(timeline.porcentaje_tiempo)}
            </span>
          </div>
          <ProgressBar
            value={progress}
            color={timeline.pre_inicio ? '#64748B' : '#0A4DFF'}
            height={8}
          />
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24, fontSize: 13 }}>
          <Stat label="Días transcurridos" value={formatNumber(timeline.dias_transcurridos)} />
          <Stat label="Días restantes" value={formatNumber(timeline.dias_restantes)} />
        </div>
      </div>
    </div>
  );
}

function HitoMarker({ hito, lineTop }) {
  const diasLabel =
    hito.dias_vencidos > 0
      ? `${hito.dias_vencidos} días vencidos`
      : `${hito.dias_faltantes} días faltantes`;

  const dotSize = hito.es_actual ? 14 : 10;

  return (
    <div
      style={{
        position: 'absolute',
        left: trackPosition(hito.posicion_pct),
        top: lineTop - dotSize / 2,
        transform: 'translateX(-50%)',
        width: 108,
        zIndex: hito.es_actual ? 3 : 2,
        textAlign: 'center',
      }}
    >
      <div
        style={{
          width: dotSize,
          height: dotSize,
          borderRadius: '50%',
          margin: '0 auto',
          backgroundColor: hito.es_actual ? '#FFFFFF' : '#94A3B8',
          border: hito.es_actual ? '3px solid #0A4DFF' : '2px solid #64748B',
          boxShadow: hito.es_actual ? '0 0 0 2px #EEF4FF' : 'none',
        }}
      />
      <div style={{ marginTop: 10 }}>
        <p
          style={{
            margin: '0 0 2px',
            fontSize: 11,
            fontWeight: 800,
            color: hito.es_actual ? '#0A4DFF' : '#0F172A',
            lineHeight: 1.2,
          }}
        >
          {hito.id}
        </p>
        <p
          style={{
            margin: '0 0 4px',
            fontSize: 10,
            fontWeight: 600,
            color: '#334155',
            lineHeight: 1.25,
          }}
        >
          {hito.nombre || hito.label}
        </p>
        <p style={{ margin: '0 0 2px', fontSize: 10, color: '#64748B' }}>
          {formatDate(hito.fecha_inicio)}
        </p>
        <p
          style={{
            margin: 0,
            fontSize: 10,
            fontWeight: 600,
            color: hito.dias_vencidos > 0 ? '#DC2626' : '#64748B',
          }}
        >
          {diasLabel}
        </p>
      </div>
    </div>
  );
}

function FinMarker({ timeline, lineTop }) {
  return (
    <div
      style={{
        position: 'absolute',
        left: trackPosition(100),
        top: lineTop - 5,
        transform: 'translateX(-50%)',
        width: 96,
        textAlign: 'center',
        zIndex: 2,
      }}
    >
      <div
        style={{
          width: 12,
          height: 12,
          borderRadius: '50%',
          margin: '0 auto',
          backgroundColor: '#94A3B8',
          border: '2px solid #64748B',
        }}
      />
      <div style={{ marginTop: 10 }}>
        <p style={{ margin: '0 0 2px', fontSize: 11, fontWeight: 800, color: '#64748B' }}>
          Fin
        </p>
        <p style={{ margin: '0 0 2px', fontSize: 10, color: '#64748B' }}>
          {formatDate(timeline.fin)}
        </p>
      </div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div>
      <p style={{ margin: 0, color: '#64748B', fontSize: 12 }}>{label}</p>
      <p style={{ margin: '2px 0 0', fontWeight: 700 }}>{value}</p>
    </div>
  );
}
