import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../lib/supabaseClient';
import { useRequireMaster } from '../../lib/useRequireMaster';

export default function Transferencias() {
  const { authorized, loading } = useRequireMaster();
  const [orders, setOrders] = useState([]);
  const [inputs, setInputs] = useState({});
  const [error, setError] = useState('');
  const [saving, setSaving] = useState('');
  async function api(options = {}) {
    const { data } = await supabase.auth.getSession();
    const response = await fetch('/api/master/transferencias', { ...options,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session?.access_token || ''}` } });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error);
    return body;
  }
  async function load() { try { setOrders((await api()).orders || []); } catch (err) { setError(err.message); } }
  useEffect(() => { if (authorized) load(); }, [authorized]);
  async function confirm(event, order) {
    event.preventDefault(); setSaving(order.id); setError('');
    try { await api({ method: 'POST', body: JSON.stringify({ order_id: order.id, ...inputs[order.id] }) }); await load(); }
    catch (err) { setError(err.message); } finally { setSaving(''); }
  }
  if (loading || !authorized) return <p>Verificando acceso…</p>;
  return <main><Link href="/master">← Panel master</Link><h1>Transferencias recibidas</h1>
    <p>Confirma únicamente después de comprobar el abono en BancoEstado. El monto debe coincidir con el total de la compra.</p>
    <Link href="/master/liquidaciones">Ver nóminas de proveedores</Link>
    {error && <p role="alert">{error}</p>}
    {!orders.length && <p>No hay transferencias registradas.</p>}
    {orders.map((order) => <section key={order.id}><h2>{Number(order.total).toLocaleString('es-CL')} CLP</h2>
      <p>Referencia de compra: <strong>{order.id}</strong></p>
      <p>{order.payment_order_items?.map((item) => item.title).join(' · ')}</p>
      <p>{new Date(order.created_at).toLocaleString('es-CL')} · {order.status === 'approved' ? 'Confirmada' : 'Pendiente'}</p>
      {['pending', 'processing'].includes(order.status) ? <form onSubmit={(event) => confirm(event, order)}>
        <label>Monto recibido (CLP)<input required type="number" min="1" step="1" value={inputs[order.id]?.amount || ''} onChange={(e) => setInputs({ ...inputs, [order.id]: { ...inputs[order.id], amount: e.target.value } })} /></label>
        <label>Referencia bancaria<input required minLength={3} maxLength={120} value={inputs[order.id]?.reference || ''} onChange={(e) => setInputs({ ...inputs, [order.id]: { ...inputs[order.id], reference: e.target.value } })} /></label>
        <label><input type="checkbox" required /> Verifiqué el abono en la cuenta de Kyntü.</label>
        <button disabled={!!saving}>{saving === order.id ? 'Confirmando…' : 'Confirmar recepción'}</button>
      </form> : <p>Operación: {order.provider_payment_id}</p>}
    </section>)}
    <style jsx>{`main{max-width:900px;margin:auto;padding:32px;font-family:Arial,sans-serif;color:#071b3d}section{border:1px solid #dce7f7;padding:24px;border-radius:18px;margin:20px 0;overflow-wrap:anywhere}form{display:grid;gap:14px}label{display:block}input{padding:10px;margin-left:10px}button{padding:14px;border:0;border-radius:12px;background:#176bff;color:white;cursor:pointer}button:disabled{opacity:.5}`}</style>
  </main>;
}
