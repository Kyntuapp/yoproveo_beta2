import { verifyMasterRequest } from '../../../lib/verifyMasterRequest';
import { supabaseAdmin } from '../../../lib/supabaseAdmin';

export default async function handler(req, res) {
  const auth = await verifyMasterRequest(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

  if (req.method === 'GET') {
    const { data: payouts, error } = await supabaseAdmin
      .from('provider_payouts')
      .select('id, payment_order_id, provider_profile_id, payment_provider, gross_amount, kyntu_commission, gateway_fee, net_amount, status, transfer_reference, paid_at, created_at, scheduled_date, batch_id, bank_snapshot')
      .order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });

    const providerIds = [...new Set((payouts || []).map((row) => row.provider_profile_id))];
    let profiles = [];
    if (providerIds.length) {
      const result = await supabaseAdmin
        .from('perfiles')
        .select('id, email, email_contacto, banco, tipo_cuenta, numero_cuenta, rut_titular, nombre_titular, email_titular')
        .in('id', providerIds);
      if (result.error) return res.status(500).json({ error: result.error.message });
      profiles = result.data || [];
    }
    const profilesById = new Map(profiles.map((profile) => [String(profile.id), profile]));
    return res.status(200).json({
      payouts: (payouts || []).map((row) => ({
        ...row,
        provider: row.bank_snapshot || profilesById.get(String(row.provider_profile_id)) || null,
      })),
    });
  }

  if (req.method === 'POST') {
    const { data, error } = await supabaseAdmin.rpc('preparar_nomina_kyntu', { p_master: auth.user.id });
    return res.status(error ? 409 : 200).json(error ? { error: error.message } : { batch_id: data });
  }

  if (req.method === 'PATCH') {
    if (req.body?.action === 'confirm_batch_provider') {
      const reference = String(req.body?.transfer_reference || '').trim();
      if (!req.body.batch_id || !req.body.provider_id || reference.length < 3 || reference.length > 120)
        return res.status(400).json({ error: 'Indica la nómina, el proveedor y la referencia bancaria.' });
      const { error } = await supabaseAdmin.rpc('confirmar_pago_nomina_kyntu', {
        p_batch: req.body.batch_id, p_provider: req.body.provider_id, p_reference: reference,
      });
      return res.status(error ? 409 : 200).json(error ? { error: error.message } : { ok: true });
    }
    const id = String(req.body?.id || '');
    if (req.body?.action === 'set_gateway_fee') {
      const gatewayFee = Math.round(Number(req.body?.gateway_fee));
      if (!id || !Number.isFinite(gatewayFee) || gatewayFee < 0) {
        return res.status(400).json({ error: 'Indica un costo de pasarela válido' });
      }
      const { data: current, error: currentError } = await supabaseAdmin
        .from('provider_payouts')
        .select('id, gross_amount, kyntu_commission, status')
        .eq('id', id)
        .eq('status', 'held')
        .neq('payment_provider', 'transferencia')
        .maybeSingle();
      if (currentError) return res.status(500).json({ error: currentError.message });
      if (!current) return res.status(409).json({ error: 'La liquidación ya fue procesada o no está retenida' });
      const netAmount = Number(current.gross_amount) - Number(current.kyntu_commission) - gatewayFee;
      if (netAmount <= 0) return res.status(400).json({ error: 'El costo supera el monto liquidable' });
      const now = new Date().toISOString();
      const { data, error } = await supabaseAdmin
        .from('provider_payouts')
        .update({ gateway_fee: gatewayFee, net_amount: netAmount, status: 'ready', updated_at: now })
        .eq('id', id)
        .eq('status', 'held')
        .neq('payment_provider', 'transferencia')
        .select('id, gateway_fee, net_amount, status')
        .single();
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ payout: data });
    }
    const transferReference = String(req.body?.transfer_reference || '').trim();
    if (!id || !transferReference) {
      return res.status(400).json({ error: 'Indica la liquidación y la referencia de transferencia' });
    }
    const now = new Date().toISOString();
    const { data, error } = await supabaseAdmin
      .from('provider_payouts')
      .update({ status: 'paid', transfer_reference: transferReference, paid_at: now, updated_at: now })
      .eq('id', id)
      .eq('status', 'ready')
      .neq('payment_provider', 'transferencia')
      .select('id, status, transfer_reference, paid_at')
      .maybeSingle();
    if (error) return res.status(500).json({ error: error.message });
    if (!data) return res.status(409).json({ error: 'La liquidación ya fue procesada o no está disponible' });
    return res.status(200).json({ payout: data });
  }

  res.setHeader('Allow', 'GET, POST, PATCH');
  return res.status(405).json({ error: 'Método no permitido' });
}
