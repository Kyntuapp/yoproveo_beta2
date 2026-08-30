import { showKyntuAlert } from '../../lib/kyntuAlert';
// pages/proveedor/catalogo.js

import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { Plus, Save, Trash2 } from 'lucide-react';

import { supabase } from '../../lib/supabaseClient';
import { resolveProveedorProfile } from '../../lib/resolveProveedorProfile';
import Notificaciones from '../../components/Notificaciones';
import SoporteLauncher from '../../components/soporte/SoporteLauncher';
import AppLayout from '../../components/Layout/AppLayout';

export default function CatalogoProveedor() {
  const router = useRouter();

  const [proveedorId, setProveedorId] = useState(null);
  const [loading, setLoading] = useState(true);

  const [productosNuevos, setProductosNuevos] = useState([
    {
      nombre: '',
      marca: '',
      formato: '',
      cantidad_disponible: '',
    },
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
      const { data: userData, error } =
        await supabase.auth.getUser();

      if (error || !userData?.user) {
        showKyntuAlert('Debes iniciar sesión.');
        router.push('/');
        return;
      }

      const { perfil } = await resolveProveedorProfile(
        userData.user,
        {
          select: 'id',
        }
      );

      if (!perfil) {
        showKyntuAlert('No se encontró un perfil de proveedor.');
        router.push('/');
        return;
      }

      setProveedorId(perfil.id);

      const {
        data: universoData,
        error: universoError,
      } = await supabase
        .from('productos_proveedores')
        .select('nombre, formato, marca');

      if (universoError) {
        showKyntuAlert(
          'Error al cargar universo de productos: ' +
            universoError.message
        );
      } else {
        setUniversoProductos(universoData || []);
      }

      await cargarProductos(perfil.id);
      setLoading(false);
    };

    cargarDatos();
  }, [router]);

  const cargarProductos = async (
    idProveedor = proveedorId
  ) => {
    if (!idProveedor) return;

    const {
      data: productosData,
      error: productosError,
    } = await supabase
      .from('productos_proveedores')
      .select('*')
      .eq('proveedor_id', idProveedor);

    if (productosError) {
      showKyntuAlert(
        'Error al cargar productos: ' +
          productosError.message
      );
    } else {
      setProductosStock(productosData || []);
    }
  };

  const normalizarTexto = (valor) =>
    (valor || '')
      .toUpperCase()
      .replace(/\s+/g, ' ')
      .trim();

  const normalizarFormato = (valor) =>
    (valor || '')
      .toUpperCase()
      .replace(/\s+/g, '')
      .trim();

  const obtenerNombres = () =>
    Array.from(
      new Set(
        (universoProductos || []).map(
          (producto) => producto.nombre
        )
      )
    ).filter(Boolean);

  const obtenerFormatos = (nombre) =>
    Array.from(
      new Set(
        (universoProductos || [])
          .filter(
            (producto) => producto.nombre === nombre
          )
          .map((producto) => producto.formato)
      )
    ).filter(Boolean);

  const obtenerMarcas = (nombre, formato) =>
    Array.from(
      new Set(
        (universoProductos || [])
          .filter(
            (producto) =>
              producto.nombre === nombre &&
              producto.formato === formato
          )
          .map((producto) => producto.marca)
      )
    ).filter(Boolean);

  const handleNuevoChange = (
    index,
    field,
    value
  ) => {
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
      {
        nombre: '',
        marca: '',
        formato: '',
        cantidad_disponible: '',
      },
    ]);
  };

  const guardarProductos = async () => {
    if (!proveedorId) return;

    const productosValidos = productosNuevos.filter(
      (producto) =>
        (producto.nombre || '').trim() !== '' &&
        (producto.formato || '').trim() !== '' &&
        (producto.marca || '').trim() !== ''
    );

    if (productosValidos.length === 0) {
      showKyntuAlert(
        'Debes seleccionar al menos un producto, formato y marca.'
      );
      return;
    }

    const productosConProveedor =
      productosValidos.map((producto) => ({
        ...producto,
        cantidad_disponible:
          Number(producto.cantidad_disponible) || 0,
        proveedor_id: proveedorId,
      }));

    const { error } = await supabase
      .from('productos_proveedores')
      .insert(productosConProveedor);

    if (error) {
      showKyntuAlert(
        'Error al agregar productos: ' +
          error.message
      );
    } else {
      showKyntuAlert('Productos agregados correctamente');

      setProductosNuevos([
        {
          nombre: '',
          marca: '',
          formato: '',
          cantidad_disponible: '',
        },
      ]);

      await cargarProductos();
    }
  };

  const handleCantidadChange = (
    id,
    nuevaCantidad
  ) => {
    setCantidadesEditadas((prev) => ({
      ...prev,
      [id]: nuevaCantidad,
    }));
  };

  const actualizarCantidad = async (id) => {
    const nuevaCantidad =
      cantidadesEditadas[id];

    if (nuevaCantidad === undefined) return;

    const valor = Number(nuevaCantidad);

    if (Number.isNaN(valor) || valor < 0) {
      showKyntuAlert(
        'La cantidad debe ser un número mayor o igual a 0.'
      );
      return;
    }

    const { error } = await supabase
      .from('productos_proveedores')
      .update({
        cantidad_disponible: valor,
      })
      .eq('id', id);

    if (error) {
      showKyntuAlert(
        'Error al actualizar la cantidad: ' +
          error.message
      );
    } else {
      showKyntuAlert('Cantidad actualizada correctamente');

      setProductosStock((prev) =>
        prev.map((producto) =>
          producto.id === id
            ? {
                ...producto,
                cantidad_disponible: valor,
              }
            : producto
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
      showKyntuAlert(
        'Error al eliminar el producto: ' +
          error.message
      );
    } else {
      showKyntuAlert('Producto eliminado correctamente');

      setProductosStock((prev) =>
        prev.filter(
          (producto) => producto.id !== id
        )
      );

      setCantidadesEditadas((prev) => {
        const copy = { ...prev };

        delete copy[id];

        return copy;
      });
    }
  };

  const handleSolicitudChange = (
    field,
    value
  ) => {
    const valorNormalizado =
      field === 'cantidad_disponible'
        ? value
        : value.toUpperCase();

    setSolicitud((prev) => ({
      ...prev,
      [field]: valorNormalizado,
    }));
  };

  const enviarSolicitud = async () => {
    if (!proveedorId) return;

    const nombre = normalizarTexto(
      solicitud.nombre
    );

    const marca = normalizarTexto(
      solicitud.marca
    );

    const formato = normalizarTexto(
      solicitud.formato
    );

    const cantidadDisponible =
      Number(solicitud.cantidad_disponible) || 0;

    if (!nombre) {
      showKyntuAlert(
        'Debes ingresar al menos el nombre del producto.'
      );
      return;
    }

    const nombreNormalizado =
      normalizarTexto(nombre);

    const marcaNormalizada =
      normalizarTexto(marca);

    const formatoNormalizado =
      normalizarFormato(formato);

        const {
      data: productosCatalogo,
      error: errorCatalogo,
    } = await supabase
      .from('catalogo_productos')
      .select('id, nombre, marca, formato');

    if (errorCatalogo) {
      showKyntuAlert(
        'Error al validar el catálogo: ' +
          errorCatalogo.message
      );
      return;
    }

    const existeProducto = (
      productosCatalogo || []
    ).some((producto) => {
      const nombreCatalogo =
        normalizarTexto(producto.nombre);

      const marcaCatalogo =
        normalizarTexto(producto.marca);

      const formatoCatalogo =
        normalizarFormato(producto.formato);

      return (
        nombreCatalogo === nombreNormalizado &&
        marcaCatalogo === marcaNormalizada &&
        formatoCatalogo === formatoNormalizado
      );
    });

    if (existeProducto) {
      showKyntuAlert(
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
          cantidad_disponible:
            cantidadDisponible,
          estado: 'pendiente',
        },
      ]);

    if (error) {
      showKyntuAlert(
        'Error al enviar la solicitud: ' +
          error.message
      );
    } else {
      showKyntuAlert(
        'Solicitud enviada al administrador.'
      );

      setSolicitud({
        nombre: '',
        marca: '',
        formato: '',
        cantidad_disponible: '',
      });

      setMostrarSolicitud(false);
    }
  };

  const cambiarPerfil = () =>
    router.push('/seleccionar-perfil');

  const irDatosContacto = () =>
    router.push('/proveedor/datos-contacto');

  const irDashboard = () =>
    router.push('/proveedor/DashboardProveedor');

  const cerrarSesion = async () => {
    await supabase.auth.signOut();
    localStorage.clear();
    router.push('/login');
  };

  if (loading) {
    return (
      <div style={styles.loadingPage}>
        <div style={styles.loadingSpinner} />

        <p style={styles.loading}>
          Cargando catálogo...
        </p>

        <style jsx>{`
          @keyframes spin {
            to {
              transform: rotate(360deg);
            }
          }
        `}</style>
      </div>
    );
  }

  return (
    <AppLayout
      title="Catálogo y stock"
      profileLabel="Proveedor"
      showProfileSwitch
      onChangeProfile={cambiarPerfil}
      onUpdateData={irDatosContacto}
      onDashboard={irDashboard}
      onLogout={cerrarSesion}
      notifications={
        <Notificaciones
          userId={proveedorId}
          rol="proveedor"
        />
      }
      support={
        proveedorId ? (
          <SoporteLauncher perfilId={proveedorId} rol="proveedor" />
        ) : null
      }
    >
      <div
        className="catalogo-content"
        style={styles.content}
      >
        <section
          className="catalogo-card"
          style={styles.card}
        >
          <div
            className="catalogo-section-heading"
            style={styles.sectionHeading}
          >
            <img
              src="/icono_2.png"
              alt="Kyntü"
              className="catalogo-logo"
              style={styles.logo}
            />

            <h2
              className="catalogo-card-title"
              style={{
                ...styles.cardTitle,
                ...styles.addCardTitle,
              }}
            >
              Agregar productos disponibles
            </h2>
          </div>

          <div className="mobile-card-table-wrap" style={styles.tableWrapper}>
            <table className="mobile-card-table" style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>
                    Producto
                  </th>

                  <th style={styles.th}>
                    Formato
                  </th>

                  <th style={styles.th}>
                    Marca
                  </th>

                  <th style={styles.th}>
                    Cantidad
                  </th>
                </tr>
              </thead>

              <tbody>
                {productosNuevos.map(
                  (item, index) => {
                    const nombres =
                      obtenerNombres();

                    const formatos =
                      item.nombre
                        ? obtenerFormatos(
                            item.nombre
                          )
                        : [];

                    const marcas =
                      item.nombre &&
                      item.formato
                        ? obtenerMarcas(
                            item.nombre,
                            item.formato
                          )
                        : [];

                    return (
                      <tr key={index}>
                        <td data-label="Producto" data-primary="true" style={styles.td}>
                          <select
                            value={item.nombre}
                            onChange={(e) =>
                              handleNuevoChange(
                                index,
                                'nombre',
                                e.target.value
                              )
                            }
                            style={styles.select}
                          >
                            <option value="">
                              Selecciona
                            </option>

                            {nombres.map(
                              (nombre, idx) => (
                                <option
                                  key={idx}
                                  value={nombre}
                                >
                                  {nombre}
                                </option>
                              )
                            )}
                          </select>
                        </td>

                        <td data-label="Formato" style={styles.td}>
                          <select
                            value={item.formato}
                            onChange={(e) =>
                              handleNuevoChange(
                                index,
                                'formato',
                                e.target.value
                              )
                            }
                            style={styles.select}
                            disabled={!item.nombre}
                          >
                            <option value="">
                              Selecciona
                            </option>

                            {formatos.map(
                              (formato, idx) => (
                                <option
                                  key={idx}
                                  value={formato}
                                >
                                  {formato}
                                </option>
                              )
                            )}
                          </select>
                        </td>

                        <td data-label="Marca" style={styles.td}>
                          <select
                            value={item.marca}
                            onChange={(e) =>
                              handleNuevoChange(
                                index,
                                'marca',
                                e.target.value
                              )
                            }
                            style={styles.select}
                            disabled={!item.formato}
                          >
                            <option value="">
                              Selecciona
                            </option>

                            {marcas.map(
                              (marca, idx) => (
                                <option
                                  key={idx}
                                  value={marca}
                                >
                                  {marca}
                                </option>
                              )
                            )}
                          </select>
                        </td>

                        <td data-label="Cantidad" style={styles.td}>
                          <input
                            type="number"
                            min="0"
                            value={
                              item.cantidad_disponible
                            }
                            onChange={(e) =>
                              handleNuevoChange(
                                index,
                                'cantidad_disponible',
                                e.target.value
                              )
                            }
                            style={
                              styles.quantityInput
                            }
                          />
                        </td>
                      </tr>
                    );
                  }
                )}
              </tbody>
            </table>
          </div>

          <div
            className="catalogo-action-row"
            style={styles.actionRow}
          >
            <button
              type="button"
              onClick={agregarFila}
              className="catalogo-icon-button"
              style={styles.smallButton}
              aria-label="Agregar otra fila"
              title="Agregar otra fila"
            >
              <Plus size={20} />
            </button>

            <button
              type="button"
              onClick={guardarProductos}
              className="catalogo-button"
              style={styles.mainButton}
            >
              Agregar productos
            </button>

            <button
              type="button"
              onClick={() =>
                setMostrarSolicitud(
                  (prev) => !prev
                )
              }
              className="catalogo-button"
              style={styles.secondaryButton}
            >
              {mostrarSolicitud
                ? 'Cerrar solicitud'
                : 'Solicitar nuevo producto'}
            </button>
          </div>

          {mostrarSolicitud && (
            <div style={styles.requestBox}>
              <h3 style={styles.requestTitle}>
                Solicitud de nuevo producto
              </h3>

              <div style={styles.formGrid}>
                <input
                  type="text"
                  placeholder="Nombre"
                  value={solicitud.nombre}
                  onChange={(e) =>
                    handleSolicitudChange(
                      'nombre',
                      e.target.value
                    )
                  }
                  style={styles.input}
                />

                <input
                  type="text"
                  placeholder="Marca"
                  value={solicitud.marca}
                  onChange={(e) =>
                    handleSolicitudChange(
                      'marca',
                      e.target.value
                    )
                  }
                  style={styles.input}
                />

                <input
                  type="text"
                  placeholder="Formato"
                  value={solicitud.formato}
                  onChange={(e) =>
                    handleSolicitudChange(
                      'formato',
                      e.target.value
                    )
                  }
                  style={styles.input}
                />

                <input
                  type="number"
                  min="0"
                  placeholder="Cantidad"
                  value={
                    solicitud.cantidad_disponible
                  }
                  onChange={(e) =>
                    handleSolicitudChange(
                      'cantidad_disponible',
                      e.target.value
                    )
                  }
                  style={styles.input}
                />
              </div>

              <div
                className="catalogo-action-row"
                style={styles.actionRow}
              >
                <button
                  type="button"
                  onClick={enviarSolicitud}
                  className="catalogo-button"
                  style={styles.mainButton}
                >
                  Enviar solicitud
                </button>

                <button
                  type="button"
                  onClick={() =>
                    router.push(
                      '/proveedor/solicitudes'
                    )
                  }
                  className="catalogo-button"
                  style={styles.secondaryButton}
                >
                  Estado solicitudes
                </button>
              </div>
            </div>
          )}
        </section>

        <section
          className="catalogo-card"
          style={styles.card}
        >
          <h2
            className="catalogo-card-title"
            style={styles.cardTitle}
          >
            Mis productos disponibles
          </h2>

          {productosStock.length === 0 ? (
            <p style={styles.emptyText}>
              No tienes productos en stock.
            </p>
          ) : (
            <div className="mobile-card-table-wrap" style={styles.tableWrapper}>
              <table className="mobile-card-table" style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>
                      Producto
                    </th>

                    <th style={styles.th}>
                      Marca
                    </th>

                    <th style={styles.th}>
                      Formato
                    </th>

                    <th style={styles.th}>
                      Cantidad
                    </th>

                    <th style={styles.th}>
                      Acciones
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {productosStock.map(
                    (producto) => (
                      <tr key={producto.id}>
                        <td data-label="Producto" data-primary="true" style={styles.td}>
                          {producto.nombre}
                        </td>

                        <td data-label="Marca" style={styles.td}>
                          {producto.marca}
                        </td>

                        <td data-label="Formato" style={styles.td}>
                          {producto.formato}
                        </td>

                        <td data-label="Cantidad" style={styles.td}>
                          <input
                            type="number"
                            min="0"
                            value={
                              cantidadesEditadas[
                                producto.id
                              ] !== undefined
                                ? cantidadesEditadas[
                                    producto.id
                                  ]
                                : producto.cantidad_disponible
                            }
                            onChange={(e) =>
                              handleCantidadChange(
                                producto.id,
                                e.target.value
                              )
                            }
                            style={
                              styles.quantityInput
                            }
                          />
                        </td>

                        <td data-label="Acciones" style={styles.td}>
                          <div
                            style={styles.iconActions}
                          >
                            <button
                              type="button"
                              onClick={() =>
                                actualizarCantidad(
                                  producto.id
                                )
                              }
                              className="catalogo-icon-button"
                              style={
                                styles.iconButton
                              }
                              title="Guardar cambios"
                              aria-label="Guardar cambios"
                            >
                              <Save size={18} />
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                eliminarProducto(
                                  producto.id
                                )
                              }
                              className="catalogo-icon-button"
                              style={
                                styles.deleteButton
                              }
                              title="Eliminar producto"
                              aria-label="Eliminar producto"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      <style jsx>{`
        .catalogo-button,
        .catalogo-icon-button {
          transition:
            transform 0.2s ease,
            box-shadow 0.2s ease,
            border-color 0.2s ease,
            background 0.2s ease;
        }

        .catalogo-button:hover,
        .catalogo-icon-button:hover {
          transform: translateY(-1px);
          box-shadow: 0 12px 25px
            rgba(31, 69, 122, 0.12);
        }

        select:focus,
        input:focus {
          border-color: #176bff !important;
          box-shadow: 0 0 0 3px
            rgba(23, 107, 255, 0.12);
        }

        @media (max-width: 760px) {
          .catalogo-content {
            gap: 18px !important;
          }

          .catalogo-card {
            padding: 22px 16px !important;
            border-radius: 20px !important;
          }

          .catalogo-action-row {
            display: grid !important;
            grid-template-columns: 1fr !important;
          }

          .catalogo-action-row button {
            width: 100% !important;
          }

          .catalogo-action-row
            button:first-child {
            width: 46px !important;
            justify-self: center;
          }
        }

        @media (max-width: 520px) {
          .catalogo-section-heading {
            gap: 10px !important;
          }

          .catalogo-logo {
            width: 52px !important;
          }

          .catalogo-card-title {
            font-size: 23px !important;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .catalogo-button,
          .catalogo-icon-button {
            transition: none;
          }
        }
      `}</style>
    </AppLayout>
  );
}
const styles = {
  loadingPage: {
    minHeight: '100vh',
    minHeight: '100dvh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '14px',
    background:
      'linear-gradient(145deg, #f8fbff 0%, #eef5ff 48%, #f8fcfb 100%)',
    fontFamily:
      'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },

  loadingSpinner: {
    width: '38px',
    height: '38px',
    borderRadius: '50%',
    border: '4px solid #dce8f8',
    borderTopColor: '#176bff',
    animation: 'spin 0.8s linear infinite',
  },

  loading: {
    margin: 0,
    color: '#49617f',
    fontSize: '15px',
    fontWeight: 800,
  },

  content: {
    width: '100%',
    maxWidth: '1180px',
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  },

  card: {
    width: '100%',
    padding: '30px',
    boxSizing: 'border-box',
    borderRadius: '26px',
    background: 'rgba(255, 255, 255, 0.96)',
    border: '1px solid #e1e9f4',
    boxShadow: '0 22px 60px rgba(31, 69, 122, 0.1)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },

  logo: {
    width: '64px',
    height: 'auto',
    objectFit: 'contain',
    flexShrink: 0,
  },

  sectionHeading: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: '14px',
    marginBottom: '22px',
  },

  cardTitle: {
    margin: '0 0 24px',
    color: '#061b41',
    fontSize: 'clamp(24px, 3vw, 30px)',
    lineHeight: 1.2,
    fontWeight: 900,
    letterSpacing: '-0.03em',
    textAlign: 'center',
  },

  addCardTitle: {
    margin: 0,
    textAlign: 'left',
  },

  tableWrapper: {
    width: '100%',
    overflowX: 'auto',
    borderRadius: '16px',
    border: '1px solid #e2eaf4',
    background: '#ffffff',
  },

  table: {
    width: '100%',
    minWidth: '680px',
    borderCollapse: 'collapse',
  },

  th: {
    padding: '13px 12px',
    background: '#f4f8fd',
    color: '#60748f',
    borderBottom: '1px solid #dfe8f3',
    fontSize: '12px',
    fontWeight: 900,
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },

  td: {
    padding: '12px',
    color: '#274363',
    borderBottom: '1px solid #edf1f6',
    fontSize: '13px',
    fontWeight: 650,
    textAlign: 'center',
    background: '#ffffff',
  },

  select: {
    width: '100%',
    minWidth: '140px',
    minHeight: '42px',
    padding: '10px 12px',
    boxSizing: 'border-box',
    borderRadius: '11px',
    border: '1px solid #d6e1ef',
    background: '#ffffff',
    color: '#274363',
    outline: 'none',
    fontSize: '13px',
  },

  input: {
    width: '100%',
    minHeight: '44px',
    padding: '11px 13px',
    boxSizing: 'border-box',
    borderRadius: '11px',
    border: '1px solid #d6e1ef',
    background: '#ffffff',
    color: '#274363',
    outline: 'none',
    fontSize: '13px',
    textTransform: 'uppercase',
  },

  quantityInput: {
    width: '92px',
    minHeight: '42px',
    padding: '10px 8px',
    boxSizing: 'border-box',
    borderRadius: '11px',
    border: '1px solid #d6e1ef',
    background: '#ffffff',
    color: '#274363',
    outline: 'none',
    fontSize: '13px',
    fontWeight: 800,
    textAlign: 'center',
  },

  actionRow: {
    width: '100%',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '12px',
    flexWrap: 'wrap',
    marginTop: '20px',
  },

  mainButton: {
    minHeight: '44px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '12px 24px',
    borderRadius: '12px',
    border: 'none',
    background:
      'linear-gradient(135deg, #176bff 0%, #2e6bff 100%)',
    color: '#ffffff',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 900,
    boxShadow: '0 10px 24px rgba(23, 107, 255, 0.24)',
  },

  secondaryButton: {
    minHeight: '44px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '11px 20px',
    borderRadius: '12px',
    border: '1px solid #d6e1ef',
    background: '#ffffff',
    color: '#49617f',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 900,
  },

  smallButton: {
    width: '44px',
    height: '44px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    borderRadius: '12px',
    border: 'none',
    background:
      'linear-gradient(135deg, #176bff 0%, #2e6bff 100%)',
    color: '#ffffff',
    cursor: 'pointer',
    boxShadow: '0 10px 24px rgba(23, 107, 255, 0.24)',
  },

  requestBox: {
    width: '100%',
    marginTop: '24px',
    padding: '22px',
    boxSizing: 'border-box',
    borderRadius: '18px',
    border: '1px solid #dfe8f3',
    background: '#f7faff',
  },

  requestTitle: {
    margin: '0 0 18px',
    color: '#17365e',
    fontSize: '18px',
    fontWeight: 900,
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
    width: '40px',
    height: '40px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '11px',
    border: '1px solid #cfe0ff',
    background: '#edf4ff',
    color: '#176bff',
    cursor: 'pointer',
  },

  deleteButton: {
    width: '40px',
    height: '40px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '11px',
    border: '1px solid #ffd7d4',
    background: '#fff3f2',
    color: '#c1342d',
    cursor: 'pointer',
  },

  emptyText: {
    margin: 0,
    padding: '26px',
    color: '#71829a',
    fontSize: '14px',
    textAlign: 'center',
  },
};
