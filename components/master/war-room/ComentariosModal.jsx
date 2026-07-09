import { useMemo, useState } from 'react';
import { formatDate } from './format';

export default function ComentariosModal({ comentarios, semanasSelector, onClose }) {
  const [tipo, setTipo] = useState('todos');
  const [semana, setSemana] = useState('todos');
  const [busqueda, setBusqueda] = useState('');

  const filtrados = useMemo(() => {
    let rows = [...(comentarios || [])];

    if (tipo !== 'todos') {
      rows = rows.filter((c) => c.tipo_usuario === tipo);
    }

    if (semana !== 'todos') {
      rows = rows.filter(
        (c) => String(c.semana_visual ?? c.semana_piloto) === String(semana)
      );
    }

    if (busqueda.trim()) {
      const q = busqueda.trim().toLowerCase();
      rows = rows.filter((c) => String(c.texto || '').toLowerCase().includes(q));
    }

    return rows.sort(
      (a, b) =>
        new Date(a.fecha_respuesta || 0).getTime() -
        new Date(b.fecha_respuesta || 0).getTime()
    );
  }, [comentarios, tipo, semana, busqueda]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="comentarios-modal-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
        backgroundColor: 'rgba(15, 23, 42, 0.45)',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 720,
          maxHeight: '85vh',
          backgroundColor: '#FFFFFF',
          borderRadius: 14,
          boxShadow: '0 20px 50px rgba(0,0,0,0.2)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid #E2E8F0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <h3 id="comentarios-modal-title" style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>
            Comentarios abiertos
          </h3>
          <button
            type="button"
            onClick={onClose}
            style={{
              border: 'none',
              background: '#F1F5F9',
              borderRadius: 8,
              padding: '6px 12px',
              cursor: 'pointer',
              fontWeight: 700,
            }}
          >
            Cerrar
          </button>
        </div>

        <div
          style={{
            padding: '14px 20px',
            borderBottom: '1px solid #E2E8F0',
            display: 'flex',
            flexWrap: 'wrap',
            gap: 10,
          }}
        >
          <FilterSelect
            label="Tipo"
            value={tipo}
            onChange={setTipo}
            options={[
              { value: 'todos', label: 'Todos' },
              { value: 'comprador', label: 'Compradores' },
              { value: 'proveedor', label: 'Proveedores' },
            ]}
          />
          <FilterSelect
            label="Semana"
            value={semana}
            onChange={setSemana}
            options={[
              { value: 'todos', label: 'Todas' },
              ...(semanasSelector || []).map((s) => ({
                value: String(s),
                label: s === 'pre-piloto' ? 'Pre-piloto / Pruebas' : `Semana ${s}`,
              })),
            ]}
          />
          <label style={{ flex: '1 1 200px', fontSize: 12 }}>
            <span style={{ display: 'block', marginBottom: 4, fontWeight: 700 }}>Buscar</span>
            <input
              type="search"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Texto del comentario…"
              style={{
                width: '100%',
                padding: '8px 10px',
                borderRadius: 8,
                border: '1px solid #E2E8F0',
                fontSize: 13,
              }}
            />
          </label>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 20px 20px' }}>
          {filtrados.length === 0 ? (
            <p style={{ margin: 0, color: '#64748B', textAlign: 'center', padding: 24 }}>
              No hay comentarios para los filtros seleccionados.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {filtrados.map((c) => (
                <div
                  key={c.id}
                  style={{
                    border: '1px solid #E2E8F0',
                    borderRadius: 10,
                    padding: 12,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      gap: 8,
                      flexWrap: 'wrap',
                      marginBottom: 6,
                      fontSize: 12,
                      color: '#64748B',
                    }}
                  >
                    <span style={{ fontWeight: 700, color: '#0F172A' }}>
                      {c.tipo_usuario === 'comprador' ? 'Comprador' : 'Proveedor'}
                    </span>
                    <span>
                      {c.semana_visual === 'pre-piloto'
                        ? 'Pre-piloto / Pruebas'
                        : `Semana ${c.semana_visual ?? c.semana_piloto}`}
                    </span>
                    <span>{formatDate(c.fecha_respuesta)}</span>
                  </div>
                  <p style={{ margin: 0, lineHeight: 1.5, fontSize: 14 }}>{c.texto}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FilterSelect({ label, value, onChange, options }) {
  return (
    <label style={{ fontSize: 12 }}>
      <span style={{ display: 'block', marginBottom: 4, fontWeight: 700 }}>{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          padding: '8px 10px',
          borderRadius: 8,
          border: '1px solid #E2E8F0',
          fontSize: 13,
          minWidth: 140,
        }}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  );
}
