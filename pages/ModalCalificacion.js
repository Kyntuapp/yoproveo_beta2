export default function ModalCalificacion({
  open,
  estrellas,
  comentario,
  onClose,
  onGuardar,
  onEstrellasChange,
  onComentarioChange,
}) {
  if (!open) return null;

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <img src="/icono_1.png" alt="" style={styles.watermark} />

        <div style={styles.content}>
          <p style={styles.badge}>CALIFICACIÓN</p>

          <h2 style={styles.title}>Califica al proveedor</h2>

          <p style={styles.message}>
            Tu opinión ayuda a otros compradores a elegir mejores proveedores.
          </p>

          <div style={styles.stars}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => onEstrellasChange(n)}
                style={{
                  ...styles.starButton,
                  color: n <= estrellas ? '#f59e0b' : '#cbd5e1',
                }}
              >
                ★
              </button>
            ))}
          </div>

          <input
            type="text"
            value={comentario}
            onChange={(e) => onComentarioChange(e.target.value)}
            placeholder="Escribe una reseña opcional..."
            style={styles.input}
          />

          <div style={styles.actions}>
            <button onClick={onClose} style={styles.cancelButton}>
              Cancelar
            </button>

            <button onClick={onGuardar} style={styles.confirmButton}>
              Enviar calificación
            </button>
          </div>
        </div>
      </div>
    </div>
  );
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
    width: '100%',
    maxWidth: '460px',
    background: '#ffffff',
    border: '1px solid #e5ebf5',
    borderRadius: '28px',
    padding: '32px',
    boxShadow: '0 30px 90px rgba(20, 55, 120, 0.22)',
    overflow: 'hidden',
    fontFamily: 'Arial, Helvetica, sans-serif',
  },
  watermark: {
    position: 'absolute',
    width: '260px',
    opacity: 0.055,
    right: '-55px',
    top: '-55px',
    pointerEvents: 'none',
  },
  content: {
    position: 'relative',
    zIndex: 2,
    textAlign: 'center',
  },
  badge: {
    color: '#176BFF',
    fontWeight: 900,
    fontSize: '12px',
    letterSpacing: '0.08em',
    margin: '0 0 10px',
  },
  title: {
    color: '#061b41',
    fontSize: '26px',
    fontWeight: 900,
    margin: '0 0 10px',
  },
  message: {
    color: '#52627a',
    fontSize: '15px',
    lineHeight: 1.6,
    margin: '0 0 18px',
  },
  stars: {
    display: 'flex',
    justifyContent: 'center',
    gap: '8px',
    marginBottom: '20px',
  },
  starButton: {
    border: 'none',
    background: 'transparent',
    fontSize: '36px',
    lineHeight: 1,
    cursor: 'pointer',
    padding: '2px',
  },
  input: {
    width: '100%',
    minHeight: '110px',
    border: '1px solid #dbe4f0',
    borderRadius: '16px',
    padding: '14px 16px',
    fontSize: '14px',
    color: '#061b41',
    outline: 'none',
    resize: 'vertical',
    boxSizing: 'border-box',
    fontFamily: 'Arial, Helvetica, sans-serif',
    marginBottom: '22px',
  },
  actions: {
    display: 'flex',
    justifyContent: 'center',
    gap: '12px',
    flexWrap: 'wrap',
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
  confirmButton: {
    border: 'none',
    background: '#176BFF',
    borderRadius: '14px',
    padding: '13px 22px',
    color: '#ffffff',
    fontWeight: 900,
    cursor: 'pointer',
    minWidth: '170px',
    boxShadow: '0 14px 28px rgba(23,107,255,0.24)',
  },
};