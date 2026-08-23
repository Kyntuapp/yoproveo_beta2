import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { CreditCard, ShoppingCart } from 'lucide-react';
import { supabase } from '../../../lib/supabaseClient';
import AppLayout from '../../../components/Layout/AppLayout';
import Notificaciones from '../../../components/Notificaciones';
import SoporteLauncher from '../../../components/soporte/SoporteLauncher';
import CarroCompradorButton from '../../../components/CarroCompradorButton';
import {
  cancelarOrdenCheckout,
  confirmarOrdenCheckout,
  fetchNombresProveedores,
  obtenerOrdenCheckout,
} from '../../../lib/carroComprador';
import KyntuModal, { createModalState } from '../../KyntuModal';

const formatearMonto = (valor) =>
  new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(Number(valor || 0));

export default function CheckoutOrdenPage() {
  const router = useRouter();
  const { ordenId } = router.query;

  const [loading, setLoading] = useState(true);
  const [authUserId, setAuthUserId] = useState(null);
  const [perfilId, setPerfilId] = useState(null);
  const [tienePerfilProveedor, setTienePerfilProveedor] =
    useState(false);
  const [orden, setOrden] = useState(null);
  const [nombresProv, setNombresProv] = useState({});
  const [busy, setBusy] = useState(false);
  const [modal, setModal] = useState(createModalState());

  const showModal = (config) => {
    setModal({
      ...createModalState(),
      open: true,
      ...config,
      onConfirm:
        config.onConfirm ||
        (() => setModal(createModalState())),
      onCancel:
        config.onCancel ||
        (() => setModal(createModalState())),
    });
  };

  const cargarOrden = async (id) => {
    const { data, error } = await obtenerOrdenCheckout(id);

    if (error) {
      showModal({
        type: 'error',
        title: 'No se pudo cargar el resumen',
        message: error.message,
      });
      setOrden(null);
      return;
    }

    if (!data) {
      showModal({
        type: 'error',
        title: 'Orden no encontrada',
        message: 'La orden no existe o no te pertenece.',
        onConfirm: () => {
          setModal(createModalState());
          router.push('/comprador/carro');
        },
      });
      setOrden(null);
      return;
    }

    setOrden(data);

    const map = await fetchNombresProveedores(
      (data.items || []).map((i) => i.proveedor_id)
    );
    setNombresProv(map);
  };

  useEffect(() => {
    if (!router.isReady || !ordenId) return undefined;

    let active = true;

    const init = async () => {
      setLoading(true);

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (!active) return;

      if (userError || !user) {
        router.push('/login');
        return;
      }

      setAuthUserId(user.id);

      const { data: perfil } = await supabase
        .from('perfiles')
        .select('id')
        .eq('auth_id', user.id)
        .eq('tipo', 'comprador')
        .maybeSingle();

      if (perfil?.id) setPerfilId(perfil.id);

      const { data: perfilProv } = await supabase
        .from('perfiles')
        .select('id')
        .eq('auth_id', user.id)
        .eq('tipo', 'proveedor')
        .maybeSingle();

      setTienePerfilProveedor(Boolean(perfilProv?.id));

      await cargarOrden(String(ordenId));
      if (active) setLoading(false);
    };

    init();

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.isReady, ordenId]);

  const grupos = useMemo(() => {
    const items = orden?.items || [];
    const map = new Map();

    for (const item of items) {
      const key = item.proveedor_id || 'sin-proveedor';
      if (!map.has(key)) {
        map.set(key, {
          proveedorId: key,
          nombre: nombresProv[key] || 'Proveedor',
          items: [],
        });
      }
      map.get(key).items.push(item);
    }

    return Array.from(map.values());
  }, [orden, nombresProv]);

  const volverAlCarro = async () => {
    if (!orden?.id || busy) return;

    if (orden.estado === 'abierta') {
      setBusy(true);
      const { error } = await cancelarOrdenCheckout(orden.id);
      setBusy(false);

      if (error) {
        showModal({
          type: 'error',
          title: 'No se pudo volver al carro',
          message: error.message,
        });
        return;
      }
    }

    router.push('/comprador/carro');
  };

  /**
   * handlePagarOrden — frontera de desarrollo Kyntü.
   * 1) confirma la orden en backend (snapshots/pagos pendientes internos)
   * 2) [PUNTO DE INTEGRACIÓN PASARELA] — aquí debe continuar Transbank/MP/etc.
   * No iniciar pasarela en este ticket.
   */
  const handlePagarOrden = async () => {
    if (!orden?.id || busy) return;
    if (orden.estado !== 'abierta') return;

    setBusy(true);
    const { data, error } = await confirmarOrdenCheckout(orden.id);
    setBusy(false);

    if (error || !data) {
      showModal({
        type: 'error',
        title: 'No se pudo preparar el pago',
        message: error?.message || 'Inténtalo nuevamente.',
      });
      return;
    }

    // [PUNTO DE INTEGRACIÓN PASARELA]
    // Reemplazar/extender desde aquí con el medio de pago externo.
    // La orden ya quedó confirmada con pagos pendientes asociados.

    await cargarOrden(orden.id);

    showModal({
      type: 'success',
      title: 'Orden preparada para pago',
      message:
        'Tu compra está lista. La conexión con el medio de pago se realizará desde este punto.',
      confirmText: 'Entendido',
    });
  };

  const cerrarSesion = async () => {
    await supabase.auth.signOut();
    localStorage.clear();
    router.push('/login');
  };

  const esAbierta = orden?.estado === 'abierta';
  const esConfirmada = orden?.estado === 'confirmada';
  const itemsCount = orden?.items?.length || 0;
  const subtotalProductos = Number(orden?.total_ofertas || 0);

  return (
    <AppLayout
      title="Resumen de compra"
      showProfileSwitch={tienePerfilProveedor}
      onChangeProfile={() =>
        router.push('/seleccionar-perfil')
      }
      onUpdateData={() =>
        router.push('/comprador/datos-contacto')
      }
      onDashboard={() =>
        router.push('/comprador/DashboardComprador')
      }
      onLogout={cerrarSesion}
      cart={<CarroCompradorButton />}
      notifications={
        <Notificaciones userId={authUserId} rol="comprador" />
      }
      support={
        perfilId ? (
          <SoporteLauncher perfilId={perfilId} rol="comprador" />
        ) : null
      }
    >
      <section style={styles.card}>
        <div style={styles.heading}>
          <div style={styles.headingIcon}>
            <CreditCard size={22} strokeWidth={2.2} />
          </div>
          <div>
            <h1 style={styles.title}>Resumen final</h1>
            <p style={styles.subtitle}>
              Revisa tu compra agrupada. Los montos vienen de la
              orden congelada en el servidor.
            </p>
          </div>
        </div>

        {loading ? (
          <p style={styles.muted}>Cargando resumen…</p>
        ) : !orden ? (
          <p style={styles.muted}>No hay orden para mostrar.</p>
        ) : (
          <>
            <p style={styles.statusPill}>
              Estado: <strong>{orden.estado}</strong>
            </p>

            {esConfirmada && (
              <div style={styles.preparedBox}>
                <h2 style={styles.preparedTitle}>
                  Orden preparada para pago
                </h2>
                <p style={styles.preparedText}>
                  Tu compra está lista. La conexión con el medio de
                  pago se realizará desde este punto.
                </p>
              </div>
            )}

            <div style={styles.groups}>
              {grupos.map((grupo) => {
                const sub = grupo.items.reduce(
                  (acc, i) => acc + Number(i.monto_oferta || 0),
                  0
                );
                return (
                  <div key={grupo.proveedorId} style={styles.group}>
                    <h2 style={styles.groupTitle}>{grupo.nombre}</h2>
                    <div style={styles.items}>
                      {grupo.items.map((item) => (
                        <article key={item.id} style={styles.item}>
                          <div style={styles.itemMain}>
                            <h3 style={styles.itemTitle}>
                              {item.producto_snapshot || 'Producto'}
                            </h3>
                            <p style={styles.itemMeta}>
                              {[
                                item.marca_snapshot,
                                item.formato_snapshot,
                              ]
                                .filter(Boolean)
                                .join(' · ') || 'Sin detalle'}
                            </p>
                            <p style={styles.itemMeta}>
                              Cantidad:{' '}
                              {item.cantidad_snapshot ?? '—'}
                            </p>
                          </div>
                          <strong style={styles.priceValue}>
                            {formatearMonto(item.monto_oferta)}
                          </strong>
                        </article>
                      ))}
                    </div>
                    <p style={styles.providerSubtotal}>
                      Subtotal proveedor:{' '}
                      <strong>{formatearMonto(sub)}</strong>
                    </p>
                  </div>
                );
              })}
            </div>

            <aside style={styles.summary}>
              <div style={styles.summaryRow}>
                <span>Compras</span>
                <strong>{itemsCount}</strong>
              </div>
              <div style={styles.summaryRow}>
                <span>Subtotal productos</span>
                <strong>{formatearMonto(subtotalProductos)}</strong>
              </div>
              <p style={styles.summaryNote}>
                No se muestran comisiones/impuestos adicionales: la
                semántica comercial definitiva aún no está aprobada.
              </p>

              {esAbierta && (
                <>
                  <button
                    type="button"
                    style={{
                      ...styles.payButton,
                      ...(busy ? styles.disabled : {}),
                    }}
                    disabled={busy}
                    onClick={handlePagarOrden}
                  >
                    {busy ? 'Procesando…' : 'Pagar'}
                  </button>
                  <button
                    type="button"
                    style={styles.secondaryButton}
                    disabled={busy}
                    onClick={volverAlCarro}
                  >
                    <ShoppingCart size={16} />
                    Volver al carro
                  </button>
                </>
              )}

              {esConfirmada && (
                <button
                  type="button"
                  style={styles.secondaryButton}
                  onClick={() => router.push('/comprador/carro')}
                >
                  Ir al carro
                </button>
              )}

              {orden.estado === 'cancelada' && (
                <button
                  type="button"
                  style={styles.secondaryButton}
                  onClick={() => router.push('/comprador/carro')}
                >
                  Volver al carro
                </button>
              )}
            </aside>
          </>
        )}
      </section>

      <KyntuModal {...modal} />
    </AppLayout>
  );
}

const styles = {
  card: {
    background: '#ffffff',
    border: '1px solid #dbe5f1',
    borderRadius: '24px',
    padding: '22px',
    boxShadow: '0 18px 40px rgba(31, 69, 122, 0.08)',
  },
  heading: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '14px',
    marginBottom: '18px',
  },
  headingIcon: {
    width: '44px',
    height: '44px',
    borderRadius: '14px',
    background: '#e8f1ff',
    color: '#176bff',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  title: {
    margin: 0,
    color: '#061b41',
    fontSize: '22px',
    fontWeight: 900,
  },
  subtitle: {
    margin: '6px 0 0',
    color: '#6d7f98',
    fontSize: '14px',
    lineHeight: 1.45,
  },
  muted: { color: '#6d7f98', fontSize: '14px' },
  statusPill: {
    display: 'inline-block',
    marginBottom: '14px',
    padding: '6px 10px',
    borderRadius: '999px',
    background: '#f1f6ff',
    color: '#49617f',
    fontSize: '12px',
    fontWeight: 700,
  },
  preparedBox: {
    marginBottom: '16px',
    padding: '14px 16px',
    borderRadius: '14px',
    border: '1px solid #b7e4d0',
    background: '#f3fbf7',
  },
  preparedTitle: {
    margin: 0,
    color: '#0f766e',
    fontSize: '16px',
    fontWeight: 900,
  },
  preparedText: {
    margin: '6px 0 0',
    color: '#3f6f66',
    fontSize: '13px',
    lineHeight: 1.45,
  },
  groups: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  group: {
    border: '1px solid #e5ecf4',
    borderRadius: '18px',
    padding: '14px',
    background: '#f8fbff',
  },
  groupTitle: {
    margin: '0 0 12px',
    color: '#17365e',
    fontSize: '15px',
    fontWeight: 900,
  },
  items: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  item: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '12px',
    flexWrap: 'wrap',
    padding: '12px',
    borderRadius: '12px',
    background: '#fff',
    border: '1px solid #e7edf5',
  },
  itemMain: { flex: '1 1 200px', minWidth: 0 },
  itemTitle: {
    margin: 0,
    color: '#061b41',
    fontSize: '15px',
    fontWeight: 900,
  },
  itemMeta: {
    margin: '6px 0 0',
    color: '#6d7f98',
    fontSize: '13px',
  },
  priceValue: {
    color: '#061b41',
    fontSize: '17px',
    fontWeight: 900,
  },
  providerSubtotal: {
    margin: '12px 0 0',
    textAlign: 'right',
    color: '#49617f',
    fontSize: '13px',
    fontWeight: 700,
  },
  summary: {
    marginTop: '20px',
    padding: '16px',
    borderRadius: '16px',
    border: '1px solid #dbe5f1',
    background: '#ffffff',
  },
  summaryRow: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '12px',
    marginBottom: '10px',
    color: '#17365e',
    fontSize: '14px',
    fontWeight: 700,
  },
  summaryNote: {
    margin: '0 0 14px',
    color: '#8594aa',
    fontSize: '12px',
  },
  payButton: {
    width: '100%',
    minHeight: '48px',
    marginBottom: '10px',
    borderRadius: '12px',
    border: 0,
    background: 'linear-gradient(135deg, #176bff 0%, #00b89c 100%)',
    color: '#fff',
    fontWeight: 900,
    fontSize: '15px',
    cursor: 'pointer',
  },
  secondaryButton: {
    width: '100%',
    minHeight: '44px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    borderRadius: '12px',
    border: '1px solid #cfe0ff',
    background: '#f1f6ff',
    color: '#176bff',
    fontWeight: 800,
    cursor: 'pointer',
  },
  disabled: {
    opacity: 0.55,
    cursor: 'wait',
  },
};
