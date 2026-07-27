import { useCallback, useEffect, useRef, useState } from 'react';
import {
  detectarDatosContacto,
  enviarMensajeOferta,
  esErrorServicioConversacionNoDisponible,
  esOfertaAdjudicada,
  fetchMensajesOferta,
  marcarMensajesLeidosOferta,
  mensajeErrorCargaConversacion,
  mensajeErrorEnvioConversacion,
  registrarErrorConversacion,
  subscribeMensajesOferta,
} from '../lib/ofertaMensajes';

const AVISO_CONTACTO =
  'No compartas datos de contacto. Toda la comunicación debe realizarse a través de Kyntü hasta la adjudicación.';

export default function OfertaConversacion({
  ofertaId,
  authUserId,
  estadoOferta,
  variant = 'dark',
  panelId,
  onLeidosActualizados,
  participanteLabel = 'Contraparte',
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
  const adjudicada = esOfertaAdjudicada(estadoOferta);
  const palette = variant === 'light' ? lightStyles : darkStyles;

  const scrollAlFinal = useCallback(() => {
    const contenedor = historialRef.current;
    if (!contenedor) return;
    contenedor.scrollTop = contenedor.scrollHeight;
  }, []);

  const cargarYMarcarLeidos = useCallback(async () => {
    if (!ofertaId) return;

    setCargando(true);
    setError('');

    try {
      const data = await fetchMensajesOferta(ofertaId);
      setMensajes(data);
      setServicioDisponible(true);
      await marcarMensajesLeidosOferta(ofertaId);
      if (onLeidosActualizados) onLeidosActualizados(ofertaId);
    } catch (err) {
      registrarErrorConversacion('cargar', err);

      if (esErrorServicioConversacionNoDisponible(err)) {
        setServicioDisponible(false);
        setError('');
      } else {
        setError(mensajeErrorCargaConversacion(err));
      }
    } finally {
      setCargando(false);
    }
  }, [ofertaId, onLeidosActualizados]);

  const recargarSinMarcar = useCallback(async () => {
    if (!ofertaId) return;

    try {
      const data = await fetchMensajesOferta(ofertaId);
      setMensajes(data);
      setServicioDisponible(true);
    } catch (err) {
      registrarErrorConversacion('actualizar', err);

      if (esErrorServicioConversacionNoDisponible(err)) {
        setServicioDisponible(false);
        setError('');
      } else {
        setError(mensajeErrorCargaConversacion(err));
      }
    }
  }, [ofertaId]);

  useEffect(() => {
    cargarYMarcarLeidos();
  }, [cargarYMarcarLeidos]);

  useEffect(() => {
    if (!ofertaId) return undefined;

    return subscribeMensajesOferta(ofertaId, () => {
      cargarYMarcarLeidos();
    });
  }, [cargarYMarcarLeidos, ofertaId]);

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
    if (!valor || enviandoRef.current || !servicioDisponible) return;

    enviandoRef.current = true;
    setEnviando(true);
    setError('');

    try {
      await enviarMensajeOferta(ofertaId, valor);
      setTexto('');
      setAdvertenciaContacto('');
      await recargarSinMarcar();
      scrollAlFinal();
    } catch (err) {
      registrarErrorConversacion('enviar', err);

      if (esErrorServicioConversacionNoDisponible(err)) {
        setServicioDisponible(false);
        setError('');
      } else {
        setError(mensajeErrorEnvioConversacion(err));
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
        {cargando ? (
          <p style={palette.estadoTexto}>Cargando conversación…</p>
        ) : !servicioDisponible ? (
          <p style={palette.estadoTexto}>
            El servicio de conversación aún no está disponible.
          </p>
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

      {!adjudicada && (
        <p style={palette.avisoContacto}>{AVISO_CONTACTO}</p>
      )}

      {advertenciaContacto && (
        <p style={palette.advertencia}>{advertenciaContacto}</p>
      )}

      {error && <p style={palette.error}>{error}</p>}

      <div style={palette.inputRow}>
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={handleKeyDown}
          onClick={(e) => e.stopPropagation()}
          placeholder="Escribe un mensaje…"
          rows={2}
          style={palette.textarea}
          disabled={enviando || !servicioDisponible}
        />
        <button
          type="button"
          onClick={handleEnviar}
          disabled={enviando || !servicioDisponible || !texto.trim()}
          style={{
            ...palette.enviarBtn,
            ...(enviando || !servicioDisponible || !texto.trim()
              ? palette.enviarBtnDisabled
              : {}),
          }}
        >
          {enviando ? '…' : 'Enviar'}
        </button>
      </div>
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
