import { showKyntuAlert } from '../../lib/kyntuAlert';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { resolveProveedorProfile } from '../../lib/resolveProveedorProfile';
import { useRouter } from 'next/router';
import AppLayout from '../../components/Layout/AppLayout';
import Notificaciones from '../../components/Notificaciones';
import OfertaConversacionContenedor from '../../components/OfertaConversacionContenedor';
import {
  fetchSolicitudesAdjudicadasIds,
  resolverConversacionesPorSolicitudes,
} from '../../lib/ofertaMensajes';
import Tooltip from '../../components/Tooltip';

const VISTA_STORAGE_KEY = 'kyntu_proveedor_vista_ofertas';

const MENSAJE_AYUDA_OFERTA =
  'Debes ofertar por el total de productos solicitados';

const FILTROS_INICIALES = {
  producto: '',
  marca: '',
  comuna: '',
};

function formatearFechaCorta(fecha) {
  if (!fecha) return '—';

  const d = new Date(fecha);
  if (Number.isNaN(d.getTime())) return '—';

  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();

  return `${dd}-${mm}-${yyyy}`;
}

function puedeMostrarChatSolicitud(item) {
  return item.solicitud_abierta !== false;
}

function etiquetaChatSolicitud(conversacionId, chatAbierto) {
  if (chatAbierto) return 'Ocultar chat';
  return conversacionId ? 'Ver conversación' : 'Conversar';
}

function leerVistaPreferida() {
  try {
    const valor = localStorage.getItem(VISTA_STORAGE_KEY);

    if (valor === 'lista' || valor === 'cuadricula') {
      return valor;
    }
  } catch (_) {
    /* localStorage no disponible */
  }

  return 'lista';
}

function guardarVistaPreferida(vista) {
  try {
    localStorage.setItem(VISTA_STORAGE_KEY, vista);
  } catch (_) {
    /* ignorar */
  }
}

function normalizarFormatosItem(item) {
  const formatos = Array.isArray(item?.formatos_detalle)
    ? item.formatos_detalle.filter(Boolean)
    : [];

  if (formatos.length > 0) {
    return formatos.map((f) => ({
      formato: (f.formato ?? '').toString(),
      cantidad: f.cantidad ?? '',
      precio: f.precio ?? '',
      detalle_pedido: (f?.detalle_pedido ?? '').toString().trim(),
    }));
  }

  return [
    {
      formato: (item?.formato ?? '').toString(),
      cantidad: item?.cantidad ?? '',
      precio: item?.precio ?? '',
      detalle_pedido: '',
    },
  ];
}

const LISTA_GRID_COLUMNS =
  'minmax(150px, 1.5fr) minmax(80px, 0.7fr) minmax(65px, 0.5fr) minmax(100px, 0.8fr) minmax(140px, 1.2fr) minmax(110px, 0.9fr) minmax(85px, 0.7fr) minmax(145px, 1fr) minmax(95px, 0.7fr) minmax(130px, 0.9fr)';

function DetallePedidoCelda({ detalle }) {
  if (!detalle) {
    return <span style={styles.detalleEmpty}>—</span>;
  }

  return (
    <span
      className="kyntu-detalleCelda"
      style={styles.detalleCelda}
      title={detalle}
    >
      {detalle}
    </span>
  );
}

function DetallePedidoBloque({ detalle }) {
  if (!detalle) return null;

  return (
    <div className="kyntu-detalleBox" style={styles.detalleBox}>
      <div className="kyntu-detalleLabel" style={styles.detalleLabel}>
        <span style={styles.detalleIcon} aria-hidden="true">
          ℹ
        </span>

        Detalle del pedido
      </div>

      <p className="kyntu-detalleText" style={styles.detalleText}>
        {detalle}
      </p>
    </div>
  );
}

function BloqueOferta({
  fila,
  variant,
  onChange,
  formatearNumero,
}) {
  const compacto = variant === 'lista';

  const boxStyle = compacto
    ? styles.offerHighlightBoxCompact
    : styles.offerHighlightBox;

  const inputId = `oferta-${fila.itemId}`;

  if (fila.ya_oferto) {
    return (
      <div className="kyntu-offerHighlight" style={boxStyle}>
        <span style={styles.offerBlockTitle}>Tu oferta</span>

        <span style={styles.sentOffer}>
          ${formatearNumero(fila.oferta)}
        </span>
      </div>
    );
  }

  if (fila.estado === 'cerrada') {
    return (
      <div className="kyntu-offerHighlight" style={boxStyle}>
        <span style={styles.offerBlockTitle}>Tu oferta</span>
        <span style={styles.sentOffer}>Cerrada</span>
      </div>
    );
  }

  const ayudaOfertaId = `ayuda-oferta-${fila.itemId}`;

  return (
    <div className="kyntu-offerHighlight" style={boxStyle}>
      <div style={styles.offerBlockHeader}>
        <div style={styles.offerBlockTitleRow}>
          <span style={styles.offerBlockTitle}>Tu oferta</span>

          <Tooltip label={MENSAJE_AYUDA_OFERTA}>
            <button
              type="button"
              aria-label={`Ayuda: ${MENSAJE_AYUDA_OFERTA}`}
              style={styles.offerHelpButton}
            >
              ⓘ
            </button>
          </Tooltip>
        </div>

        {!compacto && (
          <span style={styles.offerBlockHint}>
            Ingresa tu precio · monto total ofertado
          </span>
        )}
      </div>

      {compacto && (
        <span style={styles.offerBlockHintCompact}>
          Ingresa tu precio
        </span>
      )}

      <span id={ayudaOfertaId} style={styles.srOnly}>
        {MENSAJE_AYUDA_OFERTA}
      </span>

      <label htmlFor={inputId} style={styles.srOnly}>
        Ingresar monto total de la oferta
      </label>

      <input
        id={inputId}
        type="text"
        value={fila.oferta}
        onChange={(e) => onChange(fila.itemId, e.target.value)}
        placeholder="Monto total"
        aria-label="Ingresar monto total de la oferta"
        aria-describedby={ayudaOfertaId}
        className="kyntu-offerInput"
        style={
          compacto
            ? styles.offerInputLista
            : styles.offerInputGrid
        }
      />
    </div>
  );
}

function SelectorVista({ vista, onChange }) {
  return (
    <div
      className="kyntu-viewToggle"
      style={styles.viewToggle}
      role="group"
      aria-label="Selector de visualización"
    >
      <button
        type="button"
        className="kyntu-viewToggleBtn"
        style={{
          ...styles.viewToggleBtn,
          ...(vista === 'lista'
            ? styles.viewToggleBtnActive
            : {}),
        }}
        aria-label="Ver como lista"
        aria-pressed={vista === 'lista'}
        title="Ver como lista"
        onClick={() => onChange('lista')}
      >
        ☰ Lista
      </button>

      <button
        type="button"
        className="kyntu-viewToggleBtn"
        style={{
          ...styles.viewToggleBtn,
          ...(vista === 'cuadricula'
            ? styles.viewToggleBtnActive
            : {}),
        }}
        aria-label="Ver como cuadrícula"
        aria-pressed={vista === 'cuadricula'}
        title="Ver como cuadrícula"
        onClick={() => onChange('cuadricula')}
      >
        ▦ Cuadrícula
      </button>
    </div>
  );
}

function ListaColumnHeader() {
  return (
    <div
      className="kyntu-listaHeaderGrid"
      style={styles.listaHeaderGrid}
      aria-hidden="true"
    >
      <div style={styles.listaHeaderCell}>Producto</div>
      <div style={styles.listaHeaderCell}>Formato</div>
      <div
        className="kyntu-col-secondary"
        style={styles.listaHeaderCell}
      >
        Cantidad
      </div>
      <div
        className="kyntu-col-secondary"
        style={styles.listaHeaderCell}
      >
        Precio referencia
      </div>
      <div
        className="kyntu-col-secondary"
        style={styles.listaHeaderCell}
      >
        Detalle del pedido
      </div>
      <div
        className="kyntu-col-secondary"
        style={styles.listaHeaderCell}
      >
        Comuna
      </div>
      <div
        className="kyntu-col-secondary"
        style={styles.listaHeaderCell}
      >
        Fecha
      </div>
      <div style={styles.listaHeaderCell}>Tu oferta</div>
      <div
        className="kyntu-col-secondary"
        style={styles.listaHeaderCell}
      >
        Despacho
      </div>
      <div style={styles.listaHeaderCell}>Acción</div>
    </div>
  );
}

function SolicitudListaRowCard({
  item,
  detalleContactoId,
  authUserId,
  chatAbiertoSolicitudId,
  onToggleChatSolicitud,
  conversacionId,
  onConversacionDetectada,
  onToggleContacto,
  onChangeOferta,
  onDespacho,
  onTiempoDespacho,
  onOfertar,
  formatearNumero,
}) {
  const formatos = normalizarFormatosItem(item);
  const totalFormatos = formatos.length;
  const filaOferta = {
    ...item,
    itemId: item.id,
  };

  const puedeOfertar =
    !item.ya_oferto &&
    item.estado !== 'cerrada';
  const esConfirmada =
    item.estado_oferta === 'confirmada';
  const chatAbierto = chatAbiertoSolicitudId === item.id;
  const puedeMostrarChat = puedeMostrarChatSolicitud(item);
  const rowSpanEnd = totalFormatos + 1;

  return (
    <article
      className="kyntu-solicitudRowCard"
      style={styles.solicitudRowCard}
    >
      <div
        className="kyntu-listaRowGrid"
        style={{
          ...styles.listaRowGrid,
          gridTemplateRows: `repeat(${totalFormatos}, auto)`,
        }}
      >
        <div
          style={{
            ...styles.listaCell,
            ...styles.listaProductCell,
            gridColumn: 1,
            gridRow: `1 / ${rowSpanEnd}`,
          }}
        >
          <strong style={styles.tableProductName}>
            {item.producto || '—'}
          </strong>
          <span style={styles.tableProductBrand}>
            Marca: {item.marca || '—'}
          </span>
        </div>

        {formatos.map((formato, fmtIndex) => {
          const filaNum = fmtIndex + 1;

          return (
            <React.Fragment key={`${item.id}-fmt-${fmtIndex}`}>
              <div
                style={{
                  ...styles.listaCell,
                  gridColumn: 2,
                  gridRow: filaNum,
                }}
              >
                {formato.formato || '—'}
              </div>

              <div
                className="kyntu-col-secondary"
                style={{
                  ...styles.listaCell,
                  gridColumn: 3,
                  gridRow: filaNum,
                }}
              >
                {formato.cantidad ?? '—'}
              </div>

              <div
                className="kyntu-col-secondary"
                style={{
                  ...styles.listaCell,
                  gridColumn: 4,
                  gridRow: filaNum,
                }}
              >
                {formato.precio !== '' &&
                formato.precio !== null &&
                formato.precio !== undefined
                  ? `$${formatearNumero(formato.precio)}`
                  : '—'}
              </div>

              <div
                className="kyntu-col-secondary"
                style={{
                  ...styles.listaCell,
                  ...styles.listaDetailCell,
                  gridColumn: 5,
                  gridRow: filaNum,
                }}
              >
                <DetallePedidoCelda
                  detalle={formato.detalle_pedido}
                />
              </div>
            </React.Fragment>
          );
        })}

        <div
          className="kyntu-col-secondary"
          style={{
            ...styles.listaCell,
            gridColumn: 6,
            gridRow: `1 / ${rowSpanEnd}`,
          }}
        >
          {item.comuna_despacho || '—'}
        </div>

        <div
          className="kyntu-col-secondary"
          style={{
            ...styles.listaCell,
            gridColumn: 7,
            gridRow: `1 / ${rowSpanEnd}`,
          }}
        >
          {formatearFechaCorta(item.fecha_creacion)}
        </div>

        <div
          style={{
            ...styles.listaCell,
            ...styles.listaOfferCell,
            gridColumn: 8,
            gridRow: `1 / ${rowSpanEnd}`,
          }}
        >
          <BloqueOferta
            fila={filaOferta}
            variant="lista"
            onChange={onChangeOferta}
            formatearNumero={formatearNumero}
          />
        </div>

        <div
          className="kyntu-col-secondary"
          style={{
            ...styles.listaCell,
            ...styles.listaDeliveryCell,
            gridColumn: 9,
            gridRow: `1 / ${rowSpanEnd}`,
          }}
        >
          {item.ya_oferto || item.estado === 'cerrada' ? (
            <span style={styles.metaValue}>No</span>
          ) : (
            <div style={styles.deliveryBoxCompact}>
              <label style={styles.checkLabelCompact}>
                <input
                  type="checkbox"
                  checked={Boolean(item.incluye_despacho)}
                  onChange={(e) =>
                    onDespacho(item.id, e.target.checked)
                  }
                  style={styles.checkbox}
                />
                Incluye despacho
              </label>

              {item.incluye_despacho && (
                <select
                  value={item.tiempo_despacho_horas || ''}
                  onChange={(e) =>
                    onTiempoDespacho(
                      item.id,
                      e.target.value
                    )
                  }
                  className="kyntu-select"
                  style={styles.selectCompact}
                >
                  <option value="">Tiempo</option>
                  <option value="24">24 h</option>
                  <option value="48">48 h</option>
                  <option value="72">72 h</option>
                  <option value="96">72+ h</option>
                </select>
              )}
            </div>
          )}
        </div>

        <div
          style={{
            ...styles.listaCell,
            ...styles.listaActionCell,
            gridColumn: 10,
            gridRow: `1 / ${rowSpanEnd}`,
          }}
        >
          <div
            className="kyntu-actionButtons"
            style={styles.actionButtonsStack}
          >
            {puedeMostrarChat && (
              <button
                type="button"
                onClick={() => onToggleChatSolicitud(item.id)}
                className="kyntu-chatButton"
                style={styles.chatButtonSmall}
              >
                {etiquetaChatSolicitud(conversacionId, chatAbierto)}
              </button>
            )}

            {esConfirmada ? (
              <button
                type="button"
                onClick={() => onToggleContacto(item.id)}
                className="kyntu-smallButton"
                style={styles.smallButton}
              >
                {detalleContactoId === item.id
                  ? 'Ocultar contacto'
                  : 'Ver contacto'}
              </button>
            ) : puedeOfertar ? (
              <button
                type="button"
                onClick={() => onOfertar(item.id)}
                className="kyntu-mainButtonSmall"
                style={styles.mainButtonSmall}
              >
                Enviar oferta
              </button>
            ) : (
              <span style={styles.emptyAction}>
                No disponible
              </span>
            )}
          </div>
        </div>
      </div>

      {authUserId && (
        <OfertaConversacionContenedor
          listasComprasId={item.id}
          authUserId={authUserId}
          chatAbierto={chatAbierto && puedeMostrarChat}
          onToggleChat={onToggleChatSolicitud}
          onConversacionDetectada={onConversacionDetectada}
          participanteLabel="Comprador"
          tooltipChat="Hablar con el comprador"
          variant="light"
          ocultarBarra
        />
      )}

      {esConfirmada &&
        detalleContactoId === item.id && (
          <div style={styles.listaContactPanel}>
            <div style={styles.contactBox}>
              <strong>Datos de contacto</strong>

              <div style={styles.contactText}>
                <p>
                  <strong>Correo:</strong>{' '}
                  {item.comprador_email}
                </p>

                <p>
                  <strong>Precio aceptado:</strong> $
                  {formatearNumero(item.oferta)}
                </p>

                <p>
                  <strong>Dirección de despacho:</strong>{' '}
                  {item.comuna_despacho}
                </p>
              </div>
            </div>
          </div>
        )}
    </article>
  );
}

export default function OfertarProductos() {
  const [listas, setListas] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [proveedorPerfilId, setProveedorPerfilId] =
    useState(null);
  const [authUserId, setAuthUserId] = useState(null);
  const [chatAbiertoSolicitudId, setChatAbiertoSolicitudId] =
    useState(null);
  const [conversacionesPorSolicitud, setConversacionesPorSolicitud] =
    useState({});

  const handleConversacionDetectada = useCallback(
    (solicitudId, conversacionId) => {
      setConversacionesPorSolicitud((prev) => {
        const siguiente = conversacionId || null;

        if (prev[solicitudId] === siguiente) return prev;

        return {
          ...prev,
          [solicitudId]: siguiente,
        };
      });
    },
    []
  );

  const [filtros, setFiltros] = useState({
    ...FILTROS_INICIALES,
  });

  const [paginaActual, setPaginaActual] = useState(1);
  const [detalleContactoId, setDetalleContactoId] =
    useState(null);

  const [vista, setVista] = useState('lista');

  const itemsPorPagina = 20;
  const router = useRouter();

  useEffect(() => {
    setVista(leerVistaPreferida());
  }, []);

  useEffect(() => {
    if (vista) {
      guardarVistaPreferida(vista);
    }
  }, [vista]);

  const cambiarVista = (nuevaVista) => {
    setVista(nuevaVista);
  };

  const toggleChatSolicitud = (listasComprasId) => {
    setChatAbiertoSolicitudId((prev) =>
      prev === listasComprasId ? null : listasComprasId
    );
  };

  useEffect(() => {
    if (!router.isReady || router.query?.notif !== 'chat') return;

    const listIdParam = Array.isArray(router.query.list_id)
      ? router.query.list_id[0]
      : router.query.list_id;

    if (!listIdParam) return;

    setChatAbiertoSolicitudId(listIdParam);
  }, [router.isReady, router.query]);

  useEffect(() => {
    const cargarDatos = async () => {
      const {
        data: userData,
        error: userError,
      } = await supabase.auth.getUser();

      if (
        userError ||
        !userData?.user
      ) {
        showKyntuAlert('Debes iniciar sesión.');
        router.push('/');
        return;
      }

      const {
        perfil: perfilProv,
      } = await resolveProveedorProfile(
        userData.user,
        {
          select: 'id, tipo',
        }
      );

      if (!perfilProv) {
        showKyntuAlert(
          'El usuario no tiene un perfil de proveedor asociado.'
        );

        return;
      }

      setProveedorPerfilId(
        perfilProv.id
      );

      setAuthUserId(userData.user.id);

      const {
        data: listasData,
        error: listasError,
      } = await supabase
        .from('listas_compras')
        .select('*')
        .order(
          'fecha_creacion',
          {
            ascending: false,
          }
        );

      const listaIds =
        Array.from(
          new Set(
            (listasData || [])
              .map(
                (item) =>
                  item.lista_id
              )
              .filter(Boolean)
          )
        );

      let estadoPorLista = {};

      if (listaIds.length > 0) {
        const {
          data: cabecerasData,
          error: cabecerasError,
        } = await supabase
          .from('listas')
          .select('id, estado')
          .in('id', listaIds);

        if (cabecerasError) {
          console.error(
            'Error cargando estados de listas:',
            cabecerasError
          );

          return;
        }

        estadoPorLista =
          Object.fromEntries(
            (
              cabecerasData || []
            ).map((lista) => [
              lista.id,
              lista.estado,
            ])
          );
      }

      const {
        data: perfilesData,
        error: perfilesError,
      } = await supabase
        .from('perfiles')
        .select('*');

      const {
        data: ofertasData,
        error: ofertasError,
      } = await supabase
        .from(
          'ofertas_productos'
        )
        .select(
          'lista_id, proveedor_id, precio_ofertado, estado'
        )
        .eq(
          'proveedor_id',
          perfilProv.id
        );

      if (
        listasError ||
        perfilesError ||
        ofertasError
      ) {
        console.error(
          listasError ||
            perfilesError ||
            ofertasError
        );

        showKyntuAlert(
          'Error al cargar datos.'
        );

        return;
      }

      const authUserId =
        userData.user.id;

      const listasAjenas =
        (listasData || []).filter(
          (item) => {
            const perteneceAOtroUsuario =
              String(
                item.usuario_id || ''
              ) !==
              String(authUserId);

            const estaPublicada =
              !item.lista_id ||
              estadoPorLista[
                item.lista_id
              ] === 'publicada';

            return (
              perteneceAOtroUsuario &&
              estaPublicada
            );
          }
        );

      setUsuarios(
        perfilesData || []
      );

      const compradoresPorAuth =
        Object.fromEntries(
          (
            perfilesData || []
          )
            .filter(
              (p) =>
                String(
                  p.tipo || ''
                )
                  .trim()
                  .toLowerCase() ===
                  'comprador' &&
                p.auth_id
            )
            .map((p) => [
              String(
                p.auth_id
              )
                .trim()
                .toLowerCase(),
              p,
            ])
        );

      const listaIdsEnriquecer = listasAjenas.map((item) => item.id);
      const solicitudesAdjudicadas =
        await fetchSolicitudesAdjudicadasIds(listaIdsEnriquecer);

      const enriquecida =
        listasAjenas
          .map((item) => {
            const perfilComprador =
              compradoresPorAuth[
                String(
                  item.usuario_id ||
                    ''
                )
                  .trim()
                  .toLowerCase()
              ] || null;

            const ofertaExistente =
              (
                ofertasData || []
              ).find(
                (o) =>
                  o.lista_id ===
                  item.id
              );

            const estadoLista = item.lista_id
              ? estadoPorLista[item.lista_id] ?? null
              : 'publicada';
            const solicitudAdjudicada = solicitudesAdjudicadas.has(
              String(item.id)
            );
            const solicitudAbierta =
              !solicitudAdjudicada &&
              (!item.lista_id ||
                estadoPorLista[item.lista_id] === 'publicada');

            return {
              ...item,

              estado: estadoLista,
              solicitud_abierta: solicitudAbierta,
              solicitud_adjudicada: solicitudAdjudicada,

              comprador_email:
                item.comprador_email ||
                perfilComprador?.email ||
                'Desconocido',

              oferta:
                ofertaExistente
                  ? ofertaExistente.precio_ofertado
                  : '',

              incluye_despacho:
                false,

              tiempo_despacho_horas:
                '',

              ya_oferto:
                !!ofertaExistente,

              estado_oferta:
                ofertaExistente
                  ? ofertaExistente.estado
                  : null,
            };
          })
          .filter(
            (item) =>
              !item.ya_oferto && !item.solicitud_adjudicada
          );

      const conversacionesMap =
        await resolverConversacionesPorSolicitudes(
          enriquecida.map((item) => item.id),
          perfilProv.id
        );

      setConversacionesPorSolicitud(conversacionesMap);
      setListas(enriquecida);
    };

    cargarDatos();
  }, [router]);

  const calcularDiasRestantes = (
    fecha_cierre
  ) => {
    if (!fecha_cierre) {
      return '-';
    }

    const cierre =
      new Date(fecha_cierre);

    const hoy =
      new Date();

    const diff =
      cierre - hoy;

    if (diff <= 0) {
      return '0';
    }

    return Math.ceil(
      diff /
        (
          1000 *
          60 *
          60 *
          24
        )
    );
  };

  const manejarCambioOferta = (
    itemId,
    valor
  ) => {
    setListas((prev) =>
      prev.map((item) =>
        item.id === itemId
          ? {
              ...item,
              oferta: valor,
            }
          : item
      )
    );
  };

  const manejarDespacho = (
    itemId,
    valor
  ) => {
    setListas((prev) =>
      prev.map((item) =>
        item.id === itemId
          ? {
              ...item,
              incluye_despacho:
                valor,

              tiempo_despacho_horas:
                valor
                  ? item.tiempo_despacho_horas
                  : '',
            }
          : item
      )
    );
  };

  const manejarTiempoDespacho = (
    itemId,
    valor
  ) => {
    setListas((prev) =>
      prev.map((item) =>
        item.id === itemId
          ? {
              ...item,
              tiempo_despacho_horas:
                valor,
            }
          : item
      )
    );
  };

  const ofertarProducto = async (
    itemId
  ) => {
    if (!proveedorPerfilId) {
      showKyntuAlert(
        'No hay perfil de proveedor activo.'
      );

      return;
    }

    const producto =
      listas.find(
        (item) =>
          item.id === itemId
      );

    if (!producto) {
      return;
    }

    const ofertaLimpia =
      parseFloat(
        (
          producto.oferta ?? ''
        )
          .toString()
          .replace(/\./g, '')
      );

    if (
      isNaN(ofertaLimpia) ||
      ofertaLimpia <= 0
    ) {
      showKyntuAlert(
        'Por favor ingresa un valor numérico válido en la oferta.'
      );

      return;
    }

    if (
      producto.incluye_despacho &&
      !producto.tiempo_despacho_horas
    ) {
      showKyntuAlert(
        'Selecciona el tiempo de despacho.'
      );

      return;
    }

    if (producto.solicitud_adjudicada) {
      showKyntuAlert(
        'Esta solicitud ya fue adjudicada y no admite nuevas ofertas.'
      );

      setListas((prev) =>
        prev.filter((item) => item.id !== producto.id)
      );

      return;
    }

    if (
      producto.estado ===
        'cerrada' ||
      calcularDiasRestantes(
        producto.fecha_cierre
      ) === '0'
    ) {
      showKyntuAlert(
        'La licitación está cerrada.'
      );

      return;
    }

    if (producto.ya_oferto) {
      showKyntuAlert(
        'Ya enviaste una oferta para este producto. Puedes verla en Mis ofertas enviadas.'
      );

      setListas((prev) =>
        prev.filter(
          (item) =>
            item.id !==
            producto.id
        )
      );

      return;
    }

    const {
      data: ofertaDuplicada,
      error: dupError,
    } = await supabase
      .from(
        'ofertas_productos'
      )
      .select('id')
      .eq(
        'proveedor_id',
        proveedorPerfilId
      )
      .eq(
        'lista_id',
        producto.id
      )
      .maybeSingle();

    if (dupError) {
      showKyntuAlert(
        'Error al verificar ofertas existentes: ' +
          dupError.message
      );

      return;
    }

    if (ofertaDuplicada) {
      showKyntuAlert(
        'Ya enviaste una oferta para este producto. Puedes verla en Mis ofertas enviadas.'
      );

      setListas((prev) =>
        prev.filter(
          (item) =>
            item.id !==
            producto.id
        )
      );

      return;
    }

    const { error } =
      await supabase
        .from(
          'ofertas_productos'
        )
        .insert({
          lista_id:
            producto.id,

          proveedor_id:
            proveedorPerfilId,

          producto:
            producto.producto,

          formato:
            producto.formato,

          marca:
            producto.marca,

          precio_ofertado:
            ofertaLimpia,

          incluye_despacho:
            producto.incluye_despacho,

          tiempo_despacho_horas:
            producto.incluye_despacho
              ? Number(
                  producto.tiempo_despacho_horas
                )
              : null,

          estado:
            'pendiente',
        });

    if (error) {
      const esDuplicada =
        error.code ===
          '23505' ||
        (
          error.message || ''
        )
          .toLowerCase()
          .includes('unique');

      if (esDuplicada) {
        showKyntuAlert(
          'Ya enviaste una oferta para este producto. Puedes verla en Mis ofertas enviadas.'
        );

        setListas((prev) =>
          prev.filter(
            (item) =>
              item.id !==
              producto.id
          )
        );
      } else {
        showKyntuAlert(
          'Error al enviar oferta: ' +
            error.message
        );
      }
    } else {
      await supabase
        .from(
          'notificaciones'
        )
        .insert([
          {
            usuario_id:
              producto.usuario_id,

            rol:
              'comprador',

            titulo:
              'Nueva oferta recibida',

            mensaje:
              `Has recibido una oferta para el producto ${producto.producto}`,

            ruta:
              '/comprador?notif=ofertas&list_id=' +
              producto.id,

            leida: false,
          },
        ]);

      setListas((prev) =>
        prev.filter(
          (item) =>
            item.id !==
            producto.id
        )
      );

      showKyntuAlert(
        'Oferta enviada correctamente.'
      );
    }
  };

  const irDashboard = () => {
    router.push(
      '/proveedor/DashboardProveedor'
    );
  };

  const irDatosContacto = () => {
    router.push(
      '/proveedor/datos-contacto'
    );
  };

  const cambiarPerfil = () => {
    router.push(
      '/seleccionar-perfil'
    );
  };

  const cerrarSesion = async () => {
    const { error } =
      await supabase.auth.signOut();

    if (error) {
      console.error(
        'Error al cerrar sesión:',
        error
      );

      showKyntuAlert(
        'No se pudo cerrar la sesión.'
      );

      return;
    }

    localStorage.clear();
    router.push('/login');
  };

  const normalizarTexto = (t) =>
    t
      ? t
          .toUpperCase()
          .normalize('NFD')
          .replace(
            /[\u0300-\u036f]/g,
            ''
          )
      : '';

  const manejarCambioFiltro = (
    campo,
    valor
  ) => {
    setFiltros((prev) => ({
      ...prev,
      [campo]: valor,
    }));

    setPaginaActual(1);
  };

  const limpiarFiltros = () => {
    setFiltros({
      ...FILTROS_INICIALES,
    });
    setPaginaActual(1);
  };

  const quitarFiltro = (campo) => {
    setFiltros((prev) => ({
      ...prev,
      [campo]: '',
    }));
    setPaginaActual(1);
  };

  const marcasUnicas = useMemo(() => {
    const mapa = new Map();

    listas.forEach((item) => {
      const valor = (item.marca || '')
        .toString()
        .trim();

      if (!valor) {
        return;
      }

      const clave = normalizarTexto(valor);

      if (!mapa.has(clave)) {
        mapa.set(clave, valor);
      }
    });

    return Array.from(mapa.values()).sort(
      (a, b) =>
        normalizarTexto(a).localeCompare(
          normalizarTexto(b)
        )
    );
  }, [listas]);

  const comunasUnicas = useMemo(() => {
    const mapa = new Map();

    listas.forEach((item) => {
      const valor = (item.comuna_despacho || '')
        .toString()
        .trim();

      if (!valor) {
        return;
      }

      const clave = normalizarTexto(valor);

      if (!mapa.has(clave)) {
        mapa.set(clave, valor);
      }
    });

    return Array.from(mapa.values()).sort(
      (a, b) =>
        normalizarTexto(a).localeCompare(
          normalizarTexto(b)
        )
    );
  }, [listas]);

  const listasFiltradas = useMemo(() => {
    const terminoProducto = normalizarTexto(
      filtros.producto
    );
    const terminoMarca = normalizarTexto(
      filtros.marca
    );
    const terminoComuna = normalizarTexto(
      filtros.comuna
    );

    return listas.filter((item) => {
      const coincideProducto =
        !terminoProducto ||
        normalizarTexto(item.producto).includes(
          terminoProducto
        );

      const coincideMarca =
        !terminoMarca ||
        normalizarTexto(item.marca) ===
          terminoMarca;

      const coincideComuna =
        !terminoComuna ||
        normalizarTexto(
          item.comuna_despacho
        ) === terminoComuna;

      return (
        coincideProducto &&
        coincideMarca &&
        coincideComuna
      );
    });
  }, [listas, filtros]);

  const totalPaginas = Math.max(
    1,
    Math.ceil(
      listasFiltradas.length / itemsPorPagina
    )
  );

  const listasPaginadas = listasFiltradas.slice(
    (paginaActual - 1) * itemsPorPagina,
    paginaActual * itemsPorPagina
  );

  useEffect(() => {
    if (paginaActual > totalPaginas) {
      setPaginaActual(totalPaginas);
    }
  }, [paginaActual, totalPaginas]);

  const filtrosActivos = useMemo(() => {
    const chips = [];

    if (filtros.producto.trim()) {
      chips.push({
        key: 'producto',
        label: 'Producto',
        value: filtros.producto.trim(),
      });
    }

    if (filtros.marca.trim()) {
      chips.push({
        key: 'marca',
        label: 'Marca',
        value: filtros.marca.trim(),
      });
    }

    if (filtros.comuna.trim()) {
      chips.push({
        key: 'comuna',
        label: 'Comuna',
        value: filtros.comuna.trim(),
      });
    }

    return chips;
  }, [filtros]);

  const hayFiltrosActivos =
    filtrosActivos.length > 0;

const cambiarPagina = (numero) => {
  if (
    numero < 1 ||
    numero > totalPaginas
  ) {
    return;
  }

  setPaginaActual(numero);

  window.scrollTo({
    top: 0,
    behavior: "smooth",
  });
};

const formatearNumero = (valor) => {
  if (
    valor === null ||
    valor === undefined ||
    valor === ""
  ) {
    return "";
  }

  const numero = Number(
    String(valor).replace(/\./g, "")
  );

  if (Number.isNaN(numero)) {
    return valor;
  }

  return numero.toLocaleString("es-CL");
};

return (
  <AppLayout
    title="Ofertar productos"
    profileLabel="Proveedor"
    showProfileSwitch
    onChangeProfile={cambiarPerfil}
    onUpdateData={irDatosContacto}
    onDashboard={irDashboard}
    onLogout={cerrarSesion}
    notifications={
      <Notificaciones
        userId={proveedorPerfilId}
        rol="proveedor"
      />
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
            Solicitudes de compra
          </h1>

          <p style={styles.subtitle}>
            Revisa las solicitudes publicadas y
            envía tu mejor oferta.
          </p>
        </div>

        <SelectorVista
          vista={vista}
          onChange={cambiarVista}
        />
      </section>
            <section
        className="kyntu-filterCard"
        style={styles.filterCard}
      >
        <div
          className="kyntu-filterToolbar"
          style={styles.filterToolbar}
        >
          <div
            className="kyntu-filterFieldsGrid"
            style={styles.filterFieldsGrid}
          >
            <div style={styles.filterGroup}>
              <label
                htmlFor="filtro-producto"
                style={styles.filterFieldLabel}
              >
                Producto
              </label>

              <input
                id="filtro-producto"
                type="search"
                style={styles.filterInput}
                placeholder="Buscar producto"
                value={filtros.producto}
                onChange={(e) =>
                  manejarCambioFiltro(
                    'producto',
                    e.target.value
                  )
                }
                aria-label="Buscar producto"
              />
            </div>

            <div style={styles.filterGroup}>
              <label
                htmlFor="filtro-marca"
                style={styles.filterFieldLabel}
              >
                Marca
              </label>

              <select
                id="filtro-marca"
                style={styles.filterSelect}
                value={filtros.marca}
                onChange={(e) =>
                  manejarCambioFiltro(
                    'marca',
                    e.target.value
                  )
                }
                aria-label="Filtrar por marca"
              >
                <option value="">
                  Todas las marcas
                </option>

                {marcasUnicas.map((marca) => (
                  <option
                    key={marca}
                    value={marca}
                  >
                    {marca}
                  </option>
                ))}
              </select>
            </div>

            <div style={styles.filterGroup}>
              <label
                htmlFor="filtro-comuna"
                style={styles.filterFieldLabel}
              >
                Comuna
              </label>

              <select
                id="filtro-comuna"
                style={styles.filterSelect}
                value={filtros.comuna}
                onChange={(e) =>
                  manejarCambioFiltro(
                    'comuna',
                    e.target.value
                  )
                }
                aria-label="Filtrar por comuna"
              >
                <option value="">
                  Todas las comunas
                </option>

                {comunasUnicas.map((comuna) => (
                  <option
                    key={comuna}
                    value={comuna}
                  >
                    {comuna}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {hayFiltrosActivos && (
            <button
              type="button"
              className="kyntu-clearFiltersBtn"
              style={styles.clearFiltersButton}
              onClick={limpiarFiltros}
            >
              Limpiar filtros
            </button>
          )}
        </div>

        {hayFiltrosActivos && (
          <div
            className="kyntu-filterChips"
            style={styles.filterChipsRow}
          >
            {filtrosActivos.map((chip) => (
              <button
                key={chip.key}
                type="button"
                style={styles.filterChip}
                onClick={() =>
                  quitarFiltro(chip.key)
                }
                aria-label={`Quitar filtro ${chip.label}: ${chip.value}`}
              >
                <span style={styles.filterChipText}>
                  {chip.label}: {chip.value}
                </span>

                <span
                  style={styles.filterChipRemove}
                  aria-hidden="true"
                >
                  ×
                </span>
              </button>
            ))}
          </div>
        )}
      </section>
            {vista === 'lista' ? (
        <section
          className="kyntu-listaSectionCard"
          style={styles.listaSectionCard}
        >
          <div
            className="kyntu-listaScrollWrap"
            style={styles.listaScrollWrap}
          >
            <div
              className="kyntu-listaInner"
              style={styles.listaInner}
            >
              <ListaColumnHeader />

              <div
                className="kyntu-listaRowsStack"
                style={styles.listaRowsStack}
              >
                {listasPaginadas.map((item) => (
                  <SolicitudListaRowCard
                    key={item.id}
                    item={item}
                    authUserId={authUserId}
                    chatAbiertoSolicitudId={
                      chatAbiertoSolicitudId
                    }
                    onToggleChatSolicitud={
                      toggleChatSolicitud
                    }
                    conversacionId={
                      conversacionesPorSolicitud[item.id] ||
                      null
                    }
                    onConversacionDetectada={
                      handleConversacionDetectada
                    }
                    detalleContactoId={
                      detalleContactoId
                    }
                    onToggleContacto={(id) =>
                      setDetalleContactoId(
                        detalleContactoId === id
                          ? null
                          : id
                      )
                    }
                    onChangeOferta={
                      manejarCambioOferta
                    }
                    onDespacho={manejarDespacho}
                    onTiempoDespacho={
                      manejarTiempoDespacho
                    }
                    onOfertar={ofertarProducto}
                    formatearNumero={
                      formatearNumero
                    }
                  />
                ))}
              </div>
            </div>
          </div>
        </section>
      ) : (
            <div
        className="kyntu-grid"
        style={styles.grid}
      >
        {listasPaginadas.map((item) => {
          const puedeOfertar =
            !item.ya_oferto &&
            item.estado !== "cerrada";

          const esConfirmada =
            item.estado_oferta === "confirmada";
          const chatAbierto =
            chatAbiertoSolicitudId === item.id;
          const conversacionId =
            conversacionesPorSolicitud[item.id] || null;
          const puedeMostrarChat = puedeMostrarChatSolicitud(item);

          return (
            <article
              key={item.id}
              className="kyntu-card"
              style={styles.card}
            >
              <div style={styles.cardHeader}>
                <div>
                  <span style={styles.cardLabel}>
                    Producto
                  </span>

                  <h3 style={styles.cardTitle}>
                    {item.producto}
                  </h3>

                  <span style={styles.cardBrand}>
                    {item.marca || "Sin marca"}
                  </span>
                </div>
              </div>

              <div style={styles.cardBody}>
                {normalizarFormatosItem(item).map(
                  (formato, index) => (
                    <div
                      key={index}
                      style={
                        styles.formatCard
                      }
                    >
                      <div
                        style={
                          styles.formatHeader
                        }
                      >
                        <span
                          style={
                            styles.metaLabel
                          }
                        >
                          Formato
                        </span>

                        <strong>
                          {formato.formato ||
                            "—"}
                        </strong>
                      </div>

                      <div
                        style={
                          styles.metaGrid
                        }
                      >
                        <div>
                          <span
                            style={
                              styles.metaLabel
                            }
                          >
                            Cantidad
                          </span>

                          <div
                            style={
                              styles.metaValue
                            }
                          >
                            {formato.cantidad ??
                              "—"}
                          </div>
                        </div>

                        <div>
                          <span
                            style={
                              styles.metaLabel
                            }
                          >
                            Precio referencia
                          </span>

                          <div
                            style={
                              styles.metaValue
                            }
                          >
                            {formato.precio
                              ? `$${formatearNumero(
                                  formato.precio
                                )}`
                              : "—"}
                          </div>
                        </div>
                      </div>

                      <DetallePedidoBloque
                        detalle={
                          formato.detalle_pedido
                        }
                      />
                    </div>
                  )
                )}

                <div
                  style={styles.metaGrid}
                >
                  <div>
                    <span
                      style={
                        styles.metaLabel
                      }
                    >
                      Comuna
                    </span>

                    <div
                      style={
                        styles.metaValue
                      }
                    >
                      {item.comuna_despacho}
                    </div>
                  </div>

                  <div>
                    <span
                      style={
                        styles.metaLabel
                      }
                    >
                      Fecha
                    </span>

                    <div
                      style={
                        styles.metaValue
                      }
                    >
                      {formatearFechaCorta(
                        item.fecha_creacion
                      )}
                    </div>
                  </div>
                </div>

                <BloqueOferta
                  fila={item}
                  variant="grid"
                  onChange={
                    manejarCambioOferta
                  }
                  formatearNumero={
                    formatearNumero
                  }
                />

                {authUserId && (
                  <OfertaConversacionContenedor
                    listasComprasId={item.id}
                    authUserId={authUserId}
                    chatAbierto={chatAbierto && puedeMostrarChat}
                    onToggleChat={toggleChatSolicitud}
                    onConversacionDetectada={
                      handleConversacionDetectada
                    }
                    participanteLabel="Comprador"
                    tooltipChat="Hablar con el comprador"
                    variant="light"
                    ocultarBarra
                  />
                )}

                              {!item.ya_oferto &&
                  item.estado !== "cerrada" && (
                    <div style={styles.deliveryBox}>
                      <label style={styles.checkLabel}>
                        <input
                          type="checkbox"
                          checked={Boolean(item.incluye_despacho)}
                          onChange={(e) =>
                            manejarDespacho(
                              item.id,
                              e.target.checked
                            )
                          }
                          style={styles.checkbox}
                        />

                        Incluye despacho
                      </label>

                      {item.incluye_despacho && (
                        <select
                          value={
                            item.tiempo_despacho_horas || ""
                          }
                          onChange={(e) =>
                            manejarTiempoDespacho(
                              item.id,
                              e.target.value
                            )
                          }
                          className="kyntu-select"
                          style={styles.select}
                        >
                          <option value="">
                            Tiempo de despacho
                          </option>

                          <option value="24">
                            24 horas
                          </option>

                          <option value="48">
                            48 horas
                          </option>

                          <option value="72">
                            72 horas
                          </option>

                          <option value="96">
                            Más de 72 horas
                          </option>
                        </select>
                      )}
                    </div>
                  )}

                {esConfirmada &&
                  detalleContactoId === item.id && (
                    <div style={styles.contactBox}>
                      <strong>
                        Datos de contacto
                      </strong>

                      <div style={styles.contactText}>
                        <p>
                          <strong>
                            Correo:
                          </strong>{" "}
                          {item.comprador_email}
                        </p>

                        <p>
                          <strong>
                            Precio aceptado:
                          </strong>{" "}
                          $
                          {formatearNumero(item.oferta)}
                        </p>

                        <p>
                          <strong>
                            Comuna:
                          </strong>{" "}
                          {item.comuna_despacho}
                        </p>
                      </div>
                    </div>
                  )}
              </div>

              <div
                className="kyntu-cardFooterActions"
                style={styles.cardFooterActions}
              >
                {puedeMostrarChat && (
                  <button
                    type="button"
                    style={styles.secondaryButton}
                    onClick={() => toggleChatSolicitud(item.id)}
                  >
                    {etiquetaChatSolicitud(
                      conversacionId,
                      chatAbierto
                    )}
                  </button>
                )}

                {esConfirmada ? (
                  <button
                    type="button"
                    style={styles.secondaryButton}
                    onClick={() =>
                      setDetalleContactoId(
                        detalleContactoId === item.id
                          ? null
                          : item.id
                      )
                    }
                  >
                    {detalleContactoId === item.id
                      ? "Ocultar contacto"
                      : "Ver contacto"}
                  </button>
                ) : puedeOfertar ? (
                  <button
                    type="button"
                    style={styles.mainButton}
                    onClick={() =>
                      ofertarProducto(item.id)
                    }
                  >
                    Enviar oferta
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled
                    style={styles.disabledButton}
                  >
                    No disponible
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>
      )}

      {totalPaginas > 1 && (
        <div style={styles.pagination}>
          <button
            type="button"
            style={styles.pageButton}
            disabled={paginaActual === 1}
            onClick={() =>
              cambiarPagina(
                paginaActual - 1
              )
            }
          >
            Anterior
          </button>

          {Array.from(
            { length: totalPaginas },
            (_, i) => i + 1
          ).map((pagina) => (
            <button
              key={pagina}
              type="button"
              onClick={() =>
                cambiarPagina(pagina)
              }
              style={{
                ...styles.pageButton,
                ...(paginaActual === pagina
                  ? styles.pageButtonActive
                  : {}),
              }}
            >
              {pagina}
            </button>
          ))}

          <button
            type="button"
            style={styles.pageButton}
            disabled={
              paginaActual === totalPaginas
            }
            onClick={() =>
              cambiarPagina(
                paginaActual + 1
              )
            }
          >
            Siguiente
          </button>
        </div>
      )}
    </main>

    <style jsx>{`
      @media (max-width: 820px) {
        .kyntu-filterCard {
          padding: 18px 16px !important;
        }

        .kyntu-filterToolbar {
          flex-direction: column !important;
          align-items: stretch !important;
          gap: 12px !important;
        }

        .kyntu-filterFieldsGrid {
          grid-template-columns: 1fr !important;
        }

        .kyntu-clearFiltersBtn {
          width: 100% !important;
        }

        .kyntu-grid {
          grid-template-columns: 1fr !important;
        }

        .kyntu-listaSectionCard {
          padding: 20px 16px !important;
        }

        .kyntu-col-secondary {
          display: none !important;
        }

        .kyntu-listaInner {
          min-width: 720px !important;
        }
      }

      @media (max-width: 620px) {
        .kyntu-listaSectionCard {
          padding: 16px 12px !important;
        }

        .kyntu-actionButtons {
          gap: 5px !important;
        }
      }

      @media (max-width: 375px) {
        .kyntu-cardFooterActions {
          gap: 6px !important;
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
    boxShadow: '0 18px 45px rgba(32, 73, 130, 0.08)',
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
    margin: '8px 0 0',
    color: '#65758b',
    fontSize: '14px',
    lineHeight: 1.6,
  },

  viewToggle: {
    display: 'inline-flex',
    alignItems: 'stretch',
    flexShrink: 0,
    overflow: 'hidden',
    borderRadius: '12px',
    border: '1px solid #d4dfec',
    background: '#ffffff',
    boxShadow: '0 7px 18px rgba(34, 67, 110, 0.06)',
  },

  viewToggleBtn: {
    minHeight: '42px',
    padding: '9px 15px',
    border: 'none',
    borderRight: '1px solid #e2e9f2',
    background: '#ffffff',
    color: '#607086',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: 800,
    whiteSpace: 'nowrap',
  },

  viewToggleBtnActive: {
    background: 'linear-gradient(135deg, #176bff, #438cff)',
    color: '#ffffff',
    boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.15)',
  },

  filterCard: {
    marginTop: '8px',
    marginBottom: '28px',
    padding: '20px 22px',
    width: '100%',
    maxWidth: '100%',
    boxSizing: 'border-box',
    borderRadius: '20px',
    background: '#ffffff',
    border: '1px solid #dfe8f3',
    boxShadow: '0 8px 24px rgba(32, 73, 130, 0.06)',
  },

  filterToolbar: {
    display: 'flex',
    alignItems: 'flex-end',
    gap: '14px',
    flexWrap: 'wrap',
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
    boxSizing: 'border-box',
  },

  filterFieldsGrid: {
    display: 'grid',
    gridTemplateColumns: 'minmax(220px, 2fr) minmax(160px, 1fr) minmax(160px, 1fr)',
    gap: '12px',
    flex: '1 1 520px',
    minWidth: 0,
    width: '100%',
    maxWidth: '100%',
    boxSizing: 'border-box',
  },

  filterChipsRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
    marginTop: '16px',
    paddingTop: '2px',
  },

  filterChip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    minHeight: '34px',
    padding: '6px 10px',
    borderRadius: '999px',
    border: '1px solid #cfdbea',
    background: '#f8fbff',
    color: '#315173',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: 700,
  },

  filterChipText: {
    lineHeight: 1.2,
  },

  filterChipRemove: {
    color: '#6d8198',
    fontSize: '16px',
    lineHeight: 1,
    fontWeight: 800,
  },

  filterGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    minWidth: 0,
  },

  filterFieldLabel: {
    color: '#607086',
    fontSize: '11px',
    fontWeight: 800,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },

  clearFiltersButton: {
    minHeight: '43px',
    padding: '10px 14px',
    flexShrink: 0,
    borderRadius: '11px',
    border: '1px solid #cfdbea',
    background: '#f8fbff',
    color: '#315173',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: 800,
    whiteSpace: 'nowrap',
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
    fontSize: '13px',
  },

  filterSelect: {
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
    fontSize: '13px',
  },

  listaSectionCard: {
    width: '100%',
    maxWidth: '100%',
    marginBottom: '28px',
    padding: '24px',
    boxSizing: 'border-box',
    borderRadius: '26px',
    background: 'rgba(255,255,255,0.96)',
    border: '1px solid #e1e9f4',
    boxShadow: '0 24px 65px rgba(28,69,128,0.10)',
    overflow: 'visible',
  },

  listaScrollWrap: {
    width: '100%',
    maxWidth: '100%',
    overflowX: 'auto',
    boxSizing: 'border-box',
    WebkitOverflowScrolling: 'touch',
  },

  listaInner: {
    width: '100%',
    minWidth: '1120px',
    boxSizing: 'border-box',
  },

  listaHeaderGrid: {
    display: 'grid',
    gridTemplateColumns: LISTA_GRID_COLUMNS,
    gap: '8px 10px',
    alignItems: 'center',
    marginBottom: '12px',
    padding: '10px 12px',
    borderRadius: '12px',
    background: '#f3f7fc',
    border: '1px solid #e3ebf5',
    boxSizing: 'border-box',
  },

  listaHeaderCell: {
    color: '#52647b',
    fontSize: '11px',
    lineHeight: 1.3,
    fontWeight: 900,
    textTransform: 'uppercase',
    letterSpacing: '0.035em',
    textAlign: 'center',
    whiteSpace: 'nowrap',
  },

  listaRowsStack: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    width: '100%',
    boxSizing: 'border-box',
  },

  solicitudRowCard: {
    padding: '12px 14px',
    borderRadius: '20px',
    background: '#ffffff',
    border: '1px solid #e1e9f4',
    boxShadow: '0 12px 30px rgba(28,69,128,0.06)',
    boxSizing: 'border-box',
  },

  listaRowGrid: {
    display: 'grid',
    gridTemplateColumns: LISTA_GRID_COLUMNS,
    gap: '8px 10px',
    alignItems: 'center',
    width: '100%',
    boxSizing: 'border-box',
  },

  listaCell: {
    minWidth: 0,
    color: '#293f5f',
    fontSize: '12px',
    lineHeight: 1.45,
    textAlign: 'center',
    verticalAlign: 'middle',
  },

  listaProductCell: {
    textAlign: 'left',
    alignSelf: 'center',
  },

  listaDetailCell: {
    textAlign: 'left',
    verticalAlign: 'top',
  },

  listaOfferCell: {
    minWidth: '145px',
  },

  listaDeliveryCell: {
    minWidth: '95px',
  },

  listaActionCell: {
    minWidth: '118px',
  },

  actionButtonsStack: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    width: '100%',
    minWidth: 0,
  },

  chatButtonSmall: {
    width: '100%',
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
    textAlign: 'center',
  },

  cardFooterActions: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    padding: '16px 20px 20px',
    borderTop: '1px solid #e6edf5',
    background: '#fbfdff',
  },

  listaContactPanel: {
    marginTop: '12px',
    paddingTop: '12px',
    borderTop: '1px solid #e7edf5',
  },

  tableProductName: {
    display: 'block',
    color: '#102b50',
    fontSize: '13px',
    lineHeight: 1.4,
    fontWeight: 900,
    overflowWrap: 'anywhere',
  },

  tableProductBrand: {
    display: 'block',
    marginTop: '5px',
    color: '#758399',
    fontSize: '11px',
    lineHeight: 1.4,
    overflowWrap: 'anywhere',
  },

  detalleCelda: {
    display: '-webkit-box',
    color: '#344a68',
    fontSize: '11px',
    lineHeight: 1.4,
    textAlign: 'left',
    overflow: 'hidden',
    overflowWrap: 'anywhere',
    WebkitLineClamp: 3,
    WebkitBoxOrient: 'vertical',
  },

  detalleEmpty: {
    color: '#9aa8ba',
  },

  deliveryBoxCompact: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    minWidth: 0,
  },

  checkLabelCompact: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    color: '#314c6c',
    cursor: 'pointer',
    fontSize: '10px',
    lineHeight: 1.3,
    fontWeight: 800,
    textAlign: 'left',
  },

  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
    gap: '20px',
    marginBottom: '24px',
  },

  card: {
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
    overflow: 'hidden',
    borderRadius: '20px',
    border: '1px solid #dde7f2',
    background: '#ffffff',
    boxShadow: '0 16px 40px rgba(32, 73, 130, 0.08)',
  },

  cardHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: '16px',
    padding: '20px',
    borderBottom: '1px solid #e6edf5',
    background:
      'linear-gradient(135deg, #f8fbff 0%, #ffffff 100%)',
  },

  cardLabel: {
    display: 'block',
    marginBottom: '5px',
    color: '#7c899b',
    fontSize: '10px',
    lineHeight: 1.3,
    fontWeight: 900,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
  },

  cardTitle: {
    margin: 0,
    color: '#102b50',
    fontSize: '20px',
    lineHeight: 1.25,
    fontWeight: 900,
    letterSpacing: '-0.02em',
    overflowWrap: 'anywhere',
  },

  cardBrand: {
    display: 'block',
    marginTop: '6px',
    color: '#6f7f94',
    fontSize: '12px',
    lineHeight: 1.4,
  },

  cardBody: {
    display: 'flex',
    flex: 1,
    flexDirection: 'column',
    gap: '16px',
    padding: '20px',
  },

  formatCard: {
    padding: '15px',
    borderRadius: '14px',
    border: '1px solid #e0e8f2',
    background: '#f8fbff',
  },

  formatHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    marginBottom: '14px',
    color: '#183354',
    fontSize: '13px',
  },

  metaGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: '14px',
  },

  metaLabel: {
    display: 'block',
    marginBottom: '4px',
    color: '#8290a3',
    fontSize: '10px',
    lineHeight: 1.3,
    fontWeight: 900,
    textTransform: 'uppercase',
    letterSpacing: '0.055em',
  },

  metaValue: {
    color: '#28415f',
    fontSize: '13px',
    lineHeight: 1.45,
    fontWeight: 700,
    overflowWrap: 'anywhere',
  },

  detalleBox: {
    marginTop: '13px',
    padding: '12px',
    borderRadius: '11px',
    border: '1px solid #d9e5f3',
    background: '#ffffff',
  },

  detalleLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    marginBottom: '6px',
    color: '#315b8a',
    fontSize: '11px',
    fontWeight: 900,
  },

  detalleIcon: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '17px',
    height: '17px',
    flexShrink: 0,
    borderRadius: '50%',
    background: '#e8f1ff',
    color: '#176bff',
    fontSize: '11px',
    fontWeight: 900,
  },

  detalleText: {
    margin: 0,
    color: '#4d6078',
    fontSize: '12px',
    lineHeight: 1.55,
    overflowWrap: 'anywhere',
  },

  offerHighlightBox: {
    display: 'flex',
    flexDirection: 'column',
    gap: '9px',
    padding: '16px',
    borderRadius: '15px',
    border: '1px solid #cddfff',
    background:
      'linear-gradient(135deg, rgba(23,107,255,0.08), rgba(67,140,255,0.03))',
  },

  offerHighlightBoxCompact: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    minWidth: 0,
    padding: '10px',
    borderRadius: '11px',
    border: '1px solid #d2e1fa',
    background: '#f5f9ff',
  },

  offerBlockHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
  },

  offerBlockTitle: {
    color: '#173c69',
    fontSize: '12px',
    lineHeight: 1.3,
    fontWeight: 900,
  },

  offerBlockTitleRow: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
  },

  offerHelpButton: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '20px',
    height: '20px',
    padding: 0,
    borderRadius: '999px',
    border: '1px solid #c5d8f2',
    background: '#f0f6ff',
    color: '#4a719e',
    cursor: 'pointer',
    fontSize: '11px',
    lineHeight: 1,
    fontWeight: 800,
    flexShrink: 0,
  },

  offerBlockHint: {
    color: '#75869c',
    fontSize: '10px',
    lineHeight: 1.4,
    textAlign: 'right',
  },

  offerBlockHintCompact: {
    color: '#7a899d',
    fontSize: '9px',
    lineHeight: 1.3,
  },

  offerInputGrid: {
    width: '100%',
    minHeight: '45px',
    padding: '10px 13px',
    boxSizing: 'border-box',
    borderRadius: '11px',
    border: '1px solid #a9c6ef',
    background: '#ffffff',
    color: '#102b50',
    outline: 'none',
    fontSize: '14px',
    fontWeight: 800,
  },

  offerInputLista: {
    width: '100%',
    minWidth: 0,
    minHeight: '37px',
    padding: '8px 9px',
    boxSizing: 'border-box',
    borderRadius: '9px',
    border: '1px solid #afc8eb',
    background: '#ffffff',
    color: '#102b50',
    outline: 'none',
    fontSize: '11px',
    fontWeight: 800,
  },

  sentOffer: {
    color: '#176bff',
    fontSize: '16px',
    lineHeight: 1.3,
    fontWeight: 900,
  },

  deliveryBox: {
    display: 'flex',
    flexDirection: 'column',
    gap: '11px',
    padding: '14px',
    borderRadius: '14px',
    border: '1px solid #e0e8f2',
    background: '#fafcff',
  },

  checkLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    color: '#314c6c',
    cursor: 'pointer',
    fontSize: '12px',
    lineHeight: 1.4,
    fontWeight: 800,
  },

  checkbox: {
    width: '17px',
    height: '17px',
    flexShrink: 0,
    cursor: 'pointer',
    accentColor: '#176bff',
  },

  select: {
    width: '100%',
    minHeight: '42px',
    padding: '9px 11px',
    boxSizing: 'border-box',
    borderRadius: '10px',
    border: '1px solid #ccd9e8',
    background: '#ffffff',
    color: '#28415f',
    outline: 'none',
    cursor: 'pointer',
    fontSize: '12px',
  },

  selectCompact: {
    width: '100%',
    minWidth: '88px',
    minHeight: '34px',
    padding: '6px 7px',
    boxSizing: 'border-box',
    borderRadius: '8px',
    border: '1px solid #ccd9e8',
    background: '#ffffff',
    color: '#28415f',
    outline: 'none',
    cursor: 'pointer',
    fontSize: '10px',
  },

  cardFooter: {
    padding: '16px 20px 20px',
    borderTop: '1px solid #e6edf5',
    background: '#fbfdff',
  },

  mainButton: {
    width: '100%',
    minHeight: '45px',
    padding: '11px 18px',
    border: 'none',
    borderRadius: '11px',
    background: 'linear-gradient(135deg, #176bff, #438cff)',
    boxShadow: '0 10px 22px rgba(23,107,255,0.22)',
    color: '#ffffff',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 900,
  },

  mainButtonSmall: {
    width: '100%',
    minHeight: '36px',
    padding: '8px 10px',
    border: 'none',
    borderRadius: '9px',
    background: 'linear-gradient(135deg, #176bff, #438cff)',
    boxShadow: '0 7px 16px rgba(23,107,255,0.18)',
    color: '#ffffff',
    cursor: 'pointer',
    fontSize: '10px',
    lineHeight: 1.3,
    fontWeight: 900,
  },

  secondaryButton: {
    width: '100%',
    minHeight: '45px',
    padding: '11px 18px',
    borderRadius: '11px',
    border: '1px solid #a9c5e8',
    background: '#f5f9ff',
    color: '#24507f',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 900,
  },

  smallButton: {
    width: '100%',
    minHeight: '36px',
    padding: '8px 10px',
    borderRadius: '9px',
    border: '1px solid #a9c5e8',
    background: '#f5f9ff',
    color: '#24507f',
    cursor: 'pointer',
    fontSize: '10px',
    lineHeight: 1.3,
    fontWeight: 900,
  },

  disabledButton: {
    width: '100%',
    minHeight: '45px',
    padding: '11px 18px',
    border: '1px solid #d9e1eb',
    borderRadius: '11px',
    background: '#edf1f6',
    color: '#9aa7b7',
    cursor: 'not-allowed',
    fontSize: '13px',
    fontWeight: 800,
  },

  emptyAction: {
    color: '#9aa7b7',
    fontSize: '10px',
    fontWeight: 700,
  },

  contactBox: {
    padding: '15px',
    borderRadius: '13px',
    border: '1px solid #b9d3f2',
    background: '#f2f8ff',
    color: '#234b77',
    fontSize: '12px',
    lineHeight: 1.5,
  },

  contactText: {
    display: 'grid',
    gap: '5px',
    marginTop: '9px',
  },

  pagination: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    flexWrap: 'wrap',
    marginTop: '8px',
  },

  pageButton: {
    minWidth: '40px',
    minHeight: '38px',
    padding: '8px 12px',
    borderRadius: '9px',
    border: '1px solid #ccd9e8',
    background: '#ffffff',
    color: '#365372',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: 800,
  },

  pageButtonActive: {
    borderColor: '#176bff',
    background: '#176bff',
    color: '#ffffff',
    boxShadow: '0 7px 16px rgba(23,107,255,0.2)',
  },

  srOnly: {
    position: 'absolute',
    width: '1px',
    height: '1px',
    padding: 0,
    margin: '-1px',
    overflow: 'hidden',
    clip: 'rect(0, 0, 0, 0)',
    whiteSpace: 'nowrap',
    border: 0,
  },
};
