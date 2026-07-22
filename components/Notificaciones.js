import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import {
  Bell,
  ChevronRight,
  Clock3,
  Inbox,
  LoaderCircle,
  X,
} from 'lucide-react';

import { supabase } from '../lib/supabaseClient';

export default function Notificaciones({ userId, rol }) {
  const router = useRouter();
  const contenedorRef = useRef(null);

  const [mostrar, setMostrar] = useState(false);
  const [notificaciones, setNotificaciones] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [notificacionSeleccionada, setNotificacionSeleccionada] =
    useState(null);

  useEffect(() => {
    if (!userId || !rol) {
      setNotificaciones([]);
      return;
    }

    cargarNotificaciones();
  }, [userId, rol]);

  useEffect(() => {
    const cerrarAlHacerClickFuera = (event) => {
      if (
        contenedorRef.current &&
        !contenedorRef.current.contains(event.target)
      ) {
        setMostrar(false);
      }
    };

    const cerrarConEscape = (event) => {
      if (event.key === 'Escape') {
        setMostrar(false);
      }
    };

    document.addEventListener('mousedown', cerrarAlHacerClickFuera);
    document.addEventListener('keydown', cerrarConEscape);

    return () => {
      document.removeEventListener(
        'mousedown',
        cerrarAlHacerClickFuera
      );

      document.removeEventListener(
        'keydown',
        cerrarConEscape
      );
    };
  }, []);

  const cargarNotificaciones = async () => {
    if (!userId || !rol) return;

    setCargando(true);

    const { data, error } = await supabase
      .from('notificaciones')
      .select('*')
      .eq('usuario_id', userId)
      .eq('rol', rol)
      .eq('leida', false)
      .order('created_at', { ascending: false });

    if (error) {
      console.error(
        'Error al cargar notificaciones:',
        error.message
      );

      setCargando(false);
      return;
    }

    setNotificaciones(data || []);
    setCargando(false);
  };

  const marcarLeidaYRedirigir = async (notif) => {
    if (!notif?.id || notificacionSeleccionada) return;

    setNotificacionSeleccionada(notif.id);

    // Desaparece inmediatamente de la campana.
    setNotificaciones((prev) =>
      prev.filter((item) => item.id !== notif.id)
    );

    const { error } = await supabase
      .from('notificaciones')
      .update({ leida: true })
      .eq('id', notif.id);

    if (error) {
      console.error(
        'Error al marcar la notificación como leída:',
        error.message
      );

      await cargarNotificaciones();
      setNotificacionSeleccionada(null);
      return;
    }

    setMostrar(false);
    setNotificacionSeleccionada(null);

    const rutaPorDefecto =
      rol === 'proveedor' ? '/proveedor' : '/comprador';

    const rutaDestino =
      typeof notif.ruta === 'string' && notif.ruta.trim()
        ? notif.ruta.trim()
        : rutaPorDefecto;

    await router.push(rutaDestino);
  };

  const formatearFecha = (fecha) => {
    if (!fecha) return '';

    const fechaNotificacion = new Date(fecha);

    if (Number.isNaN(fechaNotificacion.getTime())) {
      return '';
    }

    return fechaNotificacion.toLocaleString('es-CL', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const obtenerColorNotificacion = (indice) => {
    const colores = [
      {
        principal: '#2563EB',
        suave: '#EFF6FF',
        borde: '#BFDBFE',
        icono: '#DBEAFE',
      },
      {
        principal: '#0F9F8F',
        suave: '#ECFDF9',
        borde: '#A7F3E5',
        icono: '#CCFBF1',
      },
      {
        principal: '#F97316',
        suave: '#FFF7ED',
        borde: '#FED7AA',
        icono: '#FFEDD5',
      },
    ];

    return colores[indice % colores.length];
  };

  const cantidadNoLeidas = notificaciones.length;

  return (
    <div ref={contenedorRef} style={styles.wrapper}>
      <button
        type="button"
        onClick={() => setMostrar((prev) => !prev)}
        aria-label={
          mostrar
            ? 'Cerrar notificaciones'
            : 'Abrir notificaciones'
        }
        aria-expanded={mostrar}
        style={{
          ...styles.bellButton,
          ...(mostrar ? styles.bellButtonActive : {}),
        }}
      >
        <Bell size={22} strokeWidth={2.2} />

        {cantidadNoLeidas > 0 && (
          <span style={styles.badge}>
            {cantidadNoLeidas > 99
              ? '99+'
              : cantidadNoLeidas}
          </span>
        )}
      </button>

      {mostrar && (
        <div
          role="dialog"
          aria-label="Panel de notificaciones"
          style={styles.panel}
        >
          <div style={styles.topDecoration}>
            <span style={styles.decorationBlue} />
            <span style={styles.decorationGreen} />
            <span style={styles.decorationOrange} />
          </div>

          <div style={styles.panelHeader}>
            <div style={styles.headerInformation}>
              <div style={styles.headerIcon}>
                <Bell size={20} strokeWidth={2.2} />
              </div>

              <div style={styles.headerText}>
                <h3 style={styles.panelTitle}>
                  Notificaciones
                </h3>

                <p style={styles.panelSubtitle}>
                  {cantidadNoLeidas === 0
                    ? 'No tienes notificaciones pendientes'
                    : cantidadNoLeidas === 1
                      ? 'Tienes una notificación nueva'
                      : `Tienes ${cantidadNoLeidas} notificaciones nuevas`}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setMostrar(false)}
              aria-label="Cerrar notificaciones"
              style={styles.closeButton}
            >
              <X size={19} strokeWidth={2.2} />
            </button>
          </div>

          <div style={styles.divider} />

          <div style={styles.notificationsContainer}>
            {cargando ? (
              <div style={styles.statusContainer}>
                <LoaderCircle
                  size={28}
                  strokeWidth={2}
                  style={styles.spinner}
                />

                <p style={styles.statusTitle}>
                  Cargando notificaciones
                </p>
              </div>
            ) : notificaciones.length === 0 ? (
              <div style={styles.emptyContainer}>
                <div style={styles.emptyIcon}>
                  <Inbox size={29} strokeWidth={1.8} />
                </div>

                <p style={styles.emptyTitle}>
                  No tienes notificaciones
                </p>

                <p style={styles.emptyDescription}>
                  Las nuevas ofertas, confirmaciones y cambios
                  aparecerán aquí.
                </p>
              </div>
            ) : (
              notificaciones.map((notif, index) => {
                const estaProcesando =
                  notificacionSeleccionada === notif.id;

                const color =
                  obtenerColorNotificacion(index);

                return (
                  <button
                    type="button"
                    key={notif.id}
                    disabled={estaProcesando}
                    onClick={() =>
                      marcarLeidaYRedirigir(notif)
                    }
                    style={{
                      ...styles.notificationCard,

                      borderColor: color.borde,
                      backgroundColor: color.suave,

                      ...(estaProcesando
                        ? styles.notificationCardDisabled
                        : {}),
                    }}
                    onMouseEnter={(event) => {
                      if (estaProcesando) return;

                      event.currentTarget.style.boxShadow =
                        `0 12px 28px ${color.borde}`;

                      event.currentTarget.style.transform =
                        'translateY(-2px)';

                      event.currentTarget.style.borderColor =
                        color.principal;
                    }}
                    onMouseLeave={(event) => {
                      if (estaProcesando) return;

                      event.currentTarget.style.boxShadow =
                        '0 5px 16px rgba(29, 78, 126, 0.08)';

                      event.currentTarget.style.transform =
                        'translateY(0)';

                      event.currentTarget.style.borderColor =
                        color.borde;
                    }}
                  >
                    <span
                      style={{
                        ...styles.colorBar,
                        backgroundColor: color.principal,
                      }}
                    />

                    <div
                      style={{
                        ...styles.notificationIcon,
                        backgroundColor: color.icono,
                        color: color.principal,
                      }}
                    >
                      <Bell size={18} strokeWidth={2.1} />
                    </div>

                    <div style={styles.notificationContent}>
                      <div style={styles.notificationTop}>
                        <span style={styles.notificationTitle}>
                          {notif.titulo ||
                            'Nueva notificación'}
                        </span>

                        <ChevronRight
                          size={20}
                          strokeWidth={2.3}
                          style={{
                            ...styles.chevron,
                            color: color.principal,
                          }}
                        />
                      </div>

                      <p style={styles.notificationMessage}>
                        {notif.mensaje ||
                          'Tienes nueva información disponible.'}
                      </p>

                      <div style={styles.notificationFooter}>
                        {notif.created_at && (
                          <div style={styles.dateContainer}>
                            <Clock3
                              size={13}
                              strokeWidth={2}
                            />

                            <span>
                              {formatearFecha(
                                notif.created_at
                              )}
                            </span>
                          </div>
                        )}

                        <span
                          style={{
                            ...styles.openText,
                            color: color.principal,
                          }}
                        >
                          {estaProcesando
                            ? 'Abriendo...'
                            : 'Ver información'}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes notification-spin {
          from {
            transform: rotate(0deg);
          }

          to {
            transform: rotate(360deg);
          }
        }

        @media (max-width: 600px) {
          div[role='dialog'] {
            position: fixed !important;
            top: 72px !important;
            right: 14px !important;
            left: 14px !important;
            width: auto !important;
            max-width: none !important;
            max-height: calc(100vh - 90px) !important;
          }
        }
      `}</style>
    </div>
  );
}

const styles = {
  wrapper: {
    position: 'relative',
    display: 'inline-flex',
    alignItems: 'center',
    zIndex: 10000,
  },

  bellButton: {
    position: 'relative',
    width: '44px',
    height: '44px',
    padding: 0,
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: '#D5E3F4',
    borderRadius: '14px',
    backgroundColor: '#FFFFFF',
    color: '#2563EB',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    boxShadow: '0 8px 20px rgba(29, 78, 126, 0.12)',
    transition:
      'background-color 0.2s ease, border-color 0.2s ease, transform 0.2s ease',
  },

  bellButtonActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#2563EB',
    transform: 'translateY(-1px)',
  },

  badge: {
    position: 'absolute',
    top: '-7px',
    right: '-8px',
    minWidth: '21px',
    height: '21px',
    padding: '0 5px',
    borderRadius: '999px',
    backgroundColor: '#F97316',
    color: '#FFFFFF',
    borderWidth: '2px',
    borderStyle: 'solid',
    borderColor: '#FFFFFF',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxSizing: 'border-box',
    fontSize: '10px',
    lineHeight: 1,
    fontWeight: 800,
    boxShadow: '0 5px 12px rgba(249, 115, 22, 0.32)',
  },

  panel: {
    position: 'absolute',
    top: '55px',
    right: 0,
    width: '410px',
    maxWidth: 'calc(100vw - 30px)',
    maxHeight: '530px',
    backgroundColor: '#FFFFFF',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: '#DCE7F5',
    borderRadius: '22px',
    boxShadow: '0 24px 65px rgba(30, 71, 120, 0.22)',
    overflow: 'hidden',
    zIndex: 10001,
  },

  topDecoration: {
    width: '100%',
    height: '5px',
    display: 'grid',
    gridTemplateColumns: '1fr 1fr 1fr',
  },

  decorationBlue: {
    backgroundColor: '#2563EB',
  },

  decorationGreen: {
    backgroundColor: '#0F9F8F',
  },

  decorationOrange: {
    backgroundColor: '#F97316',
  },

  panelHeader: {
    minHeight: '84px',
    padding: '17px 18px 15px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '14px',
    boxSizing: 'border-box',
    background:
      'linear-gradient(135deg, #F7FAFF 0%, #FFFFFF 58%, #F0FDFA 100%)',
  },

  headerInformation: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    minWidth: 0,
  },

  headerIcon: {
    width: '42px',
    height: '42px',
    flexShrink: 0,
    borderRadius: '14px',
    backgroundColor: '#DBEAFE',
    color: '#2563EB',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },

  headerText: {
    minWidth: 0,
  },

  panelTitle: {
    margin: 0,
    color: '#17375E',
    fontSize: '17px',
    lineHeight: 1.25,
    fontWeight: 800,
  },

  panelSubtitle: {
    margin: '4px 0 0',
    color: '#6B7D93',
    fontSize: '11px',
    lineHeight: 1.4,
  },

  closeButton: {
    width: '36px',
    height: '36px',
    padding: 0,
    flexShrink: 0,
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: '#DCE7F5',
    borderRadius: '11px',
    backgroundColor: '#FFFFFF',
    color: '#63758B',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },

  divider: {
    height: '1px',
    backgroundColor: '#E8EEF6',
  },

  notificationsContainer: {
    maxHeight: '435px',
    overflowY: 'auto',
    padding: '13px',
    boxSizing: 'border-box',
    backgroundColor: '#FBFDFF',
  },

  notificationCard: {
    position: 'relative',
    width: '100%',
    minHeight: '116px',
    padding: '15px 15px 14px 18px',
    marginBottom: '11px',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderRadius: '17px',
    color: '#17375E',
    textAlign: 'left',
    display: 'flex',
    alignItems: 'flex-start',
    gap: '12px',
    cursor: 'pointer',
    boxSizing: 'border-box',
    boxShadow: '0 5px 16px rgba(29, 78, 126, 0.08)',
    transition:
      'box-shadow 0.18s ease, border-color 0.18s ease, transform 0.18s ease, opacity 0.18s ease',
    fontFamily: 'inherit',
  },

  notificationCardDisabled: {
    cursor: 'wait',
    opacity: 0.55,
    pointerEvents: 'none',
  },

  colorBar: {
    position: 'absolute',
    top: '15px',
    bottom: '15px',
    left: '7px',
    width: '4px',
    borderRadius: '999px',
  },

  notificationIcon: {
    width: '37px',
    height: '37px',
    marginLeft: '3px',
    flexShrink: 0,
    borderRadius: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },

  notificationContent: {
    flex: 1,
    minWidth: 0,
  },

  notificationTop: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: '10px',
  },

  notificationTitle: {
    color: '#17375E',
    fontSize: '14px',
    lineHeight: 1.35,
    fontWeight: 800,
    overflowWrap: 'anywhere',
  },

  chevron: {
    flexShrink: 0,
    marginTop: '1px',
  },

  notificationMessage: {
    margin: '6px 0 0',
    color: '#52677F',
    fontSize: '12px',
    lineHeight: 1.5,
    overflowWrap: 'anywhere',
  },

  notificationFooter: {
    marginTop: '10px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: '7px',
  },

  dateContainer: {
    color: '#8493A5',
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
    fontSize: '10px',
  },

  openText: {
    fontSize: '10px',
    lineHeight: 1.3,
    fontWeight: 800,
  },

  statusContainer: {
    minHeight: '190px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#64748B',
  },

  spinner: {
    color: '#2563EB',
    animation: 'notification-spin 0.8s linear infinite',
  },

  statusTitle: {
    margin: '12px 0 0',
    fontSize: '12px',
    fontWeight: 700,
  },

  emptyContainer: {
    minHeight: '220px',
    padding: '25px',
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
  },

  emptyIcon: {
    width: '62px',
    height: '62px',
    borderRadius: '19px',
    background:
      'linear-gradient(135deg, #EFF6FF, #ECFDF9)',
    color: '#0F9F8F',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: '#CFE8EA',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },

  emptyTitle: {
    margin: '14px 0 0',
    color: '#17375E',
    fontSize: '14px',
    fontWeight: 800,
  },

  emptyDescription: {
    maxWidth: '260px',
    margin: '7px 0 0',
    color: '#718096',
    fontSize: '11px',
    lineHeight: 1.5,
  },
};