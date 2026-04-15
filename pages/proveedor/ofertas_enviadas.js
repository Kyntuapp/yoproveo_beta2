// pages/proveedor/ofertas_enviadas.js
import { useEffect, useMemo, useState, Fragment } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useRouter } from 'next/router';

export default function OfertasEnviadas() {
  const [perfilId, setPerfilId] = useState(null);
  const [ofertas, setOfertas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedRow, setExpandedRow] = useState(null); // id oferta expandida

  // Filtros (uno por columna)
  const [fProducto, setFProducto] = useState('');
  const [fFormato, setFFormato] = useState('');
  const [fMarca, setFMarca] = useState('');
  const [fPrecioMin, setFPrecioMin] = useState('');
  const [fPrecioMax, setFPrecioMax] = useState('');
  const [fDespacho, setFDespacho] = useState(''); // '', 'si', 'no'
  const [fEstado, setFEstado] = useState('');     // '', 'confirmada','rechazada','por_confirmar','pendiente'
  const [fComprador, setFComprador] = useState('');
  const [fComuna, setFComuna] = useState('');
  const [fFechaDDMMAA, setFFechaDDMMAA] = useState(''); // único filtro de fecha (dd-mm-aa sin guiones al filtrar)

  const router = useRouter();

  useEffect(() => {
    const run = async () => {
      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (userErr || !userData?.user) {
        alert('Debes iniciar sesión.');
        router.push('/login');
        return;
      }

      const { data: perfil, error: perfilErr } = await supabase
        .from('perfiles')
        .select('id')
        .eq('auth_id', userData.user.id)
        .eq('tipo', 'proveedor')
        .maybeSingle();

      if (perfilErr || !perfil) {
        alert('No se encontró perfil de proveedor');
        router.push('/login');
        return;
      }
      setPerfilId(perfil.id);

      // Ofertas del proveedor
      const { data: ofertasData, error: ofertasErr } = await supabase
        .from('ofertas_productos')
        .select('id, lista_id, producto, formato, marca, precio_ofertado, incluye_despacho, fecha, estado')
        .eq('proveedor_id', perfil.id)
        .order('fecha', { ascending: false });

      if (ofertasErr) {
        console.error(ofertasErr);
        setLoading(false);
        return;
      }

      // Enriquecer: lista_id -> (usuario_id, comuna_despacho, direccion_envio?) y luego perfil comprador
      const listaIds = Array.from(new Set((ofertasData || []).map(o => o.lista_id))).filter(Boolean);

      const mapLista = {};
      if (listaIds.length) {
        const { data: listasRows } = await supabase
          .from('listas_compras')
          .select('id, usuario_id, comuna_despacho, direccion_envio')
          .in('id', listaIds);

        (listasRows || []).forEach(l => {
          mapLista[l.id] = {
            usuario_id: l.usuario_id,
            comuna_despacho: (l.comuna_despacho || '').toString().trim(),
            direccion_envio: (l.direccion_envio || '').toString().trim(),
          };
        });
      }

      const usuarioIds = Array.from(new Set(Object.values(mapLista).map(v => v?.usuario_id).filter(Boolean)));

      const mapPerfilComprador = {};
      if (usuarioIds.length) {
        const { data: perfilesRows } = await supabase
          .from('perfiles')
          .select('id, email, email_contacto, telefono_contacto, direccion, comuna')
          .in('id', usuarioIds);

        (perfilesRows || []).forEach(p => {
          const emailContacto = (p.email_contacto || '').toString().trim();
          const emailBase = (p.email || '').toString().trim();
          const tel = (p.telefono_contacto || '').toString().trim();
          const direccion = (p.direccion || '').toString().trim();
          const comunaPerfil = (p.comuna || '').toString().trim();

          mapPerfilComprador[p.id] = {
            email: emailContacto || emailBase || 'N/A',
            telefono: tel || 'No disponible',
            direccionPerfil: [direccion, comunaPerfil].filter(Boolean).join(', '),
          };
        });
      }

      const enriquecidas = (ofertasData || []).map(o => {
        const li = mapLista[o.lista_id] || {};
        const buyer = mapPerfilComprador[li.usuario_id] || {};

        const direccionFinal =
          buyer.direccionPerfil ||
          li.direccion_envio ||
          (li.comuna_despacho ? `Comuna: ${li.comuna_despacho}` : '');

        return {
          ...o,
          comprador_email: buyer.email || 'N/A',
          comprador_telefono: buyer.telefono || 'No disponible',
          comprador_direccion: direccionFinal || 'No disponible',
          comuna: li.comuna_despacho || '', // columna "Comuna"
        };
      });

      setOfertas(enriquecidas);
      setLoading(false);
    };

    run();
  }, [router]);

  // Helpers
  const dd_mm_aa = (dateVal) => {
    if (!dateVal) return '';
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return '';
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yy = String(d.getFullYear()).slice(-2);
    return `${dd}-${mm}-${yy}`;
  };

  const normalizaFiltroFecha = (s) => s.replace(/\D/g, '').slice(0, 6); // ddmmaa (6 dígitos)

  const ofertasFiltradas = useMemo(() => {
    return (ofertas || []).filter(o => {
      if (fProducto && !String(o.producto || '').toLowerCase().includes(fProducto.toLowerCase())) return false;
      if (fFormato && !String(o.formato || '').toLowerCase().includes(fFormato.toLowerCase())) return false;
      if (fMarca && !String(o.marca || '').toLowerCase().includes(fMarca.toLowerCase())) return false;

      const precio = Number(o.precio_ofertado || 0);
      if (fPrecioMin && !Number.isNaN(Number(fPrecioMin)) && precio < Number(fPrecioMin)) return false;
      if (fPrecioMax && !Number.isNaN(Number(fPrecioMax)) && precio > Number(fPrecioMax)) return false;

      if (fDespacho === 'si' && !o.incluye_despacho) return false;
      if (fDespacho === 'no' && !!o.incluye_despacho) return false;

      if (fEstado) {
        const estadoN = String(o.estado || '').toLowerCase();
        if (estadoN !== fEstado) return false;
      }

      if (fComprador && !String(o.comprador_email || '').toLowerCase().includes(fComprador.toLowerCase())) return false;
      if (fComuna && !String(o.comuna || '').toLowerCase().includes(fComuna.toLowerCase())) return false;

      if (fFechaDDMMAA) {
        // Comparamos contra dd-mm-aa → lo normalizamos a ddmmaa para comparar
        const s = dd_mm_aa(o.fecha).replace(/\D/g, ''); // ddmmaa
        if (!s.includes(normalizaFiltroFecha(fFechaDDMMAA))) return false;
      }
      return true;
    });
  }, [ofertas, fProducto, fFormato, fMarca, fPrecioMin, fPrecioMax, fDespacho, fEstado, fComprador, fComuna, fFechaDDMMAA]);

  if (loading) return <p style={{ padding: 16 }}>Cargando ofertas enviadas...</p>;

  const colorEstado = (estadoRaw) => {
    const e = String(estadoRaw || '').toLowerCase();
    if (e === 'confirmada') return { color: '#15803d', fontWeight: 600 }; // verde
    if (e === 'rechazada') return { color: '#b91c1c', fontWeight: 600 }; // rojo
    if (e === 'por_confirmar' || e === 'pendiente de confirmación') return { color: '#1d4ed8', fontWeight: 600 }; // azul
    return { color: '#374151' }; // gris
  };

  // Estilos
  const tableWrap = { overflowX: 'auto' };
  const tableStyle = {
    width: '100%',
    background: '#fff',
    borderCollapse: 'separate',
    borderSpacing: '0 8px',
  };
  const thBase = {
    padding: '10px 14px',
    fontWeight: 700,
    fontSize: 13,
    textAlign: 'left',
    color: '#0f172a',
    background: '#f3f4f6',
    borderTop: '1px solid #e5e7eb',
    borderBottom: '1px solid #e5e7eb',
    whiteSpace: 'nowrap',
  };
  const thCenter = { ...thBase, textAlign: 'center' };
  const thRight = { ...thBase, textAlign: 'right' };

  const filterCell = {
    padding: '8px 14px',
    background: '#f9fafb',
    borderBottom: '1px solid #e5e7eb',
  };
  const inputStyle = { width: '100%', padding: 8, border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13 };

  const tdBase = {
    padding: '10px 14px',
    fontSize: 14,
    color: '#111827',
    background: '#fff',
    borderTop: '1px solid #e5e7eb',
    borderBottom: '1px solid #e5e7eb',
    lineHeight: 1.2,
  };
  const tdCenter = { ...tdBase, textAlign: 'center' };
  const tdRight = { ...tdBase, textAlign: 'right' };

  const actionBtn = {
    padding: '6px 10px',
    border: '1px solid #d1d5db',
    borderRadius: 8,
    background: '#fff',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
  };

  // Header con botón arriba-izquierda y título centrado
  const HeaderBar = () => (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '1fr auto 1fr',
      alignItems: 'center',
      marginBottom: 12
    }}>
      <div>
        <button
          onClick={() => router.push('/proveedor')}
          style={{ ...actionBtn, padding: '8px 12px' }}
          title="Volver al Panel"
        >
          ← Volver al Panel
        </button>
      </div>
      <div style={{ justifySelf: 'center' }}>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, textAlign: 'center' }}>
          Mis Ofertas Enviadas
        </h1>
      </div>
      <div /> {/* vacío para balancear la grilla */}
    </div>
  );

  // Encabezado con indicador de filtro activo
  const ThWithDot = ({ active, children, style }) => (
    <th style={style}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        {children}
        {active ? <span title="Filtro activo" style={{ width: 8, height: 8, background: '#16a34a', borderRadius: '50%' }} /> : null}
      </span>
    </th>
  );

  return (
    <div style={{ padding: 24 }}>
      <HeaderBar />

      <div style={tableWrap}>
        <table style={tableStyle}>
          <colgroup>
            <col style={{ width: '14%' }} />
            <col style={{ width: '10%' }} />
            <col style={{ width: '12%' }} />
            <col style={{ width: '10%' }} />
            <col style={{ width: '8%' }} />
            <col style={{ width: '12%' }} />
            <col style={{ width: '18%' }} />
            <col style={{ width: '12%' }} />
            <col style={{ width: '10%' }} />
            <col style={{ width: '8%' }} />
          </colgroup>

          <thead>
            <tr>
              <ThWithDot style={thBase} active={!!fProducto}>Producto</ThWithDot>
              <ThWithDot style={thBase} active={!!fFormato}>Formato</ThWithDot>
              <ThWithDot style={thBase} active={!!fMarca}>Marca</ThWithDot>
              <ThWithDot style={thRight} active={!!(fPrecioMin || fPrecioMax)}>Precio</ThWithDot>
              <ThWithDot style={thCenter} active={!!fDespacho}>Despacho</ThWithDot>
              <ThWithDot style={thBase} active={!!fEstado}>Estado</ThWithDot>
              <ThWithDot style={thBase} active={!!fComprador}>Comprador</ThWithDot>
              <ThWithDot style={thBase} active={!!fComuna}>Comuna</ThWithDot>
              <ThWithDot style={thBase} active={!!fFechaDDMMAA}>Fecha (dd-mm-aa)</ThWithDot>
              <th style={thCenter}>Acción</th>
            </tr>

            {/* FILTROS DEBAJO DE CADA TÍTULO */}
            <tr>
              <th style={filterCell}>
                <input style={inputStyle} placeholder="Filtrar…" value={fProducto} onChange={e=>setFProducto(e.target.value)} />
              </th>
              <th style={filterCell}>
                <input style={inputStyle} placeholder="Filtrar…" value={fFormato} onChange={e=>setFFormato(e.target.value)} />
              </th>
              <th style={filterCell}>
                <input style={inputStyle} placeholder="Filtrar…" value={fMarca} onChange={e=>setFMarca(e.target.value)} />
              </th>
              <th style={filterCell}>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input style={{ ...inputStyle, width: '50%' }} type="number" placeholder="Mín" value={fPrecioMin} onChange={e=>setFPrecioMin(e.target.value)} />
                  <input style={{ ...inputStyle, width: '50%' }} type="number" placeholder="Máx" value={fPrecioMax} onChange={e=>setFPrecioMax(e.target.value)} />
                </div>
              </th>
              <th style={filterCell}>
                <select style={inputStyle} value={fDespacho} onChange={e=>setFDespacho(e.target.value)}>
                  <option value="">Todos</option>
                  <option value="si">Con despacho</option>
                  <option value="no">Sin despacho</option>
                </select>
              </th>
              <th style={filterCell}>
                <select style={inputStyle} value={fEstado} onChange={e=>setFEstado(e.target.value)}>
                  <option value="">Todos</option>
                  <option value="confirmada">Confirmada</option>
                  <option value="rechazada">Rechazada</option>
                  <option value="por_confirmar">Pendiente de confirmación</option>
                  <option value="pendiente">Pendiente</option>
                </select>
              </th>
              <th style={filterCell}>
                <input style={inputStyle} placeholder="correo@dominio" value={fComprador} onChange={e=>setFComprador(e.target.value)} />
              </th>
              <th style={filterCell}>
                <input style={inputStyle} placeholder="Comuna" value={fComuna} onChange={e=>setFComuna(e.target.value)} />
              </th>
              <th style={filterCell}>
                <input
                  style={inputStyle}
                  placeholder="ddmmaaa"
                  value={fFechaDDMMAA}
                  onChange={(e) => setFFechaDDMMAA(e.target.value.replace(/\D/g, '').slice(0, 6))}
                />
              </th>
              <th style={{ ...filterCell, textAlign: 'center' }}>
                <button
                  onClick={() => {
                    setFProducto(''); setFFormato(''); setFMarca('');
                    setFPrecioMin(''); setFPrecioMax('');
                    setFDespacho(''); setFEstado('');
                    setFComprador(''); setFComuna('');
                    setFFechaDDMMAA('');
                  }}
                  style={actionBtn}
                >
                  Limpiar
                </button>
              </th>
            </tr>
          </thead>

          <tbody>
            {ofertasFiltradas.length === 0 ? (
              <tr>
                <td colSpan={10} style={{ ...tdBase, textAlign: 'center' }}>
                  No hay resultados con los filtros aplicados.
                </td>
              </tr>
            ) : (
              ofertasFiltradas.map((o) => (
                <RowWithDetail
                  key={o.id}
                  oferta={o}
                  expanded={expandedRow === o.id}
                  onToggle={() => setExpandedRow(expandedRow === o.id ? null : o.id)}
                  tdBase={tdBase}
                  tdCenter={tdCenter}
                  tdRight={tdRight}
                  actionBtn={actionBtn}
                  colorEstado={colorEstado}
                  dd_mm_aa={dd_mm_aa}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RowWithDetail({
  oferta, expanded, onToggle,
  tdBase, tdCenter, tdRight,
  actionBtn, colorEstado, dd_mm_aa
}) {
  return (
    <Fragment>
      <tr>
        <td style={tdBase}>{oferta.producto}</td>
        <td style={tdBase}>{oferta.formato || '—'}</td>
        <td style={tdBase}>{oferta.marca || '—'}</td>
        <td style={tdRight}>
          ${Number(oferta.precio_ofertado).toLocaleString('es-CL')}
        </td>
        <td style={tdCenter}>
          {oferta.incluye_despacho ? '🚚 Sí' : '—'}
        </td>
        <td style={{ ...tdBase, ...colorEstado(oferta.estado) }}>
          {oferta.estado === 'por_confirmar' ? 'Pendiente de confirmación' : oferta.estado}
        </td>
        <td style={tdBase}>{oferta.comprador_email}</td>
        <td style={tdBase}>{oferta.comuna || '—'}</td>
        <td style={tdBase}>{dd_mm_aa(oferta.fecha)}</td>
        <td style={tdCenter}>
          <button style={actionBtn} onClick={onToggle} title="Ver datos de contacto">
            👁 <span>Ver contacto</span>
          </button>
        </td>
      </tr>

      {expanded && (
        <tr>
          <td colSpan={10} style={{ ...tdBase, background: '#f9fafb' }}>
            <h4 style={{ margin: 0, marginBottom: 8, fontWeight: 600 }}>Datos de contacto del comprador</h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 12 }}>
              <p style={{ margin: 0 }}><strong>Correo:</strong> {oferta.comprador_email || 'No disponible'}</p>
              <p style={{ margin: 0 }}><strong>Teléfono:</strong> {oferta.comprador_telefono || 'No disponible'}</p>
              <p style={{ margin: 0 }}><strong>Dirección de despacho:</strong> {oferta.comprador_direccion || 'No disponible'}</p>
            </div>
          </td>
        </tr>
      )}
    </Fragment>
  );
}
