export default function KyntuModal({
  open,
  type = 'info',
  title,
  message,
  confirmText = 'Aceptar',
  cancelText = 'Cancelar',
  onConfirm,
  onCancel,
  showCancel = false,
}) {
  if (!open) return null;

  const iconByType = {
    success: '✓',
    error: '!',
    warning: '!',
    info: 'i',
  };

  const colorByType = {
    success: '#12b981',
    error: '#ef4444',
    warning: '#f59e0b',
    info: '#176BFF',
  };

  const color = colorByType[type] || colorByType.info;

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <img
            src="/icono_1.png"
            alt=""
            style={styles.backgroundLogo}
            />

       

        <h2 style={styles.title}>{title}</h2>

        {message && <p style={styles.message}>{message}</p>}

        <div style={styles.actions}>
          {showCancel && (
            <button onClick={onCancel} style={styles.cancelButton}>
              {cancelText}
            </button>
          )}

          <button
            onClick={onConfirm}
            style={{
              ...styles.confirmButton,
              background: color,
              boxShadow: `0 14px 28px ${color}33`,
            }}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

export function createModalState() {
  return {
    open: false,
    type: 'info',
    title: '',
    message: '',
    confirmText: 'Aceptar',
    cancelText: 'Cancelar',
    showCancel: false,
    onConfirm: null,
    onCancel: null,
  };
}

const styles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(7, 18, 40, 0.45)',
    backdropFilter: 'blur(8px)',
    zIndex: 99999,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
  },
  modal: {
    position: 'relative',
    overflow: 'hidden',
    width: '100%',
    maxWidth: '420px',
    background: '#ffffff',
    border: '1px solid #e5ebf5',
    borderRadius: '28px',
    padding: '32px 30px',
    boxShadow: '0 30px 90px rgba(20, 55, 120, 0.22)',
    textAlign: 'center',
    fontFamily: 'Arial, Helvetica, sans-serif',
  },
  logo: {
    width: '90px',
    marginBottom: '10px',
  },
  icon: {
    width: '54px',
    height: '54px',
    borderRadius: '18px',
    border: '1px solid',
    margin: '8px auto 18px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '28px',
    fontWeight: 900,
  },
  title: {
    position: 'relative',
    zIndex: 2,
    color: '#061b41',
    fontSize: '24px',
    fontWeight: 900,
    margin: '0 0 10px',
  },
  message: {
    position: 'relative',
    zIndex: 2,
    color: '#52627a',
    fontSize: '15px',
    lineHeight: 1.6,
    margin: '0 0 24px',
  },
  actions: {
    position: 'relative',
    zIndex: 2,
    display: 'flex',
    gap: '12px',
    justifyContent: 'center',
  },
  confirmButton: {
    border: 'none',
    borderRadius: '14px',
    padding: '13px 22px',
    color: '#ffffff',
    fontWeight: 900,
    cursor: 'pointer',
    minWidth: '130px',
  },
  cancelButton: {
    border: '1px solid #dbe4f0',
    background: '#ffffff',
    borderRadius: '14px',
    padding: '13px 22px',
    color: '#061b41',
    fontWeight: 900,
    cursor: 'pointer',
    minWidth: '120px',
  },
  backgroundLogo: {
  position: 'absolute',
  width: '230px',
  opacity: 0.05,
  right: '-35px',
  top: '-10px',
  pointerEvents: 'none',
  userSelect: 'none',
},
};