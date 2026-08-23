import { supabase } from './supabaseClient';

export const CARRO_UPDATED_EVENT = 'kyntu:carro-updated';

export function notifyCarroUpdated() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(CARRO_UPDATED_EVENT));
}

/**
 * Ofertas pendiente_pago de solicitudes del comprador autenticado.
 * Ownership: listas_compras.usuario_id = auth.uid() (+ RLS).
 */
export async function fetchCarroOfertasComprador(authUserId) {
  if (!authUserId) {
    return { ofertas: [], count: 0, error: null };
  }

  const { data: listas, error: listasError } = await supabase
    .from('listas_compras')
    .select('id, producto, formato, marca, cantidad, usuario_id')
    .eq('usuario_id', authUserId);

  if (listasError) {
    return { ofertas: [], count: 0, error: listasError };
  }

  const listaIds = (listas || []).map((l) => l.id).filter(Boolean);

  if (listaIds.length === 0) {
    return { ofertas: [], count: 0, error: null };
  }

  const listaPorId = Object.fromEntries(
    (listas || []).map((l) => [l.id, l])
  );

  const { data: ofertas, error: ofertasError } = await supabase
    .from('ofertas_productos')
    .select(
      `
      id,
      lista_id,
      proveedor_id,
      producto,
      formato,
      marca,
      precio_ofertado,
      incluye_despacho,
      tiempo_despacho_horas,
      estado,
      adjudicada_en,
      perfiles:proveedor_id (
        id,
        nombre_contacto,
        email,
        email_contacto
      )
    `
    )
    .in('lista_id', listaIds)
    .eq('estado', 'pendiente_pago')
    .order('adjudicada_en', { ascending: false });

  if (ofertasError) {
    return { ofertas: [], count: 0, error: ofertasError };
  }

  const enriched = (ofertas || []).map((oferta) => {
    const lista = listaPorId[oferta.lista_id] || {};
    return {
      ...oferta,
      cantidad_solicitada: lista.cantidad ?? null,
      lista_producto: lista.producto || oferta.producto,
      lista_formato: lista.formato || oferta.formato,
      lista_marca: lista.marca || oferta.marca,
    };
  });

  return {
    ofertas: enriched,
    count: enriched.length,
    error: null,
  };
}

export async function fetchCarroCountComprador(authUserId) {
  const { count, error } = await fetchCarroOfertasComprador(authUserId);
  return { count, error };
}

/**
 * Elimina del carro = revertir adjudicación pendiente_pago.
 * Backend: notifica exganador, reactiva rivales adjudicacion_automatica,
 * notifica reactivados, reabre solicitud a nuevas ofertas.
 */
export async function revertirAdjudicacionDesdeCarro(ofertaId) {
  if (!ofertaId) {
    return {
      data: null,
      error: new Error('Oferta inválida'),
    };
  }

  const { data, error } = await supabase.rpc('revertir_adjudicacion', {
    p_oferta_id: ofertaId,
  });

  if (!error) {
    notifyCarroUpdated();
  }

  return { data, error };
}

