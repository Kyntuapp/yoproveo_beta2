// pages/proveedor/ofertas_enviadas.js
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabaseClient';
import { resolveProveedorProfile } from '../../lib/resolveProveedorProfile';

export default function OfertasEnviadas() {
  const router = useRouter();

  const [ofertas, setOfertas] = useState([]);
  const [paginaActual, setPaginaActual] = useState(1);
  const [filtros, setFiltros] = useState({
  producto: '',
  formato: '',
  marca: '',
  cantidad: '',
  precioObjetivo: '',
  oferta: '',
  comuna: '',
  comprador: '',
  estado: '',
});
  const [detalleContactoId, setDetalleContactoId] = useState(null);
  const itemsPorPagina = 20;

  useEffect(() => {
    const cargarOfertas = async () => {
      const { data: userData, error: userError } = await supabase.auth.getUser();

      if (userError || !userData?.user) {
        alert('Debes iniciar sesión.');
        router.push('/');
        return;
      }

      const { perfil: perfilProv } = await resolveProveedorProfile(userData.user, {
        select: 'id, tipo',
      });

      if (!perfilProv) {
        alert('No se encontró perfil proveedor.');
        router.push('/proveedor');
        return;
      }

      const proveedorPerfilId = perfilProv.id;

      const { data: ofertasData, error: ofertasError } = await supabase
        .from('ofertas_productos')
        .select('*')
        .eq('proveedor_id', proveedorPerfilId)
        .order('id', { ascending: false });

      if (ofertasError) {
        alert('Error al cargar ofertas: ' + ofertasError.message);
        return;
      }

      const listaIds = Array.from(
        new Set((ofertasData || []).map((o) => o.lista_id).filter(Boolean))
      );

      const mapLista = {};

      if (listaIds.length) {
        const { data: listasRows, error: listasErr } = await supabase
          .from('listas_compras')
          .select(
            'id, usuario_id, comprador_email, producto, formato, marca, cantidad, precio, comuna_despacho, direccion_envio, fecha_creacion'
          )
          .in('id', listaIds);

        if (listasErr) {
          console.error('Error cargando listas_compras:', listasErr);
        }

        (listasRows || []).forEach((l) => {
          mapLista[l.id] = {
            id: l.id,
            usuario_id: (l.usuario_id || '').toString().trim(),
            comprador_email: (l.comprador_email || '').toString().trim(),
            producto: l.producto || '',
            formato: l.formato || '',
            marca: l.marca || '',
            cantidad: l.cantidad || '',
            precio: l.precio || '',
            comuna_despacho: (l.comuna_despacho || '').toString().trim(),
            direccion_envio: (l.direccion_envio || '').toString().trim(),
            fecha_creacion: l.fecha_creacion || null,
          };
        });
      }

      const usuarioIds = Array.from(
        new Set(
          Object.values(mapLista)
            .map((v) => (v?.usuario_id || '').toString().trim())
            .filter(Boolean)
        )
      );

      const mapPerfilComprador = {};

      if (usuarioIds.length) {
        const { data: perfilesRows, error: perfilesErr } = await supabase
          .from('perfiles')
          .select(
            'id, auth_id, tipo, email, email_contacto, telefono_contacto, direccion, comuna'
          )
          .eq('tipo', 'comprador')
          .in('auth_id', usuarioIds);

        if (perfilesErr) {
          console.error('Error cargando perfiles comprador:', perfilesErr);
        }

        (perfilesRows || []).forEach((p) => {
          const authId = (p.auth_id || '').toString().trim();
          if (!authId) return;

          const emailContacto = (p.email_contacto || '').toString().trim();
          const emailBase = (p.email || '').toString().trim();
          const telefono = (p.telefono_contacto || '').toString().trim();
          const direccion = (p.direccion || '').toString().trim();
          const comuna = (p.comuna || '').toString().trim();

          mapPerfilComprador[authId] = {
            email: emailContacto || emailBase || 'N/A',
            telefono: telefono || 'No disponible',
            direccionPerfil: [direccion, comuna].filter(Boolean).join(', '),
          };
        });
      }

      const enriquecidas = (ofertasData || []).map((o) => {
        const li = mapLista[o.lista_id] || {};
        const buyer =
          mapPerfilComprador[(li.usuario_id || '').toString().trim()] || {};

        const direccionFinal =
          buyer.direccionPerfil ||
          li.direccion_envio ||
          li.comuna_despacho ||
          'No disponible';

        return {
          ...o,
          producto: o.producto || li.producto || '',
          formato: o.formato || li.formato || '',
          marca: o.marca || li.marca || '',
          cantidad: li.cantidad || '',
          precio_objetivo: li.precio || '',
          comprador_email: buyer.email || li.comprador_email || 'N/A',
          comprador_telefono: buyer.telefono || 'No disponible',
          comprador_direccion: direccionFinal,
          comuna: li.comuna_despacho || '—',
          fecha_creacion: li.fecha_creacion || null,
        };
      });

      setOfertas(enriquecidas);
    };

    cargarOfertas();
  }, [router]);

  const volverAlPanel = () => router.push('/proveedor');

  const normalizarTexto = (t) =>
    t
      ? t
          .toString()
          .toUpperCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
      : '';

  const manejarCambioFiltro = (campo, valor) => {
  setFiltros((prev) => ({
    ...prev,
    [campo]: valor.toUpperCase(),
  }));
  setPaginaActual(1);
};

  const formatearNumero = (num) =>
    num === '' || num === null || num === undefined
      ? ''
      : new Intl.NumberFormat('es-CL').format(num);

  const estadoTexto = (estado) => {
    switch ((estado || '').toLowerCase()) {
      case 'pendiente':
        return 'Oferta enviada';
      case 'en_espera_confirmacion':
        return 'Aceptada';
      case 'confirmada':
        return 'Confirmada';
      case 'rechazada':
        return 'Rechazada';
      default:
        return estado || '—';
    }
  };

  const getEstadoStyle = (estado) => {
    switch ((estado || '').toLowerCase()) {
      case 'pendiente':
        return styles.estadoAzul;
      case 'en_espera_confirmacion':
        return styles.estadoNaranja;
      case 'confirmada':
        return styles.estadoConfirmada;
      case 'rechazada':
        return styles.estadoGris;
      default:
        return styles.estadoDefault;
    }
  };

const ofertasFiltradas = useMemo(() => {
  return ofertas.filter((item) => {
    const valores = {
      producto: item.producto,
      formato: item.formato,
      marca: item.marca,
      cantidad: item.cantidad?.toString(),
      precioObjetivo: item.precio_objetivo?.toString(),
      oferta: item.precio_ofertado?.toString(),
      comuna: item.comuna,
      comprador: item.comprador_email,
      estado: estadoTexto(item.estado),
    };

    return Object.entries(filtros).every(([campo, valor]) => {
      if (!valor) return true;

      return normalizarTexto(valores[campo] || '').includes(
        normalizarTexto(valor)
      );
    });
  });
}, [ofertas, filtros]);

  const totalPaginas = Math.ceil(ofertasFiltradas.length / itemsPorPagina);
  const inicio = (paginaActual - 1) * itemsPorPagina;
  const fin = inicio + itemsPorPagina;
  const ofertasPaginadas = ofertasFiltradas.slice(inicio, fin);

  return (
    <div style={styles.page}>
      <div style={styles.backgroundGlow}></div>

      <img
        src="/yoproveo_logo_mvp.png"
        alt=""
        style={styles.watermark}
      />

      <div style={styles.topBar}>
        <div style={styles.leftActions}>
          <button onClick={volverAlPanel} style={styles.secondaryButton}>
            Volver al panel
          </button>
        </div>

        <div style={styles.centerTitle}>
          <h1 style={styles.title}>Mis Ofertas Enviadas</h1>
        </div>

        <div style={styles.rightActions}></div>
      </div>

      <main style={styles.content}>
        <section style={styles.card}>
          <img
            src="/icono_1.png"
            alt="Kyntü"
            style={styles.logo}
          />

          <h2 style={styles.cardTitle}>Historial de ofertas</h2>

          <div style={styles.filtersGrid}>
  <div style={styles.filterGroup}>
    <label style={styles.filterLabel}>Producto</label>
    <input value={filtros.producto} onChange={(e) => manejarCambioFiltro('producto', e.target.value)} style={styles.filterInput} />
  </div>

  <div style={styles.filterGroup}>
    <label style={styles.filterLabel}>Formato</label>
    <input value={filtros.formato} onChange={(e) => manejarCambioFiltro('formato', e.target.value)} style={styles.filterInput} />
  </div>

  <div style={styles.filterGroup}>
    <label style={styles.filterLabel}>Marca</label>
    <input value={filtros.marca} onChange={(e) => manejarCambioFiltro('marca', e.target.value)} style={styles.filterInput} />
  </div>

  <div style={styles.filterGroup}>
    <label style={styles.filterLabel}>Cantidad</label>
    <input value={filtros.cantidad} onChange={(e) => manejarCambioFiltro('cantidad', e.target.value)} style={styles.filterInput} />
  </div>

  <div style={styles.filterGroup}>
    <label style={styles.filterLabel}>Precio objetivo</label>
    <input value={filtros.precioObjetivo} onChange={(e) => manejarCambioFiltro('precioObjetivo', e.target.value)} style={styles.filterInput} />
  </div>

  <div style={styles.filterGroup}>
    <label style={styles.filterLabel}>Tu oferta</label>
    <input value={filtros.oferta} onChange={(e) => manejarCambioFiltro('oferta', e.target.value)} style={styles.filterInput} />
  </div>

  <div style={styles.filterGroup}>
    <label style={styles.filterLabel}>Comuna</label>
    <input value={filtros.comuna} onChange={(e) => manejarCambioFiltro('comuna', e.target.value)} style={styles.filterInput} />
  </div>

  <div style={styles.filterGroup}>
    <label style={styles.filterLabel}>Comprador</label>
    <input value={filtros.comprador} onChange={(e) => manejarCambioFiltro('comprador', e.target.value)} style={styles.filterInput} />
  </div>

  <div style={styles.filterGroup}>
    <label style={styles.filterLabel}>Estado</label>
    <input value={filtros.estado} onChange={(e) => manejarCambioFiltro('estado', e.target.value)} style={styles.filterInput} />
  </div>
</div>

          {ofertasFiltradas.length === 0 ? (
            <p style={styles.emptyText}>No has enviado ofertas todavía.</p>
          ) : (
            <>
              <div style={styles.tableWrapper}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>Producto</th>
                      <th style={styles.th}>Formato</th>
                      <th style={styles.th}>Marca</th>
                      <th style={styles.th}>Cantidad</th>
                      <th style={styles.th}>Precio objetivo</th>
                      <th style={styles.th}>Tu oferta</th>
                      <th style={styles.th}>Comuna</th>
                      <th style={styles.th}>Comprador</th>
                      <th style={styles.th}>Fecha</th>
                      <th style={styles.th}>Estado</th>
                      <th style={styles.th}>Comentario comprador</th>
                      <th style={styles.th}>Contacto</th>
                    </tr>
                  </thead>

                  <tbody>
                    {ofertasPaginadas.map((item) => {
                      const puedeVerContacto =
                        item.estado === 'en_espera_confirmacion' ||
                        item.estado === 'confirmada';

                      return (
                        <>
                          <tr key={item.id}>
                            <td style={styles.td}>{item.producto}</td>
                            <td style={styles.td}>{item.formato}</td>
                            <td style={styles.td}>{item.marca}</td>
                            <td style={styles.td}>{item.cantidad}</td>
                            <td style={styles.td}>
                              ${formatearNumero(item.precio_objetivo)}
                            </td>
                            <td style={styles.td}>
                              ${formatearNumero(item.precio_ofertado)}
                            </td>
                            <td style={styles.td}>{item.comuna}</td>
                            <td style={styles.td}>{item.comprador_email}</td>
                            <td style={styles.td}>
                              {item.fecha_creacion
                                ? new Date(item.fecha_creacion).toLocaleString()
                                : ''}
                            </td>
                            <td style={styles.td}>
                              <span style={getEstadoStyle(item.estado)}>
                                {estadoTexto(item.estado)}
                              </span>
                            </td>
                            <td style={styles.td}>
                              <div style={styles.commentBox}>
                                {item.comentario_comprador?.trim()
                                  ? item.comentario_comprador
                                  : 'Sin comentarios'}
                              </div>
                            </td>
                            <td style={styles.td}>
                              {puedeVerContacto ? (
                                <button
                                  onClick={() =>
                                    setDetalleContactoId(
                                      detalleContactoId === item.id
                                        ? null
                                        : item.id
                                    )
                                  }
                                  style={styles.smallButton}
                                >
                                  {detalleContactoId === item.id
                                    ? 'Ocultar'
                                    : 'Ver contacto'}
                                </button>
                              ) : (
                                <span style={styles.emptyAction}>—</span>
                              )}
                            </td>
                          </tr>

                          {puedeVerContacto && detalleContactoId === item.id && (
                            <tr key={`detalle-${item.id}`}>
                              <td colSpan={12} style={styles.contactBox}>
                                <strong>Datos de contacto del comprador</strong>

                                <div style={styles.contactText}>
                                  <p>
                                    <strong>Correo:</strong>{' '}
                                    {item.comprador_email || 'N/A'}
                                  </p>
                                  <p>
                                    <strong>Teléfono:</strong>{' '}
                                    {item.comprador_telefono ||
                                      'No disponible'}
                                  </p>
                                  <p>
                                    <strong>Dirección de despacho:</strong>{' '}
                                    {item.comprador_direccion ||
                                      'No disponible'}
                                  </p>
                                  <p>
                                    <strong>Precio aceptado:</strong>{' '}
                                    ${formatearNumero(item.precio_ofertado)}
                                  </p>
                                </div>
                              </td>
                            </tr>
                          )}
                        </>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div style={styles.pagination}>
                <button
                  onClick={() => setPaginaActual((p) => Math.max(p - 1, 1))}
                  disabled={paginaActual === 1}
                  style={styles.secondaryButton}
                >
                  Anterior
                </button>

                <span style={styles.pageText}>
                  Página {paginaActual} de {totalPaginas || 1}
                </span>

                <button
                  onClick={() =>
                    setPaginaActual((p) => Math.min(p + 1, totalPaginas || 1))
                  }
                  disabled={
                    paginaActual === totalPaginas || totalPaginas === 0
                  }
                  style={styles.secondaryButton}
                >
                  Siguiente
                </button>
              </div>
            </>
          )}
        </section>
      </main>
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    background:
      'linear-gradient(135deg, #1f5cff 0%, #071426 42%, #050b18 100%)',
    position: 'relative',
    overflowX: 'hidden',
    padding: '24px',
    boxSizing: 'border-box',
    fontFamily: 'Arial, Helvetica, sans-serif',
  },

  backgroundGlow: {
    position: 'absolute',
    inset: 0,
    background:
      'radial-gradient(circle at 18% 18%, rgba(31, 92, 255, 0.38), transparent 32%), radial-gradient(circle at 80% 75%, rgba(0, 255, 195, 0.10), transparent 28%)',
    zIndex: 1,
  },

  watermark: {
    position: 'absolute',
    top: '35px',
    left: '45px',
    width: '260px',
    opacity: 0.08,
    zIndex: 1,
    filter: 'drop-shadow(0 0 18px rgba(0,255,210,0.55))',
    pointerEvents: 'none',
  },

  topBar: {
    position: 'relative',
    zIndex: 3,
    display: 'grid',
    gridTemplateColumns: '1fr auto 1fr',
    alignItems: 'center',
    marginBottom: '32px',
  },

  leftActions: {
    display: 'flex',
    justifyContent: 'flex-start',
  },

  centerTitle: {
    display: 'flex',
    justifyContent: 'center',
  },

  rightActions: {
    display: 'flex',
    justifyContent: 'flex-end',
  },

  title: {
    color: '#ffffff',
    fontSize: '38px',
    fontWeight: 800,
    margin: 0,
    textAlign: 'center',
    textShadow: '0 3px 12px rgba(0,0,0,0.35)',
  },

  content: {
    position: 'relative',
    zIndex: 3,
    maxWidth: '1280px',
    margin: '0 auto',
  },

  card: {
    width: '100%',
    background: 'rgba(5, 12, 29, 0.86)',
    border: '1px solid rgba(255, 255, 255, 0.12)',
    borderRadius: '28px',
    boxShadow: '0 28px 80px rgba(0, 0, 0, 0.35)',
    padding: '34px',
    boxSizing: 'border-box',
    backdropFilter: 'blur(10px)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },

  logo: {
    width: '220px',
    marginBottom: '-18px',
    filter: 'drop-shadow(0 0 28px rgba(0,255,210,0.45))',
  },

  cardTitle: {
    color: '#ffffff',
    fontSize: '28px',
    margin: '0 0 24px',
    fontWeight: 800,
    textAlign: 'center',
  },

  searchInput: {
    width: 'min(420px, 100%)',
    padding: '13px 15px',
    marginBottom: '24px',
    borderRadius: '12px',
    border: '1px solid rgba(255, 255, 255, 0.18)',
    background: 'rgba(255, 255, 255, 0.08)',
    color: '#ffffff',
    outline: 'none',
    fontSize: '14px',
    textTransform: 'uppercase',
    textAlign: 'center',
  },

  tableWrapper: {
    width: '100%',
    overflowX: 'auto',
  },

  table: {
    width: '100%',
    borderCollapse: 'separate',
    borderSpacing: '0 10px',
    textAlign: 'center',
  },

  th: {
    color: 'rgba(255, 255, 255, 0.72)',
    fontSize: '12px',
    padding: '8px',
    textAlign: 'center',
    whiteSpace: 'nowrap',
  },

  td: {
    color: '#ffffff',
    padding: '9px 8px',
    textAlign: 'center',
    background: 'rgba(255, 255, 255, 0.045)',
    borderTop: '1px solid rgba(255, 255, 255, 0.08)',
    borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
    fontSize: '13px',
  },

  smallButton: {
    background: 'rgba(255, 255, 255, 0.08)',
    color: '#ffffff',
    border: '1px solid rgba(255, 255, 255, 0.18)',
    padding: '10px 14px',
    borderRadius: '11px',
    cursor: 'pointer',
    fontWeight: 700,
    fontSize: '12px',
    whiteSpace: 'nowrap',
  },

  secondaryButton: {
    background: 'rgba(255, 255, 255, 0.08)',
    color: '#ffffff',
    border: '1px solid rgba(255, 255, 255, 0.18)',
    padding: '12px 22px',
    borderRadius: '12px',
    cursor: 'pointer',
    fontWeight: 700,
    fontSize: '14px',
  },

  pagination: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '14px',
    flexWrap: 'wrap',
    marginTop: '24px',
  },

  pageText: {
    color: 'rgba(255, 255, 255, 0.78)',
    fontWeight: 700,
  },

  emptyText: {
    color: 'rgba(255, 255, 255, 0.72)',
    margin: 0,
  },

  emptyAction: {
    color: 'rgba(255, 255, 255, 0.45)',
  },

  contactBox: {
    color: '#ffffff',
    textAlign: 'left',
    background: 'rgba(255, 255, 255, 0.07)',
    padding: '16px 20px',
    borderRadius: '14px',
    border: '1px solid rgba(255, 255, 255, 0.12)',
  },

  contactText: {
    marginTop: '8px',
    fontSize: '14px',
    color: 'rgba(255, 255, 255, 0.82)',
  },

  estadoAzul: {
    color: '#5dade2',
    fontWeight: 800,
  },

  estadoNaranja: {
    color: '#f39c12',
    fontWeight: 800,
  },

  estadoConfirmada: {
    color: '#2ecc71',
    fontWeight: 800,
  },

  estadoGris: {
    color: 'rgba(255, 255, 255, 0.55)',
    fontStyle: 'italic',
  },

  estadoDefault: {
    color: '#ffffff',
  },
filtersGrid: {
  width: '100%',
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))',
  gap: '10px',
  marginBottom: '24px',
},

filterInput: {
  padding: '11px 12px',
  borderRadius: '10px',
  border: '1px solid rgba(255, 255, 255, 0.18)',
  background: 'rgba(255, 255, 255, 0.08)',
  color: '#ffffff',
  outline: 'none',
  fontSize: '12px',
  textTransform: 'uppercase',
  textAlign: 'center',
},filtersGrid: {
  width: '100%',
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))',
  gap: '10px',
  marginBottom: '24px',
},

filterInput: {
  padding: '11px 12px',
  borderRadius: '10px',
  border: '1px solid rgba(255, 255, 255, 0.18)',
  background: 'rgba(255, 255, 255, 0.08)',
  color: '#ffffff',
  outline: 'none',
  fontSize: '12px',
  textTransform: 'uppercase',
  textAlign: 'center',
},
filterGroup: {
  display: 'flex',
  flexDirection: 'column',
  gap: '4px',
},

filterLabel: {
  color: 'rgba(255,255,255,0.75)',
  fontSize: '11px',
  fontWeight: '700',
  textAlign: 'left',
},
commentBox: {
  minWidth: '160px',
  maxWidth: '240px',
  minHeight: '38px',
  padding: '10px',
  borderRadius: '10px',
  background: 'rgba(255, 255, 255, 0.08)',
  border: '1px solid rgba(255, 255, 255, 0.12)',
  color: 'rgba(255,255,255,0.82)',
  fontSize: '12px',
  lineHeight: '1.4',
  whiteSpace: 'normal',
  wordBreak: 'break-word',
},
};