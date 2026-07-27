import { useCallback, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export default function Tooltip({ label, children }) {
  const [visible, setVisible] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const triggerRef = useRef(null);

  const updatePosition = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    setCoords({
      top: rect.top - 10,
      left: rect.left + rect.width / 2,
    });
  }, []);

  const show = useCallback(() => {
    updatePosition();
    setVisible(true);
  }, [updatePosition]);

  const hide = useCallback((event) => {
    if (event?.currentTarget?.contains(event?.relatedTarget)) return;
    setVisible(false);
  }, []);

  return (
    <>
      <span
        ref={triggerRef}
        className="tooltip-trigger"
        onMouseEnter={show}
        onMouseLeave={() => setVisible(false)}
        onFocus={show}
        onBlur={hide}
      >
        {children}
      </span>

      {visible &&
        typeof document !== 'undefined' &&
        createPortal(
          <span
            role="tooltip"
            style={{
              ...tooltipStyles.bubble,
              top: `${coords.top}px`,
              left: `${coords.left}px`,
            }}
          >
            {label}
          </span>,
          document.body
        )}

      <style jsx>{`
        .tooltip-trigger {
          display: inline-flex;
          position: relative;
        }
      `}</style>
    </>
  );
}

const tooltipStyles = {
  bubble: {
    position: 'fixed',
    transform: 'translate(-50%, -100%)',
    zIndex: 10050,
    maxWidth: '280px',
    padding: '6px 10px',
    borderRadius: '8px',
    background: 'rgba(8, 16, 36, 0.96)',
    border: '1px solid rgba(255, 255, 255, 0.18)',
    color: '#ffffff',
    fontSize: '12px',
    fontWeight: 600,
    lineHeight: 1.35,
    textAlign: 'center',
    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.45)',
    pointerEvents: 'none',
    whiteSpace: 'normal',
    boxSizing: 'border-box',
  },
};
