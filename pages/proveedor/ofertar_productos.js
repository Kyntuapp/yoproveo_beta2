import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useRouter } from 'next/router';

export default function OfertarProductos() {
  const [listas, setListas] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [proveedorPerfilId, setProveedorPerfilId] = useState(null);
  const [busqueda, setBusqueda] = useState('');
  const [paginaActual, setPaginaActual] = useState(1);
  const [detalleContactoId, setDetalleContactoId] = useState(null); // 👈 para desplegar datos
  const itemsPorPagina = 20;
  const router = useRouter();

  useEffect(() => {
    const cargarDatos = async () => {
      // 1) Usuario autenticado
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData?.user) {
        alert('Debes iniciar sesión.');
        router.push('/');
        return;
      }
      console.log('Auth user id:', userData?.user?.id);
      console.log('Auth user email:', userData?.user?.email);

      // 2) Buscar perfil proveedor
      const { data: perfilProv, error: perfilError } = await supabase
        .from('perfiles')
        .select('id, tipo')
        .eq('auth_id', userData.user.id)
        .eq('tipo', 'proveedor')
        .maybeSingle();

      if (perfilError || !perfilProv) {
        console.error('Perfiles encontrados:', perfilProv);
        alert('El usuario no tiene un perfil de proveedor asociado.');
        return;
      }

      setProveedorPerfilId(perfilProv.id);

      // 3) Traer listas de compras
      const { data: listasData, error: listasError } = await supabase
        .from('listas_compras')
        .select('*')
        .order('fecha_creacion', { ascending: false });

      // 4) Traer perfiles (emails de compradores)
      const { data: perfilesData, error: perfilesError } = await supabase
        .from('perfiles')
.select('*');

      // 5) Traer ofertas existentes del proveedor actual (incluyendo estado)
      const { data: ofertasData, error: ofertasError } = await supabase
        .from('ofertas_productos')
        .select('lista_id, proveedor_id, precio_ofertado, estado')
        .eq('proveedor_id', perfilProv.id);

      if (listasError || perfilesError || ofertasError) {
        console.error(listasError || perfilesError || ofertasError);
        alert('Error al cargar datos.');
        return;
      }

      setUsuarios(perfilesData || []);
console.log(
  'PERFILES_RESUMEN',
  (perfilesData || []).map((p) => ({
    id: p.id,
    email: p.email,
    auth_id: p.auth_id,
    tipo: p.tipo,
  }))
);
const compradoresPorAuth = Object.fromEntries(
  (perfilesData || [])
    .filter(
      (p) =>
        String(p.tipo || '').trim().toLowerCase() === 'comprador' &&
        p.auth_id
    )
    .map((p) => [String(p.auth_id).trim().toLowerCase(), p])
);
     const enriquecida = (listasData || []).map((item) => {
  const perfilComprador =
  compradoresPorAuth[String(item.usuario_id || '').trim().toLowerCase()] || null;
  const ofertaExistente = (ofertasData || []).find(
    (o) => o.lista_id === item.id
  );

  console.log('FILA_DEBUG', {
  lista_id: item.id,
  producto: item.producto,
  cantidad: item.cantidad,
  precio: item.precio,
  comuna: item.comuna_despacho,
  fecha: item.fecha_creacion,
  usuario_id: item.usuario_id,
  lookup_key: String(item.usuario_id || '').trim().toLowerCase(),
  compradores_keys: Object.keys(compradoresPorAuth),
  comprador_encontrado: perfilComprador?.email || null,
});

  return {
    ...item,
    comprador_email: item.comprador_email || perfilComprador?.email || 'Desconocido',
    oferta: ofertaExistente ? ofertaExistente.precio_ofertado : '',
    incluye_despacho: false,
    ya_oferto: !!ofertaExistente,
    estado_oferta: ofertaExistente ? ofertaExistente.estado : null,
  };
});

      setListas(enriquecida);
    };

    cargarDatos();
  }, [router]);

  // 👉 Utilidades
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

  const manejarDespacho = (index, valor) => {
    const actualizada = [...listas];
    actualizada[index].incluye_despacho = valor;
    setListas(actualizada);
  };

  // 👉 Enviar oferta
  const ofertarProducto = async (index) => {
  if (!proveedorPerfilId) {
    alert('No hay perfil de proveedor activo.');
    return;
  }

  const producto = listas[index];
  const ofertaLimpia = parseFloat((producto.oferta ?? '').toString().replace(/\./g, ''));

  if (isNaN(ofertaLimpia) || ofertaLimpia <= 0) {
    alert('Por favor ingresa un valor numérico válido en la oferta.');
    return;
  }

  if (producto.estado === 'cerrada' || calcularDiasRestantes(producto.fecha_cierre) === '0') {
    alert('La licitación está cerrada.');
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
    estado: 'pendiente',
  });

  if (error) {
    alert('Error al enviar oferta: ' + error.message);
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

    const actualizada = [...listas];
    actualizada[index].ya_oferto = true;
    actualizada[index].oferta = ofertaLimpia;
    actualizada[index].estado_oferta = 'pendiente';
    setListas(actualizada);
    alert('Oferta enviada correctamente.');
  }
};

  const volverAlPanel = () => router.push('/proveedor');

  const normalizarTexto = (t) =>
    t ? t.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') : '';

  const listasFiltradas = listas.filter((item) => {
    const busq = normalizarTexto(busqueda);
    if (!busq) return true;
    const campos = [
      item.producto,
      item.formato,
      item.marca,
      item.cantidad?.toString(),
      item.precio?.toString(),
      item.comuna_despacho,
      item.comprador_email,
      item.fecha_creacion,
    ];
    return campos.some((c) => normalizarTexto(c || '').includes(busq));
  });

  // 🔹 Paginación
  const totalPaginas = Math.ceil(listasFiltradas.length / itemsPorPagina);
  const inicio = (paginaActual - 1) * itemsPorPagina;
  const fin = inicio + itemsPorPagina;
  const listasPaginadas = listasFiltradas.slice(inicio, fin);

  const formatearNumero = (num) =>
    num === '' || num === null || num === undefined
      ? ''
      : new Intl.NumberFormat('es-CL').format(num);

  // 🔹 Estado mostrado en la tabla (combinando licitación + oferta)
  const obtenerEstado = (item) => {
    // estado de la licitación
    if (item.estado === 'cerrada') return 'Cerrada';

    // estado de la oferta para este proveedor
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
        // si ya ofertó y la oferta sigue pendiente
        if (item.ya_oferto) return 'Oferta enviada';
        break;
      default:
        if (item.ya_oferto) return 'Oferta enviada';
    }

    return 'Recibiendo ofertas';
  };

  const getColorEstado = (estadoTexto) => {
    switch (estadoTexto) {
      case 'Recibiendo ofertas':
        return { color: '#2ecc71', fontWeight: 'bold' }; // verde
      case 'Oferta enviada':
        return { color: '#5dade2', fontWeight: 'bold' }; // azul claro
      case 'En espera de confirmación':
        return { color: '#f39c12', fontWeight: 'bold' }; // naranjo
      case 'Confirmada':
        return { color: '#27ae60', fontWeight: 'bold' }; // verde fuerte
      case 'Rechazada':
        return { color: '#7f8c8d', fontStyle: 'italic' }; // gris
      case 'Cerrada':
        return { color: '#e74c3c', opacity: 0.8, fontWeight: 'bold' }; // rojo
      default:
        return {};
    }
  };

  const estadoTexto = (item) => obtenerEstado(item);

  return (
    <div style={{ padding: '20px' }}>
      <button onClick={volverAlPanel} style={{ marginBottom: '15px' }}>
        Volver al panel principal
      </button>

      <h2>Listas de compra activas</h2>

      <div style={{ marginBottom: '10px' }}>
        <input
          type="text"
          placeholder="BUSCAR EN TODOS LOS CAMPOS"
          value={busqueda}
          onChange={(e) => {
            setBusqueda(e.target.value.toUpperCase());
            setPaginaActual(1);
          }}
          style={{ width: '300px', textTransform: 'uppercase' }}
        />
      </div>

      {listasFiltradas.length === 0 ? (
        <p>No hay listas disponibles.</p>
      ) : (
        <>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              textAlign: 'center',
            }}
          >
            <thead>
              <tr>
                <th>Producto</th>
                <th>Formato</th>
                <th>Marca</th>
                <th>Cantidad</th>
                <th>Precio objetivo</th>
                <th>Comuna</th>
                <th>Comprador</th>
                <th>Fecha</th>
                <th>Días restantes</th>
                <th>Estado</th>
                <th>Oferta</th>
                <th>Incluye despacho</th>
                <th>Acción</th>
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
                      <td>{item.producto}</td>
                      <td>{item.formato}</td>
                      <td>{item.marca}</td>
                      <td>{item.cantidad}</td>
                      <td>${formatearNumero(item.precio)}</td>
                      <td>{item.comuna_despacho}</td>
                      <td>{item.comprador_email}</td>
                      <td>
                        {item.fecha_creacion
                          ? new Date(item.fecha_creacion).toLocaleString()
                          : ''}
                      </td>
                      <td>{calcularDiasRestantes(item.fecha_cierre)}</td>
                      <td style={getColorEstado(estado)}>{estado}</td>
                      <td>
                        {item.ya_oferto ? (
                          <span style={{ color: 'gray' }}>
                            ${formatearNumero(item.oferta)}
                          </span>
                        ) : item.estado !== 'cerrada' ? (
                          <input
                            type="text"
                            value={item.oferta}
                            onChange={(e) =>
                              manejarCambioOferta(inicio + index, e.target.value)
                            }
                            style={{ width: '80px', textAlign: 'right' }}
                          />
                        ) : (
                          <span style={{ color: 'gray' }}>
                            Licitación cerrada
                          </span>
                        )}
                      </td>
                      <td>
                        {!item.ya_oferto && item.estado !== 'cerrada' ? (
                          <input
                            type="checkbox"
                            checked={item.incluye_despacho}
                            onChange={(e) =>
                              manejarDespacho(
                                inicio + index,
                                e.target.checked
                              )
                            }
                          />
                        ) : (
                          '-'
                        )}
                      </td>
                      <td>
                        {esConfirmada ? (
                          <button
                            onClick={() =>
                              setDetalleContactoId(
                                detalleContactoId === item.id ? null : item.id
                              )
                            }
                          >
                            Ver datos de contacto
                          </button>
                        ) : puedeOfertar ? (
                          <button
                            onClick={() => ofertarProducto(inicio + index)}
                          >
                            Ofertar
                          </button>
                        ) : (
                          '---'
                        )}
                      </td>
                    </tr>

                    {esConfirmada && detalleContactoId === item.id && (
                      <tr>
                        <td
                          colSpan={13}
                          style={{
                            textAlign: 'left',
                            backgroundColor: '#f9f9f9',
                            padding: '10px 15px',
                          }}
                        >
                          <strong>Datos de contacto del comprador</strong>
                          <div style={{ marginTop: '8px', fontSize: '14px' }}>
                            <p>
                              <strong>Correo:</strong>{' '}
                              {item.comprador_email}
                            </p>
                            <p>
                              <strong>Precio aceptado:</strong>{' '}
                              ${formatearNumero(item.oferta)}
                            </p>
                            <p>
                              <strong>Dirección de despacho (comuna):</strong>{' '}
                              {item.comuna_despacho}
                            </p>
                            {/* Cuando tengas teléfono y dirección exacta en BD,
                                puedes agregarlos aquí usando esos campos */}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>

          <div style={{ marginTop: '15px', textAlign: 'center' }}>
            <button
              onClick={() => setPaginaActual((p) => Math.max(p - 1, 1))}
              disabled={paginaActual === 1}
              style={{ marginRight: '10px' }}
            >
              Anterior
            </button>

            <span>
              {' '}
              Página {paginaActual} de {totalPaginas || 1}{' '}
            </span>

            <button
              onClick={() =>
                setPaginaActual((p) => Math.min(p + 1, totalPaginas))
              }
              disabled={paginaActual === totalPaginas || totalPaginas === 0}
              style={{ marginLeft: '10px' }}
            >
              Siguiente
            </button>
          </div>
        </>
      )}
    </div>
  );
}
