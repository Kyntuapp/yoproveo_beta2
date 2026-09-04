import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabaseClient';
import { useRequireMaster } from '../../lib/useRequireMaster';
import KyntuModal, { createModalState } from '../KyntuModal';

const money = (value) => new Intl.NumberFormat('es-CL', {
  style: 'currency', currency: 'CLP', maximumFractionDigits: 0,
}).format(value || 0);

export default function Liquidaciones() {
  const router = useRouter();
  const { authorized, loading: authLoading } = useRequireMaster();
  const [payouts, setPayouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [references, setReferences] = useState({});
  const [gatewayFees, setGatewayFees] = useState({});
  const [saving, setSaving] = useState('');
  const [modal, setModal] = useState(createModalState());

  const api = useCallback(async (options = {}) => {
    const { data } = await supabase.auth.getSession();
    return fetch('/api/master/liquidaciones', {
      ...options,
      headers: { ...(options.headers || {}), Authorization: `Bearer ${data.session?.access_token || ''}` },
    });
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api();
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      setPayouts(body.payouts || []);
    } catch (error) {
      setModal({ ...createModalState(), open: true, type: 'error', title: 'No se pudieron cargar las liquidaciones', message: error.message, onConfirm: () => setModal(createModalState()) });
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => { if (authorized) load(); }, [authorized, load]);

  const totals = useMemo(() => payouts.filter((row) => row.status === 'ready').reduce(
    (sum, row) => ({ count: sum.count + 1, net: sum.net + Number(row.net_amount) }),
    { count: 0, net: 0 }
  ), [payouts]);

  const markPaid = async (row) => {
    const reference = String(references[row.id] || '').trim();
    if (!reference) {
      setModal({ ...createModalState(), open: true, type: 'warning', title: 'Falta la referencia', message: 'Ingresa el número de operación o referencia de la transferencia.', onConfirm: () => setModal(createModalState()) });
      return;
    }
    setSaving(row.id);
    try {
      const response = await api({ method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: row.id, transfer_reference: reference }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      await load();
    } catch (error) {
      setModal({ ...createModalState(), open: true, type: 'error', title: 'No se pudo confirmar', message: error.message, onConfirm: () => setModal(createModalState()) });
    } finally {
      setSaving('');
    }
  };

  const setGatewayFee = async (row) => {
    const gatewayFee = Number(gatewayFees[row.id]);
    if (!Number.isFinite(gatewayFee) || gatewayFee < 0) {
      setModal({ ...createModalState(), open: true, type: 'warning', title: 'Costo inválido', message: 'Ingresa la comisión informada por la pasarela.', onConfirm: () => setModal(createModalState()) });
      return;
    }
    setSaving(row.id);
    try {
      const response = await api({ method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: row.id, action: 'set_gateway_fee', gateway_fee: gatewayFee }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      await load();
    } catch (error) {
      setModal({ ...createModalState(), open: true, type: 'error', title: 'No se pudo registrar el costo', message: error.message, onConfirm: () => setModal(createModalState()) });
    } finally {
      setSaving('');
    }
  };

  const exportCsv = () => {
    const rows = payouts.filter((row) => row.status === 'ready');
    const quote = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const header = ['Proveedor', 'RUT', 'Banco', 'Tipo cuenta', 'Numero cuenta', 'Email', 'Monto neto'];
    const lines = rows.map((row) => {
      const p = row.provider || {};
      return [p.nombre_titular, p.rut_titular, p.banco, p.tipo_cuenta, p.numero_cuenta, p.email_titular || p.email_contacto || p.email, row.net_amount].map(quote).join(';');
    });
    const blob = new Blob([`\uFEFF${[header.map(quote).join(';'), ...lines].join('\n')}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'liquidaciones-pendientes.csv'; anchor.click();
    URL.revokeObjectURL(url);
  };

  if (authLoading || !authorized) return <p style={{ padding: 32 }}>Verificando acceso...</p>;

  return <main className="page">
    <header><div><button onClick={() => router.push('/master')}>← Volver</button><p>PANEL MASTER</p><h1>Liquidaciones a proveedores</h1><span>Se generan automáticamente cuando la pasarela confirma el pago.</span></div><button className="export" disabled={!totals.count} onClick={exportCsv}>Exportar pendientes</button></header>
    <section className="summary"><div><small>Pendientes</small><strong>{totals.count}</strong></div><div><small>Total por transferir</small><strong>{money(totals.net)}</strong></div></section>
    {loading ? <p>Cargando...</p> : !payouts.length ? <section className="empty">Aún no existen liquidaciones.</section> : <section className="table mobile-card-table-wrap"><table className="mobile-card-table master-liquidations-table"><thead><tr><th>Proveedor / cuenta</th><th>Pasarela</th><th>Bruto</th><th>Costo pasarela</th><th>Comisión Kyntü</th><th>Neto</th><th>Estado</th><th>Confirmación</th></tr></thead><tbody>{payouts.map((row) => { const p = row.provider || {}; const missingBank = !p.banco || !p.numero_cuenta || !p.rut_titular; return <tr key={row.id}><td><strong>{p.nombre_titular || p.email_contacto || p.email || 'Proveedor'}</strong><small>{missingBank ? 'Faltan datos bancarios' : `${p.banco} · ${p.tipo_cuenta || 'Cuenta'} · ${p.numero_cuenta}`}</small><small>{p.rut_titular || ''}</small></td><td>{row.payment_provider === 'mercadopago' ? 'Mercado Pago' : 'Transbank'}</td><td>{money(row.gross_amount)}</td><td>{row.gateway_fee == null ? 'Por informar' : `-${money(row.gateway_fee)}`}</td><td>{money(row.kyntu_commission)}</td><td><strong>{money(row.net_amount)}</strong></td><td><span className={`status ${row.status}`}>{row.status === 'ready' ? 'Por transferir' : row.status === 'paid' ? 'Pagada' : row.status === 'held' ? 'Esperando costo' : row.status}</span></td><td>{row.status === 'held' ? <div className="confirm"><input type="number" min="0" placeholder="Costo pasarela" value={gatewayFees[row.id] || ''} onChange={(event) => setGatewayFees((current) => ({ ...current, [row.id]: event.target.value }))} /><button disabled={saving === row.id} onClick={() => setGatewayFee(row)}>{saving === row.id ? 'Guardando...' : 'Confirmar costo'}</button></div> : row.status === 'ready' ? <div className="confirm"><input placeholder="N.º operación" value={references[row.id] || ''} onChange={(event) => setReferences((current) => ({ ...current, [row.id]: event.target.value }))} /><button disabled={saving === row.id || missingBank} onClick={() => markPaid(row)}>{saving === row.id ? 'Guardando...' : 'Marcar pagada'}</button></div> : <><strong>{row.transfer_reference}</strong><small>{row.paid_at ? new Date(row.paid_at).toLocaleString('es-CL') : ''}</small></>}</td></tr>; })}</tbody></table></section>}
    <KyntuModal {...modal} />
    <style jsx>{`.page{min-height:100vh;padding:32px;background:#f3f7fd;color:#071b3a;font-family:'Plus Jakarta Sans',sans-serif}header{display:flex;justify-content:space-between;gap:20px;align-items:end;background:#071b3a;color:white;padding:28px;border-radius:24px}header button{border:0;background:transparent;color:#80b3ff;font-weight:800;cursor:pointer}header p{margin:18px 0 4px;color:#3be1ff;font-size:12px;font-weight:900}h1{margin:0 0 8px}.export{background:#176bff!important;color:white!important;padding:13px 18px;border-radius:12px}.export:disabled{opacity:.5}.summary{display:flex;gap:18px;margin:22px 0}.summary div{background:white;border:1px solid #dce6f5;border-radius:18px;padding:20px;min-width:210px;display:grid;gap:6px}.summary small,td small{display:block;color:#6c7c93;margin-top:5px}.summary strong{font-size:24px}.table{overflow:auto;background:white;border:1px solid #dce6f5;border-radius:20px}table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:15px;border-bottom:1px solid #edf1f7;white-space:nowrap}th{font-size:11px;text-transform:uppercase;color:#607089;background:#f8faff}.status{padding:6px 10px;border-radius:20px;font-size:12px;font-weight:800}.status.ready{background:#fff4d6;color:#9b6900}.status.paid{background:#dcf8ed;color:#087e60}.status.held{background:#e8edf5;color:#53647b}.confirm{display:flex;gap:8px}.confirm input{width:125px;padding:9px;border:1px solid #ccd8e8;border-radius:9px}.confirm button{border:0;border-radius:9px;background:#176bff;color:white;padding:9px 12px;font-weight:800;cursor:pointer}.confirm button:disabled{opacity:.5}.empty{background:white;padding:32px;border-radius:18px}@media(max-width:700px){.page{padding:16px}header{align-items:start;flex-direction:column}.summary{flex-direction:column}.summary div{min-width:0}}`}</style>
  </main>;
}
