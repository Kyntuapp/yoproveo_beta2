import { useMemo, useState } from 'react';
import {
  formatNumber,
  formatPercent,
  formatScore,
} from './format';
import { Card, EmptyState, SectionHeader, StatusBadge } from './shared';
import { SECTION_ICONS } from '../../../lib/war-room/constants';
import { interpretacionIvh, calcCumplimientoEncuesta, semanasPeriodoEncuesta } from '../../../lib/war-room/utils';
import { layout } from './theme';
import ComentariosModal from './ComentariosModal';

export default function EncuestasSection({ data }) {
  const encuestas = data.encuestas;
  const [semana, setSemana] = useState(
    encuestas.semana_actual ?? encuestas.semanas_selector?.[0] ?? 1
  );
  const [vista, setVista] = useState('semanal');
  const [comentariosModalOpen, setComentariosModalOpen] = useState(false);

  const semanas = encuestas.semanas_selector || [];
  const universo = encuestas.universo;

  const ivhCompradores = useMemo(
    () => buildIvhModo(encuestas.scores_semana_piloto, 'comprador', semana, vista),
    [encuestas.scores_semana_piloto, semana, vista]
  );

  const ivhProveedores = useMemo(
    () => buildIvhModo(encuestas.scores_semana_piloto, 'proveedor', semana, vista),
    [encuestas.scores_semana_piloto, semana, vista]
  );

  const cumplimientoModo = useMemo(
    () =>
      buildCumplimientoModo(
        encuestas.respuestas_validas,
        encuestas.cumplimiento,
        semana,
        vista,
        universo
      ),
    [encuestas.respuestas_validas, encuestas.cumplimiento, semana, vista, universo]
  );

  const porPreguntaFiltrado = useMemo(() => {
    const rows = filterByVista(encuestas.por_pregunta, semana, vista);
    return vista === 'acumulado' ? aggregatePorPregunta(rows) : rows;
  }, [encuestas.por_pregunta, semana, vista]);

  const comentariosResumen = useMemo(() => {
    const todos = encuestas.comentarios || [];
    return {
      total: todos.length,
      compradores: todos.filter((c) => c.tipo_usuario === 'comprador').length,
      proveedores: todos.filter((c) => c.tipo_usuario === 'proveedor').length,
    };
  }, [encuestas.comentarios]);

  const tendenciaCompradores = useMemo(
    () => buildTendencia(encuestas.scores_semana_piloto, 'comprador', semana, vista),
    [encuestas.scores_semana_piloto, semana, vista]
  );

  const tendenciaProveedores = useMemo(
    () => buildTendencia(encuestas.scores_semana_piloto, 'proveedor', semana, vista),
    [encuestas.scores_semana_piloto, semana, vista]
  );

  return (
    <div>
      <SectionHeader
        icon="💬"
        title="Encuestas y comentarios"
        subtitle="Validación cualitativa y cuantitativa del piloto"
      />

      <Card
        icon={SECTION_ICONS.encuesta_selectores}
        title="A. Selectores de vista y semana"
        style={{ marginBottom: 16 }}
      >
        <div style={{ marginBottom: 16 }}>
          <p style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 700 }}>Vista</p>
          <div style={{ display: 'flex', gap: 8 }}>
            {[
              { id: 'semanal', label: 'Semanal' },
              { id: 'acumulado', label: 'Acumulado' },
            ].map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setVista(opt.id)}
                style={toggleStyle(vista === opt.id)}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <p style={{ margin: '8px 0 0', fontSize: 12, color: '#64748B' }}>
            {vista === 'semanal'
              ? 'Muestra solo las respuestas de la semana seleccionada.'
              : 'Muestra respuestas acumuladas desde la semana 1 del piloto hasta la semana seleccionada (Pre-piloto solo incluye pruebas).'}
          </p>
        </div>

        <div>
          <p style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 700 }}>Semana</p>
          {semanas.length === 0 ? (
            <p style={{ margin: 0, color: '#64748B' }}>Sin semanas configuradas.</p>
          ) : (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {semanas.map((s) => (
                <button
                  key={String(s)}
                  type="button"
                  onClick={() => setSemana(s)}
                  style={{
                    ...toggleStyle(String(semana) === String(s)),
                    opacity: encuestas.semanas_con_datos?.includes(s) ? 1 : 0.65,
                  }}
                >
                  {semanaLabel(s)}
                </button>
              ))}
            </div>
          )}
        </div>
      </Card>

      <div style={{ ...layout.grid2, marginBottom: 16 }}>
        <IvhCard
          icon={SECTION_ICONS.ivh_compradores}
          titulo="B. IVH Compradores"
          ivh={ivhCompradores}
          tendencia={tendenciaCompradores}
        />
        <IvhCard
          icon={SECTION_ICONS.ivh_proveedores}
          titulo="C. IVH Proveedores"
          ivh={ivhProveedores}
          tendencia={tendenciaProveedores}
        />
      </div>

      <Card
        icon={SECTION_ICONS.cumplimiento}
        title="D. Cumplimiento de encuesta"
        style={{ marginBottom: 16 }}
      >
        <p
          style={{ margin: '0 0 12px', fontSize: 13, color: '#64748B', lineHeight: 1.5 }}
          title="Esperadas = usuarios elegibles × semanas del periodo seleccionado."
        >
          <strong style={{ color: '#0F172A' }}>Esperadas</strong> = usuarios elegibles ×
          semanas del periodo seleccionado.
        </p>

        <div
          style={{
            marginBottom: 16,
            padding: 12,
            borderRadius: 10,
            backgroundColor: '#F8FAFC',
            border: '1px solid #E2E8F0',
            fontSize: 13,
            lineHeight: 1.6,
          }}
        >
          <p style={{ margin: '0 0 6px' }}>
            Compradores: {formatNumber(cumplimientoModo.compradores_elegibles)} usuarios ×{' '}
            {formatNumber(cumplimientoModo.semanas_periodo ?? cumplimientoModo.semanas_consideradas)} semana
            {(cumplimientoModo.semanas_periodo ?? cumplimientoModo.semanas_consideradas) === 1 ? '' : 's'} ={' '}
            <strong>{formatNumber(cumplimientoModo.compradores_esperados)} esperadas</strong>
          </p>
          <p style={{ margin: '0 0 6px' }}>
            Proveedores: {formatNumber(cumplimientoModo.proveedores_elegibles)} usuarios ×{' '}
            {formatNumber(cumplimientoModo.semanas_periodo ?? cumplimientoModo.semanas_consideradas)} semana
            {(cumplimientoModo.semanas_periodo ?? cumplimientoModo.semanas_consideradas) === 1 ? '' : 's'} ={' '}
            <strong>{formatNumber(cumplimientoModo.proveedores_esperados)} esperadas</strong>
          </p>
          <p style={{ margin: 0, fontWeight: 700 }}>
            Total: {formatNumber(cumplimientoModo.esperadas_total)} esperadas
          </p>
          {universo?.criterio_usuarios ? (
            <p style={{ margin: '8px 0 0', fontSize: 12, color: '#94A3B8' }}>
              {universo.criterio_usuarios}
            </p>
          ) : null}
        </div>

        {cumplimientoModo.es_pre_piloto ? (
          <p style={{ margin: '0 0 12px', fontSize: 13, color: '#64748B' }}>
            Periodo Pre-piloto / Pruebas: datos visibles para validación, sin meta de
            cumplimiento.
          </p>
        ) : null}

        <div style={layout.grid2}>
          <div>
            <p style={{ margin: '0 0 4px', fontWeight: 700 }}>Compradores</p>
            <p style={{ margin: 0 }}>
              {formatNumber(cumplimientoModo.compradores_respondieron)} /{' '}
              {formatNumber(cumplimientoModo.compradores_esperados)}
            </p>
          </div>
          <div>
            <p style={{ margin: '0 0 4px', fontWeight: 700 }}>Proveedores</p>
            <p style={{ margin: 0 }}>
              {formatNumber(cumplimientoModo.proveedores_respondieron)} /{' '}
              {formatNumber(cumplimientoModo.proveedores_esperados)}
            </p>
          </div>
        </div>
        <p style={{ margin: '12px 0 8px', fontSize: 24, fontWeight: 800 }}>
          {cumplimientoModo.cumplimiento_pct !== null
            ? formatPercent(cumplimientoModo.cumplimiento_pct)
            : cumplimientoModo.es_pre_piloto
              ? 'N/A (pruebas)'
              : 'Sin datos suficientes'}
        </p>
        <p style={{ margin: '0 0 4px', fontSize: 13, color: '#64748B' }}>
          {formatNumber(cumplimientoModo.respondidas_total)} respuestas ·{' '}
          {formatNumber(cumplimientoModo.esperadas_total)} esperadas (
          {vista === 'semanal' ? 'corte semanal' : 'corte acumulado'})
        </p>
        <p style={{ margin: 0, fontSize: 13, color: '#64748B', lineHeight: 1.5 }}>
          La encuesta semanal es obligatoria y bloqueante para continuar usando la
          plataforma durante el piloto.
        </p>
      </Card>

      <Card
        icon={SECTION_ICONS.por_pregunta}
        title="E. Detalle por pregunta"
        style={{ marginBottom: 16 }}
      >
        {porPreguntaFiltrado.length === 0 ? (
          <EmptyState icon="❓">
            Sin datos de preguntas para el corte seleccionado.
          </EmptyState>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {porPreguntaFiltrado.map((row) => (
              <div
                key={`${row.pregunta_codigo}-${row.tipo_usuario}-${row.semana_piloto ?? 'acc'}`}
                style={{
                  border: '1px solid #E2E8F0',
                  borderRadius: 10,
                  padding: 12,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 8,
                    marginBottom: 8,
                    flexWrap: 'wrap',
                  }}
                >
                  <strong>
                    {row.pregunta_codigo} · {row.tipo_usuario}
                    {vista === 'acumulado'
                      ? ' · acumulado'
                      : rowSemanaLabel(row)
                        ? ` · ${rowSemanaLabel(row)}`
                        : ''}
                  </strong>
                  <span>Promedio: {formatScore(row.promedio)}</span>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', fontSize: 12 }}>
                  <DistChip label="1" value={row.n_1} />
                  <DistChip label="2" value={row.n_2} />
                  <DistChip label="3" value={row.n_3} />
                  <DistChip label="4" value={row.n_4} />
                  <span style={{ color: '#64748B' }}>
                    n = {formatNumber(row.n_respuestas)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card icon={SECTION_ICONS.comentarios} title="F. Comentarios abiertos">
        <p style={{ margin: '0 0 16px', fontSize: 13, color: '#64748B', lineHeight: 1.5 }}>
          Resumen de comentarios abiertos registrados en encuestas del piloto. Use el botón
          para explorar el detalle con filtros.
        </p>
        {comentariosResumen.total === 0 ? (
          <EmptyState icon="💭">
            No hay comentarios abiertos registrados.
          </EmptyState>
        ) : (
          <>
            <p style={{ margin: '0 0 12px', fontSize: 32, fontWeight: 800, color: '#7C3AED' }}>
              {formatNumber(comentariosResumen.total)}
            </p>
            <div style={{ ...layout.grid2, marginBottom: 16 }}>
              <div>
                <p style={{ margin: '0 0 4px', fontSize: 12, color: '#64748B', fontWeight: 600 }}>
                  Comentarios compradores
                </p>
                <p style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
                  {formatNumber(comentariosResumen.compradores)}
                </p>
              </div>
              <div>
                <p style={{ margin: '0 0 4px', fontSize: 12, color: '#64748B', fontWeight: 600 }}>
                  Comentarios proveedores
                </p>
                <p style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
                  {formatNumber(comentariosResumen.proveedores)}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setComentariosModalOpen(true)}
              style={{
                padding: '10px 16px',
                borderRadius: 8,
                border: 'none',
                backgroundColor: '#7C3AED',
                color: '#FFFFFF',
                fontWeight: 700,
                fontSize: 13,
                cursor: 'pointer',
                width: '100%',
              }}
            >
              Ver comentarios
            </button>
          </>
        )}
      </Card>

      {comentariosModalOpen ? (
        <ComentariosModal
          comentarios={encuestas.comentarios}
          semanasSelector={encuestas.semanas_selector}
          onClose={() => setComentariosModalOpen(false)}
        />
      ) : null}
    </div>
  );
}

function semanaLabel(s) {
  if (s === 'pre-piloto') return 'Pre-piloto / Pruebas';
  return `Semana ${s}`;
}

function rowSemanaLabel(row) {
  const sv = row.semana_visual ?? row.semana_piloto;
  if (sv === 'pre-piloto') return 'Pre-piloto';
  return sv ? `S${sv}` : '';
}

function getSemanaVisual(row) {
  return row.semana_visual ?? row.semana_piloto;
}

function filterByVista(rows, semana, vista) {
  if (!rows?.length || semana === null || semana === undefined) return rows || [];

  if (vista === 'semanal') {
    if (semana === 'pre-piloto') {
      return rows.filter((row) => getSemanaVisual(row) === 'pre-piloto');
    }
    return rows.filter((row) => Number(getSemanaVisual(row)) === Number(semana));
  }

  if (semana === 'pre-piloto') {
    return rows.filter((row) => getSemanaVisual(row) === 'pre-piloto');
  }

  return rows.filter((row) => {
    const sv = getSemanaVisual(row);
    if (sv === 'pre-piloto') return false;
    return Number(sv) <= Number(semana);
  });
}

function toggleStyle(active) {
  return {
    padding: '8px 14px',
    borderRadius: 8,
    border: active ? '2px solid #0A4DFF' : '1px solid #E2E8F0',
    backgroundColor: active ? '#EEF4FF' : '#FFFFFF',
    cursor: 'pointer',
    fontWeight: 700,
    fontSize: 13,
  };
}

function buildIvhModo(scores, tipoUsuario, semana, vista) {
  const rows = filterByVista(
    scores.filter((row) => row.tipo_usuario === tipoUsuario),
    semana,
    vista
  );

  if (!rows.length) {
    return {
      score: null,
      meta: 3.5,
      interpretacion: interpretacionIvh(null),
      sin_datos: true,
    };
  }

  const totalRespuestas = rows.reduce(
    (sum, row) => sum + Number(row.n_respuestas || 0),
    0
  );
  const score =
    totalRespuestas > 0
      ? Math.round(
          (rows.reduce(
            (sum, row) =>
              sum + Number(row.score_promedio || 0) * Number(row.n_respuestas || 0),
            0
          ) /
            totalRespuestas) *
            100
        ) / 100
      : null;

  return {
    score,
    meta: 3.5,
    interpretacion: interpretacionIvh(score),
    sin_datos: score === null,
  };
}

function buildTendencia(scores, tipoUsuario, semana, vista) {
  let rows = scores
    .filter((row) => row.tipo_usuario === tipoUsuario)
    .sort((a, b) => {
      const sa = getSemanaVisual(a);
      const sb = getSemanaVisual(b);
      if (sa === 'pre-piloto') return -1;
      if (sb === 'pre-piloto') return 1;
      return Number(sa) - Number(sb);
    });

  rows = filterByVista(rows, semana, vista);

  return rows.map((row) => ({
    semana_piloto: getSemanaVisual(row),
    score_promedio: Number(row.score_promedio),
    n_respuestas: Number(row.n_respuestas),
  }));
}

function buildCumplimientoModo(respuestas, cumplimientoBase, semana, vista, universo) {
  const filtered = filterByVista(respuestas, semana, vista);
  const esPrePiloto = semana === 'pre-piloto';
  const semanasPeriodo = esPrePiloto ? 0 : semanasPeriodoEncuesta(semana, vista);

  const result = calcCumplimientoEncuesta({
    respuestas: filtered,
    compradoresElegibles:
      universo?.compradores_elegibles ?? cumplimientoBase.compradores_elegibles ?? 0,
    proveedoresElegibles:
      universo?.proveedores_elegibles ?? cumplimientoBase.proveedores_elegibles ?? 0,
    semanasPeriodo,
  });

  return {
    es_pre_piloto: esPrePiloto,
    ...result,
    compradores_total: result.compradores_elegibles,
    proveedores_total: result.proveedores_elegibles,
  };
}

function aggregatePorPregunta(rows) {
  const map = new Map();

  for (const row of rows) {
    const key = `${row.pregunta_codigo}::${row.tipo_usuario}`;
    if (!map.has(key)) {
      map.set(key, {
        pregunta_codigo: row.pregunta_codigo,
        tipo_usuario: row.tipo_usuario,
        n_1: 0,
        n_2: 0,
        n_3: 0,
        n_4: 0,
        n_respuestas: 0,
        sumPonderado: 0,
      });
    }
    const acc = map.get(key);
    acc.n_1 += Number(row.n_1 || 0);
    acc.n_2 += Number(row.n_2 || 0);
    acc.n_3 += Number(row.n_3 || 0);
    acc.n_4 += Number(row.n_4 || 0);
    acc.n_respuestas += Number(row.n_respuestas || 0);
    acc.sumPonderado +=
      Number(row.promedio || 0) * Number(row.n_respuestas || 0);
  }

  return [...map.values()].map((acc) => ({
    pregunta_codigo: acc.pregunta_codigo,
    tipo_usuario: acc.tipo_usuario,
    n_1: acc.n_1,
    n_2: acc.n_2,
    n_3: acc.n_3,
    n_4: acc.n_4,
    n_respuestas: acc.n_respuestas,
    promedio:
      acc.n_respuestas > 0
        ? Math.round((acc.sumPonderado / acc.n_respuestas) * 100) / 100
        : null,
  }));
}

function IvhCard({ titulo, ivh, tendencia, icon }) {
  const maxScore = 4;

  return (
    <Card title={titulo} icon={icon}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
        <p style={{ margin: 0, fontSize: 36, fontWeight: 800 }}>
          {ivh.sin_datos ? '—' : formatScore(ivh.score)}
        </p>
        <StatusBadge estado={ivh.interpretacion.estado} />
      </div>
      <p style={{ margin: '0 0 12px', fontSize: 13, color: '#64748B' }}>
        Meta: {formatScore(ivh.meta)} · {ivh.interpretacion.label}
        {ivh.sin_datos ? ' · Sin datos suficientes' : ''}
      </p>
      {tendencia.length === 0 ? (
        <p style={{ margin: 0, fontSize: 13, color: '#64748B' }}>
          Sin tendencia semanal disponible.
        </p>
      ) : (
        <div>
          <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 700 }}>
            Tendencia semanal
          </p>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 80 }}>
            {tendencia.map((point) => {
              const height = (point.score_promedio / maxScore) * 100;
              const label =
                point.semana_piloto === 'pre-piloto'
                  ? 'Pre'
                  : `S${point.semana_piloto}`;
              return (
                <div key={String(point.semana_piloto)} style={{ flex: 1, textAlign: 'center' }}>
                  <div
                    style={{
                      height: `${height}%`,
                      minHeight: 4,
                      backgroundColor: '#7C3AED',
                      borderRadius: '4px 4px 0 0',
                    }}
                  />
                  <span style={{ fontSize: 10, color: '#64748B' }}>{label}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </Card>
  );
}

function DistChip({ label, value }) {
  return (
    <span
      style={{
        padding: '2px 8px',
        borderRadius: 6,
        backgroundColor: '#F1F5F9',
        fontWeight: 600,
      }}
    >
      {label}: {formatNumber(value)}
    </span>
  );
}
