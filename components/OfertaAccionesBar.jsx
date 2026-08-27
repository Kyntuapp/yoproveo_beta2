import { CheckCircle2, MessageCircle, XCircle } from 'lucide-react';
import Tooltip from './Tooltip';
import { formatearTooltipChat } from '../lib/ofertaMensajes';

function formatearBadge(cantidad) {
  if (cantidad <= 0) return null;
  if (cantidad > 9) return '9+';
  return String(cantidad);
}

export default function OfertaAccionesBar({
  tooltipChat = 'Hablar con el proveedor',
  noLeidos = 0,
  chatAbierto = false,
  panelId,
  onToggleChat,
  onAceptar,
  onRechazar,
  mostrarAceptarRechazar = false,
  variant = 'dark',
}) {
  const badge = formatearBadge(noLeidos);
  const tooltipDinamico = formatearTooltipChat(tooltipChat, noLeidos);
  const light = variant === 'light';

  return (
    <>
      <div style={styles.bar} onClick={(e) => e.stopPropagation()}>
        <Tooltip label={tooltipDinamico}>
          <button
            type="button"
            aria-label={tooltipDinamico}
            aria-expanded={chatAbierto}
            aria-controls={panelId || undefined}
            onClick={onToggleChat}
            className={`oferta-accion-icono oferta-accion-chat${
              light ? ' oferta-accion-light' : ''
            }${chatAbierto ? ' oferta-accion-chat-activo' : ''}${
              light && chatAbierto ? ' oferta-accion-chat-activo-light' : ''
            }`}
          >
            <MessageCircle size={20} strokeWidth={2.1} aria-hidden="true" />
            {badge && <span style={styles.badge}>{badge}</span>}
          </button>
        </Tooltip>

        {mostrarAceptarRechazar && (
          <>
            <Tooltip label="Aceptar oferta y agregar al carro">
              <button
                type="button"
                aria-label="Aceptar oferta y agregar al carro"
                onClick={onAceptar}
                className={`oferta-accion-icono oferta-accion-aceptar${
                  light ? ' oferta-accion-aceptar-light' : ''
                }`}
              >
                <CheckCircle2 size={20} strokeWidth={2.1} aria-hidden="true" />
              </button>
            </Tooltip>

            <Tooltip label="Rechazar oferta">
              <button
                type="button"
                aria-label="Rechazar oferta"
                onClick={onRechazar}
                className={`oferta-accion-icono oferta-accion-rechazar${
                  light ? ' oferta-accion-rechazar-light' : ''
                }`}
              >
                <XCircle size={20} strokeWidth={2.1} aria-hidden="true" />
              </button>
            </Tooltip>
          </>
        )}
      </div>

      <style jsx global>{`
        .oferta-accion-icono {
          position: relative;
          width: 40px;
          height: 40px;
          padding: 0;
          border-radius: 12px;
          border: 1px solid rgba(255, 255, 255, 0.18);
          background: rgba(255, 255, 255, 0.08);
          color: #ffffff;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          box-sizing: border-box;
          transition:
            background-color 0.15s ease,
            border-color 0.15s ease,
            color 0.15s ease,
            transform 0.15s ease,
            box-shadow 0.15s ease;
        }

        .oferta-accion-icono:hover {
          transform: translateY(-1px);
        }

        .oferta-accion-icono:focus-visible {
          outline: 2px solid #31f7c6;
          outline-offset: 2px;
        }

        .oferta-accion-chat:hover {
          background: rgba(255, 255, 255, 0.14);
        }

        .oferta-accion-chat-activo {
          border-color: rgba(49, 247, 198, 0.55);
          background: rgba(49, 247, 198, 0.14);
          color: #31f7c6;
          box-shadow: inset 0 0 0 1px rgba(49, 247, 198, 0.25);
        }

        .oferta-accion-aceptar {
          color: #31f7c6;
          border-color: rgba(49, 247, 198, 0.35);
        }

        .oferta-accion-aceptar:hover,
        .oferta-accion-aceptar:focus-visible {
          background: rgba(49, 247, 198, 0.18);
        }

        .oferta-accion-rechazar {
          color: rgba(255, 255, 255, 0.55);
          border-color: rgba(255, 255, 255, 0.18);
          background: rgba(255, 255, 255, 0.08);
        }

        .oferta-accion-rechazar:hover,
        .oferta-accion-rechazar:focus-visible {
          background: rgba(160, 35, 55, 0.42);
          border-color: rgba(255, 100, 120, 0.72);
          color: #ffe0e6;
        }

        .oferta-accion-rechazar:active {
          background: rgba(190, 45, 65, 0.55);
          border-color: rgba(255, 120, 140, 0.85);
          color: #ffffff;
        }

        .oferta-accion-light {
          border-color: #dfe8f3;
          background: #f6f9fd;
          color: #52627a;
        }

        .oferta-accion-light:hover {
          background: #edf4ff;
        }

        .oferta-accion-chat-activo-light {
          border-color: rgba(23, 107, 255, 0.45);
          background: rgba(23, 107, 255, 0.1);
          color: #176bff;
          box-shadow: inset 0 0 0 1px rgba(23, 107, 255, 0.18);
        }

        .oferta-accion-aceptar-light {
          color: #07846f;
          border-color: rgba(7, 132, 111, 0.35);
          background: rgba(7, 132, 111, 0.08);
        }

        .oferta-accion-aceptar-light:hover,
        .oferta-accion-aceptar-light:focus-visible {
          background: rgba(7, 132, 111, 0.14);
        }

        .oferta-accion-rechazar-light {
          color: #8a94a6;
          border-color: #dfe8f3;
          background: #f6f9fd;
        }

        .oferta-accion-rechazar-light:hover,
        .oferta-accion-rechazar-light:focus-visible {
          background: rgba(180, 35, 24, 0.08);
          border-color: rgba(180, 35, 24, 0.35);
          color: #b42318;
        }
      `}</style>
    </>
  );
}

const styles = {
  bar: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginTop: '12px',
    flexWrap: 'wrap',
  },
  badge: {
    position: 'absolute',
    top: '-5px',
    right: '-5px',
    minWidth: '18px',
    height: '18px',
    padding: '0 4px',
    borderRadius: '999px',
    background: '#2563EB',
    color: '#ffffff',
    border: '2px solid rgba(5, 12, 29, 0.95)',
    fontSize: '10px',
    fontWeight: 800,
    lineHeight: '14px',
    textAlign: 'center',
    boxSizing: 'border-box',
    pointerEvents: 'none',
  },
};
