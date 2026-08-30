import { showKyntuAlert } from '../../lib/kyntuAlert';
// pages/proveedor/ofertas_enviadas.js
import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabaseClient';
import { resolveProveedorProfile } from '../../lib/resolveProveedorProfile';
import AppLayout from '../../components/Layout/AppLayout';
import Notificaciones from '../../components/Notificaciones';
import SoporteLauncher from '../../components/soporte/SoporteLauncher';
import OfertaConversacionContenedor from '../../components/OfertaConversacionContenedor';
import CompradorContacto from '../../components/CompradorContacto';
import {
  chatSoloLecturaPorAdjudicacion,
  esOfertaAdjudicada,
  MENSAJE_CHAT_CERRADO_ADJUDICACION,
  textoEstadoOfertaProveedor,
  contarMensajesNoLeidos,
  contarMensajesNoLeidosConversacion,
  fetchConteosNoLeidosPorOfertas,
  subscribeMensajesConversacion,
  subscribeMensajesOferta,
} from '../../lib/ofertaMensajes';

function formatearFechaCorta(fecha) {
  if (!fecha) return '—';

  const d = new Date(fecha);
  if (Number.isNaN(d.getTime())) return '—';

  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();

  return `${dd}-${mm}-${yyyy}`;
}

/** Timestamp de envío/creación de la oferta (`ofertas_productos.fecha`). */
function timestampFechaOferta(oferta) {
  if (!oferta?.fecha) return null;
  const t = new Date(oferta.fecha).getTime();
  return Number.isFinite(t) ? t : null;
}

/** Más reciente → más antigua; sin fecha válida al final. */
function compararOfertasPorFechaDesc(a, b) {
  const ta = timestampFechaOferta(a);
  const tb = timestampFechaOferta(b);
  if (ta != null && tb != null) return tb - ta;
  if (ta != null) return -1;
  if (tb != null) return 1;
  return 0;
}

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
  const [conversacionAbiertaId, setConversacionAbiertaId] = useState(null);
  const [ofertaDestacadaId, setOfertaDestacadaId] = useState(null);
  const [authUserId, setAuthUserId] = useState(null);
  const [perfilId, setPerfilId] = useState(null);
  const [noLeidosPorOferta, setNoLeidosPorOferta] = useState({});
  const [deepLinkError, setDeepLinkError] = useState('');
  const [deepLinkPendienteId, setDeepLinkPendienteId] = useState(null);

  const scrolledToOfertaRef = useRef(null);
  const conversacionPorOfertaRef = useRef({});
  const itemsPorPagina = 20;

  useEffect(() => {
    const cargarOfertas = async () => {
      const { data: userData, error: userError } =
        await supabase.auth.getUser();

      if (userError || !userData?.user) {
        showKyntuAlert('Debes iniciar sesión.');
        router.push('/');
        return;
      }

      const { perfil: perfilProv } = await resolveProveedorProfile(
        userData.user,
        {
          select: 'id, tipo',
        }
      );

      if (!perfilProv) {
        showKyntuAlert('No se encontró perfil proveedor.');
        router.push('/proveedor');
        return;
      }

      const proveedorPerfilId = perfilProv.id;

      setAuthUserId(userData.user.id);
      setPerfilId(proveedorPerfilId);

      const { data: ofertasData, error: ofertasError } = await supabase
        .from('ofertas_productos')
        .select('*')
        .eq('proveedor_id', proveedorPerfilId)
        .order('fecha', { ascending: false, nullsFirst: false });

      if (ofertasError) {
        showKyntuAlert('Error al cargar ofertas: ' + ofertasError.message);
        return;
      }

      const listaIds = Array.from(
        new Set(
          (ofertasData || [])
            .map((oferta) => oferta.lista_id)
            .filter(Boolean)
        )
      );

      const mapLista = {};

      if (listaIds.length) {
        const { data: listasRows, error: listasErr } = await supabase
          .from('listas_compras')
          .select(
            'id, usuario_id, producto, formato, marca, cantidad, precio, comuna_despacho, fecha_creacion'
          )
          .in('id', listaIds);

        if (listasErr) {
          console.error(
            'Error cargando listas_compras:',
            listasErr
          );
        }

        (listasRows || []).forEach((lista) => {
          mapLista[lista.id] = {
            id: lista.id,
            usuario_id: (lista.usuario_id || '')
              .toString()
              .trim(),
            producto: lista.producto || '',
            formato: lista.formato || '',
            marca: lista.marca || '',
            cantidad: lista.cantidad || '',
            precio: lista.precio || '',
            comuna_despacho: (
              lista.comuna_despacho || ''
            )
              .toString()
              .trim(),
            fecha_creacion: lista.fecha_creacion || null,
          };
        });
      }

      const adjudicadasPorLista = {};

      (ofertasData || []).forEach((oferta) => {
        if (esOfertaAdjudicada(oferta.estado) && oferta.lista_id) {
          adjudicadasPorLista[String(oferta.lista_id)] = true;
        }
      });

      const enriquecidas = (ofertasData || [])
        .map((oferta) => {
          const lista = mapLista[oferta.lista_id] || {};
          const solicitudAdjudicada = Boolean(
            adjudicadasPorLista[String(oferta.lista_id)]
          );

          return {
            ...oferta,
            producto: oferta.producto || lista.producto || '',
            formato: oferta.formato || lista.formato || '',
            marca: oferta.marca || lista.marca || '',
            cantidad: lista.cantidad || '',
            precio_objetivo: lista.precio || '',
            comprador_auth_id: (
              lista.usuario_id || ''
            )
              .toString()
              .trim(),
            comuna: lista.comuna_despacho || '—',
            fecha_creacion: lista.fecha_creacion || null,
            solicitud_adjudicada: solicitudAdjudicada,
            chat_solo_lectura: chatSoloLecturaPorAdjudicacion({
              estado: oferta.estado,
              solicitud_adjudicada: solicitudAdjudicada,
            }),
          };
        })
        .sort(compararOfertasPorFechaDesc);

      setOfertas(enriquecidas);
    };

    cargarOfertas();
  }, [router]);

  useEffect(() => {
    if (!router.isReady) return;
    if (router.query?.notif !== 'chat') return;

    const ofertaIdParam = Array.isArray(
      router.query.oferta_id
    )
      ? router.query.oferta_id[0]
      : router.query.oferta_id;

    if (!ofertaIdParam) return;

    setDeepLinkPendienteId(String(ofertaIdParam));
    setOfertaDestacadaId(String(ofertaIdParam));
  }, [router.isReady, router.query]);

  useEffect(() => {
    if (!deepLinkPendienteId || ofertas.length === 0) {
      return;
    }

    const indice = ofertas.findIndex(
      (oferta) =>
        String(oferta.id) === String(deepLinkPendienteId)
    );

    if (indice === -1) {
      setDeepLinkError(
        'No se pudo abrir la conversación solicitada. La oferta no está disponible o no tienes acceso.'
      );

      setDeepLinkPendienteId(null);
      setConversacionAbiertaId(null);
      return;
    }

    setPaginaActual(
      Math.floor(indice / itemsPorPagina) + 1
    );

    setConversacionAbiertaId(
      String(deepLinkPendienteId)
    );

    setDeepLinkPendienteId(null);
  }, [deepLinkPendienteId, ofertas, itemsPorPagina]);

  useEffect(() => {
    if (!router.isReady) return;
    if (router.query?.notif !== 'chat') return;
    if (!conversacionAbiertaId) return;

    if (
      scrolledToOfertaRef.current ===
      conversacionAbiertaId
    ) {
      return;
    }

    const timer = setTimeout(() => {
      const elemento = document.getElementById(
        `oferta-card-proveedor-${conversacionAbiertaId}`
      );

      if (elemento) {
        elemento.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });

        scrolledToOfertaRef.current =
          conversacionAbiertaId;
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [
    router.isReady,
    router.query,
    conversacionAbiertaId,
    ofertas,
  ]);

  const normalizarTexto = (texto) =>
    texto
      ? texto
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

  const limpiarFiltros = () => {
    setFiltros({
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

    setPaginaActual(1);
  };

  const formatearNumero = (numero) =>
    numero === '' ||
    numero === null ||
    numero === undefined
      ? ''
      : new Intl.NumberFormat('es-CL').format(numero);

  const estadoTexto = (estado, solicitudAdjudicada = false) =>
    textoEstadoOfertaProveedor(estado, solicitudAdjudicada);

  const getEstadoStyle = (estado) => {
    switch ((estado || '').toLowerCase()) {
      case 'pendiente':
        return {
          ...styles.estadoBase,
          ...styles.estadoAzul,
        };

      case 'en_espera_confirmacion':
        return {
          ...styles.estadoBase,
          ...styles.estadoNaranja,
        };

      case 'confirmada':
        return {
          ...styles.estadoBase,
          ...styles.estadoConfirmada,
        };

      case 'rechazada':
        return {
          ...styles.estadoBase,
          ...styles.estadoGris,
        };

      default:
        return {
          ...styles.estadoBase,
          ...styles.estadoDefault,
        };
    }
  };

  const ofertasFiltradas = useMemo(() => {
    return ofertas
      .filter((item) => {
        const valores = {
          producto: item.producto,
          formato: item.formato,
          marca: item.marca,
          cantidad: item.cantidad?.toString(),
          precioObjetivo:
            item.precio_objetivo?.toString(),
          oferta: item.precio_ofertado?.toString(),
          comuna: item.comuna,
          comprador: esOfertaAdjudicada(item.estado)
            ? 'CONTACTO DISPONIBLE'
            : 'CONTRAPARTE',
          estado: estadoTexto(item.estado, item.solicitud_adjudicada),
        };

        return Object.entries(filtros).every(
          ([campo, valor]) => {
            if (!valor) return true;

            return normalizarTexto(
              valores[campo] || ''
            ).includes(normalizarTexto(valor));
          }
        );
      })
      .sort(compararOfertasPorFechaDesc);
  }, [ofertas, filtros]);

  const totalPaginas = Math.ceil(
    ofertasFiltradas.length / itemsPorPagina
  );

  const inicio =
    (paginaActual - 1) * itemsPorPagina;

  const fin = inicio + itemsPorPagina;

  const ofertasPaginadas = useMemo(
    () => ofertasFiltradas.slice(inicio, fin),
    [ofertasFiltradas, inicio, fin]
  );

  const handleLeidosActualizados = useCallback(
    (ofertaId) => {
      setNoLeidosPorOferta((prev) => {
        if (prev[ofertaId] === 0) return prev;

        return {
          ...prev,
          [ofertaId]: 0,
        };
      });
    },
    []
  );

  useEffect(() => {
    if (
      !authUserId ||
      ofertasPaginadas.length === 0
    ) {
      return undefined;
    }

    let activo = true;
    const cleanups = [];

    const ofertasVisibles = ofertasPaginadas.filter(
      (oferta) =>
        String(oferta.id) !==
        String(conversacionAbiertaId)
    );

    const actualizarOfertas = (ofertaIds, cantidad) => {
      setNoLeidosPorOferta((prev) => {
        let cambio = false;
        const siguiente = { ...prev };

        for (const ofertaId of ofertaIds) {
          if (prev[ofertaId] !== cantidad) {
            siguiente[ofertaId] = cantidad;
            cambio = true;
          }
        }

        return cambio ? siguiente : prev;
      });
    };

    (async () => {
      const { conteos, conversacionPorOferta } =
        await fetchConteosNoLeidosPorOfertas(
          ofertasVisibles,
          authUserId
        );

      if (!activo) return;

      conversacionPorOfertaRef.current = {
        ...conversacionPorOfertaRef.current,
        ...conversacionPorOferta,
      };

      setNoLeidosPorOferta((prev) => {
        const siguiente = { ...prev };
        let cambio = false;

        for (const oferta of ofertasPaginadas) {
          const cantidad =
            String(oferta.id) ===
            String(conversacionAbiertaId)
              ? 0
              : conteos[oferta.id] ?? prev[oferta.id] ?? 0;

          if (prev[oferta.id] !== cantidad) {
            siguiente[oferta.id] = cantidad;
            cambio = true;
          }
        }

        return cambio ? siguiente : prev;
      });

      const conversacionAOfertas = new Map();
      const ofertasLegacy = [];

      ofertasVisibles.forEach((oferta) => {
        const conversacionId =
          conversacionPorOferta[oferta.id];

        if (conversacionId) {
          const actuales =
            conversacionAOfertas.get(conversacionId) || [];
          actuales.push(oferta.id);
          conversacionAOfertas.set(conversacionId, actuales);
        } else {
          ofertasLegacy.push(oferta.id);
        }
      });

      if (!activo) return;

      conversacionAOfertas.forEach((ofertaIds, conversacionId) => {
        cleanups.push(
          subscribeMensajesConversacion(
            conversacionId,
            () => {
              contarMensajesNoLeidosConversacion(
                conversacionId
              ).then((cantidad) => {
                if (!activo) return;
                actualizarOfertas(ofertaIds, cantidad);
              });
            }
          )
        );
      });

      ofertasLegacy.forEach((ofertaId) => {
        cleanups.push(
          subscribeMensajesOferta(ofertaId, () => {
            contarMensajesNoLeidos(
              ofertaId,
              authUserId
            ).then((cantidad) => {
              if (!activo) return;
              actualizarOfertas([ofertaId], cantidad);
            });
          })
        );
      });

      if (!activo) {
        cleanups.forEach((limpiar) => limpiar());
      }
    })();

    return () => {
      activo = false;
      cleanups.forEach((limpiar) => limpiar());
    };
  }, [
    authUserId,
    ofertasPaginadas,
    conversacionAbiertaId,
  ]);

  const toggleConversacion = (ofertaId) => {
    setConversacionAbiertaId((prev) =>
      prev === String(ofertaId)
        ? null
        : String(ofertaId)
    );
  };

  const irDashboard = () => {
    router.push('/proveedor/DashboardProveedor');
  };

  const irDatosContacto = () => {
    router.push('/proveedor/datos-contacto');
  };

  const cambiarPerfil = () => {
    router.push('/seleccionar-perfil');
  };

  const cerrarSesion = async () => {
    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error(
        'Error al cerrar sesión:',
        error
      );

      showKyntuAlert('No se pudo cerrar la sesión.');
      return;
    }

    localStorage.clear();
    router.push('/login');
  };

  return (
    <AppLayout
      title="Mis ofertas enviadas"
      profileLabel="Proveedor"
      showProfileSwitch
      onChangeProfile={cambiarPerfil}
      onUpdateData={irDatosContacto}
      onDashboard={irDashboard}
      onLogout={cerrarSesion}
      notifications={
        perfilId ? (
          <Notificaciones
            userId={perfilId}
            rol="proveedor"
          />
        ) : null
      }
      support={
        perfilId ? (
          <SoporteLauncher perfilId={perfilId} rol="proveedor" />
        ) : null
      }
    >
      <main
        className="kyntu-main"
        style={styles.main}
      >
        <section
          className="kyntu-headerSection"
          style={styles.headerSection}
        >
          <div>
            <h1 style={styles.heading}>
              Mis ofertas enviadas
            </h1>

            <p style={styles.subtitle}>
              Revisa el estado de tus ofertas,
              conversa con los compradores y accede a
              sus datos cuando una oferta sea
              adjudicada.
            </p>
          </div>

          <div style={styles.summaryBadge}>
            <span style={styles.summaryNumber}>
              {ofertasFiltradas.length}
            </span>

            <span style={styles.summaryLabel}>
              {ofertasFiltradas.length === 1
                ? 'oferta'
                : 'ofertas'}
            </span>
          </div>
        </section>

        {deepLinkError && (
          <div style={styles.deepLinkError}>
            {deepLinkError}
          </div>
        )}

        <section
          className="kyntu-filterCard"
          style={styles.filterCard}
        >
          <div style={styles.filterHeader}>
            <div>
              <h2 style={styles.filterTitle}>
                Buscar ofertas
              </h2>

              <p style={styles.filterSubtitle}>
                Puedes combinar varios filtros para
                encontrar una oferta específica.
              </p>
            </div>

            <button
              type="button"
              onClick={limpiarFiltros}
              style={styles.clearFiltersButton}
            >
              Limpiar filtros
            </button>
          </div>

          <div
            className="kyntu-filterGrid"
            style={styles.filtersGrid}
          >
            <div style={styles.filterGroup}>
              <label style={styles.filterLabel}>
                Producto
              </label>

              <input
                value={filtros.producto}
                onChange={(event) =>
                  manejarCambioFiltro(
                    'producto',
                    event.target.value
                  )
                }
                style={styles.filterInput}
                placeholder="Buscar producto"
              />
            </div>

            <div style={styles.filterGroup}>
              <label style={styles.filterLabel}>
                Formato
              </label>

              <input
                value={filtros.formato}
                onChange={(event) =>
                  manejarCambioFiltro(
                    'formato',
                    event.target.value
                  )
                }
                style={styles.filterInput}
                placeholder="Buscar formato"
              />
            </div>

            <div style={styles.filterGroup}>
              <label style={styles.filterLabel}>
                Marca
              </label>

              <input
                value={filtros.marca}
                onChange={(event) =>
                  manejarCambioFiltro(
                    'marca',
                    event.target.value
                  )
                }
                style={styles.filterInput}
                placeholder="Buscar marca"
              />
            </div>

            <div style={styles.filterGroup}>
              <label style={styles.filterLabel}>
                Cantidad
              </label>

              <input
                value={filtros.cantidad}
                onChange={(event) =>
                  manejarCambioFiltro(
                    'cantidad',
                    event.target.value
                  )
                }
                style={styles.filterInput}
                placeholder="Buscar cantidad"
              />
            </div>

            <div style={styles.filterGroup}>
              <label style={styles.filterLabel}>
                Precio objetivo
              </label>

              <input
                value={filtros.precioObjetivo}
                onChange={(event) =>
                  manejarCambioFiltro(
                    'precioObjetivo',
                    event.target.value
                  )
                }
                style={styles.filterInput}
                placeholder="Buscar precio"
              />
            </div>

            <div style={styles.filterGroup}>
              <label style={styles.filterLabel}>
                Tu oferta
              </label>

              <input
                value={filtros.oferta}
                onChange={(event) =>
                  manejarCambioFiltro(
                    'oferta',
                    event.target.value
                  )
                }
                style={styles.filterInput}
                placeholder="Buscar oferta"
              />
            </div>

            <div style={styles.filterGroup}>
              <label style={styles.filterLabel}>
                Comuna
              </label>

              <input
                value={filtros.comuna}
                onChange={(event) =>
                  manejarCambioFiltro(
                    'comuna',
                    event.target.value
                  )
                }
                style={styles.filterInput}
                placeholder="Buscar comuna"
              />
            </div>

            <div style={styles.filterGroup}>
              <label style={styles.filterLabel}>
                Comprador
              </label>

              <input
                value={filtros.comprador}
                onChange={(event) =>
                  manejarCambioFiltro(
                    'comprador',
                    event.target.value
                  )
                }
                style={styles.filterInput}
                placeholder="Buscar comprador"
              />
            </div>

            <div style={styles.filterGroup}>
              <label style={styles.filterLabel}>
                Estado
              </label>

              <input
                value={filtros.estado}
                onChange={(event) =>
                  manejarCambioFiltro(
                    'estado',
                    event.target.value
                  )
                }
                style={styles.filterInput}
                placeholder="Buscar estado"
              />
            </div>
          </div>
        </section>

        {ofertasFiltradas.length === 0 ? (
          <section style={styles.emptyCard}>
            <div style={styles.emptyIcon}>✓</div>

            <h2 style={styles.emptyTitle}>
              No hay ofertas para mostrar
            </h2>

            <p style={styles.emptyText}>
              No has enviado ofertas todavía o no
              existen resultados para los filtros
              seleccionados.
            </p>
          </section>
        ) : (
          <>
            <section
              className="kyntu-tableWrapper"
              style={styles.tableWrapper}
            >
              <table className="mobile-card-table" style={styles.table}>
                <colgroup>
                  <col style={{ width: '12%' }} />
                  <col style={{ width: '7%' }} />
                  <col style={{ width: '7%' }} />
                  <col style={{ width: '6%' }} />
                  <col style={{ width: '8%' }} />
                  <col style={{ width: '7%' }} />
                  <col style={{ width: '8%' }} />
                  <col style={{ width: '8%' }} />
                  <col style={{ width: '8%' }} />
                  <col style={{ width: '9%' }} />
                  <col style={{ width: '10%' }} />
                  <col style={{ width: '10%' }} />
                </colgroup>
                <thead>
                  <tr>
                    <th style={styles.th}>
                      Producto
                    </th>

                    <th style={styles.th}>
                      Formato
                    </th>

                    <th style={styles.th}>Marca</th>

                    <th style={styles.th}>
                      Cantidad
                    </th>

                    <th style={styles.th}>
                      Precio objetivo
                    </th>

                    <th style={styles.th}>
                      Tu oferta
                    </th>

                    <th style={styles.th}>
                      Comuna
                    </th>

                    <th style={styles.th}>
                      Comprador
                    </th>

                    <th style={styles.th}>Fecha</th>

                    <th style={styles.th}>
                      Estado
                    </th>

                    <th style={styles.th}>
                      Conversación
                    </th>

                    <th style={styles.th}>
                      Contacto
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {ofertasPaginadas.map((item) => {
                    const adjudicada =
                      esOfertaAdjudicada(item.estado);

                    const puedeVerContacto =
                      adjudicada;

                    const noLeidos =
                      noLeidosPorOferta[item.id] || 0;

                    const conversacionAbierta =
                      conversacionAbiertaId ===
                      String(item.id);

                    const cardDestacada =
                      ofertaDestacadaId &&
                      String(ofertaDestacadaId) ===
                        String(item.id);

                    return (
                      <Fragment key={item.id}>
                        <tr style={styles.tableRow}>
                          <td data-label="Producto" data-primary="true"
                            style={{
                              ...styles.td,
                              ...styles.productCell,
                            }}
                          >
                            <strong
                              style={
                                styles.productName
                              }
                            >
                              {item.producto || '—'}
                            </strong>
                          </td>

                          <td data-label="Formato" className="mobile-hide" style={styles.td}>
                            {item.formato || '—'}
                          </td>

                          <td data-label="Marca" className="mobile-hide" style={styles.td}>
                            {item.marca || '—'}
                          </td>

                          <td data-label="Cantidad" style={styles.td}>
                            {item.cantidad || '—'}
                          </td>

                          <td data-label="Precio objetivo" className="mobile-hide" style={styles.td}>
                            $
                            {formatearNumero(
                              item.precio_objetivo
                            )}
                          </td>

                          <td data-label="Tu oferta" style={styles.td}>
                            <span
                              style={
                                styles.offerPrice
                              }
                            >
                              $
                              {formatearNumero(
                                item.precio_ofertado
                              )}
                            </span>
                          </td>

                          <td data-label="Comuna" className="mobile-hide" style={styles.td}>
                            {item.comuna || '—'}
                          </td>

                          <td data-label="Comprador" style={styles.td}>
                            {adjudicada
                              ? 'Contacto disponible'
                              : 'Contraparte'}
                          </td>

                          <td data-label="Fecha" className="mobile-hide" style={styles.td}>
                            {formatearFechaCorta(item.fecha_creacion)}
                          </td>

                          <td data-label="Estado" style={styles.td}>
                            <span
                              style={getEstadoStyle(
                                item.estado
                              )}
                            >
                              {estadoTexto(
                                item.estado,
                                item.solicitud_adjudicada
                              )}
                            </span>
                          </td>

                          <td data-label="Conversación" style={styles.conversacionCell}>
                            <button
                              type="button"
                              aria-expanded={conversacionAbierta}
                              onClick={() =>
                                toggleConversacion(item.id)
                              }
                              style={styles.chatToggleButton}
                            >
                              {conversacionAbierta
                                ? 'Ocultar'
                                : 'Ver conversación'}
                              {noLeidos > 0 &&
                                !conversacionAbierta && (
                                  <span style={styles.chatBadge}>
                                    {noLeidos > 9 ? '9+' : noLeidos}
                                  </span>
                                )}
                            </button>
                          </td>

                          <td data-label="Contacto" className="mobile-hide" style={styles.td}>
                            {puedeVerContacto ? (
                              <button
                                type="button"
                                onClick={() =>
                                  setDetalleContactoId(
                                    detalleContactoId ===
                                      item.id
                                      ? null
                                      : item.id
                                  )
                                }
                                style={
                                  styles.smallButton
                                }
                              >
                                {detalleContactoId ===
                                item.id
                                  ? 'Ocultar'
                                  : 'Ver contacto'}
                              </button>
                            ) : (
                              <span
                                style={
                                  styles.emptyAction
                                }
                              >
                                —
                              </span>
                            )}
                          </td>
                        </tr>

                        {conversacionAbierta && (
                          <tr>
                            <td
                              colSpan={12}
                              style={
                                styles.conversacionBox
                              }
                            >
                              <div
                                id={`oferta-card-proveedor-${item.id}`}
                                style={{
                                  ...styles.offerCardEmbedded,
                                  ...(cardDestacada
                                    ? styles.offerCardEmbeddedDestacada
                                    : {}),
                                }}
                              >
                                <div
                                  style={
                                    styles.embeddedHeader
                                  }
                                >
                                  <div>
                                    <span
                                      style={
                                        styles.embeddedLabel
                                      }
                                    >
                                      Tu oferta
                                    </span>

                                    <p
                                      style={
                                        styles.embeddedPrice
                                      }
                                    >
                                      $
                                      {formatearNumero(
                                        item.precio_ofertado
                                      )}
                                    </p>
                                  </div>

                                  <span
                                    style={getEstadoStyle(
                                      item.estado
                                    )}
                                  >
                                    {estadoTexto(
                                      item.estado,
                                      item.solicitud_adjudicada
                                    )}
                                  </span>
                                </div>

                                <p
                                  style={
                                    styles.embeddedMeta
                                  }
                                >
                                  {item.producto} ·{' '}
                                  {item.formato} ·{' '}
                                  {item.marca}
                                </p>

                                {authUserId && (
                                  <OfertaConversacionContenedor
                                    ofertaId={item.id}
                                    authUserId={authUserId}
                                    estadoOferta={item.estado}
                                    soloLectura={item.chat_solo_lectura}
                                    mensajeCierre={
                                      item.chat_solo_lectura
                                        ? MENSAJE_CHAT_CERRADO_ADJUDICACION
                                        : ''
                                    }
                                    ocultarBarra
                                    chatAbierto
                                    participanteLabel="Comprador"
                                    variant="dark"
                                    onLeidosActualizados={() =>
                                      handleLeidosActualizados(item.id)
                                    }
                                  />
                                )}
                              </div>
                            </td>
                          </tr>
                        )}

                        {puedeVerContacto &&
                          detalleContactoId ===
                            item.id && (
                            <tr>
                              <td
                                colSpan={12}
                                style={
                                  styles.contactTableCell
                                }
                              >
                                <div
                                  style={
                                    styles.contactBox
                                  }
                                >
                                  <h3
                                    style={
                                      styles.contactTitle
                                    }
                                  >
                                    Datos de contacto del
                                    comprador
                                  </h3>

                                  <CompradorContacto
                                    usuarioAuthId={
                                      item.comprador_auth_id
                                    }
                                    listaCompraId={
                                      item.lista_id
                                    }
                                    comunaDespacho={
                                      item.comuna
                                    }
                                    styles={styles}
                                  />

                                  <p
                                    style={
                                      styles.contactText
                                    }
                                  >
                                    <strong>
                                      Precio aceptado:
                                    </strong>{' '}
                                    $
                                    {formatearNumero(
                                      item.precio_ofertado
                                    )}
                                  </p>
                                </div>
                              </td>
                            </tr>
                          )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </section>

            <div style={styles.pagination}>
              <button
                type="button"
                onClick={() =>
                  setPaginaActual((pagina) =>
                    Math.max(pagina - 1, 1)
                  )
                }
                disabled={paginaActual === 1}
                style={{
                  ...styles.pageButton,
                  ...(paginaActual === 1
                    ? styles.pageButtonDisabled
                    : {}),
                }}
              >
                Anterior
              </button>

              <span style={styles.pageText}>
                Página {paginaActual} de{' '}
                {totalPaginas || 1}
              </span>

              <button
                type="button"
                onClick={() =>
                  setPaginaActual((pagina) =>
                    Math.min(
                      pagina + 1,
                      totalPaginas || 1
                    )
                  )
                }
                disabled={
                  paginaActual === totalPaginas ||
                  totalPaginas === 0
                }
                style={{
                  ...styles.pageButton,
                  ...(paginaActual === totalPaginas ||
                  totalPaginas === 0
                    ? styles.pageButtonDisabled
                    : {}),
                }}
              >
                Siguiente
              </button>
            </div>
          </>
        )}
      </main>

      <style jsx>{`
        @media (max-width: 1100px) {
          .kyntu-filterGrid {
            grid-template-columns: repeat(
              3,
              minmax(150px, 1fr)
            ) !important;
          }
        }

        @media (max-width: 1280px) {
          .kyntu-tableWrapper {
            overflow-x: auto !important;
            -webkit-overflow-scrolling: touch;
          }
        }

        @media (max-width: 820px) {
          .kyntu-main {
            padding: 22px 14px 38px !important;
          }

          .kyntu-headerSection {
            align-items: flex-start !important;
            flex-direction: column !important;
          }

          .kyntu-filterGrid {
            grid-template-columns: repeat(
              2,
              minmax(130px, 1fr)
            ) !important;
          }

          .kyntu-tableWrapper {
            border-radius: 14px !important;
          }
        }

        @media (max-width: 620px) {
          .kyntu-filterGrid {
            grid-template-columns: 1fr !important;
          }
        }

        @media (max-width: 375px) {
          .kyntu-main {
            padding: 18px 10px 32px !important;
          }

          .kyntu-filterCard {
            padding: 14px !important;
          }
        }
      `}</style>
    </AppLayout>
  );
}

const styles = {
  main: {
    width: '100%',
    maxWidth: '1500px',
    margin: '0 auto',
    padding: '32px 24px 48px',
    boxSizing: 'border-box',
  },

  headerSection: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '24px',
    marginBottom: '24px',
    padding: '26px 28px',
    borderRadius: '22px',
    background:
      'linear-gradient(135deg, rgba(255,255,255,0.98), rgba(244,249,255,0.98))',
    border: '1px solid #dce7f4',
    boxShadow:
      '0 18px 45px rgba(32, 73, 130, 0.08)',
  },

  heading: {
    margin: 0,
    color: '#071c41',
    fontSize: 'clamp(25px, 3vw, 34px)',
    lineHeight: 1.15,
    fontWeight: 900,
    letterSpacing: '-0.035em',
  },

  subtitle: {
    maxWidth: '700px',
    margin: '8px 0 0',
    color: '#65758b',
    fontSize: '14px',
    lineHeight: 1.6,
  },

  summaryBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '9px',
    flexShrink: 0,
    minHeight: '48px',
    padding: '9px 15px',
    borderRadius: '14px',
    border: '1px solid #cddfff',
    background: '#f2f7ff',
  },

  summaryNumber: {
    color: '#176bff',
    fontSize: '22px',
    fontWeight: 900,
  },

  summaryLabel: {
    color: '#47627f',
    fontSize: '12px',
    fontWeight: 800,
  },

  deepLinkError: {
    marginBottom: '20px',
    padding: '14px 17px',
    borderRadius: '13px',
    border: '1px solid #f1d189',
    background: '#fff8e8',
    color: '#835f16',
    fontSize: '13px',
    lineHeight: 1.5,
    fontWeight: 700,
  },

  filterCard: {
    marginBottom: '24px',
    padding: '22px',
    borderRadius: '20px',
    background: '#ffffff',
    border: '1px solid #dfe8f3',
    boxShadow:
      '0 14px 38px rgba(32, 73, 130, 0.07)',
  },

  filterHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: '18px',
    marginBottom: '18px',
  },

  filterTitle: {
    margin: 0,
    color: '#071c41',
    fontSize: '19px',
    lineHeight: 1.25,
    fontWeight: 900,
  },

  filterSubtitle: {
    margin: '5px 0 0',
    color: '#748399',
    fontSize: '13px',
    lineHeight: 1.5,
  },

  clearFiltersButton: {
    minHeight: '38px',
    padding: '8px 14px',
    flexShrink: 0,
    borderRadius: '10px',
    border: '1px solid #cfdbea',
    background: '#f8fbff',
    color: '#315173',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: 800,
  },

  filtersGrid: {
    width: '100%',
    display: 'grid',
    gridTemplateColumns:
      'repeat(4, minmax(150px, 1fr))',
    gap: '12px',
  },

  filterGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    minWidth: 0,
  },

  filterLabel: {
    color: '#4e6178',
    fontSize: '11px',
    fontWeight: 900,
  },

  filterInput: {
    width: '100%',
    minWidth: 0,
    minHeight: '43px',
    padding: '10px 12px',
    boxSizing: 'border-box',
    borderRadius: '11px',
    border: '1px solid #ccd9e8',
    background: '#fbfdff',
    color: '#183354',
    outline: 'none',
    fontSize: '12px',
    textTransform: 'uppercase',
  },

  tableWrapper: {
    width: '100%',
    maxWidth: '100%',
    overflowX: 'auto',
    marginBottom: '24px',
    borderRadius: '18px',
    border: '1px solid #dfe8f3',
    background: '#ffffff',
    boxShadow:
      '0 16px 42px rgba(32, 73, 130, 0.07)',
    boxSizing: 'border-box',
  },

  table: {
    width: '100%',
    borderCollapse: 'separate',
    borderSpacing: 0,
    tableLayout: 'fixed',
  },

  tableRow: {
    background: '#ffffff',
  },

  th: {
    padding: '13px 10px',
    borderBottom: '1px solid #dce5f0',
    background: '#f3f7fc',
    color: '#52647b',
    textAlign: 'center',
    verticalAlign: 'middle',
    fontSize: '10px',
    lineHeight: 1.3,
    fontWeight: 900,
    textTransform: 'uppercase',
    letterSpacing: '0.035em',
    whiteSpace: 'nowrap',
  },

  td: {
    padding: '12px 8px',
    borderBottom: '1px solid #e7edf5',
    background: '#ffffff',
    color: '#293f5f',
    textAlign: 'center',
    verticalAlign: 'middle',
    fontSize: '12px',
    lineHeight: 1.45,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },

  productCell: {
    minWidth: 0,
    textAlign: 'left',
    whiteSpace: 'normal',
    overflowWrap: 'anywhere',
  },

  productName: {
    color: '#102b50',
    fontSize: '13px',
    lineHeight: 1.4,
    fontWeight: 900,
    overflowWrap: 'anywhere',
  },

  offerPrice: {
    color: '#176bff',
    fontSize: '13px',
    fontWeight: 900,
  },

  estadoBase: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    maxWidth: '150px',
    padding: '6px 9px',
    borderRadius: '999px',
    fontSize: '9px',
    lineHeight: 1.3,
    fontWeight: 900,
    textAlign: 'center',
    whiteSpace: 'normal',
  },

  estadoAzul: {
    border: '1px solid #bed5f5',
    background: '#e9f2ff',
    color: '#225d9f',
  },

  estadoNaranja: {
    border: '1px solid #f0d69a',
    background: '#fff6df',
    color: '#8a6214',
  },

  estadoConfirmada: {
    border: '1px solid #b8e4c9',
    background: '#e8f8ef',
    color: '#237444',
  },

  estadoGris: {
    border: '1px solid #d3d9e1',
    background: '#edf0f4',
    color: '#677486',
  },

  estadoDefault: {
    border: '1px solid #bce3dc',
    background: '#edf8f6',
    color: '#287568',
  },

  smallButton: {
    minWidth: '78px',
    maxWidth: '100%',
    minHeight: '34px',
    padding: '7px 8px',
    borderRadius: '9px',
    border: '1px solid #a9c5e8',
    background: '#f5f9ff',
    color: '#24507f',
    cursor: 'pointer',
    fontSize: '10px',
    lineHeight: 1.25,
    fontWeight: 900,
    whiteSpace: 'normal',
    boxSizing: 'border-box',
  },

  conversacionCell: {
    padding: '10px 6px',
    borderBottom: '1px solid #e7edf5',
    background: '#ffffff',
    textAlign: 'center',
    verticalAlign: 'middle',
    minWidth: 0,
  },

  chatToggleButton: {
    position: 'relative',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    maxWidth: '112px',
    minHeight: '34px',
    padding: '7px 8px',
    margin: '0 auto',
    borderRadius: '9px',
    border: '1px solid #a9c5e8',
    background: '#f5f9ff',
    color: '#24507f',
    cursor: 'pointer',
    fontSize: '10px',
    lineHeight: 1.25,
    fontWeight: 900,
    whiteSpace: 'normal',
    textAlign: 'center',
    boxSizing: 'border-box',
  },

  chatBadge: {
    position: 'absolute',
    top: '-6px',
    right: '-4px',
    minWidth: '16px',
    height: '16px',
    padding: '0 4px',
    borderRadius: '999px',
    background: '#2563EB',
    color: '#ffffff',
    border: '2px solid #ffffff',
    fontSize: '9px',
    fontWeight: 800,
    lineHeight: '12px',
    textAlign: 'center',
    boxSizing: 'border-box',
    pointerEvents: 'none',
  },

  emptyAction: {
    color: '#9aa7b7',
    fontSize: '12px',
    fontWeight: 700,
  },

  conversacionBox: {
    padding: '18px',
    borderBottom: '1px solid #e4ebf4',
    background: '#f8fbff',
    textAlign: 'left',
  },

  offerCardEmbedded: {
    width: '100%',
    maxWidth: '620px',
    padding: '18px',
    boxSizing: 'border-box',
    overflow: 'hidden',
    borderRadius: '16px',
    border: '1px solid #d7e3f2',
    background: '#ffffff',
    boxShadow:
      '0 10px 26px rgba(32, 73, 130, 0.07)',
  },

  offerCardEmbeddedDestacada: {
    border: '1px solid #176bff',
    boxShadow:
      '0 0 0 3px rgba(23,107,255,0.12)',
  },

  embeddedHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: '16px',
  },

  embeddedLabel: {
    color: '#7c899b',
    fontSize: '10px',
    lineHeight: 1.3,
    fontWeight: 900,
    textTransform: 'uppercase',
    letterSpacing: '0.065em',
  },

  embeddedPrice: {
    margin: '4px 0 0',
    color: '#176bff',
    fontSize: '22px',
    lineHeight: 1.2,
    fontWeight: 900,
  },

  embeddedMeta: {
    margin: '8px 0 14px',
    color: '#69798e',
    fontSize: '12px',
    lineHeight: 1.5,
    overflowWrap: 'anywhere',
  },

  contactTableCell: {
    padding: '0 18px 18px',
    borderBottom: '1px solid #e4ebf4',
    background: '#f8fbff',
  },

  contactBox: {
    padding: '17px',
    borderRadius: '14px',
    border: '1px solid #b9d3f2',
    background: '#f2f8ff',
    color: '#234b77',
    textAlign: 'left',
    fontSize: '12px',
    lineHeight: 1.5,
  },

  contactTitle: {
    margin: '0 0 12px',
    color: '#173c69',
    fontSize: '15px',
    lineHeight: 1.3,
    fontWeight: 900,
  },

  contactText: {
    margin: '12px 0 0',
    color: '#315173',
    fontSize: '13px',
    lineHeight: 1.5,
  },

  emptyCard: {
    padding: '44px 24px',
    borderRadius: '20px',
    border: '1px solid #dfe8f3',
    background: '#ffffff',
    boxShadow:
      '0 14px 38px rgba(32, 73, 130, 0.07)',
    textAlign: 'center',
  },

  emptyIcon: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '52px',
    height: '52px',
    margin: '0 auto 15px',
    borderRadius: '16px',
    background: '#eaf2ff',
    color: '#176bff',
    fontSize: '23px',
    fontWeight: 900,
  },

  emptyTitle: {
    margin: 0,
    color: '#102b50',
    fontSize: '20px',
    lineHeight: 1.3,
    fontWeight: 900,
  },

  emptyText: {
    maxWidth: '520px',
    margin: '8px auto 0',
    color: '#718095',
    fontSize: '13px',
    lineHeight: 1.6,
  },

  pagination: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
    flexWrap: 'wrap',
  },

  pageButton: {
    minWidth: '105px',
    minHeight: '40px',
    padding: '9px 15px',
    borderRadius: '10px',
    border: '1px solid #a9c5e8',
    background: '#f5f9ff',
    color: '#24507f',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: 900,
  },

  pageButtonDisabled: {
    borderColor: '#d9e1eb',
    background: '#edf1f6',
    color: '#9aa7b7',
    cursor: 'not-allowed',
  },

  pageText: {
    color: '#52647b',
    fontSize: '12px',
    fontWeight: 800,
  },

  unreadInline: {
    display: 'block',
    marginTop: '6px',
    color: '#176bff',
    fontSize: '11px',
    fontWeight: 900,
  },
};
