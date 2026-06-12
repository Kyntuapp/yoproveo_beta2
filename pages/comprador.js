// pages/comprador.js
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabaseClient';
import Notificaciones from '../components/Notificaciones';
import { comunasChile } from '../utils/comunasChile';

const filaVacia = {
  producto: '',
  formato: '',
  marca: '',
  cantidad: '',
  precio: '',
};

export default function Comprador() {
  const [productos, setProductos] = useState([{ ...filaVacia }]);
  const [usuarioId, setUsuarioId] = useState(null);
  const [authUserId, setAuthUserId] = useState(null);
  const [stock, setStock] = useState([]);
  const [comunaDespacho, setComunaDespacho] = useState('');
  const [listas, setListas] = useState([]);
  const [expandedFechas, setExpandedFechas] = useState([]);
  const [editandoFechas, setEditandoFechas] = useState([]);
  const [ofertasPorProducto, setOfertasPorProducto] = useState({});
  const [ofertasCrudasPorProducto, setOfertasCrudasPorProducto] =
    useState({});
  const [nuevosProductos, setNuevosProductos] = useState({});
  const [listasConOfertas, setListasConOfertas] = useState([]);
  const [tienePerfilProveedor, setTienePerfilProveedor] = useState(false);
  const [comentariosCompra, setComentariosCompra] = useState({});
  const [productosConOfertasAbiertas, setProductosConOfertasAbiertas] =
    useState({});

  // NUEVOS FILTROS
  const [filtroMejorPrecio, setFiltroMejorPrecio] = useState(true);
  const [filtroDespacho, setFiltroDespacho] = useState(false);
  const [filtroCincoEstrellas, setFiltroCincoEstrellas] =
    useState(false);
  const [mostrarComunas, setMostrarComunas] = useState(false);

 const comunasFiltradas = comunasChile.filter((c) =>
  c
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .includes(
      comunaDespacho
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
    )
);

  const router = useRouter();
  const scrolledToOfertaRef = useRef(null);

  const RUTA_MIS_OFERTAS = '/proveedor/ofertas_enviadas';

  const getRowId = (item) =>
    item?.id ??
    item?.identificacion ??
    item?.['identificación'] ??
    null;

  const groupByFecha = useMemo(() => {
    return listas.reduce((acc, item) => {
      const fecha = new Date(item.fecha_creacion).toLocaleString();

      if (!acc[fecha]) acc[fecha] = [];

      acc[fecha].push(item);

      return acc;
    }, {});
  }, [listas]);

  useEffect(() => {
    const fetchData = async () => {
      const { data: userData, error: userError } =
        await supabase.auth.getUser();

      if (userError || !userData?.user) {
        alert('Debes iniciar sesión.');
        router.push('/');
        return;
      }

      setAuthUserId(userData.user.id);

      if (userData.user.email) {
        localStorage.setItem(
          'user_email',
          userData.user.email
        );
      }

      let { data: perfilData, error: perfilError } =
        await supabase
          .from('perfiles')
          .select('id, tipo, email, auth_id')
          .eq('auth_id', userData.user.id)
          .eq('tipo', 'comprador')
          .maybeSingle();

      if (perfilError) {
        console.error(
          'Error buscando perfil comprador:',
          perfilError
        );
      }

      if (!perfilData) {
        const { data: perfilByEmail } = await supabase
          .from('perfiles')
          .select('id, tipo, email, auth_id')
          .eq('email', userData.user.email)
          .eq('tipo', 'comprador')
          .maybeSingle();

        perfilData = perfilByEmail;
      }

      if (!perfilData) {
        alert('No se encontró perfil comprador');
        router.push('/');
        return;
      }

      setUsuarioId(perfilData.id);

      const { data: perfilProveedor } = await supabase
        .from('perfiles')
        .select('id')
        .eq('auth_id', userData.user.id)
        .eq('tipo', 'proveedor')
        .maybeSingle();

      setTienePerfilProveedor(!!perfilProveedor);

      const { data: stockData } = await supabase
        .from('productos_proveedores')
        .select(
          'nombre, formato, marca, cantidad_disponible'
        )
        .gt('cantidad_disponible', 0);

      if (stockData) {
        setStock(stockData);
      }

      const { data: listasData } = await supabase
        .from('listas_compras')
        .select('*')
        .eq('usuario_id', userData.user.id)
        .order('fecha_creacion', {
          ascending: false,
        });

      if (listasData) {
        setListas(listasData);
      }
    };

    fetchData();
  }, [router]);

  useEffect(() => {
    if (!router.isReady) return;
    if (router.query?.notif !== 'ofertas') return;
    if (!listas || listas.length === 0) return;

    let fechaKey = null;
    let listIdToOpen = null;

    const listIdParam = Array.isArray(router.query.list_id)
      ? router.query.list_id[0]
      : router.query.list_id;

    if (listIdParam) {
      const listaMatch = listas.find(
        (l) =>
          String(getRowId(l)) ===
          String(listIdParam)
      );

      if (listaMatch) {
        listIdToOpen = getRowId(listaMatch);
        fechaKey = new Date(
          listaMatch.fecha_creacion
        ).toLocaleString();
      }
    }

    if (!fechaKey) {
      const ultima = listas.reduce((a, b) =>
        new Date(a.fecha_creacion) >
        new Date(b.fecha_creacion)
          ? a
          : b
      );

      fechaKey = new Date(
        ultima.fecha_creacion
      ).toLocaleString();
    }

    if (!expandedFechas.includes(fechaKey)) {
      setExpandedFechas((prev) => [
        ...prev,
        fechaKey,
      ]);
    }

    if (listIdToOpen) {
      setProductosConOfertasAbiertas((prev) => ({
        ...prev,
        [listIdToOpen]: true,
      }));
    }

    verOfertas(fechaKey);

    // eslint-disable-next-line
  }, [router.isReady, router.query, listas]);

  useEffect(() => {
    if (!router.isReady) return;
    if (router.query?.notif !== 'ofertas') return;

    const listIdParam = Array.isArray(router.query.list_id)
      ? router.query.list_id[0]
      : router.query.list_id;

    if (!listIdParam) return;
    if (!productosConOfertasAbiertas[listIdParam]) return;
    if (scrolledToOfertaRef.current === listIdParam) return;

    const timer = setTimeout(() => {
      const el = document.getElementById(`oferta-${listIdParam}`);

      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        scrolledToOfertaRef.current = listIdParam;
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [
    router.isReady,
    router.query,
    productosConOfertasAbiertas,
    expandedFechas,
  ]);

  const handleChange = (
    index,
    field,
    value
  ) => {
    const updated = [...productos];

    updated[index][field] =
      typeof value === 'string'
        ? value.toUpperCase()
        : value;

    if (field === 'producto') {
      updated[index].formato = '';
      updated[index].marca = '';
    } else if (field === 'formato') {
      updated[index].marca = '';
    }

    setProductos(updated);
  };

  const obtenerFormatos = (producto) =>
    [
      ...new Set(
        stock
          .filter((p) => p.nombre === producto)
          .map((p) => p.formato)
      ),
    ];

  const obtenerMarcas = (
    producto,
    formato
  ) =>
    [
      ...new Set(
        stock
          .filter(
            (p) =>
              p.nombre === producto &&
              p.formato === formato
          )
          .map((p) => p.marca)
      ),
    ];

  const agregarFila = () => {
    setProductos([
      ...productos,
      { ...filaVacia },
    ]);
  };

  // FIN PARTE 1
    const enviarLista = async () => {
    if (!authUserId || !comunaDespacho) {
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

    const lista = productosValidos.map((p) => ({
      producto: p.producto,
      formato: p.formato,
      marca: p.marca,
      cantidad: Number(p.cantidad),
      precio: Number(p.precio),
      usuario_id: authUserId,
      comprador_email: localStorage.getItem('user_email') || '',
      fecha_creacion: fecha,
      comuna_despacho: comunaDespacho.toUpperCase(),
    }));

    const { data, error } = await supabase
      .from('listas_compras')
      .insert(lista)
      .select();

    if (error) {
      alert('Error al enviar la lista: ' + error.message);
      return;
    }

    alert('Lista enviada correctamente');

    setProductos([{ ...filaVacia }]);
    setComunaDespacho('');
    setListas((prev) => [...(data || []), ...prev]);
  };

  const toggleExpand = (fecha) => {
    setExpandedFechas((prev) =>
      prev.includes(fecha)
        ? prev.filter((f) => f !== fecha)
        : [...prev, fecha]
    );
  };

  const toggleEdit = (fecha) => {
    setEditandoFechas((prev) =>
      prev.includes(fecha)
        ? prev.filter((f) => f !== fecha)
        : [...prev, fecha]
    );
  };

  const toggleOfertasProducto = (productoId) => {
    setProductosConOfertasAbiertas((prev) => ({
      ...prev,
      [productoId]: !prev[productoId],
    }));
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

    const ids = (groupByFecha[fecha] || [])
      .map((p) => getRowId(p))
      .filter(Boolean);

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

  const aplicarFiltrosOfertas = useCallback(
    (ofertas) => {
      const resultado = [...(ofertas || [])];

      // Filtro "Solo 5 estrellas": pendiente Fase B (tabla calificaciones_proveedor).

      resultado.sort((a, b) => {
        if (filtroDespacho) {
          const keyA = a.incluye_despacho ? 0 : 1;
          const keyB = b.incluye_despacho ? 0 : 1;
          if (keyA !== keyB) return keyA - keyB;
        }

        if (filtroMejorPrecio) {
          return (
            Number(a.precio_ofertado || 0) -
            Number(b.precio_ofertado || 0)
          );
        }

        return 0;
      });

      return resultado.slice(0, 3);
    },
    [filtroMejorPrecio, filtroDespacho]
  );

  useEffect(() => {
    const claves = Object.keys(ofertasCrudasPorProducto);
    if (claves.length === 0) return;

    const filtradas = {};
    claves.forEach((clave) => {
      filtradas[clave] = aplicarFiltrosOfertas(
        ofertasCrudasPorProducto[clave]
      );
    });

    setOfertasPorProducto(filtradas);
  }, [ofertasCrudasPorProducto, aplicarFiltrosOfertas]);

  const verOfertas = async (fecha) => {
    if (!expandedFechas.includes(fecha)) {
      setExpandedFechas((prev) => [...prev, fecha]);
    }

    const productosFecha = groupByFecha[fecha] || [];

    const listaIds = Array.from(
      new Set(productosFecha.map((item) => getRowId(item)).filter(Boolean))
    );

    if (listaIds.length === 0) return;

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
      return;
    }

    const visibles = (ofertasAll || []).filter((o) => {
      const st = (o.estado || '').toLowerCase();
      return st !== 'rechazada';
    });

    const crudas = {};

    for (const item of productosFecha) {
      const listaId = getRowId(item);
      const ofertasDeEste = visibles.filter((o) => o.lista_id === listaId);
      const clave = `${item.producto}__${listaId}`;

      crudas[clave] = ofertasDeEste;
    }

    setOfertasCrudasPorProducto((prev) => ({
      ...prev,
      ...crudas,
    }));

    setListasConOfertas((prev) => [...new Set([...prev, fecha])]);
  };

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
    .update({
      estado: 'pendiente_pago',
      comentario_comprador: comentariosCompra[oferta.id] || '',
    })
    .eq('id', oferta.id);

  if (ganadorError) {
    alert('Error al confirmar la oferta: ' + ganadorError.message);
    return;
  }

  await supabase.from('notificaciones').insert([
    {
      usuario_id: oferta.proveedor_id,
      rol: 'proveedor',
      titulo: 'Compra pendiente de pago',
      mensaje: `El comprador confirmó tu oferta para ${oferta.producto}, pero el pago aún está pendiente.`,
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

  alert('Compra confirmada. Ahora puedes realizar el pago.');
  await verOfertas(fecha);
};

const pagarOferta = async (oferta) => {
  const { data: proveedor, error } = await supabase
    .from('perfiles')
    .select(`
      banco,
      tipo_cuenta,
      numero_cuenta,
      rut_titular,
      nombre_titular,
      email_titular
    `)
    .eq('id', oferta.proveedor_id)
    .maybeSingle();

  if (error || !proveedor) {
    alert('No se encontraron los datos bancarios del proveedor.');
    return;
  }

  if (!proveedor.banco || !proveedor.tipo_cuenta || !proveedor.numero_cuenta) {
    alert('El proveedor aún no ha ingresado sus datos bancarios.');
    return;
  }

  const montoOferta = Number(oferta.precio_ofertado);
  const comisionKyntu = Math.round(montoOferta * 0.1);
  const totalPagado = montoOferta + comisionKyntu;

  const { data: pagoCreado, error: pagoError } = await supabase
    .from('pagos')
    .insert({
      oferta_id: oferta.id,
      proveedor_id: oferta.proveedor_id,
      monto_oferta: montoOferta,
      comision_kyntu: comisionKyntu,
      total_pagado: totalPagado,
      estado_pago: 'pendiente',
    })
    .select()
    .single();

  if (pagoError) {
    alert('Error creando registro de pago: ' + pagoError.message);
    return;
  }

  const response = await fetch('/api/create-payment', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      pago_id: pagoCreado.id,
      oferta_id: oferta.id,
      proveedor_id: oferta.proveedor_id,
      titulo: oferta.producto,
      precio: totalPagado,
    }),
  });

  const data = await response.json();

  if (data.init_point) {
    window.open(data.init_point, '_blank');
  } else {
    alert('No se pudo crear el pago.');
  }
};

  // FIN PARTE 2
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

    updated[index][field] =
      typeof value === 'string' ? value.toUpperCase() : value;

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

    if (
      !producto.producto ||
      !producto.formato ||
      !producto.marca ||
      !producto.cantidad ||
      !producto.precio
    ) {
      alert('Completa todos los datos del producto.');
      return;
    }

    const nuevo = {
      producto: producto.producto,
      formato: producto.formato,
      marca: producto.marca,
      cantidad: Number(producto.cantidad),
      precio: Number(producto.precio),
      usuario_id: listaBase.usuario_id,
      comprador_email:
        listaBase.comprador_email || localStorage.getItem('user_email') || '',
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

  const formatearPrecio = (valor) =>
    valor === '' || valor === null || valor === undefined
      ? ''
      : Number(valor).toLocaleString('es-CL');

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
          {tienePerfilProveedor && (
            <button onClick={cambiarPerfil} style={styles.secondaryButton}>
              Cambiar perfil
            </button>
          )}

          <button
            onClick={() => router.push('/comprador/datos-contacto')}
            style={styles.secondaryButton}
          >
            Actualizar datos
          </button>
        </div>

        <div style={styles.centerTitle}>
          <h1 style={styles.title}>Panel del Comprador</h1>
        </div>

        <div style={styles.rightActions}>
          <Notificaciones userId={authUserId} rol="comprador" />

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

          <h2 style={styles.cardTitle}>Agrega productos a tu lista</h2>

           <div style={styles.comunaBox}>
  <label style={styles.label}>Comuna de despacho</label>

  <input
    type="text"
    value={comunaDespacho}
    onChange={(e) => {
      setComunaDespacho(e.target.value);
      setMostrarComunas(true);
    }}
    onFocus={() => setMostrarComunas(true)}
    placeholder="Ej: Santiago"
    style={styles.input}
  />

  {mostrarComunas && comunaDespacho && (
    <div style={styles.comunasDropdown}>
      {comunasFiltradas.slice(0, 8).map((c) => (
        <div
          key={c}
          style={styles.comunaItem}
          onMouseDown={() => {
            setComunaDespacho(c);
            setMostrarComunas(false);
          }}
        >
          {c}
        </div>
      ))}

      {comunasFiltradas.length === 0 && (
        <div style={styles.comunaEmpty}>
          No se encontraron comunas
        </div>
      )}
    </div>
  )}
</div>

          <div style={styles.tableWrapper}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Producto</th>
                  <th style={styles.th}>Formato</th>
                  <th style={styles.th}>Marca</th>
                  <th style={styles.th}>Cantidad</th>
                  <th style={styles.th}>Precio</th>
                </tr>
              </thead>

              <tbody>
                {productos.map((item, i) => (
                  <tr key={i}>
                    <td style={styles.td}>
                      <select
                        value={item.producto}
                        onChange={(e) =>
                          handleChange(i, 'producto', e.target.value)
                        }
                        style={styles.select}
                      >
                        <option value="">Selecciona</option>

                        {[...new Set(stock.map((p) => p.nombre))].map(
                          (nombre, idx) => (
                            <option key={idx} value={nombre}>
                              {nombre}
                            </option>
                          )
                        )}
                      </select>
                    </td>

                    <td style={styles.td}>
                      <select
                        value={item.formato}
                        onChange={(e) =>
                          handleChange(i, 'formato', e.target.value)
                        }
                        disabled={!item.producto}
                        style={styles.select}
                      >
                        <option value="">Selecciona</option>

                        {obtenerFormatos(item.producto).map((f, idx) => (
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
                          handleChange(i, 'marca', e.target.value)
                        }
                        disabled={!item.formato}
                        style={styles.select}
                      >
                        <option value="">Selecciona</option>

                        {obtenerMarcas(item.producto, item.formato).map(
                          (m, idx) => (
                            <option key={idx} value={m}>
                              {m}
                            </option>
                          )
                        )}
                      </select>
                    </td>

                    <td style={styles.td}>
                      <input
                        type="number"
                        value={item.cantidad}
                        onChange={(e) =>
                          handleChange(i, 'cantidad', e.target.value)
                        }
                        style={styles.quantityInput}
                      />
                    </td>

                    <td style={styles.td}>
                      <input
                        type="number"
                        value={item.precio}
                        onChange={(e) =>
                          handleChange(i, 'precio', e.target.value)
                        }
                        style={styles.quantityInput}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={styles.actionRow}>
            <button onClick={agregarFila} style={styles.secondaryButton}>
              Agregar otro producto
            </button>

            <button onClick={enviarLista} style={styles.mainButton}>
              Enviar lista
            </button>
          </div>
        </section>

        <section style={styles.card}>
          <h2 style={styles.cardTitle}>Mis listas enviadas</h2>

          <div style={styles.filtersBox}>
            <p style={styles.filtersTitle}>
              Mostrar mejores ofertas según:
            </p>

            <label style={styles.filterLabel}>
              <input
                type="checkbox"
                checked={filtroMejorPrecio}
                onChange={(e) => setFiltroMejorPrecio(e.target.checked)}
              />
              Mejor precio
            </label>

            <label style={styles.filterLabel}>
              <input
                type="checkbox"
                checked={filtroDespacho}
                onChange={(e) => setFiltroDespacho(e.target.checked)}
              />
              Incluye despacho
            </label>

            <label style={styles.filterLabel}>
              <input
                type="checkbox"
                checked={false}
                disabled
                readOnly
              />
              Solo 5 estrellas (próximamente)
            </label>
          </div>

          {Object.keys(groupByFecha).length === 0 ? (
            <p style={styles.emptyText}>
              Aún no has enviado listas de compra.
            </p>
          ) : (
            Object.entries(groupByFecha).map(([fecha, productos]) => {
              const expanded = expandedFechas.includes(fecha);
              const editando = editandoFechas.includes(fecha);

              return (
                <div key={fecha} style={styles.listBox}>
                  <div style={styles.listHeader}>
                    <div>
                      <h3 style={styles.listTitle}>
                        Lista enviada el {fecha}
                      </h3>

                      <p style={styles.listSubtitle}>
                        {productos.length} productos
                      </p>
                    </div>

                    <div style={styles.listActions}>
                      <button
                        onClick={() => toggleExpand(fecha)}
                        style={styles.smallButton}
                      >
                        {expanded ? 'Ocultar' : 'Ver'}
                      </button>

                      <button
                        onClick={() => toggleEdit(fecha)}
                        style={styles.smallButton}
                      >
                        {editando ? 'Cerrar edición' : 'Editar'}
                      </button>

                      <button
                        onClick={() => verOfertas(fecha)}
                        style={styles.mainButtonSmall}
                      >
                        Ver ofertas
                      </button>

                      <button
                        onClick={() => eliminarLista(fecha)}
                        style={styles.deleteButton}
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>

                  {/* FIN PARTE 3 */}
                                    {expanded && (
                    <>
                      <div style={styles.tableWrapper}>
                        <table style={styles.table}>
                          <thead>
                            <tr>
                              <th style={styles.th}>Producto</th>
                              <th style={styles.th}>Formato</th>
                              <th style={styles.th}>Marca</th>
                              <th style={styles.th}>Cantidad</th>
                              <th style={styles.th}>Precio</th>
                              <th style={styles.th}>Ofertas</th>
                            </tr>
                          </thead>

                          <tbody>
                            {productos.map((item, idx) => {
                              const rowId = getRowId(item);
                              const clave = `${item.producto}__${rowId}`;
                              const ofertas = ofertasPorProducto[clave] || [];
                              const abierto =
                                productosConOfertasAbiertas[rowId];

                              return (
                                <>
                                  <tr
                                    key={`producto-${rowId || idx}`}
                                    id={rowId ? `oferta-${rowId}` : undefined}
                                    onClick={() =>
                                      toggleOfertasProducto(rowId)
                                    }
                                    style={styles.clickableRow}
                                  >
                                    <td style={styles.td}>{item.producto}</td>
                                    <td style={styles.td}>{item.formato}</td>
                                    <td style={styles.td}>{item.marca}</td>
                                    <td style={styles.td}>{item.cantidad}</td>
                                    <td style={styles.td}>
                                      ${formatearPrecio(item.precio)}
                                    </td>
                                    <td style={styles.td}>
                                      <span style={styles.offerCount}>
                                        {ofertas.length > 0
                                          ? 'Ver ofertas'
                                          : 'Sin ofertas'}
                                      </span>
                                      <span style={styles.arrow}>
                                        {abierto ? '▲' : '▼'}
                                      </span>
                                    </td>
                                  </tr>

                                  {abierto && (
                                    <tr key={`ofertas-${rowId || idx}`}>
                                      <td colSpan={6} style={styles.offersRow}>
                                        {ofertas.length === 0 ? (
                                          <p style={styles.waitingOffer}>
                                            Aún no has recibido ofertas por este producto.
                                          </p>
                                        ) : (
                                          <div style={styles.offersGrid}>
                                            {ofertas.map((of, i) => {
                                              const estado = (
                                                of.estado || ''
                                              ).toLowerCase();

                                              const isPending =
                                                estado === 'pendiente';
                                              const isWaiting =
                                                estado ===
                                                'en_espera_confirmacion';
                                              const isConfirm =
                                                estado === 'confirmada';
                                              const isPendingPayment =
                                                estado === 'pendiente_pago';

                                              return (
                                                <div
                                                  key={i}
                                                  style={styles.offerCard}
                                                >
                                                  <p style={styles.offerPrice}>
                                                    $
                                                    {formatearPrecio(
                                                      of.precio_ofertado
                                                    )}
                                                  </p>

                                                  <p style={styles.offerMeta}>
                                                    {of.incluye_despacho
                                                      ? '🚚 Incluye despacho'
                                                      : '❌ Sin despacho'}
                                                  </p>

                                                  {isPending && (
                                                    <div
                                                      style={styles.offerActions}
                                                    >
                                                      <button
                                                        onClick={(e) => {
                                                          e.stopPropagation();
                                                          aceptarOferta(
                                                            of,
                                                            item,
                                                            fecha
                                                          );
                                                        }}
                                                        style={
                                                          styles.mainButtonSmall
                                                        }
                                                      >
                                                        Aceptar
                                                      </button>

                                                      <button
                                                        onClick={(e) => {
                                                          e.stopPropagation();
                                                          rechazarOferta(
                                                            of,
                                                            item,
                                                            fecha
                                                          );
                                                        }}
                                                        style={
                                                          styles.deleteButton
                                                        }
                                                      >
                                                        Rechazar
                                                      </button>
                                                    </div>
                                                  )}

                                                  {isWaiting && (
                                                    <>
                                                      <div
                                                        style={styles.contactBox}
                                                      >
                                                        <p
                                                          style={
                                                            styles.contactText
                                                          }
                                                        >
                                                          <strong>
                                                            Proveedor:
                                                          </strong>{' '}
                                                          {of.perfiles
                                                            ?.email_contacto ||
                                                            of.perfiles
                                                              ?.email ||
                                                            'No disponible'}
                                                        </p>

                                                        <p
                                                          style={
                                                            styles.contactText
                                                          }
                                                        >
                                                          <strong>
                                                            Teléfono:
                                                          </strong>{' '}
                                                          {of.perfiles
                                                            ?.telefono_contacto ||
                                                            'No disponible'}
                                                        </p>
                                                      </div>

                                                      <textarea
                                                        placeholder="Comentario para el proveedor"
                                                        value={
                                                          comentariosCompra[
                                                            of.id
                                                          ] || ''
                                                        }
                                                        onClick={(e) =>
                                                          e.stopPropagation()
                                                        }
                                                        onChange={(e) =>
                                                          setComentariosCompra(
                                                            (prev) => ({
                                                              ...prev,
                                                              [of.id]:
                                                                e.target.value,
                                                            })
                                                          )
                                                        }
                                                        style={styles.textArea}
                                                      />

                                                      <div
                                                        style={
                                                          styles.offerActions
                                                        }
                                                      >
                                                        <button
                                                          onClick={(e) => {
                                                            e.stopPropagation();
                                                            confirmarOferta(
                                                              of,
                                                              fecha
                                                            );
                                                          }}
                                                          style={
                                                            styles.mainButtonSmall
                                                          }
                                                        >
                                                          Confirmar compra
                                                        </button>

                                                        <button
                                                          onClick={(e) => {
                                                            e.stopPropagation();
                                                            rechazarOferta(
                                                              of,
                                                              item,
                                                              fecha
                                                            );
                                                          }}
                                                          style={
                                                            styles.deleteButton
                                                          }
                                                        >
                                                          Rechazar
                                                        </button>
                                                      </div>
                                                    </>
                                                  )}

                                                  {isPendingPayment && (
                                                    <>
                                                      <p style={styles.pendingPaymentText}>
                                                        ⏳ Pago pendiente
                                                      </p>

                                                      <button
                                                        onClick={(e) => {
                                                          e.stopPropagation();
                                                          pagarOferta(of);
                                                        }}
                                                        style={styles.mainButtonSmall}
                                                      >
                                                        Pagar
                                                      </button>
                                                    </>
                                                  )}

                                                  {isConfirm && (
                                                    <>
                                                      <p
                                                        style={
                                                          styles.confirmedText
                                                        }
                                                      >
                                                        ✅ Compra confirmada
                                                      </p>

                                                      <div
                                                        style={styles.contactBox}
                                                      >
                                                        <p
                                                          style={
                                                            styles.contactText
                                                          }
                                                        >
                                                          <strong>
                                                            Proveedor:
                                                          </strong>{' '}
                                                          {of.perfiles
                                                            ?.email_contacto ||
                                                            of.perfiles
                                                              ?.email ||
                                                            'No disponible'}
                                                        </p>

                                                        <p
                                                          style={
                                                            styles.contactText
                                                          }
                                                        >
                                                          <strong>
                                                            Teléfono:
                                                          </strong>{' '}
                                                          {of.perfiles
                                                            ?.telefono_contacto ||
                                                            'No disponible'}
                                                        </p>

                                                        {of.comentario_comprador && (
                                                          <p
                                                            style={
                                                              styles.contactText
                                                            }
                                                          >
                                                            <strong>
                                                              Comentario:
                                                            </strong>{' '}
                                                            {
                                                              of.comentario_comprador
                                                            }
                                                          </p>
                                                        )}
                                                      </div>
                                                    </>
                                                  )}
                                                </div>
                                              );
                                            })}
                                          </div>
                                        )}
                                      </td>
                                    </tr>
                                  )}
                                </>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                </div>
              );
            })
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
    overflowY: 'auto',
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
    zIndex: 20,
    display: 'grid',
    gridTemplateColumns: '1fr auto 1fr',
    alignItems: 'center',
    marginBottom: '32px',
  },

  leftActions: {
    display: 'flex',
    gap: '10px',
    justifyContent: 'flex-start',
  },

  centerTitle: {
    display: 'flex',
    justifyContent: 'center',
  },

  rightActions: {
    display: 'flex',
    gap: '12px',
    justifyContent: 'flex-end',
    alignItems: 'center',
    position: 'relative',
    zIndex: 30,
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
    gap: '28px',
  },

  card: {
    width: '100%',
    background: 'rgba(5, 12, 29, 0.86)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: '28px',
    boxShadow: '0 28px 80px rgba(0,0,0,0.35)',
    padding: '34px',
    boxSizing: 'border-box',
    backdropFilter: 'blur(10px)',
    overflow: 'visible',
  },

  logo: {
    width: '220px',
    display: 'block',
    margin: '0 auto -20px',
    filter: 'drop-shadow(0 0 28px rgba(0,255,210,0.45))',
  },

  cardTitle: {
    color: '#ffffff',
    fontSize: '28px',
    marginBottom: '24px',
    fontWeight: 800,
    textAlign: 'center',
  },

  comunaBox: {
  width: '100%',
  position: 'relative',
  marginBottom: '22px',
},

  label: {
    display: 'block',
    color: '#ffffff',
    fontWeight: 700,
    marginBottom: '8px',
  },

  input: {
    width: '100%',
    padding: '13px 15px',
    borderRadius: '12px',
    border: '1px solid rgba(255,255,255,0.18)',
    background: 'rgba(255,255,255,0.08)',
    color: '#ffffff',
    outline: 'none',
    boxSizing: 'border-box',
  },

  select: {
    width: '100%',
    minWidth: '140px',
    padding: '11px 12px',
    borderRadius: '10px',
    border: '1px solid rgba(255,255,255,0.18)',
    background: '#10192b',
    color: '#ffffff',
    outline: 'none',
  },

  quantityInput: {
    width: '90px',
    padding: '10px 12px',
    borderRadius: '10px',
    border: '1px solid rgba(255,255,255,0.18)',
    background: 'rgba(255,255,255,0.08)',
    color: '#ffffff',
    outline: 'none',
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
    color: 'rgba(255,255,255,0.72)',
    fontSize: '13px',
    padding: '8px',
    textAlign: 'center',
  },

  td: {
    color: '#ffffff',
    padding: '10px 8px',
    textAlign: 'center',
    background: 'rgba(255,255,255,0.045)',
    borderTop: '1px solid rgba(255,255,255,0.08)',
    borderBottom: '1px solid rgba(255,255,255,0.08)',
  },

  actionRow: {
    display: 'flex',
    justifyContent: 'center',
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
    boxShadow: '0 10px 24px rgba(23,107,255,0.32)',
  },

  mainButtonSmall: {
    background: 'linear-gradient(135deg, #176BFF, #2E6BFF)',
    color: '#fff',
    border: 'none',
    padding: '10px 14px',
    borderRadius: '10px',
    cursor: 'pointer',
    fontWeight: 700,
    fontSize: '12px',
  },

  secondaryButton: {
    background: 'rgba(255,255,255,0.08)',
    color: '#ffffff',
    border: '1px solid rgba(255,255,255,0.18)',
    padding: '12px 20px',
    borderRadius: '12px',
    cursor: 'pointer',
    fontWeight: 700,
  },

  logoutButton: {
    background: 'rgba(255,80,80,0.14)',
    color: '#ffffff',
    border: '1px solid rgba(255,80,80,0.25)',
    padding: '12px 20px',
    borderRadius: '12px',
    cursor: 'pointer',
    fontWeight: 700,
  },

  smallButton: {
    background: 'rgba(255,255,255,0.08)',
    color: '#ffffff',
    border: '1px solid rgba(255,255,255,0.18)',
    padding: '10px 14px',
    borderRadius: '10px',
    cursor: 'pointer',
    fontWeight: 700,
    fontSize: '12px',
  },

  deleteButton: {
    background: 'rgba(255,80,80,0.14)',
    color: '#ffffff',
    border: '1px solid rgba(255,80,80,0.25)',
    padding: '10px 14px',
    borderRadius: '10px',
    cursor: 'pointer',
    fontWeight: 700,
    fontSize: '12px',
  },

  emptyText: {
    color: 'rgba(255,255,255,0.72)',
    textAlign: 'center',
  },

  listBox: {
    marginBottom: '24px',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: '20px',
    padding: '20px',
    background: 'rgba(255,255,255,0.03)',
  },

  listHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '20px',
    flexWrap: 'wrap',
    marginBottom: '16px',
  },

  listTitle: {
    color: '#ffffff',
    margin: 0,
  },

  listSubtitle: {
    color: 'rgba(255,255,255,0.65)',
    margin: '4px 0 0',
  },

  listActions: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
  },

  filtersBox: {
    marginBottom: '22px',
    padding: '16px',
    borderRadius: '16px',
    background: 'rgba(255,255,255,0.045)',
    border: '1px solid rgba(255,255,255,0.10)',
    display: 'flex',
    gap: '16px',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
  },

  filtersTitle: {
    color: '#ffffff',
    fontWeight: 800,
    margin: 0,
  },

  filterLabel: {
    color: 'rgba(255,255,255,0.82)',
    display: 'flex',
    gap: '6px',
    alignItems: 'center',
    fontWeight: 700,
  },

  clickableRow: {
    cursor: 'pointer',
  },

  offerCount: {
    color: '#31f7c6',
    fontWeight: 800,
  },

  arrow: {
    marginLeft: '8px',
    color: '#31f7c6',
    fontWeight: 800,
  },

  offersRow: {
    padding: '18px',
    background: 'rgba(255,255,255,0.025)',
    borderBottom: '1px solid rgba(255,255,255,0.08)',
  },

  offersGrid: {
    display: 'flex',
    gap: '12px',
    flexWrap: 'wrap',
    marginTop: '10px',
  },

  offerCard: {
    padding: '16px',
    borderRadius: '16px',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.08)',
    minWidth: '240px',
    maxWidth: '280px',
    flex: '0 0 auto',
  },

  offerPrice: {
    color: '#31f7c6',
    fontSize: '24px',
    fontWeight: 800,
    margin: 0,
  },

  offerMeta: {
    color: 'rgba(255,255,255,0.72)',
    marginTop: '4px',
  },

  offerActions: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
    marginTop: '12px',
  },

  contactBox: {
    marginTop: '10px',
    borderTop: '1px dashed rgba(255,255,255,0.18)',
    paddingTop: '10px',
  },

  contactText: {
    color: 'rgba(255,255,255,0.82)',
    margin: '6px 0',
  },

  textArea: {
    width: '100%',
    minHeight: '70px',
    marginTop: '10px',
    padding: '12px',
    borderRadius: '12px',
    border: '1px solid rgba(255,255,255,0.18)',
    background: 'rgba(255,255,255,0.08)',
    color: '#ffffff',
    resize: 'vertical',
    boxSizing: 'border-box',
  },

  confirmedText: {
    color: '#31f7c6',
    marginTop: '10px',
    fontWeight: 800,
  },

  waitingOffer: {
    margin: 0,
    fontStyle: 'italic',
    color: 'rgba(255,255,255,0.65)',
  },
  pendingPaymentText: {
  color: '#ffd166',
  marginTop: '10px',
  fontWeight: 800,
},
comunasDropdown: {
  position: 'absolute',
  top: '100%',
  left: 0,
  right: 0,
  marginTop: '6px',
  background: '#0d1830',
  border: '1px solid rgba(255,255,255,0.15)',
  borderRadius: '12px',
  maxHeight: '220px',
  overflowY: 'auto',
  zIndex: 9999,
  boxShadow: '0 10px 30px rgba(0,0,0,0.35)',
},

comunaItem: {
  padding: '12px 14px',
  color: '#ffffff',
  cursor: 'pointer',
  borderBottom: '1px solid rgba(255,255,255,0.05)',
  textAlign: 'left',
},

comunaEmpty: {
  padding: '12px 14px',
  color: 'rgba(255,255,255,0.6)',
  textAlign: 'left',
},
};