import { supabase } from './supabaseClient';

export const CARRO_UPDATED_EVENT = 'kyntu:carro-updated';

/** pendiente_pago sin item activo en checkout */
export const CARRO_ESTADO_DISPONIBLE = 'disponible';
/** pendiente_pago + orden abierta + item incluido */
export const CARRO_ESTADO_CHECKOUT_ABIERTO = 'checkout_abierto';
/** pendiente_pago + orden confirmada + item confirmado */
export const CARRO_ESTADO_ORDEN_PREPARADA = 'orden_preparada';

export function notifyCarroUpdated() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(CARRO_UPDATED_EVENT));
}

function clasificarEstadoCheckout(itemActivo) {
  if (!itemActivo) return CARRO_ESTADO_DISPONIBLE;

  const itemEstado = String(itemActivo.estado_item || '').toLowerCase();
  const ordenEstado = String(
    itemActivo.ordenes_checkout?.estado || ''
  ).toLowerCase();

  if (itemEstado === 'incluido' && ordenEstado === 'abierta') {
    return CARRO_ESTADO_CHECKOUT_ABIERTO;
  }

  if (itemEstado === 'confirmado' && ordenEstado === 'confirmada') {
    return CARRO_ESTADO_ORDEN_PREPARADA;
  }

  return CARRO_ESTADO_DISPONIBLE;
}

/**
 * Ofertas pendiente_pago de solicitudes del comprador autenticado.
 * Ownership: listas_compras.usuario_id = auth.uid() (+ RLS).
 * Incluye ofertas en checkout abierto o preparadas (siguen pendiente_pago).
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

  const ofertaIds = (ofertas || []).map((o) => o.id).filter(Boolean);
  const itemsPorOferta = {};

  if (ofertaIds.length) {
    const { data: itemsActivos, error: itemsError } = await supabase
      .from('ordenes_checkout_items')
      .select(
        `
        oferta_id,
        estado_item,
        orden_id,
        ordenes_checkout!inner (
          id,
          estado
        )
      `
      )
      .in('oferta_id', ofertaIds)
      .in('estado_item', ['incluido', 'confirmado']);

    if (itemsError) {
      return { ofertas: [], count: 0, error: itemsError };
    }

    for (const item of itemsActivos || []) {
      itemsPorOferta[item.oferta_id] = item;
    }
  }

  const enriched = (ofertas || []).map((oferta) => {
    const lista = listaPorId[oferta.lista_id] || {};
    const itemActivo = itemsPorOferta[oferta.id] || null;
    const carroEstado = clasificarEstadoCheckout(itemActivo);

    return {
      ...oferta,
      cantidad_solicitada: lista.cantidad ?? null,
      lista_producto: lista.producto || oferta.producto,
      lista_formato: lista.formato || oferta.formato,
      lista_marca: lista.marca || oferta.marca,
      carro_estado: carroEstado,
      checkout_orden_id: itemActivo?.orden_id || null,
      checkout_item_estado: itemActivo?.estado_item || null,
      seleccionable: carroEstado === CARRO_ESTADO_DISPONIBLE,
      eliminable: carroEstado === CARRO_ESTADO_DISPONIBLE,
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

function firstRow(data) {
  if (Array.isArray(data)) return data[0] || null;
  return data || null;
}

export async function crearOrdenCheckout(ofertaIds) {
  const ids = (ofertaIds || []).filter(Boolean);
  if (!ids.length) {
    return {
      data: null,
      error: new Error('Selecciona al menos una oferta'),
    };
  }

  const { data, error } = await supabase.rpc('crear_orden_checkout', {
    p_oferta_ids: ids,
  });

  return { data: firstRow(data), error };
}

export async function obtenerOrdenCheckout(ordenId = null) {
  const { data, error } = await supabase.rpc('obtener_orden_checkout', {
    p_orden_id: ordenId,
  });

  return { data: data ?? null, error };
}

export async function cancelarOrdenCheckout(ordenId) {
  const { data, error } = await supabase.rpc('cancelar_orden_checkout', {
    p_orden_id: ordenId,
  });

  if (!error) {
    notifyCarroUpdated();
  }

  return { data: firstRow(data), error };
}

export async function confirmarOrdenCheckout(ordenId) {
  const { data, error } = await supabase.rpc('confirmar_orden_checkout', {
    p_orden_id: ordenId,
  });

  if (!error) {
    notifyCarroUpdated();
  }

  return { data: firstRow(data), error };
}

export async function fetchNombresProveedores(proveedorIds) {
  const ids = [...new Set((proveedorIds || []).filter(Boolean))];
  if (!ids.length) return {};

  const { data, error } = await supabase
    .from('perfiles')
    .select('id, nombre_contacto, email, email_contacto')
    .in('id', ids);

  if (error) {
    console.error('Error cargando proveedores:', error.message);
    return {};
  }

  return Object.fromEntries(
    (data || []).map((p) => [
      p.id,
      p.nombre_contacto?.trim?.() ||
        p.email_contacto?.trim?.() ||
        p.email?.trim?.() ||
        'Proveedor',
    ])
  );
}
