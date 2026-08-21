import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowLeft,
  Headphones,
  LoaderCircle,
  MessageCircle,
  Plus,
  Send,
  X,
} from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import {
  contarNoLeidosSoporte,
  crearConversacionSoporte,
  enviarMensajeSoporte,
  etiquetaEstadoSoporte,
  formatearFechaSoporte,
  listarConversacionesSoporteUsuario,
  marcarMensajesSoporteLeidos,
  obtenerMensajesSoporte,
  subscribeMensajesSoporte,
  subscribeSoporteUsuario,
} from '../../lib/soporteMensajes';

/**
 * Ícono de soporte en header + ventana flotante (portal a document.body).
 * Independiente de la campana de notificaciones.
 */
export default function SoporteLauncher({
  perfilId,
  rol = 'comprador',
}) {
  const [montado, setMontado] = useState(false);
  const [abierto, setAbierto] = useState(false);
  const [vista, setVista] = useState('lista'); // lista | nueva | chat
  const [conversaciones, setConversaciones] = useState([]);
  const [activa, setActiva] = useState(null);
  const [mensajes, setMensajes] = useState([]);
  const [noLeidos, setNoLeidos] = useState(0);
  const [cargandoLista, setCargandoLista] = useState(false);
  const [cargandoChat, setCargandoChat] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const [asunto, setAsunto] = useState('');
  const [texto, setTexto] = useState('');
  const [authUserId, setAuthUserId] = useState(null);

  const panelRef = useRef(null);
  const historialRef = useRef(null);
  const enviandoRef = useRef(false);
  const triggerRef = useRef(null);

  useEffect(() => {
    setMontado(true);
  }, []);

  const refrescarBadge = useCallback(async () => {
    try {
      const total = await contarNoLeidosSoporte();
      setNoLeidos(total);
    } catch (err) {
      console.error('Error badge soporte:', err?.message || err);
    }
  }, []);

  const refrescarLista = useCallback(async () => {
    setCargandoLista(true);
    setError('');
    try {
      const rows = await listarConversacionesSoporteUsuario();
      setConversaciones(rows);
      await refrescarBadge();
    } catch (err) {
      setError(err?.message || 'No se pudieron cargar las conversaciones.');
    } finally {
      setCargandoLista(false);
    }
  }, [refrescarBadge]);

  const abrirConversacion = useCallback(
    async (conv) => {
      if (!conv?.id) return;
      setActiva(conv);
      setVista('chat');
      setCargandoChat(true);
      setError('');
      setTexto('');
      try {
        const msgs = await obtenerMensajesSoporte(conv.id);
        setMensajes(msgs);
        await marcarMensajesSoporteLeidos(conv.id);
        await refrescarLista();
      } catch (err) {
        setError(err?.message || 'No se pudo abrir la conversación.');
      } finally {
        setCargandoChat(false);
      }
    },
    [refrescarLista]
  );

  useEffect(() => {
    if (!perfilId) return undefined;

    let mounted = true;

    const boot = async () => {
      const { data } = await supabase.auth.getUser();
      if (!mounted) return;
      setAuthUserId(data?.user?.id || null);
      await refrescarBadge();
    };

    boot();
    return () => {
      mounted = false;
    };
  }, [perfilId, refrescarBadge]);

  useEffect(() => {
    if (!authUserId) return undefined;
    return subscribeSoporteUsuario(authUserId, () => {
      refrescarBadge();
      if (abierto && vista === 'lista') {
        refrescarLista();
      }
    });
  }, [authUserId, abierto, vista, refrescarBadge, refrescarLista]);

  useEffect(() => {
    if (!abierto || !activa?.id || vista !== 'chat') return undefined;

    return subscribeMensajesSoporte(activa.id, async () => {
      try {
        const msgs = await obtenerMensajesSoporte(activa.id);
        setMensajes(msgs);
        await marcarMensajesSoporteLeidos(activa.id);
        await refrescarBadge();
      } catch (err) {
        console.error('Realtime soporte:', err?.message || err);
      }
    });
  }, [abierto, activa?.id, vista, refrescarBadge]);

  useEffect(() => {
    if (!historialRef.current) return;
    historialRef.current.scrollTop = historialRef.current.scrollHeight;
  }, [mensajes, vista]);

  useEffect(() => {
    if (!abierto) return undefined;

    const onKey = (event) => {
      if (event.key === 'Escape') {
        setAbierto(false);
        triggerRef.current?.focus?.();
      }
    };

    document.addEventListener('keydown', onKey);

    return () => {
      document.removeEventListener('keydown', onKey);
    };
  }, [abierto]);

  useEffect(() => {
    if (abierto) {
      refrescarLista();
      setVista('lista');
      setActiva(null);
      setMensajes([]);
      setError('');
    }
  }, [abierto, refrescarLista]);

  const cerrarPanel = () => {
    setAbierto(false);
    triggerRef.current?.focus?.();
  };

  const handleCrear = async (event) => {
    event.preventDefault();
    if (enviandoRef.current || !perfilId) return;

    const asuntoLimpio = asunto.trim();
    const mensajeLimpio = texto.trim();

    if (asuntoLimpio.length < 3) {
      setError('El asunto debe tener al menos 3 caracteres.');
      return;
    }
    if (!mensajeLimpio) {
      setError('Escribe un mensaje inicial.');
      return;
    }

    enviandoRef.current = true;
    setEnviando(true);
    setError('');

    try {
      const conv = await crearConversacionSoporte({
        perfilId,
        asunto: asuntoLimpio,
        mensaje: mensajeLimpio,
      });
      setAsunto('');
      setTexto('');
      await refrescarLista();
      await abrirConversacion(conv);
    } catch (err) {
      setError(err?.message || 'No se pudo crear la conversación.');
    } finally {
      enviandoRef.current = false;
      setEnviando(false);
    }
  };

  const handleEnviar = async (event) => {
    event.preventDefault();
    if (enviandoRef.current || !activa?.id) return;

    if (activa.estado === 'cerrado') {
      setError(
        'Esta conversación está cerrada. Crea una nueva solicitud de soporte.'
      );
      return;
    }

    const mensajeLimpio = texto.trim();
    if (!mensajeLimpio) return;

    enviandoRef.current = true;
    setEnviando(true);
    setError('');

    try {
      await enviarMensajeSoporte(activa.id, mensajeLimpio);
      setTexto('');
      const msgs = await obtenerMensajesSoporte(activa.id);
      setMensajes(msgs);
      await refrescarLista();
    } catch (err) {
      setError(err?.message || 'No se pudo enviar el mensaje.');
    } finally {
      enviandoRef.current = false;
      setEnviando(false);
    }
  };

  if (!perfilId || !['comprador', 'proveedor'].includes(rol)) {
    return null;
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="soporte-trigger"
        style={styles.trigger}
        onClick={() => setAbierto(true)}
        aria-label="Soporte"
        title="Soporte"
      >
        <Headphones size={19} />
        {noLeidos > 0 && (
          <span style={styles.badge}>
            {noLeidos > 99 ? '99+' : noLeidos}
          </span>
        )}
      </button>

      {montado &&
        abierto &&
        createPortal(
          <aside
            ref={panelRef}
            className="soporte-panel"
            style={styles.panel}
            role="dialog"
            aria-modal="false"
            aria-label="Soporte Kyntü"
          >
            <header style={styles.panelHeader}>
              <div style={styles.headerCopy}>
                {vista === 'chat' ? (
                  <button
                    type="button"
                    onClick={() => {
                      setVista('lista');
                      setActiva(null);
                      setMensajes([]);
                      setError('');
                      refrescarLista();
                    }}
                    style={styles.iconButton}
                    aria-label="Volver a conversaciones"
                  >
                    <ArrowLeft size={18} />
                  </button>
                ) : (
                  <span style={styles.headerIcon}>
                    <MessageCircle size={18} />
                  </span>
                )}

                <div>
                  <h2 style={styles.panelTitle}>
                    {vista === 'chat' && activa
                      ? activa.asunto
                      : 'Soporte Kyntü'}
                  </h2>
                  <p style={styles.panelSubtitle}>
                    {vista === 'chat' && activa
                      ? etiquetaEstadoSoporte(activa.estado)
                      : 'Nuestro equipo está para ayudarte.'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={cerrarPanel}
                style={styles.iconButton}
                aria-label="Cerrar soporte"
              >
                <X size={18} />
              </button>
            </header>

            <div style={styles.panelBody}>
              {error && <div style={styles.errorBox}>{error}</div>}

              {vista === 'lista' && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setVista('nueva');
                      setAsunto('');
                      setTexto('');
                      setError('');
                    }}
                    style={styles.primaryButton}
                  >
                    <Plus size={16} />
                    Nueva conversación
                  </button>

                  <div style={styles.listWrap}>
                    {cargandoLista ? (
                      <div style={styles.emptyState}>
                        <LoaderCircle size={20} className="soporte-spin" />
                        Cargando conversaciones…
                      </div>
                    ) : conversaciones.length === 0 ? (
                      <div style={styles.emptyState}>
                        Aún no tienes conversaciones de soporte.
                      </div>
                    ) : (
                      conversaciones.map((conv) => (
                        <button
                          key={conv.id}
                          type="button"
                          style={styles.convItem}
                          onClick={() => abrirConversacion(conv)}
                        >
                          <div style={styles.convTop}>
                            <strong style={styles.convAsunto}>
                              {conv.asunto}
                            </strong>
                            <span style={styles.convMeta}>
                              {formatearFechaSoporte(
                                conv.last_message_at || conv.updated_at
                              )}
                            </span>
                          </div>
                          <div style={styles.convBottom}>
                            <span style={styles.estadoPill}>
                              {etiquetaEstadoSoporte(conv.estado)}
                            </span>
                            {conv.no_leidos > 0 && (
                              <span style={styles.unreadPill}>
                                {conv.no_leidos}
                              </span>
                            )}
                          </div>
                          <p style={styles.convPreview}>
                            {conv.last_message_preview || 'Sin mensajes'}
                          </p>
                        </button>
                      ))
                    )}
                  </div>
                </>
              )}

              {vista === 'nueva' && (
                <form onSubmit={handleCrear} style={styles.form}>
                  <label style={styles.label}>
                    Asunto
                    <input
                      value={asunto}
                      onChange={(e) => setAsunto(e.target.value)}
                      style={styles.input}
                      placeholder="¿En qué podemos ayudarte?"
                      maxLength={120}
                      required
                    />
                  </label>

                  <label style={styles.label}>
                    Mensaje
                    <textarea
                      value={texto}
                      onChange={(e) => setTexto(e.target.value)}
                      style={styles.textarea}
                      placeholder="Cuéntanos los detalles…"
                      maxLength={2000}
                      required
                    />
                  </label>

                  <div style={styles.formActions}>
                    <button
                      type="button"
                      onClick={() => setVista('lista')}
                      style={styles.secondaryButton}
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={enviando}
                      style={styles.primaryButton}
                    >
                      {enviando ? 'Enviando…' : 'Iniciar conversación'}
                    </button>
                  </div>
                </form>
              )}

              {vista === 'chat' && (
                <>
                  <div ref={historialRef} style={styles.historial}>
                    {cargandoChat ? (
                      <div style={styles.emptyState}>
                        <LoaderCircle size={20} className="soporte-spin" />
                        Cargando mensajes…
                      </div>
                    ) : mensajes.length === 0 ? (
                      <div style={styles.emptyState}>
                        No hay mensajes todavía.
                      </div>
                    ) : (
                      mensajes.map((msg) => {
                        const propio = msg.remitente_rol === 'usuario';
                        return (
                          <div
                            key={msg.id}
                            style={{
                              ...styles.bubbleRow,
                              justifyContent: propio
                                ? 'flex-end'
                                : 'flex-start',
                            }}
                          >
                            <div
                              style={{
                                ...styles.bubble,
                                ...(propio
                                  ? styles.bubbleOwn
                                  : styles.bubbleOther),
                              }}
                            >
                              <p style={styles.bubbleText}>{msg.mensaje}</p>
                              <span style={styles.bubbleMeta}>
                                {propio ? 'Tú' : 'Soporte Kyntü'} ·{' '}
                                {formatearFechaSoporte(msg.created_at)}
                              </span>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {activa?.estado === 'cerrado' ? (
                    <div style={styles.closedBanner}>
                      Conversación cerrada. Usa “Nueva conversación” para un
                      nuevo caso.
                    </div>
                  ) : (
                    <form onSubmit={handleEnviar} style={styles.composer}>
                      <input
                        value={texto}
                        onChange={(e) => setTexto(e.target.value)}
                        style={styles.composerInput}
                        placeholder="Escribe tu mensaje…"
                        maxLength={2000}
                        disabled={enviando}
                      />
                      <button
                        type="submit"
                        disabled={enviando || !texto.trim()}
                        style={styles.sendButton}
                        aria-label="Enviar mensaje"
                      >
                        <Send size={16} />
                      </button>
                    </form>
                  )}
                </>
              )}
            </div>
          </aside>,
          document.body
        )}

      <style jsx>{`
        .soporte-trigger:focus-visible {
          outline: 2px solid #176bff;
          outline-offset: 2px;
        }

        .soporte-spin {
          animation: soporte-spin 0.8s linear infinite;
        }

        @keyframes soporte-spin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
      <style jsx global>{`
        @media (max-width: 720px) {
          .soporte-panel {
            left: 12px !important;
            right: 12px !important;
            bottom: 12px !important;
            width: auto !important;
            max-width: none !important;
            height: min(560px, calc(100dvh - 24px)) !important;
            max-height: calc(100dvh - 24px) !important;
            border-radius: 16px !important;
          }
        }
      `}</style>
    </>
  );
}

const styles = {
  trigger: {
    position: 'relative',
    width: 42,
    height: 42,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    border: '1px solid #d5e2f2',
    background: '#ffffff',
    color: '#1d3f6b',
    cursor: 'pointer',
    boxShadow: '0 8px 18px rgba(23, 107, 255, 0.08)',
  },
  badge: {
    position: 'absolute',
    top: -5,
    right: -5,
    minWidth: 18,
    height: 18,
    padding: '0 5px',
    borderRadius: 999,
    background: '#176bff',
    color: '#fff',
    fontSize: 10,
    fontWeight: 800,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '2px solid #fff',
  },
  panel: {
    position: 'fixed',
    right: 24,
    bottom: 24,
    width: 360,
    height: 520,
    maxWidth: 'calc(100vw - 48px)',
    maxHeight: 'calc(100dvh - 48px)',
    background: '#ffffff',
    border: '1px solid #d9e5f3',
    borderRadius: 18,
    boxShadow: '0 18px 48px rgba(15, 42, 86, 0.18)',
    zIndex: 1110,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  panelHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    padding: '14px 14px 12px',
    borderBottom: '1px solid #e6eef8',
    background:
      'linear-gradient(135deg, rgba(241,247,255,0.98), rgba(255,255,255,0.98))',
    flexShrink: 0,
  },
  headerCopy: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 10,
    minWidth: 0,
  },
  headerIcon: {
    width: 36,
    height: 36,
    borderRadius: 11,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#eaf2ff',
    color: '#176bff',
    flexShrink: 0,
  },
  panelTitle: {
    margin: 0,
    color: '#071c41',
    fontSize: 17,
    fontWeight: 900,
    lineHeight: 1.25,
  },
  panelSubtitle: {
    margin: '4px 0 0',
    color: '#6b7c93',
    fontSize: 12,
    lineHeight: 1.4,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    border: '1px solid #d7e3f1',
    background: '#fff',
    color: '#355074',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    flexShrink: 0,
  },
  panelBody: {
    flex: 1,
    minHeight: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    padding: 16,
  },
  errorBox: {
    padding: '10px 12px',
    borderRadius: 10,
    background: '#fff1f0',
    border: '1px solid #ffd2cf',
    color: '#b42318',
    fontSize: 12,
    lineHeight: 1.4,
  },
  primaryButton: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 44,
    padding: '10px 14px',
    border: 0,
    borderRadius: 12,
    background: 'linear-gradient(135deg, #176bff, #2e6bff)',
    color: '#fff',
    fontWeight: 800,
    fontSize: 13,
    cursor: 'pointer',
  },
  secondaryButton: {
    minHeight: 44,
    padding: '10px 14px',
    borderRadius: 12,
    border: '1px solid #cbd9e9',
    background: '#fff',
    color: '#3b5575',
    fontWeight: 800,
    fontSize: 13,
    cursor: 'pointer',
  },
  listWrap: {
    flex: 1,
    minHeight: 0,
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  emptyState: {
    marginTop: 28,
    textAlign: 'center',
    color: '#7a8aa0',
    fontSize: 13,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 10,
  },
  convItem: {
    textAlign: 'left',
    border: '1px solid #e1eaf5',
    borderRadius: 14,
    background: '#f9fbfe',
    padding: '12px 13px',
    cursor: 'pointer',
  },
  convTop: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 8,
  },
  convAsunto: {
    color: '#102b50',
    fontSize: 13,
    fontWeight: 800,
  },
  convMeta: {
    color: '#8a98ab',
    fontSize: 11,
    flexShrink: 0,
  },
  convBottom: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  estadoPill: {
    fontSize: 10,
    fontWeight: 800,
    color: '#176bff',
    background: '#eaf2ff',
    borderRadius: 999,
    padding: '3px 8px',
  },
  unreadPill: {
    minWidth: 18,
    height: 18,
    borderRadius: 999,
    background: '#176bff',
    color: '#fff',
    fontSize: 10,
    fontWeight: 800,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0 5px',
  },
  convPreview: {
    margin: '8px 0 0',
    color: '#66788f',
    fontSize: 12,
    lineHeight: 1.4,
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  label: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    color: '#354e6d',
    fontSize: 12,
    fontWeight: 800,
  },
  input: {
    minHeight: 44,
    borderRadius: 12,
    border: '1px solid #ccd9e8',
    background: '#f9fbfe',
    padding: '10px 12px',
    fontSize: 13,
    color: '#183354',
  },
  textarea: {
    minHeight: 120,
    borderRadius: 12,
    border: '1px solid #ccd9e8',
    background: '#f9fbfe',
    padding: '10px 12px',
    fontSize: 13,
    color: '#183354',
    resize: 'vertical',
    fontFamily: 'inherit',
  },
  formActions: {
    display: 'flex',
    gap: 8,
    justifyContent: 'flex-end',
  },
  historial: {
    flex: 1,
    minHeight: 0,
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    paddingRight: 2,
  },
  bubbleRow: {
    display: 'flex',
    width: '100%',
  },
  bubble: {
    maxWidth: '85%',
    borderRadius: 14,
    padding: '10px 12px',
  },
  bubbleOwn: {
    background: '#176bff',
    color: '#fff',
  },
  bubbleOther: {
    background: '#eef3f9',
    color: '#183354',
  },
  bubbleText: {
    margin: 0,
    fontSize: 13,
    lineHeight: 1.45,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  },
  bubbleMeta: {
    display: 'block',
    marginTop: 6,
    fontSize: 10,
    opacity: 0.78,
  },
  composer: {
    display: 'flex',
    gap: 8,
    alignItems: 'center',
    borderTop: '1px solid #e6eef8',
    paddingTop: 12,
  },
  composerInput: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    border: '1px solid #ccd9e8',
    background: '#f9fbfe',
    padding: '10px 12px',
    fontSize: 13,
    color: '#183354',
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    border: 0,
    background: 'linear-gradient(135deg, #176bff, #2e6bff)',
    color: '#fff',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  closedBanner: {
    padding: '12px 14px',
    borderRadius: 12,
    background: '#f3f6fa',
    color: '#66788f',
    fontSize: 12,
    lineHeight: 1.45,
    border: '1px solid #e1e8f1',
  },
};
