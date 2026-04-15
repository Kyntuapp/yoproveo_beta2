// pages/proveedor/catalogo.js
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabaseClient';

export default function CatalogoProveedor() {
  const router = useRouter();
  const [proveedorId, setProveedorId] = useState(null);
  const [loading, setLoading] = useState(true);

  // Formulario superior (productos del catálogo para agregar al stock)
  const [productosNuevos, setProductosNuevos] = useState([
    { nombre: '', marca: '', formato: '', cantidad_disponible: '' },
  ]);

  // Universo de productos (para los selects)
  const [universoProductos, setUniversoProductos] = useState([]); // [{nombre, formato, marca}]

  // Stock actual del proveedor
  const [productosStock, setProductosStock] = useState([]);
  const [cantidadesEditadas, setCantidadesEditadas] = useState({});

  // Solicitud de nuevo producto
  const [mostrarSolicitud, setMostrarSolicitud] = useState(false);
  const [solicitud, setSolicitud] = useState({
    nombre: '',
    marca: '',
    formato: '',
    cantidad_disponible: '',
  });

  // ============================
  // Carga de perfil, universo y productos
  // ============================
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

      // Universo de productos (toda la plataforma)
      const { data: universoData, error: universoError } = await supabase
        .from('productos_proveedores')
        .select('nombre, formato, marca');

      if (universoError) {
        alert('Error al cargar universo de productos: ' + universoError.message);
      } else {
        setUniversoProductos(universoData || []);
      }

      // Stock del proveedor
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

  // ============================
  // Helpers para normalización
  // ============================
  const normalizarTexto = (valor) =>
    (valor || '').toUpperCase().replace(/\s+/g, ' ').trim();

  const normalizarFormato = (valor) =>
    (valor || '').toUpperCase().replace(/\s+/g, '').trim();

  // ============================
  // Helpers para los selects
  // ============================
  const obtenerNombres = () =>
    Array.from(new Set((universoProductos || []).map(p => p.nombre))).filter(Boolean);

  const obtenerFormatos = (nombre) =>
    Array.from(
      new Set(
        (universoProductos || [])
          .filter(p => p.nombre === nombre)
          .map(p => p.formato)
      )
    ).filter(Boolean);

  const obtenerMarcas = (nombre, formato) =>
    Array.from(
      new Set(
        (universoProductos || [])
          .filter(p => p.nombre === nombre && p.formato === formato)
          .map(p => p.marca)
      )
    ).filter(Boolean);

  // ============================
  // Nuevos productos (form arriba)
  // ============================
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
    setProductosNuevos(prev => [
      ...prev,
      { nombre: '', marca: '', formato: '', cantidad_disponible: '' },
    ]);
  };

  const guardarProductos = async () => {
    if (!proveedorId) return;

    const productosValidos = productosNuevos.filter(
      p =>
        (p.nombre || '').trim() !== '' &&
        (p.formato || '').trim() !== '' &&
        (p.marca || '').trim() !== ''
    );

    if (productosValidos.length === 0) {
      alert('Debes seleccionar al menos un producto, formato y marca.');
      return;
    }

    const productosConProveedor = productosValidos.map(producto => ({
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

  // ============================
  // Stock (tabla abajo)
  // ============================
  const handleCantidadChange = (id, nuevaCantidad) => {
    setCantidadesEditadas(prev => ({ ...prev, [id]: nuevaCantidad }));
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
      setProductosStock(prev =>
        prev.map(p =>
          p.id === id ? { ...p, cantidad_disponible: valor } : p
        )
      );
      setCantidadesEditadas(prev => {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      });
    }
  };

  const eliminarProducto = async (id) => {
    const confirmar = window.confirm('¿Seguro que deseas eliminar este producto de tu catálogo?');
    if (!confirmar) return;

    const { error } = await supabase
      .from('productos_proveedores')
      .delete()
      .eq('id', id);

    if (error) {
      alert('Error al eliminar el producto: ' + error.message);
    } else {
      alert('Producto eliminado correctamente');
      setProductosStock(prev => prev.filter(p => p.id !== id));
      setCantidadesEditadas(prev => {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      });
    }
  };

  // ============================
  // Solicitud de nuevo producto
  // ============================
  const handleSolicitudChange = (field, value) => {
    const valorNormalizado =
      field === 'cantidad_disponible' ? value : value.toUpperCase();

    setSolicitud(prev => ({ ...prev, [field]: valorNormalizado }));
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
      alert("Este producto ya está en nuestro catálogo, puedes agregarlo directamente desde la opción 'Agregar producto'");
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

  // ============================
  // Navegación / sesión
  // ============================
  const volverAlPanel = () => router.push('/proveedor');

  const cerrarSesion = async () => {
    await supabase.auth.signOut();
    localStorage.clear();
    router.push('/login');
  };

  if (loading) {
    return (
      <div style={{ padding: 20, textAlign: 'center' }}>
        Cargando...
      </div>
    );
  }

  return (
    <div style={{ padding: 20 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 20,
        }}
      >
        <button onClick={volverAlPanel}>Volver al panel</button>
        <h2>Catálogo de productos y stock</h2>
        <button onClick={cerrarSesion}>Cerrar sesión</button>
      </div>

      <div style={{ textAlign: 'center', marginTop: 10 }}>
        <h3>Agregar productos disponibles</h3>

        <div style={{ display: 'inline-block', textAlign: 'left' }}>
          <table
            style={{
              borderCollapse: 'collapse',
            }}
          >
            <thead>
              <tr>
                <th style={{ padding: 4 }}>Producto</th>
                <th style={{ padding: 4 }}>Formato</th>
                <th style={{ padding: 4 }}>Marca</th>
                <th style={{ padding: 4 }}>Cantidad</th>
              </tr>
            </thead>
            <tbody>
              {productosNuevos.map((item, index) => {
                const nombres = obtenerNombres();
                const formatos = item.nombre ? obtenerFormatos(item.nombre) : [];
                const marcas = item.nombre && item.formato
                  ? obtenerMarcas(item.nombre, item.formato)
                  : [];

                return (
                  <tr key={index}>
                    <td style={{ padding: 4 }}>
                      <select
                        value={item.nombre}
                        onChange={(e) =>
                          handleNuevoChange(index, 'nombre', e.target.value)
                        }
                        style={{ width: '160px' }}
                      >
                        <option value="">Selecciona</option>
                        {nombres.map((n, idx) => (
                          <option key={idx} value={n}>{n}</option>
                        ))}
                      </select>
                    </td>
                    <td style={{ padding: 4 }}>
                      <select
                        value={item.formato}
                        onChange={(e) =>
                          handleNuevoChange(index, 'formato', e.target.value)
                        }
                        style={{ width: '120px' }}
                        disabled={!item.nombre}
                      >
                        <option value="">Selecciona</option>
                        {formatos.map((f, idx) => (
                          <option key={idx} value={f}>{f}</option>
                        ))}
                      </select>
                    </td>
                    <td style={{ padding: 4 }}>
                      <select
                        value={item.marca}
                        onChange={(e) =>
                          handleNuevoChange(index, 'marca', e.target.value)
                        }
                        style={{ width: '120px' }}
                        disabled={!item.formato}
                      >
                        <option value="">Selecciona</option>
                        {marcas.map((m, idx) => (
                          <option key={idx} value={m}>{m}</option>
                        ))}
                      </select>
                    </td>
                    <td style={{ padding: 4 }}>
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
                        style={{ width: '80px' }}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div style={{ marginTop: 8 }}>
            <button onClick={agregarFila}>+</button>
          </div>
        </div>

        <div style={{ marginTop: 16 }}>
          <button onClick={guardarProductos}>Agregar productos</button>
        </div>

        <div style={{ marginTop: 16 }}>
          <button onClick={() => setMostrarSolicitud(prev => !prev)}>
            {mostrarSolicitud ? 'Cerrar solicitud de nuevo producto' : 'Solicitar nuevo producto'}
          </button>
        </div>

        {mostrarSolicitud && (
          <div
            style={{
              marginTop: 16,
              padding: 12,
              border: '1px solid #ccc',
              display: 'inline-block',
              textAlign: 'left',
            }}
          >
            <h4 style={{ marginTop: 0 }}>Solicitud de nuevo producto</h4>
            <div style={{ marginBottom: 6 }}>
              <label>Nombre:&nbsp;</label>
              <input
                type="text"
                value={solicitud.nombre}
                onChange={(e) => handleSolicitudChange('nombre', e.target.value)}
                style={{ textTransform: 'uppercase' }}
              />
            </div>
            <div style={{ marginBottom: 6 }}>
              <label>Marca:&nbsp;</label>
              <input
                type="text"
                value={solicitud.marca}
                onChange={(e) => handleSolicitudChange('marca', e.target.value)}
                style={{ textTransform: 'uppercase' }}
              />
            </div>
            <div style={{ marginBottom: 6 }}>
              <label>Formato:&nbsp;</label>
              <input
                type="text"
                value={solicitud.formato}
                onChange={(e) => handleSolicitudChange('formato', e.target.value)}
                style={{ textTransform: 'uppercase' }}
              />
            </div>
            <div style={{ marginBottom: 6 }}>
              <label>Cantidad (referencia):&nbsp;</label>
              <input
                type="number"
                value={solicitud.cantidad_disponible}
                onChange={(e) =>
                  handleSolicitudChange('cantidad_disponible', e.target.value)
                }
                style={{ width: '80px' }}
              />
            </div>
            <div style={{ marginTop: 8, display: 'flex', gap: '8px' }}>
  <button onClick={enviarSolicitud}>Enviar solicitud</button>
  <button onClick={() => router.push('/proveedor/solicitudes')}>
    Estado solicitudes
  </button>
</div>
          </div>
        )}
      </div>

      <div style={{ textAlign: 'center', marginTop: 40 }}>
        <h3>Mis productos disponibles</h3>

        {productosStock.length === 0 ? (
          <p>No tienes productos en stock.</p>
        ) : (
          <table
            style={{
              margin: 'auto',
              borderCollapse: 'collapse',
            }}
          >
            <thead>
              <tr>
                <th style={{ padding: 4 }}>Producto</th>
                <th style={{ padding: 4 }}>Marca</th>
                <th style={{ padding: 4 }}>Formato</th>
                <th style={{ padding: 4 }}>Cantidad disponible</th>
                <th style={{ padding: 4 }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {productosStock.map((producto) => (
                <tr key={producto.id}>
                  <td style={{ padding: 4 }}>{producto.nombre}</td>
                  <td style={{ padding: 4 }}>{producto.marca}</td>
                  <td style={{ padding: 4 }}>{producto.formato}</td>
                  <td style={{ padding: 4 }}>
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
                      style={{ width: '80px' }}
                    />
                  </td>
                  <td style={{ padding: 4 }}>
                    <button
                      onClick={() => actualizarCantidad(producto.id)}
                      style={{ marginRight: 6 }}
                      title="Guardar cambios"
                    >
                      💾
                    </button>
                    <button
                      onClick={() => eliminarProducto(producto.id)}
                      style={{ color: 'red' }}
                      title="Eliminar producto"
                    >
                      ❌
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}