import { formatIndicatorValue, formatNumber, formatPercent } from './format';
import { INDICATOR_ICONS } from '../../../lib/war-room/constants';
import { layout } from './theme';
import { useState } from 'react';
import ComentariosModal from './ComentariosModal';
export function StatusBadge({ estado }) {
  if (!estado) return null;
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '4px 10px',
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 700,
        color: estado.color,
        backgroundColor: estado.bg,
      }}
    >
      {estado.label}
    </span>
  );
}

export function ProgressBar({ value, color = '#0A4DFF', height = 8 }) {
  const pct = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <div
      style={{
        width: '100%',
        height,
        borderRadius: 999,
        backgroundColor: '#E2E8F0',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          width: `${pct}%`,
          height: '100%',
          backgroundColor: color,
          borderRadius: 999,
          transition: 'width 0.3s ease',
        }}
      />
    </div>
  );
}

export function Card({ title, icon, children, style }) {
  return (
    <div style={{ ...layout.card, ...style }}>
      {title ? (
        <h3 style={{ ...layout.cardTitle, display: 'flex', alignItems: 'center', gap: 8 }}>
          {icon ? (
            <span style={{ fontSize: 18 }} aria-hidden="true">
              {icon}
            </span>
          ) : null}
          <span>{title}</span>
        </h3>
      ) : null}
      {children}
    </div>
  );
}

export function ComentariosDestacadosCard({ item, theme }) {
  const [modalOpen, setModalOpen] = useState(false);
  const icon = INDICATOR_ICONS[item.id] || '💬';
  const accent = theme?.color || '#7C3AED';

  return (
    <>
      <div
        style={{
          ...layout.card,
          backgroundColor: theme?.bg || '#F5F3FF',
          borderLeft: `4px solid ${accent}`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <span style={{ fontSize: 18 }} aria-hidden="true">{icon}</span>
          <p style={{ margin: 0, fontWeight: 700, fontSize: 14 }}>{item.label}</p>
        </div>
        <p style={{ margin: '0 0 12px', fontSize: 32, fontWeight: 800, color: accent }}>
          {formatNumber(item.total)}
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
          <MetricMini label="Compradores" value={formatNumber(item.compradores)} />
          <MetricMini label="Proveedores" value={formatNumber(item.proveedores)} />
        </div>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          style={{
            padding: '10px 16px',
            borderRadius: 8,
            border: 'none',
            backgroundColor: accent,
            color: '#FFFFFF',
            fontWeight: 700,
            fontSize: 13,
            cursor: 'pointer',
            width: '100%',
          }}
        >
          Ver comentarios
        </button>
        <p style={{ margin: '10px 0 0', fontSize: 12, color: '#64748B', lineHeight: 1.4 }}>
          {item.descripcion_calculo}
        </p>
      </div>
      {modalOpen ? (
        <ComentariosModal
          comentarios={item.comentarios}
          semanasSelector={item.semanas_selector}
          onClose={() => setModalOpen(false)}
        />
      ) : null}
    </>
  );
}

export function IndicatorCard({ item, theme }) {
  const progress =
    item.cumplimiento_fecha_pct ??
    item.avance_vs_esperado_pct ??
    item.avance_pct ??
    0;
  const estado = item.sin_datos
    ? { id: 'info', label: 'Sin datos suficientes', color: '#0A4DFF', bg: '#EEF4FF' }
    : item.estado;
  const icon = INDICATOR_ICONS[item.id] || '📌';
  const accent = theme?.color || estado?.color || '#0A4DFF';
  const bg = theme?.bg || '#FFFFFF';

  return (
    <div
      style={{
        ...layout.card,
        backgroundColor: bg,
        borderLeft: `4px solid ${accent}`,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 18 }} aria-hidden="true">{icon}</span>
          <p style={{ margin: 0, fontWeight: 700, fontSize: 14 }}>{item.label}</p>
        </div>
        <StatusBadge estado={estado} />
      </div>
      <p style={{ margin: '0 0 4px', fontSize: 28, fontWeight: 800, color: accent }}>
        {formatIndicatorValue(item)}
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8, marginBottom: 10 }}>
        <MetricMini label="Esperado hoy" value={item.esperado !== null ? formatIndicatorValue({ ...item, value: item.esperado, sin_datos: false }) : '—'} />
        <MetricMini label="Meta final (valor)" value={item.meta_final !== null && item.meta_final !== undefined ? formatIndicatorValue({ ...item, value: item.meta_final, sin_datos: false }) : '—'} />
        <MetricMini
          label="Cumpl. fecha"
          value={
            item.cumplimiento_fecha_pct !== null && item.cumplimiento_fecha_pct !== undefined
              ? formatPercent(item.cumplimiento_fecha_pct)
              : '—'
          }
        />
        <MetricMini label="Avance vs meta" value={item.avance_pct !== null ? formatPercent(item.avance_pct) : '—'} />
      </div>
      <ProgressBar value={progress} color={estado?.color} />
      <p style={{ margin: '10px 0 0', fontSize: 12, color: '#64748B', lineHeight: 1.4 }}>
        {item.descripcion_calculo}
      </p>
    </div>
  );
}

function MetricMini({ label, value }) {
  return (
    <div>
      <p style={{ margin: 0, fontSize: 11, color: '#64748B', fontWeight: 600 }}>{label}</p>
      <p style={{ margin: '2px 0 0', fontSize: 13, fontWeight: 700 }}>{value}</p>
    </div>
  );
}

export function Legend() {
  const items = [
    { color: '#059669', label: 'En línea / validado (≥90%)' },
    { color: '#D97706', label: 'En observación (70–89%)' },
    { color: '#DC2626', label: 'En riesgo (<70%)' },
    { color: '#0A4DFF', label: 'Sin datos / informativo' },
    { color: '#64748B', label: 'Preparación / No evaluable' },
  ];
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
      {items.map((item) => (
        <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: item.color }} />
          <span>{item.label}</span>
        </div>
      ))}
    </div>
  );
}

export function EmptyState({ children, icon = '📭' }) {
  return (
    <div
      style={{
        ...layout.card,
        color: '#64748B',
        lineHeight: 1.5,
        textAlign: 'center',
        padding: '28px 20px',
        backgroundColor: '#F8FAFC',
        border: '1px dashed #CBD5E1',
      }}
    >
      <p style={{ margin: '0 0 8px', fontSize: 32 }} aria-hidden="true">
        {icon}
      </p>
      {children}
    </div>
  );
}

export function SectionHeader({ title, subtitle, icon }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <h2 style={{ ...layout.sectionTitle, display: 'flex', alignItems: 'center', gap: 10 }}>
        {icon ? (
          <span style={{ fontSize: 24 }} aria-hidden="true">
            {icon}
          </span>
        ) : null}
        <span>{title}</span>
      </h2>
      {subtitle ? <p style={{ margin: 0, color: '#64748B' }}>{subtitle}</p> : null}
    </div>
  );
}

export function DimensionBlock({ title, items, theme }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          marginBottom: 12,
          padding: '10px 14px',
          borderRadius: 10,
          backgroundColor: theme?.bg || '#F8FAFC',
          borderLeft: `4px solid ${theme?.color || '#0A4DFF'}`,
        }}
      >
        {theme?.icon ? (
          <span style={{ fontSize: 20 }} aria-hidden="true">{theme.icon}</span>
        ) : null}
        <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: theme?.color }}>
          {title}
        </h3>
      </div>
      <div style={layout.grid2}>
        {items.map((item) =>
          item.tipo === 'informativo' ? (
            <ComentariosDestacadosCard key={item.id} item={item} theme={theme} />
          ) : (
            <IndicatorCard key={item.id} item={item} theme={theme} />
          )
        )}
      </div>
    </div>
  );
}
