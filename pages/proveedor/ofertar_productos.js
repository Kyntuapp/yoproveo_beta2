import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { resolveProveedorProfile } from '../../lib/resolveProveedorProfile';
import { useRouter } from 'next/router';

export default function OfertarProductos() {
  const [listas, setListas] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [proveedorPerfilId, setProveedorPerfilId] = useState(null);
  const [filtros, setFiltros] = useState({
  producto: '',
  formato: '',
  marca: '',
  cantidad: '',
  precio: '',
  comuna: '',
  comprador: '',
  fecha: '',
  estado: '',
});
  const [paginaActual, setPaginaActual] = useState(1);
  const [detalleContactoId, setDetalleContactoId] = useState(null);
  const itemsPorPagina = 20;
  const router = useRouter();

  useEffect(() => {
    const cargarDatos = async () => {
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
        alert('El usuario no tiene un perfil de proveedor asociado.');
        return;
      }

      setProveedorPerfilId(perfilProv.id);

      const { data: listasData, error: listasError } = await supabase
        .from('listas_compras')
        .select('*')
        .order('fecha_creacion', { ascending: false });

        const listaIds = Array.from(
  new Set(
    (listasData || [])
      .map((item) => item.lista_id)
      .filter(Boolean)
  )
);

let estadoPorLista = {};

if (listaIds.length > 0) {
  const { data: cabecerasData, error: cabecerasError } =
    await supabase
      .from('listas')
      .select('id, estado')
      .in('id', listaIds);

  if (cabecerasError) {
    console.error(
      'Error cargando estados de listas:',
      cabecerasError
    );
  }

  estadoPorLista = Object.fromEntries(
    (cabecerasData || []).map((lista) => [
      lista.id,
      lista.estado,
    ])
  );
}

      const { data: perfilesData, error: perfilesError } = await supabase
        .from('perfiles')
        .select('*');

      const { data: ofertasData, error: ofertasError } = await supabase
        .from('ofertas_productos')
        .select('lista_id, proveedor_id, precio_ofertado, estado')
        .eq('proveedor_id', perfilProv.id);

      if (listasError || perfilesError || ofertasError) {
        console.error(listasError || perfilesError || ofertasError);
        alert('Error al cargar datos.');
        return;
      }

      const authUserId = userData.user.id;
     const listasAjenas = (listasData || []).filter(
  (item) => {
    const perteneceAOtroUsuario =
      String(item.usuario_id || '') !==
      String(authUserId);

    // Los registros antiguos sin lista_id siguen visibles.
    const estaPublicada =
      !item.lista_id ||
      estadoPorLista[item.lista_id] ===
        'publicada';

    return perteneceAOtroUsuario && estaPublicada;
  }
);

      setUsuarios(perfilesData || []);

      const compradoresPorAuth = Object.fromEntries(
        (perfilesData || [])
          .filter(
            (p) =>
              String(p.tipo || '').trim().toLowerCase() === 'comprador' &&
              p.auth_id
          )
          .map((p) => [String(p.auth_id).trim().toLowerCase(), p])
      );

      const enriquecida = listasAjenas
        .map((item) => {
          const perfilComprador =
            compradoresPorAuth[
              String(item.usuario_id || '').trim().toLowerCase()
            ] || null;

          const ofertaExistente = (ofertasData || []).find(
            (o) => o.lista_id === item.id
          );

          return {
            ...item,
            comprador_email:
              item.comprador_email || perfilComprador?.email || 'Desconocido',
            oferta: ofertaExistente ? ofertaExistente.precio_ofertado : '',
            incluye_despacho: false,
            tiempo_despacho_horas: '',
            ya_oferto: !!ofertaExistente,
            estado_oferta: ofertaExistente ? ofertaExistente.estado : null,
          };
        })
        .filter((item) => !item.ya_oferto);

      setListas(enriquecida);
    };

    cargarDatos();
  }, [router]);

  const calcularDiasRestantes = (fecha_cierre) => {
    if (!fecha_cierre) return '-';
    const cierre = new Date(fecha_cierre);
    const hoy = new Date();
    const diff = cierre - hoy;
    if (diff <= 0) return '0';
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  const manejarCambioOferta = (index, valor) => {
    const actualizada = [...listas];
    actualizada[index].oferta = valor;
    setListas(actualizada);
  };

  const manejarDespacho = (itemId, valor) => {
  setListas((prev) =>
    prev.map((item) =>
      item.id === itemId
        ? {
            ...item,
            incluye_despacho: valor,
            tiempo_despacho_horas: valor
              ? item.tiempo_despacho_horas
              : "",
          }
        : item
    )
  );
};

  const manejarTiempoDespacho = (itemId, valor) => {
  setListas((prev) =>
    prev.map((item) =>
      item.id === itemId
        ? {
            ...item,
            tiempo_despacho_horas: valor,
          }
        : item
    )
  );
};

  const ofertarProducto = async (index) => {
    if (!proveedorPerfilId) {
      alert('No hay perfil de proveedor activo.');
      return;
    }

    const producto = listas[index];
    const ofertaLimpia = parseFloat(
      (producto.oferta ?? '').toString().replace(/\./g, '')
    );

    if (isNaN(ofertaLimpia) || ofertaLimpia <= 0) {
      alert('Por favor ingresa un valor numérico válido en la oferta.');
      return;
    }

    if (
  producto.incluye_despacho &&
  !producto.tiempo_despacho_horas
) {
  alert('Selecciona el tiempo de despacho.');
  return;
}

    if (
      producto.estado === 'cerrada' ||
      calcularDiasRestantes(producto.fecha_cierre) === '0'
    ) {
      alert('La licitación está cerrada.');
      return;
    }

    if (producto.ya_oferto) {
      alert(
        'Ya enviaste una oferta para este producto. Puedes verla en Mis ofertas enviadas.'
      );
      setListas((prev) => prev.filter((item) => item.id !== producto.id));
      return;
    }

    const { data: ofertaDuplicada, error: dupError } = await supabase
      .from('ofertas_productos')
      .select('id')
      .eq('proveedor_id', proveedorPerfilId)
      .eq('lista_id', producto.id)
      .maybeSingle();

    if (dupError) {
      alert('Error al verificar ofertas existentes: ' + dupError.message);
      return;
    }

    if (ofertaDuplicada) {
      alert(
        'Ya enviaste una oferta para este producto. Puedes verla en Mis ofertas enviadas.'
      );
      setListas((prev) => prev.filter((item) => item.id !== producto.id));
      return;
    }

    const { error } = await supabase.from('ofertas_productos').insert({
      lista_id: producto.id,
      proveedor_id: proveedorPerfilId,
      producto: producto.producto,
      formato: producto.formato,
      marca: producto.marca,
      precio_ofertado: ofertaLimpia,
      incluye_despacho: producto.incluye_despacho,
      tiempo_despacho_horas: producto.incluye_despacho
        ? Number(producto.tiempo_despacho_horas)
        : null,
      estado: 'pendiente',
    });

    if (error) {
      const esDuplicada =
        error.code === '23505' ||
        (error.message || '').toLowerCase().includes('unique');

      if (esDuplicada) {
        alert(
          'Ya enviaste una oferta para este producto. Puedes verla en Mis ofertas enviadas.'
        );
        setListas((prev) => prev.filter((item) => item.id !== producto.id));
      } else {
        alert('Error al enviar oferta: ' + error.message);
      }
    } else {
      await supabase.from('notificaciones').insert([
        {
          usuario_id: producto.usuario_id,
          rol: 'comprador',
          titulo: 'Nueva oferta recibida',
          mensaje: `Has recibido una oferta para el producto ${producto.producto}`,
          ruta: '/comprador?notif=ofertas&list_id=' + producto.id,
          leida: false,
        },
      ]);

      setListas((prev) => prev.filter((item) => item.id !== producto.id));

      alert('Oferta enviada correctamente.');
    }
  };

  const volverAlPanel = () => router.push('/proveedor');

  const normalizarTexto = (t) =>
    t ? t.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') : '';

  const manejarCambioFiltro = (campo, valor) => {
  setFiltros((prev) => ({
    ...prev,
    [campo]: valor.toUpperCase(),
  }));
  setPaginaActual(1);
  };

 const listasFiltradas = listas.filter((item) => {
  if (item.ya_oferto) return false;

  const valores = {
    producto: item.producto,
    formato: item.formato,
    marca: item.marca,
    cantidad: item.cantidad?.toString(),
    precio: item.precio?.toString(),
    comuna: item.comuna_despacho,
    comprador: item.comprador_email,
    fecha: item.fecha_creacion
  ? new Date(item.fecha_creacion).toISOString().split("T")[0]
  : "",
    estado:
  item.estado === 'cerrada'
    ? 'Cerrada'
    : item.ya_oferto
    ? 'Oferta enviada'
    : 'Recibiendo ofertas',
  };

  return Object.entries(filtros).every(([campo, valor]) => {
    if (!valor) return true;

    return normalizarTexto(valores[campo] || '').includes(
      normalizarTexto(valor)
    );
  });
});

  const totalPaginas = Math.ceil(listasFiltradas.length / itemsPorPagina);
  const inicio = (paginaActual - 1) * itemsPorPagina;
  const fin = inicio + itemsPorPagina;
  const listasPaginadas = listasFiltradas.slice(inicio, fin);

  const formatearNumero = (num) =>
    num === '' || num === null || num === undefined
      ? ''
      : new Intl.NumberFormat('es-CL').format(num);

  const obtenerEstado = (item) => {
    if (item.estado === 'cerrada') return 'Cerrada';

    switch (item.estado_oferta) {
      case 'confirmada':
        return 'Confirmada';
      case 'en_espera_confirmacion':
        return 'En espera de confirmación';
      case 'rechazada':
        return 'Rechazada';
      case 'pendiente':
      case null:
      case undefined:
        if (item.ya_oferto) return 'Oferta enviada';
        break;
      default:
        if (item.ya_oferto) return 'Oferta enviada';
    }

    return 'Recibiendo ofertas';
  };

  const getEstadoStyle = (estadoTexto) => {
    switch (estadoTexto) {
      case 'Recibiendo ofertas':
        return styles.estadoVerde;
      case 'Oferta enviada':
        return styles.estadoAzul;
      case 'En espera de confirmación':
        return styles.estadoNaranja;
      case 'Confirmada':
        return styles.estadoConfirmada;
      case 'Rechazada':
        return styles.estadoGris;
      case 'Cerrada':
        return styles.estadoRojo;
      default:
        return styles.estadoDefault;
    }
  };

  const estadoTexto = (item) => obtenerEstado(item);

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
          <h1 style={styles.title}>Ofertar Productos</h1>
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

          <h2 style={styles.cardTitle}>Listas de compra activas</h2>

          <div style={styles.filtersGrid}>
  <div style={styles.filterGroup}>
    <label style={styles.filterLabel}>Producto</label>
    <input
      value={filtros.producto}
      onChange={(e) => manejarCambioFiltro('producto', e.target.value)}
      style={styles.filterInput}
    />
  </div>

  <div style={styles.filterGroup}>
    <label style={styles.filterLabel}>Formato</label>
    <input
      value={filtros.formato}
      onChange={(e) => manejarCambioFiltro('formato', e.target.value)}
      style={styles.filterInput}
    />
  </div>

  <div style={styles.filterGroup}>
    <label style={styles.filterLabel}>Marca</label>
    <input
      value={filtros.marca}
      onChange={(e) => manejarCambioFiltro('marca', e.target.value)}
      style={styles.filterInput}
    />
  </div>

  <div style={styles.filterGroup}>
    <label style={styles.filterLabel}>Cantidad</label>
    <input
      value={filtros.cantidad}
      onChange={(e) => manejarCambioFiltro('cantidad', e.target.value)}
      style={styles.filterInput}
    />
  </div>

  <div style={styles.filterGroup}>
    <label style={styles.filterLabel}>Precio</label>
    <input
      value={filtros.precio}
      onChange={(e) => manejarCambioFiltro('precio', e.target.value)}
      style={styles.filterInput}
    />
  </div>

  <div style={styles.filterGroup}>
    <label style={styles.filterLabel}>Comuna</label>
    <input
      value={filtros.comuna}
      onChange={(e) => manejarCambioFiltro('comuna', e.target.value)}
      style={styles.filterInput}
    />
  </div>

  <div style={styles.filterGroup}>
    <label style={styles.filterLabel}>Comprador</label>
    <input
      value={filtros.comprador}
      onChange={(e) => manejarCambioFiltro('comprador', e.target.value)}
      style={styles.filterInput}
    />
  </div>

  <div style={styles.filterGroup}>
  <label style={styles.filterLabel}>Fecha</label>
  <input
    type="date"
    value={filtros.fecha}
    onChange={(e) =>
      setFiltros((prev) => ({
        ...prev,
        fecha: e.target.value,
      }))
    }
    style={styles.filterInput}
  />
</div>

  <div style={styles.filterGroup}>
    <label style={styles.filterLabel}>Estado</label>
    <input
      value={filtros.estado}
      onChange={(e) => manejarCambioFiltro('estado', e.target.value)}
      style={styles.filterInput}
    />
  </div>
</div>

          {listasFiltradas.length === 0 ? (
            <p style={styles.emptyText}>No hay listas disponibles.</p>
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
                      <th style={styles.th}>Comuna</th>
                      <th style={styles.th}>Comprador</th>
                      <th style={styles.th}>Fecha</th>
                      <th style={styles.th}>Días</th>
                      <th style={styles.th}>Estado</th>
                      <th style={styles.th}>
                        Oferta{' '}
                        <span
                          title="La oferta corresponde al valor total por la cantidad solicitada por el comprador."
                          style={styles.tooltipIcon}
                        >
                          ⓘ
                        </span>
                      </th>
                      <th style={{ ...styles.th, width: '130px' }}>Despacho</th>
                      <th style={styles.th}>Acción</th>
                    </tr>
                  </thead>

                  <tbody>
                    {listasPaginadas.map((item, index) => {
                      const estado = estadoTexto(item);
                      const puedeOfertar =
                        !item.ya_oferto && item.estado !== 'cerrada';
                      const esConfirmada = item.estado_oferta === 'confirmada';

                      return (
                        <React.Fragment key={item.id}>
                          <tr>
                            <td style={styles.td}>{item.producto}</td>
                            <td style={styles.td}>{item.formato}</td>
                            <td style={styles.td}>{item.marca}</td>
                            <td style={styles.td}>{item.cantidad}</td>
                            <td style={styles.td}>
                              ${formatearNumero(item.precio)}
                            </td>
                            <td style={styles.td}>{item.comuna_despacho}</td>
                            <td style={styles.td}>{item.comprador_email}</td>
                            <td style={styles.td}>
                              {item.fecha_creacion
                                ? new Date(item.fecha_creacion).toLocaleString()
                                : ''}
                            </td>
                            <td style={styles.td}>
                              {calcularDiasRestantes(item.fecha_cierre)}
                            </td>
                            <td style={styles.td}>
                              <span style={getEstadoStyle(estado)}>
                                {estado}
                              </span>
                            </td>
                            <td style={styles.td}>
                              {item.ya_oferto ? (
                                <span style={styles.sentOffer}>
                                  ${formatearNumero(item.oferta)}
                                </span>
                              ) : item.estado !== 'cerrada' ? (
                                <input
                                  type="text"
                                  value={item.oferta}
                                  onChange={(e) =>
                                    manejarCambioOferta(
                                      inicio + index,
                                      e.target.value
                                    )
                                  }
                                  style={styles.offerInput}
                                />
                              ) : (
                                <span style={styles.sentOffer}>
                                  Cerrada
                                </span>
                              )}
                            </td>
                            <td style={styles.td}>
                              {!item.ya_oferto && item.estado !== 'cerrada' ? (
                                <div
                                  style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    gap: '7px',
                                  }}
                                >
                                  <label
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '6px',
                                      cursor: 'pointer',
                                      whiteSpace: 'nowrap',
                                    }}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={Boolean(item.incluye_despacho)}
                                      onChange={(e) =>
                                        manejarDespacho(item.id, e.target.checked)
                                      }
                                      style={styles.checkbox}
                                    />

                                    {item.incluye_despacho ? 'Sí' : 'No'}
                                  </label>

                                  {item.incluye_despacho && (
                                    <select
                                      value={item.tiempo_despacho_horas || ''}
                                      onChange={(e) =>
                                        manejarTiempoDespacho(
                                          item.id,
                                          e.target.value
                                        )
                                      }
                                      style={styles.deliverySelect}
                                    >
                                      <option value="">Plazo</option>
                                      <option value="24">24 h</option>
                                      <option value="48">48 h</option>
                                      <option value="72">72 h</option>
                                      <option value="96">72+ h</option>
                                    </select>
                                  )}
                                </div>
                              ) : (
                                'No'
                              )}
                            </td>
                            
                            <td style={styles.td}>
                              {esConfirmada ? (
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
                                  Ver contacto
                                </button>
                              ) : puedeOfertar ? (
                                <button
                                  onClick={() =>
                                    ofertarProducto(inicio + index)
                                  }
                                  style={styles.mainButtonSmall}
                                >
                                  Ofertar
                                </button>
                              ) : (
                                <span style={styles.emptyAction}>---</span>
                              )}
                            </td>
                          </tr>

                          {esConfirmada && detalleContactoId === item.id && (
                            <tr>
                              <td colSpan={13} style={styles.contactBox}>
                                <strong>Datos de contacto del comprador</strong>

                                <div style={styles.contactText}>
                                  <p>
                                    <strong>Correo:</strong>{' '}
                                    {item.comprador_email}
                                  </p>
                                  <p>
                                    <strong>Precio aceptado:</strong>{' '}
                                    ${formatearNumero(item.oferta)}
                                  </p>
                                  <p>
                                    <strong>Dirección de despacho:</strong>{' '}
                                    {item.comuna_despacho}
                                  </p>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
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
                    setPaginaActual((p) => Math.min(p + 1, totalPaginas))
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
    maxWidth: '1440px',
    margin: '0 auto',
  },

  card: {
    width: '100%',
    background: 'rgba(5, 12, 29, 0.86)',
    border: '1px solid rgba(255, 255, 255, 0.12)',
    borderRadius: '28px',
    boxShadow: '0 28px 80px rgba(0, 0, 0, 0.35)',
    padding: '26px',
    boxSizing: 'border-box',
    backdropFilter: 'blur(10px)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },

  logo: {
    width: '190px',
    marginBottom: '-14px',
    filter: 'drop-shadow(0 0 28px rgba(0,255,210,0.45))',
  },

  cardTitle: {
    color: '#ffffff',
    fontSize: '26px',
    margin: '0 0 22px',
    fontWeight: 800,
    textAlign: 'center',
  },

  tableWrapper: {
    width: '100%',
    overflowX: 'visible',
  },

  table: {
    width: '100%',
    tableLayout: 'fixed',
    borderCollapse: 'separate',
    borderSpacing: '0 10px',
    textAlign: 'center',
  },

  th: {
    color: 'rgba(255, 255, 255, 0.72)',
    fontSize: '11px',
    padding: '7px 5px',
    textAlign: 'center',
    whiteSpace: 'normal',
  },

  td: {
    color: '#ffffff',
    padding: '9px 5px',
    textAlign: 'center',
    background: 'rgba(255, 255, 255, 0.045)',
    borderTop: '1px solid rgba(255, 255, 255, 0.08)',
    borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
    fontSize: '12px',
    wordBreak: 'break-word',
  },

  offerInput: {
    width: '60px',
    padding: '9px 8px',
    borderRadius: '10px',
    border: '1px solid rgba(255, 255, 255, 0.18)',
    background: 'rgba(255, 255, 255, 0.08)',
    color: '#ffffff',
    outline: 'none',
    textAlign: 'right',
  },

  checkbox: {
    width: '18px',
    height: '18px',
    cursor: 'pointer',
  },

deliverySelect: {
  width: '88px',
  height: '30px',
  padding: '2px 7px',
  borderRadius: '8px',
  border: '1px solid #cbd5e1',
  background: '#ffffff',
  color: '#1e293b',
  fontSize: '11px',
  fontWeight: 600,
  textAlign: 'center',
  outline: 'none',
  cursor: 'pointer',
  colorScheme: 'light',
},

  mainButtonSmall: {
    background: 'linear-gradient(135deg, #176BFF, #2E6BFF)',
    color: '#fff',
    border: 'none',
    padding: '9px 9px',
    borderRadius: '11px',
    cursor: 'pointer',
    fontWeight: 700,
    fontSize: '12px',
    boxShadow: '0 10px 24px rgba(23, 107, 255, 0.32)',
    whiteSpace: 'nowrap',
  },

  smallButton: {
    background: 'rgba(255, 255, 255, 0.08)',
    color: '#ffffff',
    border: '1px solid rgba(255, 255, 255, 0.18)',
    padding: '9px 12px',
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

  sentOffer: {
    color: 'rgba(255, 255, 255, 0.62)',
    fontWeight: 700,
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

  estadoVerde: {
    color: '#31f7c6',
    fontWeight: 800,
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

  estadoRojo: {
    color: '#ff7b7b',
    fontWeight: 800,
  },

  estadoDefault: {
    color: '#ffffff',
  },

  tooltipIcon: {
    color: '#31f7c6',
    cursor: 'help',
    fontWeight: 800,
  },

  filtersGrid: {
    width: '100%',
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(105px, 1fr))',
    gap: '9px',
    marginBottom: '22px',
  },

  filterGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },

  filterLabel: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: '11px',
    fontWeight: 700,
    textAlign: 'left',
  },

  filterInput: {
  padding: '10px 10px',
  borderRadius: '10px',
  border: '1px solid rgba(255, 255, 255, 0.18)',
  background: 'rgba(255, 255, 255, 0.08)',
  color: '#ffffff',
  outline: 'none',
  fontSize: '12px',
  textTransform: 'uppercase',
  textAlign: 'center',
  cursor: 'pointer',
  colorScheme: 'dark',
},
};