import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import {
  ArrowLeft,
  Headphones,
  LoaderCircle,
  MessageCircle,
  Plus,
  Send,
} from 'lucide-react';
import { useRequireMaster } from '../../lib/useRequireMaster';
import {
  ESTADOS_SOPORTE,
  adminCrearConversacionSoporte,
  actualizarEstadoConversacionSoporte,
  buscarPerfilesParaSoporte,
  enviarMensajeSoporte,
  etiquetaEstadoSoporte,
  formatearFechaSoporte,
  listarConversacionesSoporteAdmin,
  marcarMensajesSoporteLeidos,
  obtenerMensajesSoporte,
  subscribeSoporteAdmin,
  subscribeMensajesSoporte,
} from '../../lib/soporteMensajes';

export default function MasterSoporte() {
  const router = useRouter();
  const { authorized, loading } = useRequireMaster();

  const [conversaciones, setConversaciones] = useState([]);
  const [filtroEstado, setFiltroEstado] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [cargandoLista, setCargandoLista] = useState(false);
  const [activa, setActiva] = useState(null);
  const [mensajes, setMensajes] = useState([]);
  const [cargandoChat, setCargandoChat] = useState(false);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const [vistaNueva, setVistaNueva] = useState(false);
  const [perfilQuery, setPerfilQuery] = useState('');
  const [perfiles, setPerfiles] = useState([]);
  const [perfilSeleccionado, setPerfilSeleccionado] = useState(null);
  const [asuntoNuevo, setAsuntoNuevo] = useState('');
  const [mensajeNuevo, setMensajeNuevo] = useState('');

  const historialRef = useRef(null);
  const enviandoRef = useRef(false);
  const busquedaTimer = useRef(null);

  const cargarLista = useCallback(async () => {
    setCargandoLista(true);
    setError('');
    try {
      const rows = await listarConversacionesSoporteAdmin({
        estado: filtroEstado || null,
        busqueda: busqueda.trim() || null,
      });
      setConversaciones(rows);
    } catch (err) {
      setError(err?.message || 'No se pudieron cargar las conversaciones.');
    } finally {
      setCargandoLista(false);
    }
  }, [filtroEstado, busqueda]);

  const abrirConversacion = useCallback(async (conv) => {
    if (!conv?.id) return;
    setVistaNueva(false);
    setActiva(conv);
    setCargandoChat(true);
    setError('');
    setTexto('');
    try {
      const msgs = await obtenerMensajesSoporte(conv.id);
      setMensajes(msgs);
      await marcarMensajesSoporteLeidos(conv.id);
      const rows = await listarConversacionesSoporteAdmin({
        estado: filtroEstado || null,
        busqueda: busqueda.trim() || null,
      });
      setConversaciones(rows);
      const refreshed = rows.find((r) => r.id === conv.id);
      if (refreshed) setActiva(refreshed);
    } catch (err) {
      setError(err?.message || 'No se pudo abrir la conversación.');
    } finally {
      setCargandoChat(false);
    }
  }, [filtroEstado, busqueda]);

  useEffect(() => {
    if (!authorized) return undefined;
    cargarLista();
    return subscribeSoporteAdmin(() => {
      cargarLista();
    });
  }, [authorized, cargarLista]);

  useEffect(() => {
    if (!activa?.id) return undefined;
    return subscribeMensajesSoporte(activa.id, async () => {
      try {
        const msgs = await obtenerMensajesSoporte(activa.id);
        setMensajes(msgs);
        await marcarMensajesSoporteLeidos(activa.id);
        cargarLista();
      } catch (err) {
        console.error('Realtime admin soporte:', err?.message || err);
      }
    });
  }, [activa?.id, cargarLista]);

  useEffect(() => {
    if (!historialRef.current) return;
    historialRef.current.scrollTop = historialRef.current.scrollHeight;
  }, [mensajes]);

  useEffect(() => {
    if (!vistaNueva) return undefined;
    if (busquedaTimer.current) clearTimeout(busquedaTimer.current);

    busquedaTimer.current = setTimeout(async () => {
      try {
        const rows = await buscarPerfilesParaSoporte(perfilQuery);
        setPerfiles(rows);
      } catch (err) {
        console.error(err);
      }
    }, 280);

    return () => {
      if (busquedaTimer.current) clearTimeout(busquedaTimer.current);
    };
  }, [perfilQuery, vistaNueva]);

  const handleEnviar = async (event) => {
    event.preventDefault();
    if (enviandoRef.current || !activa?.id) return;

    const mensajeLimpio = texto.trim();
    if (!mensajeLimpio) return;

    enviandoRef.current = true;
    setEnviando(true);
    setError('');

    try {
      await enviarMensajeSoporte(activa.id, mensajeLimpio);
      setTexto('');
      if (activa.estado === 'abierto') {
        const updated = await actualizarEstadoConversacionSoporte(
          activa.id,
          'en_atencion'
        );
        setActiva((prev) => ({ ...prev, ...updated }));
      }
      const msgs = await obtenerMensajesSoporte(activa.id);
      setMensajes(msgs);
      await cargarLista();
    } catch (err) {
      setError(err?.message || 'No se pudo enviar el mensaje.');
    } finally {
      enviandoRef.current = false;
      setEnviando(false);
    }
  };

  const handleCambiarEstado = async (nuevoEstado) => {
    if (!activa?.id || !nuevoEstado) return;
    setError('');
    try {
      const updated = await actualizarEstadoConversacionSoporte(
        activa.id,
        nuevoEstado
      );
      setActiva((prev) => ({ ...prev, ...updated }));
      await cargarLista();
    } catch (err) {
      setError(err?.message || 'No se pudo actualizar el estado.');
    }
  };

  const handleContactar = async (event) => {
    event.preventDefault();
    if (enviandoRef.current || !perfilSeleccionado?.id) return;

    const asuntoLimpio = asuntoNuevo.trim();
    const mensajeLimpio = mensajeNuevo.trim();

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
      // Evitar duplicados: si hay conversación abierta/en_atención, abrirla.
      const existentes = await listarConversacionesSoporteAdmin({
        busqueda: perfilSeleccionado.email || perfilSeleccionado.email_contacto,
      });
      const abierta = (existentes || []).find(
        (c) =>
          c.usuario_perfil_id === perfilSeleccionado.id &&
          ['abierto', 'en_atencion'].includes(c.estado)
      );

      if (abierta) {
        setVistaNueva(false);
        setAsuntoNuevo('');
        setMensajeNuevo('');
        setPerfilSeleccionado(null);
        setPerfilQuery('');
        await abrirConversacion(abierta);
        setError(
          'Ya existe una conversación abierta con este usuario. Se abrió el hilo existente.'
        );
        return;
      }

      const conv = await adminCrearConversacionSoporte({
        perfilId: perfilSeleccionado.id,
        asunto: asuntoLimpio,
        mensaje: mensajeLimpio,
      });
      setVistaNueva(false);
      setAsuntoNuevo('');
      setMensajeNuevo('');
      setPerfilSeleccionado(null);
      setPerfilQuery('');
      await cargarLista();
      await abrirConversacion(conv);
    } catch (err) {
      setError(err?.message || 'No se pudo crear la conversación.');
    } finally {
      enviandoRef.current = false;
      setEnviando(false);
    }
  };

  if (loading || !authorized) {
    return <div style={{ padding: 32 }}>Verificando acceso...</div>;
  }

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <div style={styles.headerLeft}>
          <button
            type="button"
            onClick={() => router.push('/master')}
            style={styles.backButton}
          >
            <ArrowLeft size={16} />
            Volver
          </button>
          <div>
            <p style={styles.kicker}>Panel interno</p>
            <h1 style={styles.title}>
              <Headphones size={26} />
              Soporte Kyntü
            </h1>
            <p style={styles.subtitle}>
              Bandeja de atención a compradores y proveedores.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            setVistaNueva(true);
            setActiva(null);
            setMensajes([]);
            setError('');
          }}
          style={styles.primaryButton}
        >
          <Plus size={16} />
          Contactar usuario
        </button>
      </header>

      {error && <div style={styles.errorBox}>{error}</div>}

      <div style={styles.layout}>
        <section style={styles.listPanel}>
          <div style={styles.filters}>
            <input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') cargarLista();
              }}
              placeholder="Buscar por correo, nombre o asunto…"
              style={styles.input}
            />
            <select
              value={filtroEstado}
              onChange={(e) => setFiltroEstado(e.target.value)}
              style={styles.select}
            >
              <option value="">Todos los estados</option>
              {ESTADOS_SOPORTE.map((estado) => (
                <option key={estado} value={estado}>
                  {etiquetaEstadoSoporte(estado)}
                </option>
              ))}
            </select>
            <button type="button" onClick={cargarLista} style={styles.secondaryButton}>
              Filtrar
            </button>
          </div>

          <div style={styles.list}>
            {cargandoLista ? (
              <div style={styles.empty}>
                <LoaderCircle size={18} className="spin" />
                Cargando…
              </div>
            ) : conversaciones.length === 0 ? (
              <div style={styles.empty}>No hay conversaciones de soporte.</div>
            ) : (
              conversaciones.map((conv) => (
                <button
                  key={conv.id}
                  type="button"
                  onClick={() => abrirConversacion(conv)}
                  style={{
                    ...styles.convItem,
                    ...(activa?.id === conv.id ? styles.convItemActive : {}),
                  }}
                >
                  <div style={styles.convTop}>
                    <strong>{conv.asunto}</strong>
                    <span>
                      {formatearFechaSoporte(
                        conv.last_message_at || conv.updated_at
                      )}
                    </span>
                  </div>
                  <div style={styles.convMeta}>
                    <span>{conv.usuario_email || 'Sin correo'}</span>
                    <span style={styles.pill}>
                      {etiquetaEstadoSoporte(conv.estado)}
                    </span>
                    {conv.no_leidos > 0 && (
                      <span style={styles.badge}>{conv.no_leidos}</span>
                    )}
                  </div>
                  <p style={styles.preview}>
                    {conv.last_message_preview || 'Sin mensajes'}
                  </p>
                </button>
              ))
            )}
          </div>
        </section>

        <section style={styles.chatPanel}>
          {vistaNueva ? (
            <form onSubmit={handleContactar} style={styles.form}>
              <h2 style={styles.panelTitle}>
                <MessageCircle size={18} />
                Contactar por soporte
              </h2>
              <p style={styles.hint}>
                Si el usuario ya tiene un caso abierto, se abrirá ese hilo en
                lugar de crear uno nuevo.
              </p>

              <label style={styles.label}>
                Buscar usuario
                <input
                  value={perfilQuery}
                  onChange={(e) => {
                    setPerfilQuery(e.target.value);
                    setPerfilSeleccionado(null);
                  }}
                  style={styles.input}
                  placeholder="Nombre o correo…"
                />
              </label>

              {perfiles.length > 0 && !perfilSeleccionado && (
                <div style={styles.perfilList}>
                  {perfiles.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      style={styles.perfilItem}
                      onClick={() => {
                        setPerfilSeleccionado(p);
                        setPerfilQuery(
                          p.nombre_contacto ||
                            p.email_contacto ||
                            p.email ||
                            ''
                        );
                      }}
                    >
                      <strong>
                        {p.nombre_contacto || p.email || 'Usuario'}
                      </strong>
                      <span>
                        {p.email_contacto || p.email} · {p.tipo}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {perfilSeleccionado && (
                <div style={styles.selectedUser}>
                  Contactando a{' '}
                  <strong>
                    {perfilSeleccionado.nombre_contacto ||
                      perfilSeleccionado.email}
                  </strong>{' '}
                  ({perfilSeleccionado.tipo})
                </div>
              )}

              <label style={styles.label}>
                Asunto
                <input
                  value={asuntoNuevo}
                  onChange={(e) => setAsuntoNuevo(e.target.value)}
                  style={styles.input}
                  maxLength={120}
                  required
                />
              </label>

              <label style={styles.label}>
                Mensaje inicial
                <textarea
                  value={mensajeNuevo}
                  onChange={(e) => setMensajeNuevo(e.target.value)}
                  style={styles.textarea}
                  maxLength={2000}
                  required
                />
              </label>

              <div style={styles.formActions}>
                <button
                  type="button"
                  onClick={() => setVistaNueva(false)}
                  style={styles.secondaryButton}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={enviando || !perfilSeleccionado}
                  style={styles.primaryButton}
                >
                  {enviando ? 'Enviando…' : 'Iniciar conversación'}
                </button>
              </div>
            </form>
          ) : !activa ? (
            <div style={styles.emptyLarge}>
              Selecciona una conversación o contacta a un usuario.
            </div>
          ) : (
            <>
              <div style={styles.chatHeader}>
                <div>
                  <h2 style={styles.panelTitle}>{activa.asunto}</h2>
                  <p style={styles.userLine}>
                    {activa.usuario_email} · {activa.usuario_tipo}
                  </p>
                </div>
                <select
                  value={activa.estado}
                  onChange={(e) => handleCambiarEstado(e.target.value)}
                  style={styles.select}
                >
                  {ESTADOS_SOPORTE.map((estado) => (
                    <option key={estado} value={estado}>
                      {etiquetaEstadoSoporte(estado)}
                    </option>
                  ))}
                </select>
              </div>

              <div ref={historialRef} style={styles.historial}>
                {cargandoChat ? (
                  <div style={styles.empty}>Cargando mensajes…</div>
                ) : (
                  mensajes.map((msg) => {
                    const propio = msg.remitente_rol === 'admin';
                    return (
                      <div
                        key={msg.id}
                        style={{
                          ...styles.bubbleRow,
                          justifyContent: propio ? 'flex-end' : 'flex-start',
                        }}
                      >
                        <div
                          style={{
                            ...styles.bubble,
                            ...(propio ? styles.bubbleOwn : styles.bubbleOther),
                          }}
                        >
                          <p style={styles.bubbleText}>{msg.mensaje}</p>
                          <span style={styles.bubbleMeta}>
                            {propio ? 'Soporte' : 'Usuario'} ·{' '}
                            {formatearFechaSoporte(msg.created_at)}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {activa.estado === 'cerrado' ? (
                <div style={styles.closedBanner}>
                  Conversación cerrada. Crea un nuevo contacto si necesitas
                  retomar el caso.
                </div>
              ) : (
                <form onSubmit={handleEnviar} style={styles.composer}>
                  <input
                    value={texto}
                    onChange={(e) => setTexto(e.target.value)}
                    style={styles.composerInput}
                    placeholder="Responder al usuario…"
                    maxLength={2000}
                    disabled={enviando}
                  />
                  <button
                    type="submit"
                    disabled={enviando || !texto.trim()}
                    style={styles.sendButton}
                    aria-label="Enviar"
                  >
                    <Send size={16} />
                  </button>
                </form>
              )}
            </>
          )}
        </section>
      </div>

      <style jsx>{`
        .spin {
          animation: spin 0.8s linear infinite;
        }
        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
        @media (max-width: 900px) {
          :global(.master-soporte-layout) {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    padding: 28,
    fontFamily: 'Arial, sans-serif',
    background:
      'linear-gradient(135deg, #F5F8FF 0%, #EEF4FF 45%, #FFFFFF 100%)',
    color: '#071B3A',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 16,
    flexWrap: 'wrap',
    marginBottom: 18,
    background: '#071B3A',
    color: '#fff',
    borderRadius: 22,
    padding: 22,
  },
  headerLeft: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  backButton: {
    alignSelf: 'flex-start',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    border: 0,
    borderRadius: 10,
    padding: '8px 12px',
    background: 'rgba(255,255,255,0.12)',
    color: '#fff',
    cursor: 'pointer',
    fontWeight: 700,
  },
  kicker: {
    margin: 0,
    color: '#3BE1FF',
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  title: {
    margin: '6px 0 0',
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    fontSize: 28,
    fontWeight: 800,
  },
  subtitle: {
    margin: '8px 0 0',
    color: '#D9E6FF',
    fontSize: 14,
  },
  primaryButton: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    border: 0,
    borderRadius: 12,
    padding: '11px 14px',
    background: '#176bff',
    color: '#fff',
    fontWeight: 800,
    cursor: 'pointer',
  },
  secondaryButton: {
    border: '1px solid #cbd9e9',
    borderRadius: 12,
    padding: '10px 12px',
    background: '#fff',
    color: '#355074',
    fontWeight: 800,
    cursor: 'pointer',
  },
  errorBox: {
    marginBottom: 14,
    padding: '12px 14px',
    borderRadius: 12,
    background: '#fff1f0',
    border: '1px solid #ffd2cf',
    color: '#b42318',
    fontSize: 13,
  },
  layout: {
    display: 'grid',
    gridTemplateColumns: 'minmax(280px, 380px) 1fr',
    gap: 16,
    minHeight: '70vh',
  },
  listPanel: {
    background: '#fff',
    borderRadius: 18,
    border: '1px solid #DCE6FF',
    padding: 14,
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    minHeight: 520,
  },
  filters: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  input: {
    width: '100%',
    minHeight: 42,
    borderRadius: 11,
    border: '1px solid #ccd9e8',
    padding: '10px 12px',
    fontSize: 13,
    boxSizing: 'border-box',
  },
  select: {
    minHeight: 42,
    borderRadius: 11,
    border: '1px solid #ccd9e8',
    padding: '8px 10px',
    fontSize: 13,
    background: '#fff',
  },
  list: {
    flex: 1,
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  convItem: {
    textAlign: 'left',
    border: '1px solid #e1eaf5',
    borderRadius: 14,
    background: '#f9fbfe',
    padding: '12px 13px',
    cursor: 'pointer',
  },
  convItemActive: {
    borderColor: '#176bff',
    background: '#eef4ff',
  },
  convTop: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 8,
    fontSize: 13,
  },
  convMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
    fontSize: 12,
    color: '#66788f',
    flexWrap: 'wrap',
  },
  pill: {
    fontSize: 10,
    fontWeight: 800,
    color: '#176bff',
    background: '#eaf2ff',
    borderRadius: 999,
    padding: '3px 8px',
  },
  badge: {
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
  preview: {
    margin: '8px 0 0',
    color: '#66788f',
    fontSize: 12,
    lineHeight: 1.4,
  },
  chatPanel: {
    background: '#fff',
    borderRadius: 18,
    border: '1px solid #DCE6FF',
    padding: 16,
    display: 'flex',
    flexDirection: 'column',
    minHeight: 520,
  },
  empty: {
    color: '#7a8aa0',
    fontSize: 13,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    justifyContent: 'center',
    padding: 24,
  },
  emptyLarge: {
    margin: 'auto',
    color: '#7a8aa0',
    fontSize: 14,
    textAlign: 'center',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  panelTitle: {
    margin: 0,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 18,
    fontWeight: 800,
  },
  hint: {
    margin: 0,
    color: '#66788f',
    fontSize: 13,
  },
  label: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    fontSize: 12,
    fontWeight: 800,
    color: '#354e6d',
  },
  textarea: {
    minHeight: 120,
    borderRadius: 12,
    border: '1px solid #ccd9e8',
    padding: '10px 12px',
    fontSize: 13,
    fontFamily: 'inherit',
    resize: 'vertical',
  },
  perfilList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    maxHeight: 180,
    overflowY: 'auto',
  },
  perfilItem: {
    textAlign: 'left',
    border: '1px solid #e1eaf5',
    borderRadius: 12,
    background: '#f9fbfe',
    padding: '10px 12px',
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  selectedUser: {
    padding: '10px 12px',
    borderRadius: 12,
    background: '#eaf2ff',
    color: '#17365e',
    fontSize: 13,
  },
  formActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 8,
  },
  chatHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 12,
    alignItems: 'flex-start',
    borderBottom: '1px solid #e6eef8',
    paddingBottom: 12,
    marginBottom: 12,
  },
  userLine: {
    margin: '6px 0 0',
    color: '#66788f',
    fontSize: 13,
  },
  historial: {
    flex: 1,
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    minHeight: 280,
    paddingRight: 4,
  },
  bubbleRow: {
    display: 'flex',
    width: '100%',
  },
  bubble: {
    maxWidth: '78%',
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
    marginTop: 12,
    borderTop: '1px solid #e6eef8',
    paddingTop: 12,
  },
  composerInput: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    border: '1px solid #ccd9e8',
    padding: '10px 12px',
    fontSize: 13,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    border: 0,
    background: '#176bff',
    color: '#fff',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  closedBanner: {
    marginTop: 12,
    padding: '12px 14px',
    borderRadius: 12,
    background: '#f3f6fa',
    color: '#66788f',
    fontSize: 12,
    border: '1px solid #e1e8f1',
  },
};
