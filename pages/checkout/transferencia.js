import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { Copy } from 'lucide-react';
import Tooltip from '../../components/Tooltip';
import { supabase } from '../../lib/supabaseClient';
import { KYNTU_BANK_ACCOUNT as bank } from '../../lib/payments/bankAccount';

function CopyButton({ label, onClick }) {
  return <Tooltip label="Copiar">
    <button type="button" aria-label={`Copiar ${label}`} onClick={onClick}>
      <Copy size={18} aria-hidden="true" />
    </button>
    <style jsx>{`button{width:40px;height:40px;display:inline-flex;align-items:center;justify-content:center;border:0;border-radius:10px;background:#edf3ff;color:#1459ce;cursor:pointer;flex-shrink:0}button:hover{background:#dce8ff}button:focus-visible{outline:3px solid #176bff;outline-offset:3px}`}</style>
  </Tooltip>;
}

export default function Transferencia() {
  const router = useRouter();
  const [order, setOrder] = useState(null);
  const [error, setError] = useState('');
  const [orders, setOrders] = useState([]);
  const [copied, setCopied] = useState('');
  const [copyError, setCopyError] = useState('');
  async function copy(value, label) {
    setCopyError('');
    try {
      await navigator.clipboard.writeText(String(value));
      setCopied(label);
    } catch {
      setCopied('');
      setCopyError('El navegador no permitió copiar. Puedes seleccionar el dato y copiarlo manualmente.');
    }
  }
  async function load() {
    setError('');
    try {
      const { data } = await supabase.auth.getSession();
      const response = await fetch(`/api/pagos/estado${router.query.order_id ? `?order_id=${encodeURIComponent(router.query.order_id)}` : ''}`, {
        headers: { Authorization: `Bearer ${data.session?.access_token || ''}` },
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      if (body.orders) { setOrders(body.orders); return; }
      if (body.order.provider !== 'transferencia') throw new Error('Esta orden no corresponde a una transferencia.');
      setOrder(body.order);
    } catch (err) { setError(err.message); }
  }
  useEffect(() => { if (router.isReady) { setOrder(null); load(); } }, [router.isReady, router.query.order_id]);
  const pending = order && ['pending', 'processing'].includes(order.status);
  return <main>
    <Link href="/comprador">← Volver a mis compras</Link>
    <h1>{order ? 'Paga por transferencia' : 'Mis transferencias'}</h1>
    {!router.query.order_id && <><h2>Mis transferencias</h2>{orders.map((item) => <p key={item.id}><Link href={`/checkout/transferencia?order_id=${item.id}`}>{item.id} · {Number(item.total).toLocaleString('es-CL')} CLP · {item.status === 'approved' ? 'Confirmada' : 'Pendiente'}</Link></p>)}{!orders.length && <p>No hay transferencias registradas.</p>}</>}
    {error && <p role="alert">{error}</p>}
    {router.query.order_id && !order && !error && <p>Cargando el pago…</p>}
    {order && <>
      <p className="status">{order.status === 'approved' ? '✓ Pago recibido y confirmado' : pending ? 'Pendiente de pago y validación' : 'Pago no disponible'}</p>
      <div className="amount"><strong>{Number(order.total).toLocaleString('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 })}</strong>{pending && <CopyButton label="monto" onClick={() => copy(order.total, 'Monto')} />}</div>
      {pending && <>
        <p>Copia los datos y realiza una sola transferencia desde tu banco.</p>
        <div className="bankRow"><strong>Datos de transferencia</strong><CopyButton label="todos los datos" onClick={() => copy(`${bank.holder}\n${bank.rut}\n${bank.bank}\n${bank.type}\n${bank.number}\nMonto: ${order.total} CLP\nReferencia: ${order.id}`, 'Datos de transferencia')} /></div>
        <dl>{[['Banco', bank.bank], ['Tipo de cuenta', bank.type], ['Número de cuenta', bank.number], ['RUT', bank.rut], ['Titular', bank.holder]].map(([label, value]) => <div className="bankRow" key={label}><div><dt>{label}</dt><dd>{value}</dd></div><CopyButton label={label} onClick={() => copy(value, label)} /></div>)}</dl>
        <details><summary>Referencia para el comentario de la transferencia</summary><div className="bankRow"><code>{order.id}</code><CopyButton label="referencia" onClick={() => copy(order.id, 'Referencia')} /></div></details>
        <p className="feedback" role="status" aria-live="polite">{copyError || (copied ? `${copied}: copiado.` : '')}</p>
        <p className="note">¿Ya transferiste? Kyntü verificará el abono y confirmará tu compra. No necesitas pagar otra vez.</p>
      </>}
      <button className="copy" onClick={load}>Consultar estado del pago</button>
    </>}
    <style jsx>{`main{max-width:580px;margin:28px auto;padding:28px;background:#fff;border:1px solid #dce7f7;border-radius:24px;color:#071b3d;font-family:Arial,sans-serif}h1{font-size:27px;margin-bottom:8px}.status{color:#607089;font-size:14px}.amount{display:flex;justify-content:space-between;align-items:center;gap:12px;margin:20px 0}.amount strong{font-size:38px}p{line-height:1.5}dl{background:#f5f8ff;padding:8px 18px;border-radius:16px}.bankRow{display:flex;justify-content:space-between;align-items:center;gap:16px;padding:12px 0}.bankRow>div{min-width:0}dt{font-size:12px;color:#607089}dd{margin:4px 0;font-weight:bold;font-size:15px;overflow-wrap:anywhere}code{overflow-wrap:anywhere;min-width:0}button{padding:12px;background:#176bff;color:white;border:0;border-radius:10px;cursor:pointer;font-weight:700}.primary{width:100%;font-size:16px;padding:16px}.copy{background:#edf3ff;color:#1459ce;flex-shrink:0}.feedback{min-height:20px;font-size:13px;color:#1459ce}.note{font-size:14px;color:#607089}summary{cursor:pointer;font-size:14px}button:focus-visible,summary:focus-visible{outline:3px solid #176bff;outline-offset:3px}@media(max-width:620px){main{margin:12px;padding:20px}.amount strong{font-size:32px}}`}</style>
  </main>;
}
