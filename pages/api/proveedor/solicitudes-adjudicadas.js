import { requirePaymentUser } from '../../../lib/payments/auth';
import { supabaseAdmin } from '../../../lib/supabaseAdmin';
import { ESTADOS_ADJUDICACION_SOLICITUD } from '../../../lib/estadosAdjudicacion';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });
  const auth = await requirePaymentUser(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });
  const ids = req.body?.ids;
  if (!Array.isArray(ids) || ids.length > 200 || ids.some(id =>
    typeof id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))) {
    return res.status(400).json({ error: 'Solicitudes inválidas' });
  }
  if (!ids.length) return res.status(200).json({ ids: [] });
  try {
    // RLS oculta las ofertas de otros proveedores. Solo devolvemos el estado
    // de la solicitud, nunca precios, identidades ni datos de las ofertas.
    const closed = new Set();
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await supabaseAdmin.from('ofertas_productos')
        .select('id, lista_id').in('lista_id', [...new Set(ids)])
        .in('estado', ESTADOS_ADJUDICACION_SOLICITUD)
        .order('id').range(offset, offset + 999);
      if (error) throw error;
      for (const row of data || []) closed.add(row.lista_id);
      if ((data || []).length < 1000) break;
    }
    return res.status(200).json({ ids: [...closed] });
  } catch (error) {
    console.error('Error verificando solicitudes adjudicadas:', error.message);
    return res.status(503).json({ error: 'No se pudo verificar la disponibilidad. Intenta nuevamente.' });
  }
}
