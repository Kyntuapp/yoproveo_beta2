// pages/comprador.js
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabaseClient';
import Notificaciones from '../components/Notificaciones';

const filaVacia = {
  producto: '',
  formato: '',
  marca: '',
  cantidad: '',
  precio: '',
};

export default function Comprador() {
  const [productos, setProductos] = useState([{ ...filaVacia }]);
  const [usuarioId, setUsuarioId] = useState(null); // perfiles.id
  const [authUserId, setAuthUserId] = useState(null); // auth.users.id
  const [stock, setStock] = useState([]);
  const [comunaDespacho, setComunaDespacho] = useState('');
  const [listas, setListas] = useState([]);
  const [expandedFechas, setExpandedFechas] = useState([]);
  const [editandoFechas, setEditandoFechas] = useState([]);
  const [ofertasPorProducto, setOfertasPorProducto] = useState({});
  const [nuevosProductos, setNuevosProductos] = useState({});
  const [listasConOfertas, setListasConOfertas] = useState([]);
  const router = useRouter();

  const getRowId = (item) =>
    item?.id ?? item?.identificacion ?? item?.['identificación'] ?? null;

  const groupByFecha = useMemo(() => {
    return listas.reduce((acc, item) => {
      const fecha = new Date(item.fecha_creacion).toLocaleString();
      if (!acc[fecha]) acc[fecha] = [];
      acc[fecha].push(item);
      return acc;
    }, {});
  }, [listas]);

  // ======================
  // Carga inicial
  // ======================
  useEffect(() => {
    const fetchData = async () => {
      const { data: userData, error: userError } = await supabase.auth.getUser();

      if (userError || !userData?.user) {
        alert('Debes iniciar sesión.');
        router.push('/');
        return;
      }

      setAuthUserId(userData.user.id);

      let { data: perfilData, error: perfilError } = await supabase
        .from('perfiles')
        .select('id, tipo, email, auth_id')
        .eq('auth_id', userData.user.id)
        .eq('tipo', 'comprador')
        .maybeSingle();

      if (perfilError) {
        console.error('Error buscando perfil por auth_id:', perfilError);
      }

      if (!perfilData) {
        const { data: perfilByEmail, error: perfilByEmailError } = await supabase
          .from('perfiles')
          .select('id, tipo, email, auth_id')
          .eq('email', userData.user.email)
          .eq('tipo', 'comprador')
          .maybeSingle();

        if (perfilByEmailError) {
          console.error('Error buscando perfil por email:', perfilByEmailError);
        }

        perfilData = perfilByEmail;
      }

      if (!perfilData) {
        alert('No se encontró perfil comprador');
        router.push('/');
        return;
      }

      setUsuarioId(perfilData.id);

      const { data: stockData, error: stockError } = await supabase
        .from('productos_proveedores')
        .select('nombre, formato, marca, cantidad_disponible')
        .gt('cantidad_disponible', 0);

      if (stockError) {
        console.error('Error cargando stock:', stockError);
      } else if (stockData) {
        setStock(stockData);
      }

 const { data: listasData, error: listasError } = await supabase
  .from('listas_compras')
  .select('*')
  .eq('usuario_id', userData.user.id)
  .order('fecha_creacion', { ascending: false });

      if (listasError) {
        console.error('Error cargando listas:', listasError);
      } else if (listasData) {
        setListas(listasData);
      }
    };

    fetchData();
  }, [router]);

  // ======================
  // Abrir automáticamente la lista al venir desde la campana
  // ======================
  useEffect(() => {
    if (!router.isReady) return;
    if (router.query?.notif !== 'ofertas') return;
    if (!listas || listas.length === 0) return;

    let fechaKey = null;

    if (router.query?.list_id) {
      const listaMatch = listas.find(
        (l) => String(getRowId(l)) === String(router.query.list_id)
      );

      if (listaMatch) {
        fechaKey = new Date(listaMatch.fecha_creacion).toLocaleString();
      }
    }

    if (!fechaKey) {
      const ultima = listas.reduce((a, b) =>
        new Date(a.fecha_creacion) > new Date(b.fecha_creacion) ? a : b
      );
      fechaKey = new Date(ultima.fecha_creacion).toLocaleString();
    }

    if (!expandedFechas.includes(fechaKey)) {
      setExpandedFechas((prev) => [...prev, fechaKey]);
    }

    verOfertas(fechaKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.isReady, router.query, listas]);

  // ======================
  // Helpers
  // ======================
  const handleChange = (index, field, value) => {
    const updated = [...productos];
    updated[index][field] = typeof value === 'string' ? value.toUpperCase() : value;

    if (field === 'producto') {
      updated[index].formato = '';
      updated[index].marca = '';
    } else if (field === 'formato') {
      updated[index].marca = '';
    }

    setProductos(updated);
  };

  const obtenerFormatos = (producto) =>
    [...new Set(stock.filter((p) => p.nombre === producto).map((p) => p.formato))];

  const obtenerMarcas = (producto, formato) =>
    [
      ...new Set(
        stock
          .filter((p) => p.nombre === producto && p.formato === formato)
          .map((p) => p.marca)
      ),
    ];

  const agregarFila = () => {
    setProductos([...productos, { ...filaVacia }]);
  };

  const enviarLista = async () => {
    if (!usuarioId || !comunaDespacho) {
      alert('Debes iniciar sesión y completar la comuna.');
      return;
    }

    const productosValidos = productos.filter(
      (p) => p.producto && p.formato && p.marca && p.cantidad && p.precio
    );

    if (productosValidos.length === 0) {
      alert('Debes agregar al menos un producto completo.');
      return;
    }

    const fecha = new Date().toISOString();

  const lista = productosValidos.map((p) => {
  return {
    producto: p.producto,
    formato: p.formato,
    marca: p.marca,
    cantidad: Number(p.cantidad),
    precio: Number(p.precio),
    usuario_id: authUserId,
    comprador_email: localStorage.getItem('user_email') || '',
    fecha_creacion: fecha,
    comuna_despacho: comunaDespacho.toUpperCase(),
  };
});

    const { data, error } = await supabase
      .from('listas_compras')
      .insert(lista)
      .select();

    if (error) {
      alert('Error al enviar la lista: ' + error.message);
      console.error(error);
      return;
    }

    alert('Lista enviada correctamente');
    setProductos([{ ...filaVacia }]);
    setComunaDespacho('');
    setListas((prev) => [...(data || []), ...prev]);
  };

  const toggleExpand = (fecha) => {
    setExpandedFechas((prev) =>
      prev.includes(fecha) ? prev.filter((f) => f !== fecha) : [...prev, fecha]
    );
  };

  const toggleEdit = (fecha) => {
    setEditandoFechas((prev) =>
      prev.includes(fecha) ? prev.filter((f) => f !== fecha) : [...prev, fecha]
    );
  };

  const actualizarProducto = async (id, field, value) => {
    const { error } = await supabase
      .from('listas_compras')
      .update({ [field]: value })
      .eq('id', id);

    if (error) {
      alert('Error al actualizar producto: ' + error.message);
      return;
    }

    setListas((prev) =>
      prev.map((p) => (getRowId(p) === id ? { ...p, [field]: value } : p))
    );
  };

  const eliminarProducto = async (id) => {
    const { error } = await supabase
      .from('listas_compras')
      .delete()
      .eq('id', id);

    if (error) {
      alert('Error al eliminar producto: ' + error.message);
      return;
    }

    setListas((prev) => prev.filter((p) => getRowId(p) !== id));
  };

  const eliminarLista = async (fecha) => {
    if (!confirm('¿Estás seguro de eliminar esta lista?')) return;

    const ids = (groupByFecha[fecha] || []).map((p) => getRowId(p)).filter(Boolean);

    if (ids.length === 0) return;

    const { error } = await supabase
      .from('listas_compras')
      .delete()
      .in('id', ids);

    if (error) {
      alert('Error al eliminar la lista: ' + error.message);
      return;
    }

    setListas((prev) => prev.filter((p) => !ids.includes(getRowId(p))));
    setExpandedFechas((prev) => prev.filter((f) => f !== fecha));
    setEditandoFechas((prev) => prev.filter((f) => f !== fecha));
  };

  // ======================
  // Ofertas
  // ======================
  const verOfertas = async (fecha) => {
    if (!expandedFechas.includes(fecha)) {
      setExpandedFechas((prev) => [...prev, fecha]);
    }

    const productosFecha = groupByFecha[fecha] || [];
    const nuevas = {};
    let hay = false;

    const listaIds = Array.from(
      new Set(productosFecha.map((item) => getRowId(item)).filter(Boolean))
    );

    if (listaIds.length === 0) {
      setOfertasPorProducto({});
      return;
    }

    const { data: ofertasAll, error } = await supabase
      .from('ofertas_productos')
      .select(`
  *,
perfiles:proveedor_id (
  email,
  email_contacto,
  telefono_contacto
)
`)
      .in('lista_id', listaIds)
      .order('precio_ofertado', { ascending: true });

   if (error) {
  alert('Error cargando ofertas: ' + error.message);
  setOfertasPorProducto({});
  return;
}

    const visibles = (ofertasAll || []).filter((o) => {
  const st = (o.estado || '').toLowerCase();
  return st !== 'rechazada';
});

    for (const item of productosFecha) {
      const listaId = getRowId(item);
      const ofertasDeEste = visibles.filter((o) => o.lista_id === listaId);

      if (ofertasDeEste.length > 0) {
        const clave = `${item.producto}__${listaId}`;
        nuevas[clave] = ofertasDeEste.slice(0, 3);
        hay = true;
      }
    }

    setOfertasPorProducto(nuevas);

    if (hay) {
      setListasConOfertas((prev) => [...new Set([...prev, fecha])]);
    }
  };

const RUTA_MIS_OFERTAS = '/proveedor/ofertas_enviadas';
  const aceptarOferta = async (oferta, producto, fecha) => {
  const { error } = await supabase
    .from('ofertas_productos')
    .update({ estado: 'en_espera_confirmacion' })
    .eq('id', oferta.id);

  if (error) {
    alert('Error al aceptar la oferta: ' + error.message);
    return;
  }

  await supabase.from('notificaciones').insert([
    {
      usuario_id: oferta.proveedor_id,
      rol: 'proveedor',
      titulo: 'Oferta aceptada',
      mensaje: `Tu oferta para ${oferta.producto} fue aceptada.`,
      ruta: RUTA_MIS_OFERTAS,
      leida: false,
    },
  ]);

  await verOfertas(fecha);
};


  const confirmarOferta = async (oferta, fecha) => {
  const { error: ganadorError } = await supabase
    .from('ofertas_productos')
    .update({ estado: 'confirmada' })
    .eq('id', oferta.id);

  if (ganadorError) {
    alert('Error al confirmar la oferta ganadora: ' + ganadorError.message);
    return;
  }

  await supabase.from('notificaciones').insert([
    {
      usuario_id: oferta.proveedor_id,
      rol: 'proveedor',
      titulo: 'Oferta confirmada',
      mensaje: `Tu oferta para ${oferta.producto} fue confirmada.`,
      ruta: RUTA_MIS_OFERTAS,
      leida: false,
    },
  ]);

  const { error: rechazadasError } = await supabase
    .from('ofertas_productos')
    .update({ estado: 'rechazada' })
    .eq('lista_id', oferta.lista_id)
    .neq('id', oferta.id);

  if (rechazadasError) {
    alert('Error al marcar las otras ofertas como rechazadas: ' + rechazadasError.message);
    return;
  }

  alert('Compra confirmada');
  await verOfertas(fecha);
};


const rechazarOferta = async (oferta, producto, fecha) => {
  const { error } = await supabase
    .from('ofertas_productos')
    .update({ estado: 'rechazada' })
    .eq('id', oferta.id);

  if (error) {
    alert('Error al rechazar la oferta: ' + error.message);
    return;
  }

  await supabase.from('notificaciones').insert([
    {
      usuario_id: oferta.proveedor_id,
      rol: 'proveedor',
      titulo: 'Oferta rechazada',
      mensaje: `Tu oferta para ${oferta.producto} fue rechazada.`,
      ruta: RUTA_MIS_OFERTAS,
      leida: false,
    },
  ]);

  await verOfertas(fecha);
};
  const cerrarSesion = async () => {
    await supabase.auth.signOut();
    localStorage.clear();
    router.push('/login');
  };

  const cambiarPerfil = () => router.push('/seleccionar-perfil');

  const agregarProductoEnLista = (fecha) => {
    setNuevosProductos((prev) => ({
      ...prev,
      [fecha]: [...(prev[fecha] || []), { ...filaVacia }],
    }));
  };

  const handleNuevoChange = (fecha, index, field, value) => {
    const updated = [...(nuevosProductos[fecha] || [])];
    updated[index][field] = typeof value === 'string' ? value.toUpperCase() : value;

    if (field === 'producto') {
      updated[index].formato = '';
      updated[index].marca = '';
    } else if (field === 'formato') {
      updated[index].marca = '';
    }

    setNuevosProductos({ ...nuevosProductos, [fecha]: updated });
  };

  const guardarNuevoProducto = async (fecha, producto) => {
    const listaBase = groupByFecha[fecha]?.[0];
    if (!listaBase) return;

    const nuevo = {
      ...producto,
      cantidad: Number(producto.cantidad),
      precio: Number(producto.precio),
      usuario_id: listaBase.usuario_id,
      fecha_creacion: listaBase.fecha_creacion,
      comuna_despacho: listaBase.comuna_despacho,
    };

    const { data, error } = await supabase
      .from('listas_compras')
      .insert([nuevo])
      .select()
      .single();

    if (error) {
      alert('Error al guardar nuevo producto: ' + error.message);
      return;
    }

    setListas((prev) => [data, ...prev]);
    setNuevosProductos((prev) => ({ ...prev, [fecha]: [] }));
  };

  // ======================
  // UI
  // ======================
  return (
    <div style={{ padding: 20 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 12,
        }}
      >
        <button onClick={cambiarPerfil}>Cambiar perfil</button>
        <h2>Agrega productos a tu lista de compras</h2>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <Notificaciones userId={authUserId} rol="comprador" />
          <button onClick={cerrarSesion}>Cerrar sesión</button>
        </div>
      </div>

      <div style={{ marginBottom: 15 }}>
        <label>Comuna de despacho: </label>
        <input
          type="text"
          value={comunaDespacho}
          onChange={(e) => setComunaDespacho(e.target.value.toUpperCase())}
        />
      </div>

      <table>
        <thead>
          <tr>
            <th>Producto</th>
            <th>Formato</th>
            <th>Marca</th>
            <th>Cantidad</th>
            <th>Precio</th>
          </tr>
        </thead>
        <tbody>
          {productos.map((item, i) => (
            <tr key={i}>
              <td>
                <select
                  value={item.producto}
                  onChange={(e) => handleChange(i, 'producto', e.target.value)}
                >
                  <option value="">Selecciona</option>
                  {[...new Set(stock.map((p) => p.nombre))].map((nombre, idx) => (
                    <option key={idx} value={nombre}>
                      {nombre}
                    </option>
                  ))}
                </select>
              </td>
              <td>
                <select
                  value={item.formato}
                  onChange={(e) => handleChange(i, 'formato', e.target.value)}
                  disabled={!item.producto}
                >
                  <option value="">Selecciona</option>
                  {obtenerFormatos(item.producto).map((f, idx) => (
                    <option key={idx} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              </td>
              <td>
                <select
                  value={item.marca}
                  onChange={(e) => handleChange(i, 'marca', e.target.value)}
                  disabled={!item.formato}
                >
                  <option value="">Selecciona</option>
                  {obtenerMarcas(item.producto, item.formato).map((m, idx) => (
                    <option key={idx} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </td>
              <td>
                <input
                  type="number"
                  value={item.cantidad}
                  onChange={(e) => handleChange(i, 'cantidad', e.target.value)}
                />
              </td>
              <td>
                <input
                  type="number"
                  value={item.precio}
                  onChange={(e) => handleChange(i, 'precio', e.target.value)}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <button onClick={agregarFila}>Agregar otro producto</button>
      <button onClick={enviarLista}>Enviar lista</button>

      <h3 style={{ marginTop: 30 }}>🛒 Tus Listas de Compra</h3>

      {Object.keys(groupByFecha).map((fecha, idx) => {
        const itemsDeLaFecha = groupByFecha[fecha] || [];
        const listaIdsDeLaFecha = new Set(itemsDeLaFecha.map((it) => String(getRowId(it))));

        return (
          <div
            key={idx}
            style={{ border: '1px solid #ccc', padding: 10, margin: '10px 0' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <button onClick={() => toggleExpand(fecha)}>{fecha}</button>
              <div>
                <button onClick={() => eliminarLista(fecha)} style={{ marginRight: 5 }}>
                  Eliminar
                </button>
                <button onClick={() => verOfertas(fecha)} style={{ marginRight: 5 }}>
                  Ver ofertas
                </button>
                {listasConOfertas.includes(fecha) ? (
                  <span style={{ color: 'red', marginLeft: 10 }}>
                    Ya has recibido ofertas por esta lista, por lo que ya no es posible
                    modificarla.
                  </span>
                ) : (
                  <button onClick={() => toggleEdit(fecha)}>Editar</button>
                )}
              </div>
            </div>

            {expandedFechas.includes(fecha) && (
              <>
                <table style={{ marginTop: 10 }}>
                  <thead>
                    <tr>
                      <th>Producto</th>
                      <th>Formato</th>
                      <th>Marca</th>
                      <th>Cantidad</th>
                      <th>Precio</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {itemsDeLaFecha.map((item, i) => {
                      const itemId = getRowId(item);

                      return (
                        <tr key={i}>
                          <td>{item.producto}</td>
                          <td>{item.formato}</td>
                          <td>{item.marca}</td>
                          <td>
                            {editandoFechas.includes(fecha) ? (
                              <input
                                type="number"
                                defaultValue={item.cantidad}
                                onBlur={(e) =>
                                  actualizarProducto(itemId, 'cantidad', Number(e.target.value))
                                }
                              />
                            ) : (
                              item.cantidad
                            )}
                          </td>
                          <td>
                            {editandoFechas.includes(fecha) ? (
                              <input
                                type="number"
                                defaultValue={item.precio}
                                onBlur={(e) =>
                                  actualizarProducto(itemId, 'precio', Number(e.target.value))
                                }
                              />
                            ) : (
                              `$${Number(item.precio).toLocaleString('es-CL')}`
                            )}
                          </td>
                          <td>
                            {editandoFechas.includes(fecha) && (
                              <button onClick={() => eliminarProducto(itemId)}>Quitar</button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {editandoFechas.includes(fecha) && !listasConOfertas.includes(fecha) && (
                  <div style={{ marginTop: 12 }}>
                    <button onClick={() => agregarProductoEnLista(fecha)}>
                      Agregar producto a esta lista
                    </button>

                    {(nuevosProductos[fecha] || []).map((nuevo, index) => (
                      <div
                        key={index}
                        style={{
                          marginTop: 10,
                          padding: 10,
                          border: '1px solid #ddd',
                        }}
                      >
                        <select
                          value={nuevo.producto}
                          onChange={(e) =>
                            handleNuevoChange(fecha, index, 'producto', e.target.value)
                          }
                        >
                          <option value="">Selecciona producto</option>
                          {[...new Set(stock.map((p) => p.nombre))].map((nombre, idx2) => (
                            <option key={idx2} value={nombre}>
                              {nombre}
                            </option>
                          ))}
                        </select>

                        <select
                          value={nuevo.formato}
                          onChange={(e) =>
                            handleNuevoChange(fecha, index, 'formato', e.target.value)
                          }
                          disabled={!nuevo.producto}
                        >
                          <option value="">Selecciona formato</option>
                          {obtenerFormatos(nuevo.producto).map((f, idx2) => (
                            <option key={idx2} value={f}>
                              {f}
                            </option>
                          ))}
                        </select>

                        <select
                          value={nuevo.marca}
                          onChange={(e) =>
                            handleNuevoChange(fecha, index, 'marca', e.target.value)
                          }
                          disabled={!nuevo.formato}
                        >
                          <option value="">Selecciona marca</option>
                          {obtenerMarcas(nuevo.producto, nuevo.formato).map((m, idx2) => (
                            <option key={idx2} value={m}>
                              {m}
                            </option>
                          ))}
                        </select>

                        <input
                          type="number"
                          placeholder="Cantidad"
                          value={nuevo.cantidad}
                          onChange={(e) =>
                            handleNuevoChange(fecha, index, 'cantidad', e.target.value)
                          }
                        />

                        <input
                          type="number"
                          placeholder="Precio"
                          value={nuevo.precio}
                          onChange={(e) =>
                            handleNuevoChange(fecha, index, 'precio', e.target.value)
                          }
                        />

                        <button onClick={() => guardarNuevoProducto(fecha, nuevo)}>
                          Guardar producto
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {Object.entries(ofertasPorProducto)
                  .filter(([clave]) => {
                    const [, listaIdStr] = String(clave).split('__');
                    return listaIdsDeLaFecha.has(String(listaIdStr));
                  })
                  .map(([clave, ofertas], i) => {
                    const [productoNombre] = String(clave).split('__');

                    return (
                      <div key={i} style={{ marginTop: 15 }}>
                        <strong>Ofertas para {productoNombre}:</strong>

                        <div
                          style={{
                            display: 'flex',
                            gap: 12,
                            flexWrap: 'wrap',
                            marginTop: 8,
                          }}
                        >
                          {ofertas.map((of, j) => {
                            const isConfirm = of.estado === 'en_espera_confirmacion';

                            return (
                              <div
                                key={j}
                                style={{
                                  border: '1px solid #ddd',
                                  borderRadius: 8,
                                  padding: 12,
                                  minWidth: 240,
                                  maxWidth: 280,
                                  flex: '0 0 auto',
                                  boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
                                }}
                              >
                                <p>
                                  <strong>Precio:</strong>{' '}
                                  ${Number(of.precio_ofertado).toLocaleString('es-CL')}
                                </p>
                                <p>
                                  <strong>Despacho:</strong>{' '}
                                  {of.incluye_despacho ? '🚚 Con despacho' : '❌ Sin despacho'}
                                </p>

                                {of.estado === 'pendiente' && (
                                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                                    <button onClick={() => aceptarOferta(of, productoNombre, fecha)}>
                                      Aceptar
                                    </button>
                                    <button onClick={() => rechazarOferta(of, productoNombre, fecha)}>
                                      Rechazar
                                    </button>
                                  </div>
                                )}

                                {isConfirm && (
                                  <>
                                    <div
                                      style={{
                                        marginTop: 8,
                                        borderTop: '1px dashed #ddd',
                                        paddingTop: 8,
                                      }}
                                    >
                                     <p><strong>Proveedor:</strong> {of.perfiles?.email_contacto || of.perfiles?.email || 'No disponible'}</p>
<p><strong>Teléfono:</strong> {of.perfiles?.telefono_contacto || 'No disponible'}</p>
                                    </div>
                                    <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                                      <button onClick={() => confirmarOferta(of, fecha)}>
                                        Confirmar compra
                                      </button>
                                      <button onClick={() => rechazarOferta(of, productoNombre, fecha)}>
                                        Rechazar
                                      </button>
                                    </div>
                                  </>
                                )}

                                {of.estado === 'confirmada' && (
  <>
    <p style={{ color: 'green', marginTop: 8, fontWeight: 'bold' }}>
      ✅ Licitación cerrada
    </p>

    <div
      style={{
        marginTop: 8,
        borderTop: '1px dashed #ddd',
        paddingTop: 8,
      }}
    >
      <p>
        <strong>Proveedor:</strong>{' '}
        {of.perfiles?.email_contacto || of.perfiles?.email || 'No disponible'}
      </p>
      <p>
        <strong>Teléfono:</strong>{' '}
        {of.perfiles?.telefono_contacto || 'No disponible'}
      </p>
    </div>
  </>
)}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}

                {itemsDeLaFecha.map((item, idxProd) => {
  const listaId = getRowId(item);
  const clave = `${item.producto}__${listaId}`;
  const ofertasDeEste = ofertasPorProducto[clave] || [];
  const ofertaConfirmada = ofertasDeEste.find((o) => o.estado === 'confirmada');

  if (ofertasDeEste.length > 0) return null;

  if (ofertaConfirmada) {
    return (
      <div
        key={`cerrada-${idxProd}`}
        style={{ marginTop: 10, color: 'green', fontWeight: 'bold' }}
      >
        <strong>{item.producto}:</strong> licitación cerrada
      </div>
    );
  }

  return (
    <div
      key={`recibiendo-${idxProd}`}
      style={{ marginTop: 10, fontStyle: 'italic', color: '#666' }}
    >
      <strong>{item.producto}:</strong> recibiendo oferta…
    </div>
  );
})}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}