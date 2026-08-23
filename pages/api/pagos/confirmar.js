import { supabaseAdmin } from '../../../lib/supabaseAdmin';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const { pago_id } = req.body;

  if (!pago_id) {
    return res.status(400).json({ error: 'Falta pago_id' });
  }

  // service_role: mutaciones financieras no deben depender de grants del cliente.
  const { data: pago, error: pagoError } = await supabaseAdmin
    .from('pagos')
    .update({
      estado_pago: 'pagado',
      fecha_pago: new Date().toISOString(),
    })
    .eq('id', pago_id)
    .select()
    .single();

  if (pagoError) {
    return res.status(500).json({ error: pagoError.message });
  }

  await supabaseAdmin
    .from('ofertas_productos')
    .update({ estado: 'pago_recibido' })
    .eq('id', pago.oferta_id);

  return res.status(200).json({ ok: true });
}