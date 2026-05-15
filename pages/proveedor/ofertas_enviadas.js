// pages/proveedor/ofertas_enviadas.js
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabaseClient';

export default function OfertasEnviadas() {
  const router = useRouter();

  const [ofertas, setOfertas] = useState([]);
  const [paginaActual, setPaginaActual] = useState(1);
  const [busqueda, setBusqueda] = useState('');
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

      const authUserId = userData.user.id;

      const { data: perfilProv, error: perfilErr } = await supabase
        .from('perfiles')
        .select('id, tipo')
        .eq('auth_id', authUserId)
        .eq('tipo', 'proveedor')
        .maybeSingle();

      if (perfilErr || !perfilProv) {
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
    t ? t.toString().toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') : '';

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

  const getColorEstado = (estado) => {
    switch ((estado || '').toLowerCase()) {
      case 'pendiente':
        return { color: '#5dade2', fontWeight: 'bold' };
      case 'en_espera_confirmacion':
        return { color: '#f39c12', fontWeight: 'bold' };
      case 'confirmada':
        return { color: '#27ae60', fontWeight: 'bold' };
      case 'rechazada':
        return { color: '#7f8c8d', fontStyle: 'italic' };
      default:
        return {};
    }
  };

  const ofertasFiltradas = useMemo(() => {
    const busq = normalizarTexto(busqueda);
    if (!busq) return ofertas;

    return ofertas.filter((item) => {
      const campos = [
        item.producto,
        item.formato,
        item.marca,
        item.cantidad?.toString(),
        item.precio_objetivo?.toString(),
        item.precio_ofertado?.toString(),
        item.comuna,
        item.comprador_email,
        item.comprador_telefono,
        item.comprador_direccion,
        item.fecha_creacion,
        estadoTexto(item.estado),
      ];

      return campos.some((c) => normalizarTexto(c || '').includes(busq));
    });
  }, [ofertas, busqueda]);

  const totalPaginas = Math.ceil(ofertasFiltradas.length / itemsPorPagina);
  const inicio = (paginaActual - 1) * itemsPorPagina;
  const fin = inicio + itemsPorPagina;
  const ofertasPaginadas = ofertasFiltradas.slice(inicio, fin);

  return (
    <div style={{ padding: '20px' }}>
      <button onClick={volverAlPanel} style={{ marginBottom: '15px' }}>
        Volver al panel principal
      </button>

      <h2>Mis ofertas enviadas</h2>

      <div style={{ marginBottom: '10px' }}>
        <input
          type="text"
          placeholder="BUSCAR EN TODOS LOS CAMPOS"
          value={busqueda}
          onChange={(e) => {
            setBusqueda(e.target.value.toUpperCase());
            setPaginaActual(1);
          }}
          style={{ width: '320px', textTransform: 'uppercase' }}
        />
      </div>

      {ofertasFiltradas.length === 0 ? (
        <p>No has enviado ofertas todavía.</p>
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
                <th>Tu oferta</th>
                <th>Comuna</th>
                <th>Comprador</th>
                <th>Fecha</th>
                <th>Estado</th>
                <th>Contacto</th>
              </tr>
            </thead>
            <tbody>
              {ofertasPaginadas.map((item) => {
  const puedeVerContacto =
    item.estado === 'en_espera_confirmacion' ||
    item.estado === 'confirmada';

  return (
    <>
      <tr>
        <td>{item.producto}</td>
        <td>{item.formato}</td>
        <td>{item.marca}</td>
        <td>{item.cantidad}</td>
        <td>${formatearNumero(item.precio_objetivo)}</td>
        <td>${formatearNumero(item.precio_ofertado)}</td>
        <td>{item.comuna}</td>
        <td>{item.comprador_email}</td>
        <td>
          {item.fecha_creacion
            ? new Date(item.fecha_creacion).toLocaleString()
            : ''}
        </td>
        <td style={getColorEstado(item.estado)}>
          {estadoTexto(item.estado)}
        </td>
        <td>
          {puedeVerContacto ? (
            <button
              onClick={() =>
                setDetalleContactoId(
                  detalleContactoId === item.id ? null : item.id
                )
              }
            >
              {detalleContactoId === item.id
                ? 'Ocultar contacto'
                : 'Ver contacto'}
            </button>
          ) : (
            '—'
          )}
        </td>
      </tr>

      {puedeVerContacto && detalleContactoId === item.id && (
        <tr>
          <td
            colSpan={11}
            style={{
              textAlign: 'left',
              backgroundColor: '#f9f9f9',
              padding: '12px 16px',
              borderTop: '1px solid #ddd',
            }}
          >
            <strong>Datos de contacto del comprador</strong>
            <div style={{ marginTop: '8px', fontSize: '14px' }}>
              <p>
                <strong>Correo:</strong> {item.comprador_email || 'N/A'}
              </p>
              <p>
                <strong>Teléfono:</strong>{' '}
                {item.comprador_telefono || 'No disponible'}
              </p>
              <p>
                <strong>Dirección de despacho:</strong>{' '}
                {item.comprador_direccion || 'No disponible'}
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

          {ofertasPaginadas.map((item) => {
            const puedeVerContacto =
              item.estado === 'en_espera_confirmacion' ||
              item.estado === 'confirmada';

            if (!puedeVerContacto || detalleContactoId !== item.id) return null;

            return (
              <div
                key={`detalle-${item.id}`}
                style={{
                  marginTop: '12px',
                  border: '1px solid #ddd',
                  borderRadius: 8,
                  padding: '12px 16px',
                  background: '#f9f9f9',
                }}
              >
                <strong>Datos de contacto del comprador</strong>
                <div style={{ marginTop: '8px', fontSize: '14px' }}>
                  <p>
                    <strong>Correo:</strong> {item.comprador_email || 'N/A'}
                  </p>
                  <p>
                    <strong>Teléfono:</strong>{' '}
                    {item.comprador_telefono || 'No disponible'}
                  </p>
                  <p>
                    <strong>Dirección de despacho:</strong>{' '}
                    {item.comprador_direccion || 'No disponible'}
                  </p>
                  <p>
                    <strong>Precio aceptado:</strong>{' '}
                    ${formatearNumero(item.precio_ofertado)}
                  </p>
                </div>
              </div>
            );
          })}

          <div style={{ marginTop: '15px', textAlign: 'center' }}>
            <button
              onClick={() => setPaginaActual((p) => Math.max(p - 1, 1))}
              disabled={paginaActual === 1}
              style={{ marginRight: '10px' }}
            >
              Anterior
            </button>

            <span>
              Página {paginaActual} de {totalPaginas || 1}
            </span>

            <button
              onClick={() =>
                setPaginaActual((p) => Math.min(p + 1, totalPaginas || 1))
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