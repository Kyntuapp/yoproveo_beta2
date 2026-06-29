import { useRouter } from 'next/router';
import { useState } from 'react';
import KyntuModal, { createModalState } from './KyntuModal';

export default function CheckoutPago() {
  const router = useRouter();
  const { pago_id } = router.query;
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState(createModalState());

  const abrirConfirmacionPago = () => {
  setModal({
    ...createModalState(),
    open: true,
    type: 'warning',
    title: 'Confirmar pago',
    message: '¿Deseas realizar el pago de esta compra?',
    confirmText: 'Pagar ahora',
    cancelText: 'Cancelar',
    showCancel: true,
    onCancel: () => setModal(createModalState()),
    onConfirm: () => {
      setModal(createModalState());
      confirmarPago();
    },
  });
};

  const confirmarPago = async () => {
    setLoading(true);

    const res = await fetch('/api/pagos/confirmar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pago_id }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setModal({
        ...createModalState(),
        open: true,
        type: 'error',
        title: 'No se pudo realizar el pago',
        message: data.error || 'Ocurrió un error al confirmar el pago.',
        onConfirm: () => setModal(createModalState()),
      });
      return;
    }

    setModal({
      ...createModalState(),
      open: true,
      type: 'success',
      title: '¡Pago realizado!',
      message: 'Tu pago fue registrado correctamente.',
      confirmText: 'Volver a mis compras',
      onConfirm: () => router.push('/comprador'),
    });
  };

  return (
    <div style={styles.page}>
      <main style={styles.container}>
        <button onClick={() => router.push('/comprador')} style={styles.backButton}>
          ← Volver a mis compras
        </button>

        <section style={styles.grid}>
          <div>
            <p style={styles.badge}>PAGO SEGURO</p>
            <h1 style={styles.title}>Revisa y confirma tu pago</h1>
            <p style={styles.subtitle}>
              Estás a punto de realizar el pago de tu compra. Revisa el resumen antes de continuar.
            </p>

            <div style={styles.card}>
              <img src="/icono_1.png" alt="Kyntü" style={styles.logo} />
              <h2 style={styles.cardTitle}>Resumen de pago</h2>

              <div style={styles.summaryRow}>
                <span>ID de pago</span>
                <strong>{pago_id || 'Cargando...'}</strong>
              </div>

              <div style={styles.summaryRow}>
                <span>Estado</span>
                <strong>Pendiente</strong>
              </div>

              <div style={styles.totalBox}>
                <span>Total a pagar</span>
                <strong>Por confirmar</strong>
              </div>
            </div>
          </div>

          <aside style={styles.sideCard}>
            <h2 style={styles.cardTitle}>Método de pago</h2>

            <div style={styles.methodSelected}>
              <span style={styles.radio}>●</span>
              <div>
                <strong>Pago seguro Kyntü</strong>
                <p style={styles.methodText}>
                  Ambiente preparado para integración automática.
                </p>
              </div>
            </div>

            <div style={styles.secureBox}>
              <strong>Pago protegido</strong>
              <p>Tu compra quedará asociada al registro de pago de Kyntü.</p>
            </div>

            <button
              onClick={abrirConfirmacionPago}
              disabled={loading || !pago_id}
              style={{
                ...styles.payButton,
                opacity: loading || !pago_id ? 0.6 : 1,
                cursor: loading || !pago_id ? 'not-allowed' : 'pointer',
              }}
            >
              {loading ? 'Procesando...' : 'Pagar ahora'}
            </button>
          </aside>
        </section>
      </main>

      <KyntuModal {...modal} />
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    background: '#f7f9fc',
    fontFamily: 'Arial, Helvetica, sans-serif',
    color: '#071b3d',
  },
  container: {
    maxWidth: '1180px',
    margin: '0 auto',
    padding: '48px 28px',
  },
  backButton: {
    border: 'none',
    background: 'transparent',
    color: '#176BFF',
    fontWeight: 800,
    fontSize: '15px',
    cursor: 'pointer',
    marginBottom: '42px',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: '1.6fr 0.9fr',
    gap: '36px',
    alignItems: 'start',
  },
  badge: {
    color: '#176BFF',
    fontWeight: 900,
    letterSpacing: '0.08em',
    fontSize: '13px',
    margin: '0 0 14px',
  },
  title: {
    fontSize: '42px',
    lineHeight: 1.1,
    margin: 0,
    color: '#061b41',
    fontWeight: 900,
  },
  subtitle: {
    color: '#52627a',
    fontSize: '16px',
    lineHeight: 1.7,
    maxWidth: '560px',
    margin: '18px 0 30px',
  },
  card: {
    background: '#ffffff',
    border: '1px solid #e5ebf5',
    borderRadius: '24px',
    padding: '28px',
    boxShadow: '0 20px 60px rgba(20, 55, 120, 0.08)',
  },
  sideCard: {
    background: '#ffffff',
    border: '1px solid #e5ebf5',
    borderRadius: '24px',
    padding: '28px',
    boxShadow: '0 20px 60px rgba(20, 55, 120, 0.08)',
    position: 'sticky',
    top: '24px',
  },
  logo: {
    width: '198px',
    display: 'block',
    margin: '-37px -35px -37px 200px',
  },
  cardTitle: {
    color: '#061b41',
    fontSize: '20px',
    fontWeight: 900,
    margin: '0 0 20px',
  },
  summaryRow: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '16px',
    padding: '16px 0',
    borderBottom: '1px solid #edf1f7',
    color: '#52627a',
  },
  totalBox: {
    marginTop: '22px',
    padding: '20px',
    borderRadius: '16px',
    background: '#f4f8ff',
    display: 'flex',
    justifyContent: 'space-between',
    color: '#061b41',
    fontSize: '18px',
  },
  methodSelected: {
    border: '1.5px solid #176BFF',
    borderRadius: '16px',
    padding: '18px',
    display: 'flex',
    gap: '14px',
    alignItems: 'flex-start',
    marginBottom: '18px',
  },
  radio: {
    color: '#176BFF',
    fontSize: '18px',
  },
  methodText: {
    color: '#52627a',
    margin: '6px 0 0',
    fontSize: '14px',
  },
  secureBox: {
    borderTop: '1px solid #edf1f7',
    paddingTop: '18px',
    color: '#52627a',
    fontSize: '14px',
    lineHeight: 1.6,
    marginBottom: '24px',
  },
  payButton: {
    width: '100%',
    border: 'none',
    borderRadius: '14px',
    padding: '16px 20px',
    background: '#176BFF',
    color: '#ffffff',
    fontSize: '16px',
    fontWeight: 900,
    boxShadow: '0 14px 28px rgba(23,107,255,0.24)',
  },
};