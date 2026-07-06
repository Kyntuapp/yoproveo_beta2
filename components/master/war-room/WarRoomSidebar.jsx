import { colors } from './theme';
import { WAR_ROOM_SECTIONS } from '../../../lib/war-room/constants';

export default function WarRoomSidebar({
  activeSection,
  onSelect,
  piloto,
  onBack,
  onRefresh,
  loading,
}) {
  return (
    <aside
      style={{
        width: 260,
        minWidth: 260,
        backgroundColor: colors.sidebar,
        color: '#FFFFFF',
        display: 'flex',
        flexDirection: 'column',
        padding: '24px 16px',
      }}
    >
      <button
        type="button"
        onClick={onBack}
        style={{
          background: 'transparent',
          border: '1px solid rgba(255,255,255,0.2)',
          color: '#FFFFFF',
          borderRadius: 8,
          padding: '8px 12px',
          cursor: 'pointer',
          marginBottom: 20,
          fontWeight: 600,
          textAlign: 'left',
        }}
      >
        ← Panel master
      </button>

      <p
        style={{
          margin: '0 0 4px',
          fontSize: 11,
          letterSpacing: 1.2,
          textTransform: 'uppercase',
          opacity: 0.7,
          fontWeight: 700,
        }}
      >
        War Room
      </p>
      <h1 style={{ margin: '0 0 6px', fontSize: 22, fontWeight: 800 }}>
        Validación piloto
      </h1>
      {piloto ? (
        <p style={{ margin: '0 0 24px', fontSize: 13, opacity: 0.85, lineHeight: 1.4 }}>
          {piloto.nombre}
        </p>
      ) : (
        <p style={{ margin: '0 0 24px', fontSize: 13, opacity: 0.85 }}>
          Sin piloto activo
        </p>
      )}

      <nav style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
        {WAR_ROOM_SECTIONS.map((section) => {
          const active = activeSection === section.id;
          return (
            <button
              key={section.id}
              type="button"
              onClick={() => onSelect(section.id)}
              style={{
                textAlign: 'left',
                padding: '12px 14px',
                borderRadius: 10,
                border: 'none',
                cursor: 'pointer',
                fontWeight: 700,
                fontSize: 14,
                backgroundColor: active ? colors.sidebarActive : 'transparent',
                color: '#FFFFFF',
              }}
            >
              {section.icon ? (
                <span style={{ marginRight: 6 }} aria-hidden="true">
                  {section.icon}
                </span>
              ) : null}
              {section.label}
            </button>
          );
        })}
      </nav>

      <button
        type="button"
        onClick={onRefresh}
        disabled={loading}
        style={{
          marginTop: 16,
          padding: '10px 14px',
          borderRadius: 10,
          border: 'none',
          backgroundColor: '#0A4DFF',
          color: '#FFFFFF',
          fontWeight: 700,
          cursor: loading ? 'wait' : 'pointer',
          opacity: loading ? 0.7 : 1,
        }}
      >
        {loading ? 'Actualizando…' : 'Actualizar datos'}
      </button>
    </aside>
  );
}
