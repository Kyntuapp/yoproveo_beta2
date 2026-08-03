import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MessageCircle, Reply, X } from 'lucide-react';
import {
  detectarDatosContacto,
  enviarMensajeConversacion,
  fetchBadgeBandejaConsolidada,
  fetchMensajesConsolidadosBandeja,
  leerConversacionesTraspasadasAOferta,
  marcarLeidosBandejaConsolidada,
  mensajeErrorEnvioConversacion,
  subscribeBandejaSolicitud,
} from '../lib/ofertaMensajes';

const AVISO_CONTACTO =
  'No compartas datos de contacto. Toda la comunicación debe realizarse a través de Kyntü hasta la adjudicación.';

const ERROR_DATOS_CONTACTO =
  'No puedes enviar datos de contacto en el chat. Retira correo, teléfono o RUT e intenta de nuevo.';

function truncarTexto(texto, max = 80) {
  const limpio = (texto || '').toString().trim();
  if (!limpio) return '';
  if (limpio.length <= max) return limpio;
  return `${limpio.slice(0, max - 1)}…`;
}

function formatearHoraMensaje(fecha) {
  if (!fecha) return '';

  const d = new Date(fecha);
  if (Number.isNaN(d.getTime())) return '';

  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');

  return `${dd}/${mm} ${hh}:${min}`;
}

function mergeMensajes(prev, incoming) {
  const map = new Map((prev || []).map((msg) => [msg.id, msg]));

  (incoming || []).forEach((msg) => {
    if (msg?.id) map.set(msg.id, msg);
  });

  return Array.from(map.values()).sort(
    (a, b) => new Date(a.created_at) - new Date(b.created_at)
  );
}

function useBandejaResumen(listasComprasId, authUserId, traspasadasRevision) {
  const [badge, setBadge] = useState({
    tieneConversaciones: false,
    totalNoLeidos: 0,
    conversacionIds: [],
  });

  const traspasadas = useMemo(
    () => leerConversacionesTraspasadasAOferta(listasComprasId),
    [listasComprasId, traspasadasRevision]
  );

  const refrescarBadge = useCallback(async () => {
    if (!listasComprasId || !authUserId) {
      setBadge({
        tieneConversaciones: false,
        totalNoLeidos: 0,
        conversacionIds: [],
      });
      return;
    }

    try {
      const res = await fetchBadgeBandejaConsolidada(
        listasComprasId,
        authUserId,
        traspasadas
      );
      setBadge(res);
    } catch (err) {
      console.error('Error cargando badge bandeja:', err);
      setBadge({
        tieneConversaciones: false,
        totalNoLeidos: 0,
        conversacionIds: [],
      });
    }
  }, [authUserId, listasComprasId, traspasadas]);

  useEffect(() => {
    refrescarBadge();
  }, [refrescarBadge]);

  useEffect(() => {
    if (!listasComprasId) return undefined;
    return subscribeBandejaSolicitud(
      listasComprasId,
      badge.conversacionIds,
      refrescarBadge
    );
  }, [badge.conversacionIds, listasComprasId, refrescarBadge]);

  return { badge, traspasadas, refrescarBadge };
}

export function IconoChatPreOferta({
  listasComprasId,
  authUserId,
  traspasadasRevision = 0,
  activo = false,
  onClick,
}) {
  const { badge } = useBandejaResumen(
    listasComprasId,
    authUserId,
    traspasadasRevision
  );

  if (!badge.tieneConversaciones) return null;

  return (
    <button
      type="button"
      className="kyntu-chatIconBtn"
      style={{
        ...styles.iconButton,
        ...(activo ? styles.iconButtonActivo : {}),
      }}
      aria-label={
        badge.totalNoLeidos > 0
          ? `${badge.totalNoLeidos} mensajes nuevos`
          : 'Abrir consultas de proveedores'
      }
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
    >
      <MessageCircle size={16} strokeWidth={2.2} />
      {badge.totalNoLeidos > 0 && (
        <span style={styles.iconBadge}>
          {badge.totalNoLeidos > 99 ? '99+' : badge.totalNoLeidos}
        </span>
      )}
    </button>
  );
}

export default function BandejaMensajesComerciales({
  listasComprasId,
  authUserId,
  abierto = false,
  conversacionDestacadaId = null,
  traspasadasRevision = 0,
  onLeidosChange,
}) {
  const [mensajes, setMensajes] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [texto, setTexto] = useState('');
  const [error, setError] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [etiquetas, setEtiquetas] = useState({});
  const [citacionesPorMensaje, setCitacionesPorMensaje] = useState({});

  const historialRef = useRef(null);
  const operacionGenRef = useRef(0);
  const leidosMarcadosRef = useRef(false);
  const enviandoRef = useRef(false);

  const { badge, traspasadas, refrescarBadge } = useBandejaResumen(
    listasComprasId,
    authUserId,
    traspasadasRevision
  );

  const scrollAlFinal = useCallback(() => {
    const contenedor = historialRef.current;
    if (!contenedor) return;
    contenedor.scrollTop = contenedor.scrollHeight;
  }, []);

  const cargarMensajes = useCallback(async () => {
    if (!listasComprasId || !authUserId) return;

    const gen = ++operacionGenRef.current;
    setCargando(true);
    setError('');

    try {
      const resultado = await fetchMensajesConsolidadosBandeja(
        listasComprasId,
        authUserId,
        { traspasadas }
      );

      if (gen !== operacionGenRef.current) return;

      setMensajes(resultado.mensajes);
      setEtiquetas(resultado.etiquetas);

      if (abierto && resultado.conversacionIds.length > 0) {
        await marcarLeidosBandejaConsolidada(resultado.conversacionIds);
        if (gen !== operacionGenRef.current) return;
        leidosMarcadosRef.current = true;
        refrescarBadge();
        onLeidosChange?.();
      }
    } catch (err) {
      if (gen !== operacionGenRef.current) return;
      console.error('Error cargando chat consolidado:', err);
      setError('No fue posible cargar los mensajes.');
      setMensajes([]);
    } finally {
      if (gen === operacionGenRef.current) {
        setCargando(false);
      }
    }
  }, [
    abierto,
    authUserId,
    listasComprasId,
    onLeidosChange,
    refrescarBadge,
    traspasadas,
  ]);

  useEffect(() => {
    if (!abierto) {
      leidosMarcadosRef.current = false;
      return;
    }

    cargarMensajes();
  }, [abierto, cargarMensajes]);

  useEffect(() => {
    if (!abierto || !listasComprasId) return undefined;

    return subscribeBandejaSolicitud(
      listasComprasId,
      badge.conversacionIds,
      async () => {
        try {
          const resultado = await fetchMensajesConsolidadosBandeja(
            listasComprasId,
            authUserId,
            { traspasadas }
          );

          setMensajes((prev) => mergeMensajes(prev, resultado.mensajes));
          setEtiquetas(resultado.etiquetas);

          if (abierto && resultado.conversacionIds.length > 0) {
            await marcarLeidosBandejaConsolidada(resultado.conversacionIds);
            refrescarBadge();
            onLeidosChange?.();
          }
        } catch (err) {
          console.error('Error realtime bandeja:', err);
        }
      }
    );
  }, [
    abierto,
    authUserId,
    badge.conversacionIds,
    listasComprasId,
    onLeidosChange,
    refrescarBadge,
    traspasadas,
  ]);

  useEffect(() => {
    if (!abierto || mensajes.length === 0) return;
    requestAnimationFrame(scrollAlFinal);
  }, [abierto, mensajes.length, scrollAlFinal]);

  useEffect(() => {
    if (!abierto || !conversacionDestacadaId || mensajes.length === 0) return;

    const target = historialRef.current?.querySelector(
      `[data-conversacion-id="${conversacionDestacadaId}"]`
    );

    target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [abierto, conversacionDestacadaId, mensajes.length]);

  const cancelarRespuesta = () => {
    setReplyTo(null);
  };

  const seleccionarRespuesta = (msg) => {
    setReplyTo({
      conversacionId: msg.conversacion_id,
      etiqueta: msg.etiqueta,
      mensajeId: msg.id,
      extracto: truncarTexto(msg.mensaje, 120),
    });
    setError('');
  };

  const handleEnviar = async () => {
    const textoLimpio = texto.trim();

    if (!replyTo?.conversacionId || !textoLimpio || enviandoRef.current) {
      return;
    }

    const contacto = detectarDatosContacto(textoLimpio);
    if (contacto.tieneContacto) {
      setError(ERROR_DATOS_CONTACTO);
      return;
    }

    enviandoRef.current = true;
    setEnviando(true);
    setError('');

    const replySnapshot = { ...replyTo };
    const extractoRespuesta = replySnapshot.extracto;
    const convId = replySnapshot.conversacionId;
    const etiquetaDestino = replySnapshot.etiqueta;

    try {
      const resultado = await enviarMensajeConversacion(convId, textoLimpio);

      if (!resultado?.mensaje?.id) {
        throw new Error(
          'El servidor no confirmó el mensaje. Intenta de nuevo.'
        );
      }

      const mensajeId = resultado.mensaje.id;

      if (extractoRespuesta) {
        setCitacionesPorMensaje((prev) => ({
          ...prev,
          [mensajeId]: extractoRespuesta,
        }));
      }

      const mensajeNormalizado = {
        id: mensajeId,
        conversacion_id: convId,
        mensaje: resultado.mensaje.mensaje || textoLimpio,
        created_at: resultado.mensaje.created_at || new Date().toISOString(),
        esPropio: true,
        etiqueta: etiquetaDestino,
      };

      setMensajes((prev) => mergeMensajes(prev, [mensajeNormalizado]));
      setTexto('');
      setReplyTo(null);
      requestAnimationFrame(scrollAlFinal);

      try {
        const recarga = await fetchMensajesConsolidadosBandeja(
          listasComprasId,
          authUserId,
          { traspasadas }
        );
        setMensajes(recarga.mensajes);
        setEtiquetas(recarga.etiquetas);
        requestAnimationFrame(scrollAlFinal);
      } catch (recargaErr) {
        console.error('Error recargando chat consolidado:', recargaErr);
      }
    } catch (err) {
      console.error('Error enviando mensaje consolidado:', err);
      setError(
        err?.message
          ? mensajeErrorEnvioConversacion(err)
          : 'No se pudo enviar el mensaje. Intenta de nuevo.'
      );
    } finally {
      enviandoRef.current = false;
      setEnviando(false);
    }
  };

  if (!abierto) return null;

  return (
    <div
      id={`chat-consolidado-${listasComprasId}`}
      className="kyntu-chatConsolidado"
      style={styles.panel}
    >
      {cargando && mensajes.length === 0 ? (
        <p style={styles.estado}>Cargando consultas…</p>
      ) : mensajes.length === 0 ? (
        <p style={styles.estado}>
          No hay consultas pre-oferta activas para este producto.
        </p>
      ) : (
        <div
          ref={historialRef}
          className="kyntu-chatHistorial"
          style={styles.historial}
        >
          {mensajes.map((msg) => {
            const destacado =
              conversacionDestacadaId &&
              String(msg.conversacion_id) ===
                String(conversacionDestacadaId);

            if (msg.esPropio) {
              return (
                <div
                  key={msg.id}
                  data-conversacion-id={msg.conversacion_id}
                  style={{
                    ...styles.mensajePropio,
                    ...(destacado ? styles.mensajeDestacado : {}),
                  }}
                >
                  <div style={styles.mensajeHeader}>
                    <strong style={styles.etiquetaPropio}>
                      Tú · para {msg.etiqueta}
                    </strong>
                    <span style={styles.hora}>
                      {formatearHoraMensaje(msg.created_at)}
                    </span>
                  </div>
                  {msg.respuestaA && (
                    <div style={styles.citaRespuesta}>{msg.respuestaA}</div>
                  )}
                  {!msg.respuestaA && citacionesPorMensaje[msg.id] && (
                    <div style={styles.citaRespuesta}>
                      {citacionesPorMensaje[msg.id]}
                    </div>
                  )}
                  <p style={styles.cuerpo}>{msg.mensaje}</p>
                </div>
              );
            }

            return (
              <div
                key={msg.id}
                data-conversacion-id={msg.conversacion_id}
                style={{
                  ...styles.mensajeRecibido,
                  ...(destacado ? styles.mensajeDestacado : {}),
                }}
              >
                <div style={styles.mensajeRecibidoInner}>
                  <div style={styles.mensajeContenido}>
                    <div style={styles.mensajeHeader}>
                      <strong style={styles.etiquetaProveedor}>
                        {msg.etiqueta}
                      </strong>
                      <span style={styles.hora}>
                        {formatearHoraMensaje(msg.created_at)}
                      </span>
                    </div>
                    <p style={styles.cuerpo}>{msg.mensaje}</p>
                  </div>
                  <button
                    type="button"
                    style={styles.responderBtn}
                    aria-label={`Responder a ${msg.etiqueta}`}
                    onClick={() => seleccionarRespuesta(msg)}
                  >
                    <Reply size={14} strokeWidth={2.2} />
                    <span>Responder</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {replyTo && (
        <div style={styles.franjaRespuesta}>
          <div style={styles.franjaInfo}>
            <strong style={styles.franjaTitulo}>
              Respondiendo a {replyTo.etiqueta}
            </strong>
            <span style={styles.franjaExtracto}>
              “{replyTo.extracto}”
            </span>
          </div>
          <button
            type="button"
            style={styles.cancelarBtn}
            aria-label="Cancelar respuesta"
            onClick={cancelarRespuesta}
          >
            <X size={16} />
          </button>
        </div>
      )}

      <p style={styles.avisoInfo}>{AVISO_CONTACTO}</p>

      {error && <p style={styles.error}>{error}</p>}

      <div style={styles.composer}>
        <textarea
          value={texto}
          onChange={(e) => {
            setTexto(e.target.value);
            if (error === ERROR_DATOS_CONTACTO) setError('');
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleEnviar();
            }
          }}
          placeholder={
            replyTo
              ? `Escribe tu respuesta para ${replyTo.etiqueta}…`
              : 'Selecciona Responder en un mensaje del proveedor…'
          }
          rows={2}
          style={styles.textarea}
          disabled={!replyTo || enviando}
        />
        <button
          type="button"
          style={{
            ...styles.enviarBtn,
            ...((!replyTo || !texto.trim() || enviando)
              ? styles.enviarBtnDisabled
              : {}),
          }}
          disabled={!replyTo || !texto.trim() || enviando}
          onClick={handleEnviar}
        >
          {enviando ? 'Enviando…' : 'Enviar'}
        </button>
      </div>

      <style jsx>{`
        @media (max-width: 620px) {
          .kyntu-chatHistorial {
            max-height: 280px !important;
          }
        }

        @media (max-width: 375px) {
          .kyntu-chatConsolidado {
            padding: 10px !important;
          }
        }
      `}</style>
    </div>
  );
}

const styles = {
  iconButton: {
    position: 'relative',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '28px',
    height: '28px',
    marginLeft: '8px',
    padding: 0,
    borderRadius: '8px',
    border: '1px solid #c8daf0',
    background: '#f5f9ff',
    color: '#24507f',
    cursor: 'pointer',
    flexShrink: 0,
    verticalAlign: 'middle',
  },

  iconButtonActivo: {
    border: '1px solid rgba(23, 107, 255, 0.55)',
    background: '#e8f1ff',
    boxShadow: 'inset 0 0 0 1px rgba(23, 107, 255, 0.12)',
  },

  iconBadge: {
    position: 'absolute',
    top: '-5px',
    right: '-5px',
    minWidth: '16px',
    height: '16px',
    padding: '0 4px',
    borderRadius: '999px',
    background: '#2563EB',
    color: '#ffffff',
    fontSize: '9px',
    fontWeight: 800,
    lineHeight: '16px',
    textAlign: 'center',
  },

  panel: {
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
    padding: '14px',
    borderRadius: '14px',
    border: '1px solid #dfe8f3',
    background: '#ffffff',
    boxShadow: '0 8px 24px rgba(28, 69, 128, 0.06)',
    boxSizing: 'border-box',
  },

  historial: {
    maxHeight: '360px',
    overflowY: 'auto',
    overflowX: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    padding: '4px 2px 8px',
    marginBottom: '10px',
  },

  mensajeRecibido: {
    alignSelf: 'flex-start',
    maxWidth: '92%',
    minWidth: 0,
  },

  mensajeRecibidoInner: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '8px',
    minWidth: 0,
  },

  mensajeContenido: {
    flex: 1,
    minWidth: 0,
    padding: '10px 12px',
    borderRadius: '12px',
    background: '#f3f7fc',
    border: '1px solid #e3ebf5',
  },

  mensajePropio: {
    alignSelf: 'flex-end',
    maxWidth: '92%',
    minWidth: 0,
    padding: '10px 12px',
    borderRadius: '12px',
    background: '#eef5ff',
    border: '1px solid #cfe0fb',
  },

  mensajeDestacado: {
    boxShadow: '0 0 0 2px rgba(23, 107, 255, 0.25)',
  },

  mensajeHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '8px',
    marginBottom: '4px',
    flexWrap: 'wrap',
  },

  etiquetaProveedor: {
    color: '#102b50',
    fontSize: '12px',
    fontWeight: 900,
  },

  etiquetaPropio: {
    color: '#1a4f8c',
    fontSize: '12px',
    fontWeight: 900,
  },

  hora: {
    color: '#9aa7b7',
    fontSize: '10px',
    fontWeight: 700,
    whiteSpace: 'nowrap',
  },

  cuerpo: {
    margin: 0,
    color: '#334155',
    fontSize: '13px',
    lineHeight: 1.45,
    overflowWrap: 'anywhere',
    wordBreak: 'break-word',
  },

  citaRespuesta: {
    marginBottom: '6px',
    padding: '6px 8px',
    borderLeft: '3px solid #94b8e8',
    borderRadius: '6px',
    background: 'rgba(255,255,255,0.55)',
    color: '#5b6b7f',
    fontSize: '11px',
    lineHeight: 1.35,
    overflowWrap: 'anywhere',
  },

  responderBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    flexShrink: 0,
    padding: '6px 8px',
    borderRadius: '8px',
    border: '1px solid #c8daf0',
    background: '#ffffff',
    color: '#24507f',
    cursor: 'pointer',
    fontSize: '10px',
    fontWeight: 800,
    whiteSpace: 'nowrap',
  },

  franjaRespuesta: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: '10px',
    marginBottom: '8px',
    padding: '10px 12px',
    borderRadius: '10px',
    border: '1px solid #b9d0ef',
    background: '#f0f6ff',
  },

  franjaInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    minWidth: 0,
  },

  franjaTitulo: {
    color: '#102b50',
    fontSize: '12px',
    fontWeight: 900,
  },

  franjaExtracto: {
    color: '#5b6b7f',
    fontSize: '11px',
    lineHeight: 1.4,
    overflowWrap: 'anywhere',
  },

  cancelarBtn: {
    flexShrink: 0,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '28px',
    height: '28px',
    border: 'none',
    borderRadius: '8px',
    background: 'transparent',
    color: '#65758b',
    cursor: 'pointer',
  },

  composer: {
    display: 'flex',
    alignItems: 'stretch',
    gap: '8px',
    minWidth: 0,
  },

  textarea: {
    flex: 1,
    minWidth: 0,
    minHeight: '44px',
    padding: '10px 12px',
    borderRadius: '10px',
    border: '1px solid #d7e3f2',
    background: '#fbfdff',
    color: '#102b50',
    fontSize: '13px',
    lineHeight: 1.4,
    resize: 'vertical',
    boxSizing: 'border-box',
  },

  enviarBtn: {
    flexShrink: 0,
    alignSelf: 'flex-end',
    minHeight: '44px',
    padding: '0 16px',
    borderRadius: '10px',
    border: 'none',
    background: '#176bff',
    color: '#ffffff',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: 900,
  },

  enviarBtnDisabled: {
    background: '#b8c9e6',
    cursor: 'not-allowed',
  },

  estado: {
    margin: '0 0 10px',
    color: '#748399',
    fontSize: '12px',
    fontStyle: 'italic',
  },

  avisoInfo: {
    margin: '0 0 8px',
    color: '#65758b',
    fontSize: '11px',
    lineHeight: 1.4,
  },

  error: {
    margin: '0 0 8px',
    color: '#b42318',
    fontSize: '11px',
    lineHeight: 1.4,
  },
};
