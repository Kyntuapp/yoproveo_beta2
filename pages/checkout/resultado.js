import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabaseClient';

export default function PaymentResult() {
  const router = useRouter();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const forcedStatus = router.query.status;

  useEffect(() => {
    if (!router.isReady || !router.query.order_id) {
      if (router.isReady) setLoading(false);
      return;
    }
    let active = true;
    let attempts = 0;
    const load = async () => {
      const { data } = await supabase.auth.getSession();
      const response = await fetch(`/api/pagos/estado?order_id=${encodeURIComponent(router.query.order_id)}`, {
        headers: { Authorization: `Bearer ${data.session?.access_token || ''}` },
      });
      const body = await response.json();
      if (active && response.ok) setOrder(body.order);
      if (active) setLoading(false);
      attempts += 1;
      if (active && response.ok && !['approved', 'rejected', 'cancelled'].includes(body.order.status) && attempts < 6) {
        setTimeout(load, 2000);
      }
    };
    load();
    return () => { active = false; };
  }, [router.isReady, router.query.order_id]);

  const status = forcedStatus || order?.status;
  const approved = status === 'approved';
  const pending = !status || ['pending', 'processing'].includes(status);
  return <main className="result">
    <section>
      <img src="/icono_2.png" alt="Kyntü" />
      <div className={`symbol ${approved ? 'ok' : pending ? 'wait' : 'bad'}`}>{approved ? '✓' : pending ? '…' : '×'}</div>
      <h1>{approved ? 'Pago confirmado' : pending ? 'Estamos confirmando tu pago' : status === 'cancelled' ? 'Pago cancelado' : 'Pago no aprobado'}</h1>
      <p>{approved ? 'Los productos pagados ya fueron actualizados.' : pending ? 'La pasarela aún está procesando la operación. Puedes revisar nuevamente en unos segundos.' : 'No se realizó ningún cobro confirmado. Los productos permanecen pendientes.'}</p>
      {order?.total && <strong>Total: {new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(order.total)}</strong>}
      <button onClick={() => router.push('/comprador')}>Volver a mis compras</button>
    </section>
    <style jsx>{`.result{min-height:100vh;display:grid;place-items:center;background:#eef5ff;font-family:'Plus Jakarta Sans',sans-serif;color:#071b3d;padding:24px}.result section{max-width:520px;text-align:center;background:white;padding:38px;border:1px solid #dce7f7;border-radius:26px;box-shadow:0 20px 60px #234f8a1f}.result img{width:80px}.symbol{width:66px;height:66px;border-radius:50%;display:grid;place-items:center;margin:18px auto;font-size:36px;font-weight:900}.ok{background:#e4fbf3;color:#00a57c}.wait{background:#fff6dc;color:#d68a00}.bad{background:#ffeded;color:#d83c3c}.result h1{font-size:30px;margin:12px}.result p{color:#687991;line-height:1.6}.result button{display:block;width:100%;margin-top:26px;border:0;border-radius:14px;padding:15px;background:#176bff;color:white;font-weight:900;cursor:pointer}`}</style>
  </main>;
}
