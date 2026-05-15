// pages/proveedor/catalogo.js
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabaseClient';

export default function CatalogoProveedor() {
  const router = useRouter();
  const [proveedorId, setProveedorId] = useState(null);
  const [loading, setLoading] = useState(true);

  const [productosNuevos, setProductosNuevos] = useState([
    { nombre: '', marca: '', formato: '', cantidad_disponible: '' },
  ]);

  const [universoProductos, setUniversoProductos] = useState([]);
  const [productosStock, setProductosStock] = useState([]);
  const [cantidadesEditadas, setCantidadesEditadas] = useState({});

  const [mostrarSolicitud, setMostrarSolicitud] = useState(false);
  const [solicitud, setSolicitud] = useState({
    nombre: '',
    marca: '',
    formato: '',
    cantidad_disponible: '',
  });

  useEffect(() => {
    const cargarDatos = async () => {
      const { data: userData, error } = await supabase.auth.getUser();

      if (error || !userData?.user) {
        alert('Debes iniciar sesión.');
        router.push('/');
        return;
      }

      const { data: perfil, error: perfilError } = await supabase
        .from('perfiles')
        .select('id')
        .eq('auth_id', userData.user.id)
        .eq('tipo', 'proveedor')
        .single();

      if (perfilError || !perfil) {
        alert('No se encontró un perfil de proveedor.');
        router.push('/');
        return;
      }

      setProveedorId(perfil.id);

      const { data: universoData, error: universoError } = await supabase
        .from('productos_proveedores')
        .select('nombre, formato, marca');

      if (universoError) {
        alert('Error al cargar universo de productos: ' + universoError.message);
      } else {
        setUniversoProductos(universoData || []);
      }

      await cargarProductos(perfil.id);
      setLoading(false);
    };

    cargarDatos();
  }, [router]);

  const cargarProductos = async (idProveedor = proveedorId) => {
    if (!idProveedor) return;

    const { data: productosData, error: productosError } = await supabase
      .from('productos_proveedores')
      .select('*')
      .eq('proveedor_id', idProveedor);

    if (productosError) {
      alert('Error al cargar productos: ' + productosError.message);
    } else {
      setProductosStock(productosData || []);
    }
  };

  const normalizarTexto = (valor) =>
    (valor || '').toUpperCase().replace(/\s+/g, ' ').trim();

  const normalizarFormato = (valor) =>
    (valor || '').toUpperCase().replace(/\s+/g, '').trim();

  const obtenerNombres = () =>
    Array.from(new Set((universoProductos || []).map((p) => p.nombre))).filter(Boolean);

  const obtenerFormatos = (nombre) =>
    Array.from(
      new Set(
        (universoProductos || [])
          .filter((p) => p.nombre === nombre)
          .map((p) => p.formato)
      )
    ).filter(Boolean);

  const obtenerMarcas = (nombre, formato) =>
    Array.from(
      new Set(
        (universoProductos || [])
          .filter((p) => p.nombre === nombre && p.formato === formato)
          .map((p) => p.marca)
      )
    ).filter(Boolean);

  const handleNuevoChange = (index, field, value) => {
    const nuevos = [...productosNuevos];

    if (field === 'nombre') {
      nuevos[index].nombre = value;
      nuevos[index].formato = '';
      nuevos[index].marca = '';
    } else if (field === 'formato') {
      nuevos[index].formato = value;
      nuevos[index].marca = '';
    } else {
      nuevos[index][field] = value;
    }

    setProductosNuevos(nuevos);
  };

  const agregarFila = () => {
    setProductosNuevos((prev) => [
      ...prev,
      { nombre: '', marca: '', formato: '', cantidad_disponible: '' },
    ]);
  };

  const guardarProductos = async () => {
    if (!proveedorId) return;

    const productosValidos = productosNuevos.filter(
      (p) =>
        (p.nombre || '').trim() !== '' &&
        (p.formato || '').trim() !== '' &&
        (p.marca || '').trim() !== ''
    );

    if (productosValidos.length === 0) {
      alert('Debes seleccionar al menos un producto, formato y marca.');
      return;
    }

    const productosConProveedor = productosValidos.map((producto) => ({
      ...producto,
      cantidad_disponible: Number(producto.cantidad_disponible) || 0,
      proveedor_id: proveedorId,
    }));

    const { error } = await supabase
      .from('productos_proveedores')
      .insert(productosConProveedor);

    if (error) {
      alert('Error al agregar productos: ' + error.message);
    } else {
      alert('Productos agregados correctamente');
      setProductosNuevos([
        { nombre: '', marca: '', formato: '', cantidad_disponible: '' },
      ]);
      await cargarProductos();
    }
  };

  const handleCantidadChange = (id, nuevaCantidad) => {
    setCantidadesEditadas((prev) => ({ ...prev, [id]: nuevaCantidad }));
  };

  const actualizarCantidad = async (id) => {
    const nuevaCantidad = cantidadesEditadas[id];

    if (nuevaCantidad === undefined) return;

    const valor = Number(nuevaCantidad);

    if (Number.isNaN(valor) || valor < 0) {
      alert('La cantidad debe ser un número mayor o igual a 0.');
      return;
    }

    const { error } = await supabase
      .from('productos_proveedores')
      .update({ cantidad_disponible: valor })
      .eq('id', id);

    if (error) {
      alert('Error al actualizar la cantidad: ' + error.message);
    } else {
      alert('Cantidad actualizada correctamente');

      setProductosStock((prev) =>
        prev.map((p) =>
          p.id === id ? { ...p, cantidad_disponible: valor } : p
        )
      );

      setCantidadesEditadas((prev) => {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      });
    }
  };

  const eliminarProducto = async (id) => {
    const confirmar = window.confirm(
      '¿Seguro que deseas eliminar este producto de tu catálogo?'
    );

    if (!confirmar) return;

    const { error } = await supabase
      .from('productos_proveedores')
      .delete()
      .eq('id', id);

    if (error) {
      alert('Error al eliminar el producto: ' + error.message);
    } else {
      alert('Producto eliminado correctamente');

      setProductosStock((prev) => prev.filter((p) => p.id !== id));

      setCantidadesEditadas((prev) => {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      });
    }
  };

  const handleSolicitudChange = (field, value) => {
    const valorNormalizado =
      field === 'cantidad_disponible' ? value : value.toUpperCase();

    setSolicitud((prev) => ({ ...prev, [field]: valorNormalizado }));
  };

  const enviarSolicitud = async () => {
    if (!proveedorId) return;

    const nombre = normalizarTexto(solicitud.nombre);
    const marca = normalizarTexto(solicitud.marca);
    const formato = normalizarTexto(solicitud.formato);
    const cantidadDisponible = Number(solicitud.cantidad_disponible) || 0;

    if (!nombre) {
      alert('Debes ingresar al menos el nombre del producto.');
      return;
    }

    const nombreNormalizado = normalizarTexto(nombre);
    const marcaNormalizada = normalizarTexto(marca);
    const formatoNormalizado = normalizarFormato(formato);

    const { data: productosCatalogo, error: errorCatalogo } = await supabase
      .from('catalogo_productos')
      .select('id, nombre, marca, formato');

    if (errorCatalogo) {
      alert('Error al validar el catálogo: ' + errorCatalogo.message);
      return;
    }

    const existeProducto = (productosCatalogo || []).some((producto) => {
      const nombreCatalogo = normalizarTexto(producto.nombre);
      const marcaCatalogo = normalizarTexto(producto.marca);
      const formatoCatalogo = normalizarFormato(producto.formato);

      return (
        nombreCatalogo === nombreNormalizado &&
        marcaCatalogo === marcaNormalizada &&
        formatoCatalogo === formatoNormalizado
      );
    });

    if (existeProducto) {
      alert(
        "Este producto ya está en nuestro catálogo, puedes agregarlo directamente desde la opción 'Agregar producto'"
      );
      return;
    }

    const { error } = await supabase
      .from('solicitudes_productos')
      .insert([
        {
          proveedor_id: proveedorId,
          nombre,
          marca,
          formato,
          cantidad_disponible: cantidadDisponible,
          estado: 'pendiente',
        },
      ]);

    if (error) {
      alert('Error al enviar la solicitud: ' + error.message);
    } else {
      alert('Solicitud enviada al administrador.');
      setSolicitud({
        nombre: '',
        marca: '',
        formato: '',
        cantidad_disponible: '',
      });
      setMostrarSolicitud(false);
    }
  };

  const volverAlPanel = () => router.push('/proveedor');

  const cerrarSesion = async () => {
    await supabase.auth.signOut();
    localStorage.clear();
    router.push('/login');
  };

  if (loading) {
    return (
      <div style={styles.page}>
        <div style={styles.backgroundGlow}></div>
        <p style={styles.loading}>Cargando...</p>
      </div>
    );
  }

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
          <h1 style={styles.title}>Catálogo y Stock</h1>
        </div>

        <div style={styles.rightActions}>
          <button onClick={cerrarSesion} style={styles.logoutButton}>
            Cerrar sesión
          </button>
        </div>
      </div>

      <main style={styles.content}>
        <section style={styles.card}>
          <img
            src="/icono_1.png"
            alt="Kyntü"
            style={styles.logo}
          />

          <h2 style={styles.cardTitle}>Agregar productos disponibles</h2>

          <div style={styles.tableWrapper}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Producto</th>
                  <th style={styles.th}>Formato</th>
                  <th style={styles.th}>Marca</th>
                  <th style={styles.th}>Cantidad</th>
                </tr>
              </thead>

              <tbody>
                {productosNuevos.map((item, index) => {
                  const nombres = obtenerNombres();
                  const formatos = item.nombre ? obtenerFormatos(item.nombre) : [];
                  const marcas =
                    item.nombre && item.formato
                      ? obtenerMarcas(item.nombre, item.formato)
                      : [];

                  return (
                    <tr key={index}>
                      <td style={styles.td}>
                        <select
                          value={item.nombre}
                          onChange={(e) =>
                            handleNuevoChange(index, 'nombre', e.target.value)
                          }
                          style={styles.select}
                        >
                          <option value="">Selecciona</option>
                          {nombres.map((n, idx) => (
                            <option key={idx} value={n}>
                              {n}
                            </option>
                          ))}
                        </select>
                      </td>

                      <td style={styles.td}>
                        <select
                          value={item.formato}
                          onChange={(e) =>
                            handleNuevoChange(index, 'formato', e.target.value)
                          }
                          style={styles.select}
                          disabled={!item.nombre}
                        >
                          <option value="">Selecciona</option>
                          {formatos.map((f, idx) => (
                            <option key={idx} value={f}>
                              {f}
                            </option>
                          ))}
                        </select>
                      </td>

                      <td style={styles.td}>
                        <select
                          value={item.marca}
                          onChange={(e) =>
                            handleNuevoChange(index, 'marca', e.target.value)
                          }
                          style={styles.select}
                          disabled={!item.formato}
                        >
                          <option value="">Selecciona</option>
                          {marcas.map((m, idx) => (
                            <option key={idx} value={m}>
                              {m}
                            </option>
                          ))}
                        </select>
                      </td>

                      <td style={styles.td}>
                        <input
                          type="number"
                          value={item.cantidad_disponible}
                          onChange={(e) =>
                            handleNuevoChange(
                              index,
                              'cantidad_disponible',
                              e.target.value
                            )
                          }
                          style={styles.quantityInput}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div style={styles.actionRow}>
            <button onClick={agregarFila} style={styles.smallButton}>
              +
            </button>

            <button onClick={guardarProductos} style={styles.mainButton}>
              Agregar productos
            </button>

            <button
              onClick={() => setMostrarSolicitud((prev) => !prev)}
              style={styles.secondaryButton}
            >
              {mostrarSolicitud
                ? 'Cerrar solicitud'
                : 'Solicitar nuevo producto'}
            </button>
          </div>

          {mostrarSolicitud && (
            <div style={styles.requestBox}>
              <h3 style={styles.requestTitle}>Solicitud de nuevo producto</h3>

              <div style={styles.formGrid}>
                <input
                  type="text"
                  placeholder="Nombre"
                  value={solicitud.nombre}
                  onChange={(e) =>
                    handleSolicitudChange('nombre', e.target.value)
                  }
                  style={styles.input}
                />

                <input
                  type="text"
                  placeholder="Marca"
                  value={solicitud.marca}
                  onChange={(e) =>
                    handleSolicitudChange('marca', e.target.value)
                  }
                  style={styles.input}
                />

                <input
                  type="text"
                  placeholder="Formato"
                  value={solicitud.formato}
                  onChange={(e) =>
                    handleSolicitudChange('formato', e.target.value)
                  }
                  style={styles.input}
                />

                <input
                  type="number"
                  placeholder="Cantidad"
                  value={solicitud.cantidad_disponible}
                  onChange={(e) =>
                    handleSolicitudChange('cantidad_disponible', e.target.value)
                  }
                  style={styles.input}
                />
              </div>

              <div style={styles.actionRow}>
                <button onClick={enviarSolicitud} style={styles.mainButton}>
                  Enviar solicitud
                </button>

                <button
                  onClick={() => router.push('/proveedor/solicitudes')}
                  style={styles.secondaryButton}
                >
                  Estado solicitudes
                </button>
              </div>
            </div>
          )}
        </section>

        <section style={styles.card}>
          <h2 style={styles.cardTitle}>Mis productos disponibles</h2>

          {productosStock.length === 0 ? (
            <p style={styles.emptyText}>No tienes productos en stock.</p>
          ) : (
            <div style={styles.tableWrapper}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Producto</th>
                    <th style={styles.th}>Marca</th>
                    <th style={styles.th}>Formato</th>
                    <th style={styles.th}>Cantidad</th>
                    <th style={styles.th}>Acciones</th>
                  </tr>
                </thead>

                <tbody>
                  {productosStock.map((producto) => (
                    <tr key={producto.id}>
                      <td style={styles.td}>{producto.nombre}</td>
                      <td style={styles.td}>{producto.marca}</td>
                      <td style={styles.td}>{producto.formato}</td>
                      <td style={styles.td}>
                        <input
                          type="number"
                          value={
                            cantidadesEditadas[producto.id] !== undefined
                              ? cantidadesEditadas[producto.id]
                              : producto.cantidad_disponible
                          }
                          onChange={(e) =>
                            handleCantidadChange(producto.id, e.target.value)
                          }
                          style={styles.quantityInput}
                        />
                      </td>

                      <td style={styles.td}>
                        <div style={styles.iconActions}>
                          <button
                            onClick={() => actualizarCantidad(producto.id)}
                            style={styles.iconButton}
                            title="Guardar cambios"
                          >
                            💾
                          </button>

                          <button
                            onClick={() => eliminarProducto(producto.id)}
                            style={styles.deleteButton}
                            title="Eliminar producto"
                          >
                            ❌
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
    maxWidth: '1100px',
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '26px',
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

  tableWrapper: {
    width: '100%',
    overflowX: 'auto',
  },

  table: {
    width: '100%',
    borderCollapse: 'separate',
    borderSpacing: '0 10px',
  },

  th: {
    color: 'rgba(255, 255, 255, 0.72)',
    fontSize: '13px',
    padding: '8px',
    textAlign: 'center',
  },

  td: {
    color: '#ffffff',
    padding: '8px',
    textAlign: 'center',
    background: 'rgba(255, 255, 255, 0.045)',
    borderTop: '1px solid rgba(255, 255, 255, 0.08)',
    borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
  },

  select: {
    width: '100%',
    minWidth: '140px',
    padding: '11px 12px',
    borderRadius: '10px',
    border: '1px solid rgba(255, 255, 255, 0.18)',
    background: '#10192b',
    color: '#ffffff',
    outline: 'none',
  },

  input: {
    width: '100%',
    padding: '12px 14px',
    borderRadius: '10px',
    border: '1px solid rgba(255, 255, 255, 0.18)',
    background: 'rgba(255, 255, 255, 0.08)',
    color: '#ffffff',
    outline: 'none',
    fontSize: '14px',
    textTransform: 'uppercase',
    boxSizing: 'border-box',
  },

  quantityInput: {
    width: '90px',
    padding: '10px 12px',
    borderRadius: '10px',
    border: '1px solid rgba(255, 255, 255, 0.18)',
    background: 'rgba(255, 255, 255, 0.08)',
    color: '#ffffff',
    outline: 'none',
    textAlign: 'center',
  },

  actionRow: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '12px',
    flexWrap: 'wrap',
    marginTop: '18px',
  },

  mainButton: {
    background: 'linear-gradient(135deg, #176BFF, #2E6BFF)',
    color: '#fff',
    border: 'none',
    padding: '13px 28px',
    borderRadius: '12px',
    cursor: 'pointer',
    fontWeight: 700,
    fontSize: '14px',
    boxShadow: '0 10px 24px rgba(23, 107, 255, 0.32)',
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

  logoutButton: {
    background: 'rgba(255, 80, 80, 0.14)',
    color: '#ffffff',
    border: '1px solid rgba(255, 80, 80, 0.25)',
    padding: '12px 22px',
    borderRadius: '12px',
    cursor: 'pointer',
    fontWeight: 700,
    fontSize: '14px',
  },

  smallButton: {
    background: 'linear-gradient(135deg, #176BFF, #2E6BFF)',
    color: '#ffffff',
    border: 'none',
    width: '42px',
    height: '42px',
    borderRadius: '12px',
    cursor: 'pointer',
    fontWeight: 800,
    fontSize: '20px',
    boxShadow: '0 10px 24px rgba(23, 107, 255, 0.32)',
  },

  requestBox: {
    width: '100%',
    marginTop: '24px',
    padding: '22px',
    borderRadius: '20px',
    border: '1px solid rgba(255, 255, 255, 0.12)',
    background: 'rgba(255, 255, 255, 0.045)',
    boxSizing: 'border-box',
  },

  requestTitle: {
    color: '#ffffff',
    margin: '0 0 16px',
    textAlign: 'center',
  },

  formGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: '12px',
  },

  iconActions: {
    display: 'flex',
    justifyContent: 'center',
    gap: '8px',
  },

  iconButton: {
    background: 'rgba(255, 255, 255, 0.08)',
    color: '#ffffff',
    border: '1px solid rgba(255, 255, 255, 0.18)',
    width: '38px',
    height: '38px',
    borderRadius: '10px',
    cursor: 'pointer',
  },

  deleteButton: {
    background: 'rgba(255, 80, 80, 0.14)',
    color: '#ffffff',
    border: '1px solid rgba(255, 80, 80, 0.25)',
    width: '38px',
    height: '38px',
    borderRadius: '10px',
    cursor: 'pointer',
  },

  emptyText: {
    color: 'rgba(255, 255, 255, 0.72)',
    margin: 0,
  },

  loading: {
    position: 'relative',
    zIndex: 3,
    color: '#ffffff',
    textAlign: 'center',
    paddingTop: '80px',
    fontSize: '18px',
    fontWeight: 700,
  },
};