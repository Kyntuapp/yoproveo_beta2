import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { ShoppingCart } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import AppLayout from '../../components/Layout/AppLayout';
import Notificaciones from '../../components/Notificaciones';
import SoporteLauncher from '../../components/soporte/SoporteLauncher';
import CarroCompradorButton from '../../components/CarroCompradorButton';
import {
  CARRO_UPDATED_EVENT,
  fetchCarroOfertasComprador,
  notifyCarroUpdated,
  revertirAdjudicacionDesdeCarro,
} from '../../lib/carroComprador';
import KyntuModal, { createModalState } from '../KyntuModal';

const formatearMonto = (valor) =>
  new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(Number(valor || 0));

function nombreProveedor(oferta) {
  return (
    oferta?.perfiles?.nombre_contacto?.trim?.() ||
    oferta?.perfiles?.email_contacto?.trim?.() ||
    oferta?.perfiles?.email?.trim?.() ||
    'Proveedor'
  );
}

export default function CarroCompradorPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [authUserId, setAuthUserId] = useState(null);
  const [perfilId, setPerfilId] = useState(null);
  const [tienePerfilProveedor, setTienePerfilProveedor] =
    useState(false);
  const [ofertas, setOfertas] = useState([]);
  const [modal, setModal] = useState(createModalState());
  const [revirtiendoId, setRevirtiendoId] = useState(null);

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

  const cargarCarro = async (userId) => {
    const { ofertas: data, error } =
      await fetchCarroOfertasComprador(userId);

    if (error) {
      showModal({
        type: 'error',
        title: 'No se pudo cargar el carro',
        message: error.message,
      });
      setOfertas([]);
      return;
    }

    setOfertas(data || []);
  };

  const ejecutarRevertir = async (oferta) => {
    if (!oferta?.id || revirtiendoId) return;

    setRevirtiendoId(oferta.id);

    const { error } = await revertirAdjudicacionDesdeCarro(oferta.id);

    setRevirtiendoId(null);

    if (error) {
      showModal({
        type: 'error',
        title: 'No se pudo eliminar del carro',
        message:
          error.message ||
          'La adjudicación no pudo revertirse. Si la oferta está en una orden abierta, cancélala primero.',
      });
      return;
    }

    if (authUserId) {
      await cargarCarro(authUserId);
    } else {
      notifyCarroUpdated();
    }

    showModal({
      type: 'success',
      title: 'Oferta eliminada del carro',
      message:
        'La adjudicación fue cancelada. El producto vuelve a admitir ofertas y los proveedores reactivados fueron notificados.',
      confirmText: 'Entendido',
    });
  };

  const confirmarEliminarDelCarro = (oferta) => {
    const producto =
      oferta.producto ||
      oferta.lista_producto ||
      'esta oferta';

    showModal({
      type: 'warning',
      title: '¿Eliminar del carro?',
      message: `Se cancelará la adjudicación de “${producto}”. El proveedor ganador dejará de estar pendiente de pago y las ofertas rivales rechazadas automáticamente volverán a competir.`,
      confirmText: 'Eliminar del carro',
      cancelText: 'Conservar',
      showCancel: true,
      onCancel: () => setModal(createModalState()),
      onConfirm: () => {
        setModal(createModalState());
        ejecutarRevertir(oferta);
      },
    });
  };

  useEffect(() => {
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

      await cargarCarro(user.id);
      if (active) setLoading(false);
    };

    init();

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  useEffect(() => {
    if (!authUserId) return undefined;

    const onUpdated = () => {
      cargarCarro(authUserId);
    };

    window.addEventListener(CARRO_UPDATED_EVENT, onUpdated);
    return () =>
      window.removeEventListener(CARRO_UPDATED_EVENT, onUpdated);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUserId]);

  const grupos = useMemo(() => {
    const map = new Map();

    for (const oferta of ofertas) {
      const key = oferta.proveedor_id || 'sin-proveedor';
      if (!map.has(key)) {
        map.set(key, {
          proveedorId: key,
          nombre: nombreProveedor(oferta),
          items: [],
        });
      }
      map.get(key).items.push(oferta);
    }

    return Array.from(map.values());
  }, [ofertas]);

  const subtotal = useMemo(
    () =>
      ofertas.reduce(
        (acc, o) => acc + Number(o.precio_ofertado || 0),
        0
      ),
    [ofertas]
  );

  const cerrarSesion = async () => {
    await supabase.auth.signOut();
    localStorage.clear();
    router.push('/login');
  };

  return (
    <AppLayout
      title="Carro de compras"
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
            <ShoppingCart size={22} strokeWidth={2.2} />
          </div>
          <div>
            <h1 style={styles.title}>Tu carro</h1>
            <p style={styles.subtitle}>
              Ofertas aceptadas pendientes de pago. Podrás agrupar
              tus compras antes de pagar.
            </p>
          </div>
        </div>

        {loading ? (
          <p style={styles.muted}>Cargando carro…</p>
        ) : ofertas.length === 0 ? (
          <div style={styles.empty}>
            <ShoppingCart size={36} strokeWidth={1.8} color="#8aa0bc" />
            <h2 style={styles.emptyTitle}>Tu carro está vacío</h2>
            <p style={styles.emptyText}>
              Cuando aceptes una oferta, aparecerá aquí para que
              puedas agrupar tus compras antes de pagar.
            </p>
            <button
              type="button"
              style={styles.primaryButton}
              onClick={() => router.push('/comprador')}
            >
              Volver a mis solicitudes
            </button>
          </div>
        ) : (
          <>
            <div style={styles.groups}>
              {grupos.map((grupo) => (
                <div key={grupo.proveedorId} style={styles.group}>
                  <h2 style={styles.groupTitle}>{grupo.nombre}</h2>
                  <div style={styles.items}>
                    {grupo.items.map((oferta) => (
                      <article key={oferta.id} style={styles.item}>
                        <div style={styles.itemMain}>
                          <h3 style={styles.itemTitle}>
                            {oferta.producto ||
                              oferta.lista_producto ||
                              'Producto'}
                          </h3>
                          <p style={styles.itemMeta}>
                            {[
                              oferta.marca || oferta.lista_marca,
                              oferta.formato || oferta.lista_formato,
                            ]
                              .filter(Boolean)
                              .join(' · ') || 'Sin detalle'}
                          </p>
                          <p style={styles.itemMeta}>
                            Cantidad:{' '}
                            {oferta.cantidad_solicitada ?? '—'}
                          </p>
                          {oferta.incluye_despacho != null && (
                            <p style={styles.itemMeta}>
                              Despacho:{' '}
                              {oferta.incluye_despacho
                                ? oferta.tiempo_despacho_horas
                                  ? `Sí (${oferta.tiempo_despacho_horas} h)`
                                  : 'Sí'
                                : 'No'}
                            </p>
                          )}
                        </div>
                        <div style={styles.itemPrice}>
                          <span style={styles.priceLabel}>
                            Precio adjudicado
                          </span>
                          <strong style={styles.priceValue}>
                            {formatearMonto(oferta.precio_ofertado)}
                          </strong>
                          <button
                            type="button"
                            style={{
                              ...styles.removeButton,
                              ...(revirtiendoId === oferta.id
                                ? styles.removeButtonDisabled
                                : {}),
                            }}
                            disabled={Boolean(revirtiendoId)}
                            onClick={() =>
                              confirmarEliminarDelCarro(oferta)
                            }
                          >
                            {revirtiendoId === oferta.id
                              ? 'Eliminando…'
                              : 'Eliminar del carro'}
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <aside style={styles.summary}>
              <div style={styles.summaryRow}>
                <span>Ofertas en el carro</span>
                <strong>{ofertas.length}</strong>
              </div>
              <div style={styles.summaryRow}>
                <span>Subtotal productos</span>
                <strong>{formatearMonto(subtotal)}</strong>
              </div>
              <p style={styles.summaryNote}>
                Todavía no se calculan comisiones ni cargos
                adicionales en esta vista.
              </p>
              <button
                type="button"
                style={styles.secondaryButton}
                onClick={() => router.push('/comprador')}
              >
                Seguir comprando
              </button>
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
    marginBottom: '22px',
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
  muted: {
    color: '#6d7f98',
    fontSize: '14px',
  },
  empty: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    gap: '10px',
    padding: '48px 16px',
  },
  emptyTitle: {
    margin: '8px 0 0',
    color: '#17365e',
    fontSize: '18px',
    fontWeight: 900,
  },
  emptyText: {
    margin: 0,
    maxWidth: '420px',
    color: '#6d7f98',
    fontSize: '14px',
    lineHeight: 1.5,
  },
  groups: {
    display: 'flex',
    flexDirection: 'column',
    gap: '18px',
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
    gap: '16px',
    flexWrap: 'wrap',
    padding: '14px',
    borderRadius: '14px',
    background: '#ffffff',
    border: '1px solid #e7edf5',
  },
  itemMain: {
    flex: '1 1 220px',
    minWidth: 0,
  },
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
  itemPrice: {
    flex: '0 0 auto',
    textAlign: 'right',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: '10px',
  },
  priceLabel: {
    display: 'block',
    color: '#8594aa',
    fontSize: '11px',
    fontWeight: 700,
  },
  priceValue: {
    display: 'block',
    color: '#061b41',
    fontSize: '18px',
    fontWeight: 900,
  },
  removeButton: {
    minHeight: '38px',
    padding: '0 12px',
    borderRadius: '10px',
    border: '1px solid #f0c7c3',
    background: '#fff7f6',
    color: '#c1342d',
    fontSize: '12px',
    fontWeight: 800,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  removeButtonDisabled: {
    opacity: 0.65,
    cursor: 'wait',
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
  primaryButton: {
    marginTop: '8px',
    minHeight: '44px',
    padding: '0 18px',
    borderRadius: '12px',
    border: 0,
    background: 'linear-gradient(135deg, #176bff 0%, #00b89c 100%)',
    color: '#fff',
    fontWeight: 800,
    cursor: 'pointer',
  },
  secondaryButton: {
    width: '100%',
    minHeight: '44px',
    borderRadius: '12px',
    border: '1px solid #cfe0ff',
    background: '#f1f6ff',
    color: '#176bff',
    fontWeight: 800,
    cursor: 'pointer',
  },
};
