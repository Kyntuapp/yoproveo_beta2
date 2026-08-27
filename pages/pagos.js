import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabaseClient';
import KyntuModal, { createModalState } from './KyntuModal';

const money = (value) => new Intl.NumberFormat('es-CL', {
  style: 'currency', currency: 'CLP', maximumFractionDigits: 0,
}).format(value || 0);

export default function Pagos({ transbankEnabled }) {
  const router = useRouter();
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState([]);
  const [provider, setProvider] = useState('mercadopago');
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [modal, setModal] = useState(createModalState());

  const api = async (url, options = {}) => {
    const { data } = await supabase.auth.getSession();
    if (!data.session?.access_token) throw new Error('Tu sesión expiró');
    return fetch(url, {
      ...options,
      headers: { ...(options.headers || {}), Authorization: `Bearer ${data.session.access_token}` },
    });
  };

  useEffect(() => {
    if (!router.isReady) return;
    api('/api/pagos/pendientes').then(async (response) => {
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      setItems(body.items || []);
      const requested = String(router.query.oferta_id || '');
      setSelected(body.items?.some((item) => String(item.id) === requested)
        ? [requested] : (body.items || []).map((item) => String(item.id)));
    }).catch((error) => setModal({
      ...createModalState(), open: true, type: 'error', title: 'No se pudo cargar el carrito',
      message: error.message, onConfirm: () => setModal(createModalState()),
    })).finally(() => setLoading(false));
  }, [router.isReady, router.query.oferta_id]);

  const totals = useMemo(() => items.filter((item) => selected.includes(String(item.id))).reduce(
    (sum, item) => ({ subtotal: sum.subtotal + item.amount, commission: sum.commission + item.commission, total: sum.total + item.total }),
    { subtotal: 0, commission: 0, total: 0 }
  ), [items, selected]);

  const startPayment = async () => {
    setPaying(true);
    try {
      const response = await api('/api/pagos/iniciar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ offer_ids: selected, provider }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      if (body.checkout_url) return window.location.assign(body.checkout_url);
      if (body.form_url && body.token) {
        const form = document.createElement('form');
        form.method = 'POST'; form.action = body.form_url;
        const token = document.createElement('input');
        token.type = 'hidden'; token.name = 'token_ws'; token.value = body.token;
        form.appendChild(token); document.body.appendChild(form); form.submit();
        return;
      }
      throw new Error('La pasarela no entregó una URL de pago');
    } catch (error) {
      setPaying(false);
      setModal({ ...createModalState(), open: true, type: 'error', title: 'No se pudo iniciar el pago',
        message: error.message, onConfirm: () => setModal(createModalState()) });
    }
  };

  const confirmPayment = () => setModal({
    ...createModalState(), open: true, type: 'warning', title: 'Confirmar pago',
    message: `Pagarás ${selected.length} producto(s) por ${money(totals.total)}. Los demás quedarán pendientes.`,
    confirmText: 'Continuar al pago', cancelText: 'Cancelar', showCancel: true,
    onCancel: () => setModal(createModalState()),
    onConfirm: () => { setModal(createModalState()); startPayment(); },
  });

  return <div className="paymentPage">
    <main className="paymentShell">
      <button className="back" onClick={() => router.push('/comprador')}>← Volver a mis compras</button>
      <div className="paymentGrid">
        <section className="card">
          <div className="heading"><img src="/icono_2.png" alt="Kyntü" /><div><span>PAGO SEGURO</span><h1>Carrito de pagos</h1><p>Marca lo que deseas pagar ahora. El resto seguirá en tu lista.</p></div></div>
          {loading && <p>Cargando pagos pendientes...</p>}
          {!loading && !items.length && <p>No tienes productos pendientes de pago.</p>}
          <div className="items">{items.map((item) => <label className="item" key={item.id}>
            <input type="checkbox" checked={selected.includes(String(item.id))} onChange={() => setSelected((current) => current.includes(String(item.id)) ? current.filter((id) => id !== String(item.id)) : [...current, String(item.id)])} />
            <span><strong>{item.producto}</strong><small>{[item.marca, item.formato].filter(Boolean).join(' · ') || 'Oferta aceptada'}</small></span>
            <b>{money(item.total)}</b>
          </label>)}</div>
        </section>
        <aside className="card summary">
          <h2>Resumen</h2>
          <div><span>Productos</span><b>{money(totals.subtotal)}</b></div>
          <div className="total"><span>Total</span><b>{money(totals.total)}</b></div>
          <p className="commissionNote">Kyntü no cobra comisión durante el MVP. El costo de la pasarela se descuenta de la liquidación del proveedor.</p>
          <h3>Método de pago</h3>
          {[
            ['mercadopago', 'Mercado Pago'],
            ...(transbankEnabled ? [['transbank', 'Webpay Plus']] : []),
          ].map(([id, label]) => <label className={`method ${provider === id ? 'active' : ''}`} key={id}>
            <input type="radio" name="provider" checked={provider === id} onChange={() => setProvider(id)} /><span><strong>{label}</strong><small>Serás redirigido al sitio seguro.</small></span>
          </label>)}
          <button className="pay" disabled={paying || loading || !selected.length} onClick={confirmPayment}>{paying ? 'Conectando...' : `Pagar ${money(totals.total)}`}</button>
        </aside>
      </div>
    </main>
    <KyntuModal {...modal} />
    <style jsx>{`body{margin:0}.paymentPage{min-height:100vh;background:#eef5ff;color:#071b3d;font-family:'Plus Jakarta Sans',sans-serif}.paymentShell{max-width:1180px;margin:auto;padding:32px}.back{border:0;background:transparent;color:#176bff;font-weight:800;margin-bottom:24px;cursor:pointer}.paymentGrid{display:grid;grid-template-columns:1.5fr .8fr;gap:24px}.card{background:white;border:1px solid #dce7f7;border-radius:24px;padding:28px;box-shadow:0 18px 55px #234f8a16}.heading{display:flex;align-items:center;gap:18px}.heading img{width:72px;height:72px;object-fit:contain}.heading span{color:#176bff;font-size:12px;font-weight:900}.heading h1{font-size:32px;margin:3px 0}.heading p{color:#667792;margin:0 0 24px}.items{display:grid;gap:12px}.item{display:grid;grid-template-columns:auto 1fr auto;gap:14px;align-items:center;padding:18px;border:1px solid #dce7f7;border-radius:16px;cursor:pointer}.item span,.method span{display:grid;gap:4px}.item small,.method small{color:#74839a}.summary{height:max-content;position:sticky;top:24px}.summary h2{margin-top:0}.summary>div{display:flex;justify-content:space-between;padding:12px 0}.summary .total{border-top:1px solid #dce7f7;font-size:20px;padding:20px 0}.method{display:flex;gap:12px;border:1px solid #dce7f7;border-radius:14px;padding:15px;margin:10px 0;cursor:pointer}.method.active{border-color:#176bff;background:#f4f8ff}.pay{width:100%;margin-top:18px;padding:16px;border:0;border-radius:14px;background:#176bff;color:white;font-weight:900;font-size:16px;cursor:pointer}.pay:disabled{opacity:.55;cursor:not-allowed}@media(max-width:780px){.paymentShell{padding:18px}.paymentGrid{grid-template-columns:1fr}.summary{position:static}.heading h1{font-size:26px}.item{grid-template-columns:auto 1fr}.item>b{grid-column:2}}`}</style>
  </div>;
}

export function getServerSideProps() {
  return {
    props: {
      transbankEnabled:
        process.env.VERCEL_ENV !== 'production' ||
        process.env.TRANSBANK_ENVIRONMENT === 'production',
    },
  };
}
