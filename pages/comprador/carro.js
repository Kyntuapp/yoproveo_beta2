import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { ShoppingCart } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import AppLayout from '../../components/Layout/AppLayout';
import Notificaciones from '../../components/Notificaciones';
import SoporteLauncher from '../../components/soporte/SoporteLauncher';
import CarroCompradorButton from '../../components/CarroCompradorButton';
import {
  CARRO_ESTADO_CHECKOUT_ABIERTO,
  CARRO_ESTADO_DISPONIBLE,
  CARRO_ESTADO_ORDEN_PREPARADA,
  CARRO_UPDATED_EVENT,
  cancelarOrdenCheckout,
  crearOrdenCheckout,
  fetchCarroOfertasComprador,
  notifyCarroUpdated,
  obtenerOrdenCheckout,
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

function agruparPorProveedor(lista) {
  const map = new Map();
  for (const oferta of lista) {
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
}

function agruparPorOrden(lista) {
  const map = new Map();
  for (const oferta of lista) {
    const key = oferta.checkout_orden_id;
    if (!key) continue;
    if (!map.has(key)) {
      map.set(key, { ordenId: key, items: [] });
    }
    map.get(key).items.push(oferta);
  }
  return Array.from(map.values());
}

function nombresProveedoresUnicos(items) {
  return [...new Set((items || []).map((o) => nombreProveedor(o)))];
}

export default function CarroCompradorPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [authUserId, setAuthUserId] = useState(null);
  const [perfilId, setPerfilId] = useState(null);
  const [tienePerfilProveedor, setTienePerfilProveedor] =
    useState(false);
  const [ofertas, setOfertas] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [modal, setModal] = useState(createModalState());
  const [revirtiendoId, setRevirtiendoId] = useState(null);
  const [creandoOrden, setCreandoOrden] = useState(false);

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

  const sincronizarSeleccion = (nextOfertas) => {
    const disponibles = (nextOfertas || [])
      .filter((o) => o.seleccionable)
      .map((o) => o.id);

    setSelectedIds((prev) => {
      if (!disponibles.length) return [];
      if (!prev.length) return disponibles;
      const kept = prev.filter((id) => disponibles.includes(id));
      return kept.length ? kept : disponibles;
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
      setSelectedIds([]);
      return;
    }

    const next = data || [];
    setOfertas(next);
    sincronizarSeleccion(next);
  };

  const ejecutarRevertir = async (oferta) => {
    if (!oferta?.id || revirtiendoId) return;
    if (!oferta.eliminable) return;

    setRevirtiendoId(oferta.id);

    const { error } = await revertirAdjudicacionDesdeCarro(oferta.id);

    setRevirtiendoId(null);

    if (error) {
      showModal({
        type: 'error',
        title: 'No se pudo eliminar del carro',
        message:
          error.message ||
          'La adjudicación no pudo revertirse. Si la oferta está en un checkout abierto, vuelve al resumen y cancela la orden primero.',
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
    if (!oferta?.eliminable) {
      showModal({
        type: 'warning',
        title: 'No se puede eliminar',
        message:
          oferta.carro_estado === CARRO_ESTADO_ORDEN_PREPARADA
            ? 'Esta oferta ya está en una orden preparada para pago.'
            : 'Esta oferta está en un checkout abierto. Cancélalo o retómalo desde el resumen.',
      });
      return;
    }

    const producto =
      oferta.producto ||
      oferta.lista_producto ||
      'esta oferta';

    showModal({
      type: 'warning',
      title: '¿Eliminar del carro?',
      message: `Se cancelará la adjudicación de “${producto}”. Esto no es lo mismo que deseleccionar: el proveedor ganador dejará de estar pendiente de pago y las ofertas rivales auto-rechazadas volverán a competir.`,
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

  const toggleSeleccion = (oferta) => {
    if (!oferta?.seleccionable) return;

    setSelectedIds((prev) =>
      prev.includes(oferta.id)
        ? prev.filter((id) => id !== oferta.id)
        : [...prev, oferta.id]
    );
  };

  const seleccionarTodos = () => {
    setSelectedIds(
      ofertas
        .filter((o) => o.carro_estado === CARRO_ESTADO_DISPONIBLE)
        .map((o) => o.id)
    );
  };

  const deseleccionarTodos = () => {
    setSelectedIds([]);
  };

  const irACheckout = (ordenId) => {
    if (!ordenId) return;
    router.push(`/comprador/checkout/${ordenId}`);
  };

  const manejarOrdenAbiertaConflicto = async (selected) => {
    const { data: ordenAbierta, error } = await obtenerOrdenCheckout(null);

    if (error || !ordenAbierta?.id) {
      showModal({
        type: 'error',
        title: 'Ya tienes un checkout abierto',
        message:
          error?.message ||
          'Cancela o retoma el checkout en curso antes de crear uno nuevo.',
      });
      return;
    }

    const idsOrden = (ordenAbierta.items || [])
      .map((i) => i.oferta_id)
      .filter(Boolean)
      .sort();
    const idsSel = [...selected].sort();
    const mismoSet =
      idsOrden.length === idsSel.length &&
      idsOrden.every((id, idx) => id === idsSel[idx]);

    if (mismoSet) {
      irACheckout(ordenAbierta.id);
      return;
    }

    showModal({
      type: 'warning',
      title: 'Checkout en curso',
      message:
        'Ya tienes una orden abierta con otra selección. Puedes retomarla o cancelarla para usar la selección actual.',
      confirmText: 'Retomar checkout',
      cancelText: 'Cancelar orden y continuar',
      showCancel: true,
      onConfirm: () => {
        setModal(createModalState());
        irACheckout(ordenAbierta.id);
      },
      onCancel: async () => {
        setModal(createModalState());
        setCreandoOrden(true);
        const { error: cancelError } = await cancelarOrdenCheckout(
          ordenAbierta.id
        );
        if (cancelError) {
          setCreandoOrden(false);
          showModal({
            type: 'error',
            title: 'No se pudo cancelar la orden',
            message: cancelError.message,
          });
          return;
        }
        const { data, error: createError } =
          await crearOrdenCheckout(selected);
        setCreandoOrden(false);
        if (createError || !data?.orden_id) {
          showModal({
            type: 'error',
            title: 'No se pudo crear el checkout',
            message:
              createError?.message ||
              'Inténtalo nuevamente.',
          });
          return;
        }
        irACheckout(data.orden_id);
      },
    });
  };

  const continuarAlPago = async () => {
    if (!selectedIds.length || creandoOrden) return;

    const seleccionDisponible = ofertas
      .filter(
        (o) =>
          selectedIds.includes(o.id) &&
          o.carro_estado === CARRO_ESTADO_DISPONIBLE
      )
      .map((o) => o.id);

    if (!seleccionDisponible.length) {
      const preparada = ofertas.find(
        (o) =>
          selectedIds.includes(o.id) &&
          o.carro_estado === CARRO_ESTADO_ORDEN_PREPARADA
      );
      if (preparada?.checkout_orden_id) {
        irACheckout(preparada.checkout_orden_id);
        return;
      }

      const abierta = ofertas.find(
        (o) =>
          selectedIds.includes(o.id) &&
          o.carro_estado === CARRO_ESTADO_CHECKOUT_ABIERTO
      );
      if (abierta?.checkout_orden_id) {
        irACheckout(abierta.checkout_orden_id);
        return;
      }

      showModal({
        type: 'warning',
        title: 'Sin ofertas disponibles',
        message:
          'Selecciona ofertas disponibles o abre el checkout ya iniciado.',
      });
      return;
    }

    setCreandoOrden(true);
    const { data, error } = await crearOrdenCheckout(seleccionDisponible);
    setCreandoOrden(false);

    if (!error && data?.orden_id) {
      irACheckout(data.orden_id);
      return;
    }

    const msg = (error?.message || '').toLowerCase();
    if (msg.includes('orden') && msg.includes('abierta')) {
      await manejarOrdenAbiertaConflicto(seleccionDisponible);
      return;
    }

    if (msg.includes('preparada para pago')) {
      showModal({
        type: 'warning',
        title: 'Orden ya preparada',
        message:
          error?.message ||
          'Una o más ofertas ya están en una orden preparada para pago.',
      });
      return;
    }

    showModal({
      type: 'error',
      title: 'No se pudo continuar al pago',
      message:
        error?.message ||
        'Revisa la selección e inténtalo nuevamente.',
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

  const ofertasDisponibles = useMemo(
    () =>
      ofertas.filter(
        (o) => o.carro_estado === CARRO_ESTADO_DISPONIBLE
      ),
    [ofertas]
  );

  const ordenesPendientesPago = useMemo(
    () =>
      agruparPorOrden(
        ofertas.filter(
          (o) => o.carro_estado === CARRO_ESTADO_ORDEN_PREPARADA
        )
      ),
    [ofertas]
  );

  const ordenesEnPreparacion = useMemo(
    () =>
      agruparPorOrden(
        ofertas.filter(
          (o) => o.carro_estado === CARRO_ESTADO_CHECKOUT_ABIERTO
        )
      ),
    [ofertas]
  );

  const gruposDisponibles = useMemo(
    () => agruparPorProveedor(ofertasDisponibles),
    [ofertasDisponibles]
  );

  const seleccionadas = useMemo(
    () =>
      ofertasDisponibles.filter((o) => selectedIds.includes(o.id)),
    [ofertasDisponibles, selectedIds]
  );

  const subtotalSeleccionado = useMemo(
    () =>
      seleccionadas.reduce(
        (acc, o) => acc + Number(o.precio_ofertado || 0),
        0
      ),
    [seleccionadas]
  );

  const ofertasSeleccionables = ofertasDisponibles;

  const todosSeleccionados =
    ofertasSeleccionables.length > 0 &&
    selectedIds.length === ofertasSeleccionables.length &&
    ofertasSeleccionables.every((o) => selectedIds.includes(o.id));

  const hayDisponibles = ofertasDisponibles.length > 0;
  const hayPendientesPago = ordenesPendientesPago.length > 0;
  const hayEnPreparacion = ordenesEnPreparacion.length > 0;

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
              {hayDisponibles
                ? 'Selecciona las compras disponibles que quieres pagar juntas. Las órdenes ya preparadas aparecen aparte.'
                : 'Revisa tus compras pendientes de pago o sigue adjudicando ofertas para armar un nuevo checkout.'}
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
            {hayPendientesPago && (
              <section style={styles.blockSection}>
                <h2 style={styles.sectionTitle}>Pendientes de pago</h2>
                <p style={styles.sectionHint}>
                  Compras ya confirmadas, listas para la integración
                  de pago.
                </p>
                <div style={styles.orderCards}>
                  {ordenesPendientesPago.map((orden) => {
                    const subtotal = orden.items.reduce(
                      (acc, o) =>
                        acc + Number(o.precio_ofertado || 0),
                      0
                    );
                    const proveedores = nombresProveedoresUnicos(
                      orden.items
                    );

                    return (
                      <article
                        key={orden.ordenId}
                        style={styles.orderCard}
                      >
                        <div style={styles.orderCardHeader}>
                          <span style={styles.pendingBadge}>
                            Pendiente de pago
                          </span>
                          <strong style={styles.orderCount}>
                            {orden.items.length}{' '}
                            {orden.items.length === 1
                              ? 'producto'
                              : 'productos'}
                          </strong>
                        </div>

                        <p style={styles.orderMeta}>
                          Proveedor
                          {proveedores.length === 1 ? '' : 'es'}:{' '}
                          {proveedores.join(', ')}
                        </p>

                        <div style={styles.orderItems}>
                          {orden.items.map((oferta) => (
                            <div
                              key={oferta.id}
                              style={styles.orderItemRow}
                            >
                              <div style={styles.orderItemMain}>
                                <p style={styles.orderItemTitle}>
                                  {oferta.producto ||
                                    oferta.lista_producto ||
                                    'Producto'}
                                </p>
                                <p style={styles.itemMeta}>
                                  {nombreProveedor(oferta)}
                                  {[
                                    oferta.marca || oferta.lista_marca,
                                    oferta.formato ||
                                      oferta.lista_formato,
                                  ]
                                    .filter(Boolean)
                                    .map((v) => ` · ${v}`)
                                    .join('')}
                                </p>
                              </div>
                              <strong style={styles.priceValue}>
                                {formatearMonto(
                                  oferta.precio_ofertado
                                )}
                              </strong>
                            </div>
                          ))}
                        </div>

                        <div style={styles.orderFooter}>
                          <span style={styles.orderSubtotalLabel}>
                            Subtotal productos
                          </span>
                          <strong style={styles.orderSubtotalValue}>
                            {formatearMonto(subtotal)}
                          </strong>
                        </div>

                        <button
                          type="button"
                          style={styles.openCheckoutButton}
                          onClick={() => irACheckout(orden.ordenId)}
                        >
                          Ver detalle de la compra
                        </button>
                      </article>
                    );
                  })}
                </div>
              </section>
            )}

            {hayEnPreparacion && (
              <section style={styles.blockSection}>
                <h2 style={styles.sectionTitle}>
                  Compra en preparación
                </h2>
                <p style={styles.sectionHint}>
                  Tienes un checkout abierto. Continúa o cancélalo
                  desde el resumen.
                </p>
                <div style={styles.orderCards}>
                  {ordenesEnPreparacion.map((orden) => (
                    <article
                      key={orden.ordenId}
                      style={styles.orderCardOpen}
                    >
                      <div style={styles.orderCardHeader}>
                        <span style={styles.openBadge}>
                          Checkout abierto
                        </span>
                        <strong style={styles.orderCount}>
                          {orden.items.length}{' '}
                          {orden.items.length === 1
                            ? 'producto'
                            : 'productos'}
                        </strong>
                      </div>
                      <p style={styles.orderMeta}>
                        {orden.items
                          .map(
                            (o) =>
                              o.producto ||
                              o.lista_producto ||
                              'Producto'
                          )
                          .join(' · ')}
                      </p>
                      <button
                        type="button"
                        style={styles.openCheckoutButton}
                        onClick={() => irACheckout(orden.ordenId)}
                      >
                        Continuar
                      </button>
                    </article>
                  ))}
                </div>
              </section>
            )}

            {hayDisponibles && (
              <section style={styles.blockSection}>
                <h2 style={styles.sectionTitle}>
                  Compras disponibles
                </h2>
                <p style={styles.sectionHint}>
                  Selecciona las compras que quieres pagar juntas.
                  Deseleccionar no cancela la adjudicación; eliminar
                  del carro sí.
                </p>

                <div style={styles.selectionBar}>
                  <button
                    type="button"
                    style={styles.linkButton}
                    onClick={
                      todosSeleccionados
                        ? deseleccionarTodos
                        : seleccionarTodos
                    }
                  >
                    {todosSeleccionados
                      ? 'Deseleccionar todos'
                      : 'Seleccionar todos'}
                  </button>
                  <span style={styles.selectionHint}>
                    {selectedIds.length} de{' '}
                    {ofertasSeleccionables.length} seleccionadas
                  </span>
                </div>

                <div style={styles.groups}>
                  {gruposDisponibles.map((grupo) => {
                    const subtotalProv = grupo.items
                      .filter((i) => selectedIds.includes(i.id))
                      .reduce(
                        (acc, i) =>
                          acc + Number(i.precio_ofertado || 0),
                        0
                      );

                    return (
                      <div key={grupo.proveedorId} style={styles.group}>
                        <h3 style={styles.groupTitle}>
                          {grupo.nombre}
                        </h3>
                        <div style={styles.items}>
                          {grupo.items.map((oferta) => {
                            const checked = selectedIds.includes(
                              oferta.id
                            );

                            return (
                              <article
                                key={oferta.id}
                                style={styles.item}
                              >
                                <label style={styles.checkLabel}>
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() =>
                                      toggleSeleccion(oferta)
                                    }
                                    style={styles.checkbox}
                                  />
                                  <span style={styles.srOnly}>
                                    Seleccionar{' '}
                                    {oferta.producto || 'oferta'}
                                  </span>
                                </label>

                                <div style={styles.itemMain}>
                                  <h3 style={styles.itemTitle}>
                                    {oferta.producto ||
                                      oferta.lista_producto ||
                                      'Producto'}
                                  </h3>
                                  <p style={styles.itemMeta}>
                                    {[
                                      oferta.marca ||
                                        oferta.lista_marca,
                                      oferta.formato ||
                                        oferta.lista_formato,
                                    ]
                                      .filter(Boolean)
                                      .join(' · ') || 'Sin detalle'}
                                  </p>
                                  <p style={styles.itemMeta}>
                                    Cantidad:{' '}
                                    {oferta.cantidad_solicitada ??
                                      '—'}
                                  </p>
                                  {oferta.incluye_despacho !=
                                    null && (
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
                                    {formatearMonto(
                                      oferta.precio_ofertado
                                    )}
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
                                      confirmarEliminarDelCarro(
                                        oferta
                                      )
                                    }
                                  >
                                    {revirtiendoId === oferta.id
                                      ? 'Eliminando…'
                                      : 'Eliminar del carro'}
                                  </button>
                                </div>
                              </article>
                            );
                          })}
                        </div>
                        <p style={styles.providerSubtotal}>
                          Subtotal proveedor (seleccionados):{' '}
                          <strong>
                            {formatearMonto(subtotalProv)}
                          </strong>
                        </p>
                      </div>
                    );
                  })}
                </div>

                <aside style={styles.summary}>
                  <div style={styles.summaryRow}>
                    <span>Compras seleccionadas</span>
                    <strong>{seleccionadas.length}</strong>
                  </div>
                  <div style={styles.summaryRow}>
                    <span>Subtotal productos</span>
                    <strong>
                      {formatearMonto(subtotalSeleccionado)}
                    </strong>
                  </div>
                  <p style={styles.summaryNote}>
                    Un solo pago agrupado. Todavía no se muestran
                    comisiones adicionales.
                  </p>
                  <button
                    type="button"
                    style={{
                      ...styles.primaryButtonFull,
                      ...(selectedIds.length === 0 || creandoOrden
                        ? styles.primaryButtonDisabled
                        : {}),
                    }}
                    disabled={
                      selectedIds.length === 0 || creandoOrden
                    }
                    onClick={continuarAlPago}
                  >
                    {creandoOrden
                      ? 'Preparando…'
                      : 'Continuar al pago'}
                  </button>
                </aside>
              </section>
            )}

            <button
              type="button"
              style={styles.secondaryButton}
              onClick={() => router.push('/comprador')}
            >
              Seguir comprando
            </button>
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
  muted: { color: '#6d7f98', fontSize: '14px' },
  blockSection: {
    marginBottom: '28px',
  },
  sectionTitle: {
    margin: '0 0 6px',
    color: '#061b41',
    fontSize: '17px',
    fontWeight: 900,
  },
  sectionHint: {
    margin: '0 0 14px',
    color: '#6d7f98',
    fontSize: '13px',
    lineHeight: 1.45,
  },
  orderCards: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  orderCard: {
    border: '1px solid #b7e4d0',
    borderRadius: '18px',
    padding: '16px',
    background: '#f6fbf8',
  },
  orderCardOpen: {
    border: '1px solid #c9daf8',
    borderRadius: '18px',
    padding: '16px',
    background: '#f5f8ff',
  },
  orderCardHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '10px',
    flexWrap: 'wrap',
    marginBottom: '10px',
  },
  pendingBadge: {
    display: 'inline-block',
    padding: '4px 10px',
    borderRadius: '999px',
    background: '#d9f5e8',
    color: '#0f766e',
    fontSize: '12px',
    fontWeight: 800,
  },
  openBadge: {
    display: 'inline-block',
    padding: '4px 10px',
    borderRadius: '999px',
    background: '#e0ebff',
    color: '#176bff',
    fontSize: '12px',
    fontWeight: 800,
  },
  orderCount: {
    color: '#17365e',
    fontSize: '13px',
    fontWeight: 800,
  },
  orderMeta: {
    margin: '0 0 12px',
    color: '#49617f',
    fontSize: '13px',
    lineHeight: 1.45,
  },
  orderItems: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    marginBottom: '12px',
  },
  orderItemRow: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '12px',
    flexWrap: 'wrap',
    padding: '10px 12px',
    borderRadius: '12px',
    background: '#ffffff',
    border: '1px solid #dceee5',
  },
  orderItemMain: {
    flex: '1 1 180px',
    minWidth: 0,
  },
  orderItemTitle: {
    margin: 0,
    color: '#061b41',
    fontSize: '14px',
    fontWeight: 800,
  },
  orderFooter: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '10px',
    marginBottom: '12px',
  },
  orderSubtotalLabel: {
    color: '#49617f',
    fontSize: '13px',
    fontWeight: 700,
  },
  orderSubtotalValue: {
    color: '#061b41',
    fontSize: '16px',
    fontWeight: 900,
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
  selectionBar: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '10px',
    marginBottom: '14px',
  },
  linkButton: {
    border: 0,
    background: 'transparent',
    color: '#176bff',
    fontWeight: 800,
    fontSize: '13px',
    cursor: 'pointer',
    padding: 0,
  },
  selectionHint: {
    color: '#6d7f98',
    fontSize: '13px',
    fontWeight: 700,
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
    alignItems: 'flex-start',
    gap: '12px',
    flexWrap: 'wrap',
    padding: '14px',
    borderRadius: '14px',
    background: '#ffffff',
    border: '1px solid #e7edf5',
  },
  openCheckoutButton: {
    width: '100%',
    minHeight: '44px',
    marginTop: '0',
    padding: '10px 12px',
    borderRadius: '12px',
    border: '1px solid #b7cfff',
    background: '#eef4ff',
    color: '#176bff',
    fontSize: '14px',
    fontWeight: 800,
    cursor: 'pointer',
  },
  checkLabel: {
    display: 'inline-flex',
    alignItems: 'center',
    paddingTop: '4px',
  },
  checkbox: {
    width: '18px',
    height: '18px',
    cursor: 'pointer',
  },
  srOnly: {
    position: 'absolute',
    width: '1px',
    height: '1px',
    padding: 0,
    margin: '-1px',
    overflow: 'hidden',
    clip: 'rect(0,0,0,0)',
    border: 0,
  },
  itemMain: {
    flex: '1 1 200px',
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
    marginLeft: 'auto',
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
  providerSubtotal: {
    margin: '12px 0 0',
    color: '#49617f',
    fontSize: '13px',
    fontWeight: 700,
    textAlign: 'right',
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
  primaryButtonFull: {
    width: '100%',
    minHeight: '46px',
    marginBottom: '10px',
    borderRadius: '12px',
    border: 0,
    background: 'linear-gradient(135deg, #176bff 0%, #00b89c 100%)',
    color: '#fff',
    fontWeight: 800,
    cursor: 'pointer',
  },
  primaryButtonDisabled: {
    opacity: 0.45,
    cursor: 'not-allowed',
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
