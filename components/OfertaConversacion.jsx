import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  detectarDatosContacto,
  enviarMensajeConversacion,
  enviarMensajeConversacionSolicitud,
  enviarMensajeOferta,
  esErrorChatPreOfertaNoDisponible,
  esErrorServicioConversacionNoDisponible,
  esOfertaAdjudicada,
  fetchMensajesConversacion,
  fetchMensajesOferta,
  marcarMensajesLeidosConversacion,
  marcarMensajesLeidosOferta,
  mensajeErrorCargaConversacion,
  mensajeErrorChatPreOferta,
  mensajeErrorEnvioConversacion,
  registrarErrorConversacion,
  subscribeMensajesConversacion,
  subscribeMensajesOferta,
} from '../lib/ofertaMensajes';

const AVISO_CONTACTO =
  'No compartas datos de contacto. Toda la comunicación debe realizarse a través de Kyntü hasta la adjudicación.';

const ERROR_CONFIGURACION =
  'No fue posible iniciar el chat. Configuración inválida.';

/**
 * @typedef {'oferta'|'conversacion'|'solicitud'} ModoChat
 */

/**
 * @param {{
 *   modoChat?: ModoChat,
 *   ofertaId?: string,
 *   conversacionId?: string,
 *   listasComprasId?: string,
 * }} params
 */
function validarConfiguracionModoChat({
  modoChat,
  ofertaId,
  conversacionId,
  listasComprasId,
}) {
  const tieneOferta = Boolean(ofertaId);
  const tieneConversacion = Boolean(conversacionId);
  const tieneSolicitud = Boolean(listasComprasId);
  const idsPresentes = [
    tieneOferta,
    tieneConversacion,
    tieneSolicitud,
  ].filter(Boolean).length;

  if (modoChat) {
    if (modoChat === 'oferta') {
      if (!tieneOferta || tieneConversacion || tieneSolicitud) {
        return { valido: false, modo: null };
      }
      return { valido: true, modo: 'oferta' };
    }

    if (modoChat === 'conversacion') {
      if (!tieneConversacion || tieneOferta || tieneSolicitud) {
        return { valido: false, modo: null };
      }
      return { valido: true, modo: 'conversacion' };
    }

    if (modoChat === 'solicitud') {
      if (!tieneSolicitud || tieneOferta || tieneConversacion) {
        return { valido: false, modo: null };
      }
      return { valido: true, modo: 'solicitud' };
    }

    return { valido: false, modo: null };
  }

  if (idsPresentes > 1) {
    registrarErrorConversacion(
      'modo',
      new Error(
        `Identificadores incompatibles: ofertaId=${Boolean(ofertaId)}, conversacionId=${Boolean(conversacionId)}, listasComprasId=${Boolean(listasComprasId)}`
      )
    );
    return { valido: false, modo: null };
  }

  if (tieneOferta) return { valido: true, modo: 'oferta' };
  if (tieneConversacion) return { valido: true, modo: 'conversacion' };
  if (tieneSolicitud) return { valido: true, modo: 'solicitud' };
  return { valido: false, modo: null };
}

/**
 * @param {import('../lib/ofertaMensajes').MensajeConversacion[]} prev
 * @param {import('../lib/ofertaMensajes').MensajeConversacion[]} incoming
 */
function mergeMensajes(prev, incoming) {
  const map = new Map(prev.map((msg) => [msg.id, msg]));

  for (const msg of incoming) {
    if (!msg?.id) continue;
    map.set(msg.id, msg);
  }

  return Array.from(map.values()).sort(
    (a, b) => new Date(a.created_at) - new Date(b.created_at)
  );
}

export default function OfertaConversacion({
  modoChat,
  ofertaId,
  conversacionId,
  listasComprasId,
  authUserId,
  estadoOferta,
  variant = 'dark',
  panelId,
  onLeidosActualizados,
  onConversacionCreada,
  participanteLabel = 'Contraparte',
  soloLectura = false,
  mensajeCierre = '',
}) {
  const [mensajes, setMensajes] = useState([]);
  const [texto, setTexto] = useState('');
  const [cargando, setCargando] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const [servicioDisponible, setServicioDisponible] = useState(true);
  const [advertenciaContacto, setAdvertenciaContacto] = useState('');

  const historialRef = useRef(null);
  const enviandoRef = useRef(false);
  const omitirCargaTrasCreacionRef = useRef(false);
  const operacionGenRef = useRef(0);

  const adjudicada = esOfertaAdjudicada(estadoOferta);
  const palette = variant === 'light' ? lightStyles : darkStyles;

  const configuracion = useMemo(
    () =>
      validarConfiguracionModoChat({
        modoChat,
        ofertaId,
        conversacionId,
        listasComprasId,
      }),
    [modoChat, conversacionId, listasComprasId, ofertaId]
  );

  const modo = configuracion.valido ? configuracion.modo : null;
  const configuracionInvalida = !configuracion.valido;

  const scrollAlFinal = useCallback(() => {
    const contenedor = historialRef.current;
    if (!contenedor) return;
    contenedor.scrollTop = contenedor.scrollHeight;
  }, []);

  const mensajeErrorCarga = useCallback(
    (err) =>
      modo === 'oferta'
        ? mensajeErrorCargaConversacion(err)
        : mensajeErrorChatPreOferta(err, { contexto: 'carga' }),
    [modo]
  );

  const mensajeErrorEnvio = useCallback(
    (err) =>
      modo === 'oferta'
        ? mensajeErrorEnvioConversacion(err)
        : mensajeErrorChatPreOferta(err, { contexto: 'envio' }),
    [modo]
  );

  const esErrorInfraestructura = useCallback(
    (err) =>
      modo === 'oferta'
        ? esErrorServicioConversacionNoDisponible(err)
        : esErrorChatPreOfertaNoDisponible(err),
    [modo]
  );

  const notificarLeidos = useCallback(() => {
    if (!onLeidosActualizados || !modo) return;

    if (modo === 'oferta') {
      onLeidosActualizados(ofertaId);
      return;
    }

    if (modo === 'conversacion') {
      onLeidosActualizados(conversacionId);
      return;
    }

    onLeidosActualizados(listasComprasId);
  }, [
    conversacionId,
    listasComprasId,
    modo,
    ofertaId,
    onLeidosActualizados,
  ]);

  const cargarYMarcarLeidos = useCallback(async () => {
    if (configuracionInvalida || !modo) {
      setCargando(false);
      setError(ERROR_CONFIGURACION);
      return;
    }

    const gen = ++operacionGenRef.current;

    if (modo === 'oferta') {
      setCargando(true);
      setError('');

      try {
        const data = await fetchMensajesOferta(ofertaId);
        if (gen !== operacionGenRef.current) return;

        setMensajes(data);
        setServicioDisponible(true);
        await marcarMensajesLeidosOferta(ofertaId);
        if (gen !== operacionGenRef.current) return;

        notificarLeidos();
      } catch (err) {
        if (gen !== operacionGenRef.current) return;

        registrarErrorConversacion('cargar', err);

        if (esErrorInfraestructura(err)) {
          setServicioDisponible(false);
          setError('');
        } else {
          setError(mensajeErrorCarga(err));
        }
      } finally {
        if (gen === operacionGenRef.current) {
          setCargando(false);
        }
      }

      return;
    }

    if (modo === 'conversacion') {
      if (omitirCargaTrasCreacionRef.current) {
        omitirCargaTrasCreacionRef.current = false;
        setCargando(false);
        setError('');
        setServicioDisponible(true);

        try {
          await marcarMensajesLeidosConversacion(conversacionId);
          if (gen === operacionGenRef.current) {
            notificarLeidos();
          }
        } catch (err) {
          registrarErrorConversacion('marcar-leidos-transicion', err);
        }

        return;
      }

      setCargando(true);
      setError('');

      try {
        const data = await fetchMensajesConversacion(conversacionId);
        if (gen !== operacionGenRef.current) return;

        setMensajes((prev) => mergeMensajes(prev, data));
        setServicioDisponible(true);
        await marcarMensajesLeidosConversacion(conversacionId);
        if (gen !== operacionGenRef.current) return;

        notificarLeidos();
      } catch (err) {
        if (gen !== operacionGenRef.current) return;

        registrarErrorConversacion('cargar', err);

        if (esErrorInfraestructura(err)) {
          setServicioDisponible(false);
          setError('');
        } else {
          setError(mensajeErrorCarga(err));
        }
      } finally {
        if (gen === operacionGenRef.current) {
          setCargando(false);
        }
      }

      return;
    }

    if (modo === 'solicitud') {
      setMensajes([]);
      setCargando(false);
      setError('');
      setServicioDisponible(true);
    }
  }, [
    configuracionInvalida,
    conversacionId,
    esErrorInfraestructura,
    listasComprasId,
    mensajeErrorCarga,
    modo,
    notificarLeidos,
    ofertaId,
  ]);

  const recargarSinMarcar = useCallback(async () => {
    if (configuracionInvalida || !modo) return;

    const gen = ++operacionGenRef.current;

    if (modo === 'oferta') {
      try {
        const data = await fetchMensajesOferta(ofertaId);
        if (gen !== operacionGenRef.current) return;

        setMensajes(data);
        setServicioDisponible(true);
      } catch (err) {
        if (gen !== operacionGenRef.current) return;

        registrarErrorConversacion('actualizar', err);

        if (esErrorInfraestructura(err)) {
          setServicioDisponible(false);
          setError('');
        } else {
          setError(mensajeErrorCarga(err));
        }
      }

      return;
    }

    if (modo === 'conversacion') {
      try {
        const data = await fetchMensajesConversacion(conversacionId);
        if (gen !== operacionGenRef.current) return;

        setMensajes((prev) => mergeMensajes(prev, data));
        setServicioDisponible(true);
      } catch (err) {
        if (gen !== operacionGenRef.current) return;

        registrarErrorConversacion('actualizar', err);

        if (esErrorInfraestructura(err)) {
          setServicioDisponible(false);
          setError('');
        } else {
          setError(mensajeErrorCarga(err));
        }
      }
    }
  }, [
    configuracionInvalida,
    conversacionId,
    esErrorInfraestructura,
    mensajeErrorCarga,
    modo,
    ofertaId,
  ]);

  useEffect(() => {
    if (configuracionInvalida) {
      setCargando(false);
      setError(ERROR_CONFIGURACION);
      return;
    }

    cargarYMarcarLeidos();
  }, [cargarYMarcarLeidos, configuracionInvalida]);

  useEffect(() => {
    if (configuracionInvalida || !modo) return undefined;

    if (modo === 'oferta') {
      return subscribeMensajesOferta(ofertaId, () => {
        cargarYMarcarLeidos();
      });
    }

    if (modo === 'conversacion') {
      return subscribeMensajesConversacion(conversacionId, () => {
        cargarYMarcarLeidos();
      });
    }

    return undefined;
  }, [
    cargarYMarcarLeidos,
    configuracionInvalida,
    conversacionId,
    modo,
    ofertaId,
    recargarSinMarcar,
  ]);

  useEffect(() => {
    if (!cargando) {
      scrollAlFinal();
    }
  }, [cargando, mensajes, scrollAlFinal]);

  useEffect(() => {
    const resultado = detectarDatosContacto(texto);
    if (!resultado.tieneContacto || adjudicada) {
      setAdvertenciaContacto('');
      return;
    }

    setAdvertenciaContacto(
      `Parece que estás compartiendo ${resultado.motivos.join(', ')}. No debes compartir datos de contacto antes de la adjudicación.`
    );
  }, [adjudicada, texto]);

  const handleEnviar = async () => {
    const valor = texto.trim();

    if (
      !valor ||
      soloLectura ||
      enviandoRef.current ||
      !servicioDisponible ||
      configuracionInvalida ||
      !modo
    ) {
      return;
    }

    enviandoRef.current = true;
    setEnviando(true);
    setError('');

    try {
      if (modo === 'oferta') {
        await enviarMensajeOferta(ofertaId, valor);
        setTexto('');
        setAdvertenciaContacto('');
        await recargarSinMarcar();
        scrollAlFinal();
        return;
      }

      if (modo === 'conversacion') {
        const resultado = await enviarMensajeConversacion(
          conversacionId,
          valor
        );

        setTexto('');
        setAdvertenciaContacto('');

        if (resultado.mensaje) {
          setMensajes((prev) =>
            mergeMensajes(prev, [resultado.mensaje])
          );
        } else {
          await recargarSinMarcar();
        }

        scrollAlFinal();
        return;
      }

      if (modo === 'solicitud') {
        const resultado = await enviarMensajeConversacionSolicitud(
          listasComprasId,
          valor
        );

        setTexto('');
        setAdvertenciaContacto('');

        if (resultado.mensaje) {
          setMensajes((prev) =>
            mergeMensajes(prev, [resultado.mensaje])
          );
        }

        if (resultado.conversacion_id) {
          omitirCargaTrasCreacionRef.current = true;
          onConversacionCreada?.(resultado.conversacion_id);
        }

        scrollAlFinal();
      }
    } catch (err) {
      registrarErrorConversacion('enviar', err);

      if (esErrorInfraestructura(err)) {
        setServicioDisponible(false);
        setError('');
      } else {
        setError(mensajeErrorEnvio(err));
      }
    } finally {
      setEnviando(false);
      enviandoRef.current = false;
    }
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      event.stopPropagation();
      handleEnviar();
    }
  };

  const etiquetaRemitente = (remitenteAuthId) => {
    if (remitenteAuthId === authUserId) return 'Tú';
    return participanteLabel;
  };

  const mensajeServicioNoDisponible =
    modo === 'oferta'
      ? 'El servicio de conversación aún no está disponible.'
      : 'El chat pre-oferta aún no está habilitado.';

  const inputDeshabilitado =
    soloLectura ||
    enviando ||
    !servicioDisponible ||
    configuracionInvalida ||
    !modo;

  return (
    <div
      id={panelId}
      style={palette.wrapper}
      onClick={(e) => e.stopPropagation()}
    >
      <div style={palette.headerRow}>
        <span style={palette.headerTitle}>Conversación</span>
      </div>

      <div ref={historialRef} style={palette.historial}>
        {configuracionInvalida ? (
          <p style={palette.estadoTexto}>{ERROR_CONFIGURACION}</p>
        ) : cargando ? (
          <p style={palette.estadoTexto}>Cargando conversación…</p>
        ) : !servicioDisponible ? (
          <p style={palette.estadoTexto}>{mensajeServicioNoDisponible}</p>
        ) : mensajes.length === 0 ? (
          <p style={palette.estadoTexto}>
            Aún no hay mensajes. Escribe para iniciar la conversación.
          </p>
        ) : (
          mensajes.map((msg) => {
            const esPropio = msg.remitente_auth_id === authUserId;

            return (
              <div
                key={msg.id}
                style={{
                  ...palette.burbuja,
                  ...(esPropio ? palette.burbujaPropia : palette.burbujaAjena),
                }}
              >
                <div style={palette.burbujaMeta}>
                  <span style={palette.etiqueta}>
                    {etiquetaRemitente(msg.remitente_auth_id)}
                  </span>
                  <span style={palette.fecha}>
                    {new Date(msg.created_at).toLocaleString('es-CL', {
                      day: '2-digit',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
                <p style={palette.mensajeTexto}>{msg.mensaje}</p>
              </div>
            );
          })
        )}
      </div>

      {!soloLectura && !adjudicada && (
        <p style={palette.avisoContacto}>{AVISO_CONTACTO}</p>
      )}

      {advertenciaContacto && (
        <p style={palette.advertencia}>{advertenciaContacto}</p>
      )}

      {error && <p style={palette.error}>{error}</p>}

      {soloLectura && mensajeCierre && (
        <p style={palette.avisoCierre}>{mensajeCierre}</p>
      )}

      {!soloLectura && (
        <div style={palette.inputRow}>
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={handleKeyDown}
            onClick={(e) => e.stopPropagation()}
            placeholder="Escribe un mensaje…"
            rows={2}
            style={palette.textarea}
            disabled={inputDeshabilitado}
          />
          <button
            type="button"
            onClick={handleEnviar}
            disabled={inputDeshabilitado || !texto.trim()}
            style={{
              ...palette.enviarBtn,
              ...(inputDeshabilitado || !texto.trim()
                ? palette.enviarBtnDisabled
                : {}),
            }}
          >
            {enviando ? '…' : 'Enviar'}
          </button>
        </div>
      )}
    </div>
  );
}

const darkStyles = {
  wrapper: {
    marginTop: '12px',
    paddingTop: '12px',
    borderTop: '1px solid rgba(255,255,255,0.10)',
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
    boxSizing: 'border-box',
    overflow: 'hidden',
  },
  headerRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '8px',
    marginBottom: '8px',
    flexWrap: 'wrap',
  },
  headerTitle: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: '12px',
    fontWeight: 700,
  },
  historial: {
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
    height: '160px',
    minHeight: '160px',
    maxHeight: '160px',
    overflowY: 'auto',
    overflowX: 'hidden',
    padding: '8px',
    borderRadius: '12px',
    border: '1px solid rgba(255,255,255,0.10)',
    background: 'rgba(0,0,0,0.18)',
    boxSizing: 'border-box',
  },
  estadoTexto: {
    margin: 0,
    color: 'rgba(255,255,255,0.55)',
    fontSize: '12px',
    fontStyle: 'italic',
  },
  burbuja: {
    marginBottom: '8px',
    padding: '8px 10px',
    borderRadius: '10px',
    maxWidth: '100%',
    boxSizing: 'border-box',
  },
  burbujaPropia: {
    background: 'rgba(49, 247, 198, 0.12)',
    border: '1px solid rgba(49, 247, 198, 0.22)',
  },
  burbujaAjena: {
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.10)',
  },
  burbujaMeta: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '8px',
    marginBottom: '4px',
    flexWrap: 'wrap',
  },
  etiqueta: {
    color: '#31f7c6',
    fontSize: '10px',
    fontWeight: 800,
    textTransform: 'uppercase',
  },
  fecha: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: '10px',
  },
  mensajeTexto: {
    margin: 0,
    color: 'rgba(255,255,255,0.88)',
    fontSize: '12px',
    lineHeight: 1.45,
    overflowWrap: 'anywhere',
    whiteSpace: 'pre-wrap',
  },
  avisoContacto: {
    margin: '8px 0 0',
    color: 'rgba(255,255,255,0.55)',
    fontSize: '10px',
    lineHeight: 1.4,
  },
  avisoCierre: {
    margin: '10px 0 0',
    color: 'rgba(255,255,255,0.72)',
    fontSize: '11px',
    lineHeight: 1.45,
    fontStyle: 'italic',
  },
  advertencia: {
    margin: '6px 0 0',
    color: '#ffd166',
    fontSize: '10px',
    lineHeight: 1.4,
  },
  error: {
    margin: '6px 0 0',
    color: '#ff8fa3',
    fontSize: '11px',
  },
  inputRow: {
    display: 'flex',
    gap: '8px',
    marginTop: '8px',
    alignItems: 'stretch',
    flexWrap: 'wrap',
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
    boxSizing: 'border-box',
  },
  textarea: {
    flex: '1 1 120px',
    minWidth: 0,
    width: '100%',
    maxWidth: '100%',
    minHeight: '44px',
    maxHeight: '72px',
    padding: '10px 12px',
    borderRadius: '10px',
    border: '1px solid rgba(255,255,255,0.18)',
    background: 'rgba(255,255,255,0.08)',
    color: '#ffffff',
    resize: 'vertical',
    boxSizing: 'border-box',
    fontFamily: 'inherit',
    fontSize: '12px',
  },
  enviarBtn: {
    flex: '0 0 auto',
    alignSelf: 'flex-end',
    padding: '10px 14px',
    borderRadius: '10px',
    border: 'none',
    background: '#31f7c6',
    color: '#041018',
    fontWeight: 800,
    fontSize: '12px',
    cursor: 'pointer',
    minWidth: '72px',
  },
  enviarBtnDisabled: {
    opacity: 0.55,
    cursor: 'not-allowed',
  },
};

const lightStyles = {
  ...darkStyles,
  wrapper: {
    ...darkStyles.wrapper,
    borderTop: '1px solid #e1e9f4',
  },
  headerTitle: {
    ...darkStyles.headerTitle,
    color: '#52627a',
  },
  historial: {
    ...darkStyles.historial,
    background: '#f6f9fd',
    border: '1px solid #e1e9f4',
  },
  estadoTexto: {
    ...darkStyles.estadoTexto,
    color: '#8a94a6',
  },
  burbujaPropia: {
    background: 'rgba(23, 107, 255, 0.08)',
    border: '1px solid rgba(23, 107, 255, 0.18)',
  },
  burbujaAjena: {
    background: '#ffffff',
    border: '1px solid #dfe8f3',
  },
  etiqueta: {
    ...darkStyles.etiqueta,
    color: '#176bff',
  },
  fecha: {
    ...darkStyles.fecha,
    color: '#8a94a6',
  },
  mensajeTexto: {
    ...darkStyles.mensajeTexto,
    color: '#3a4658',
  },
  avisoContacto: {
    ...darkStyles.avisoContacto,
    color: '#8a94a6',
  },
  avisoCierre: {
    ...darkStyles.avisoCierre,
    color: '#65758b',
  },
  textarea: {
    ...darkStyles.textarea,
    background: '#ffffff',
    border: '1px solid #dfe8f3',
    color: '#3a4658',
  },
  enviarBtn: {
    ...darkStyles.enviarBtn,
    background: '#176bff',
    color: '#ffffff',
  },
};
