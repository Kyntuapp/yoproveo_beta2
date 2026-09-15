// "confirmada" es el estado legado de una oferta aceptada sin pago.
export const ESTADOS_OFERTA_PENDIENTE_PAGO = ['pendiente_pago', 'confirmada'];

export function estadoOfertaComprador(value) {
  const estado = String(value || '').trim().toLowerCase();
  return {
    estado,
    pendientePago: ESTADOS_OFERTA_PENDIENTE_PAGO.includes(estado),
    confirmadaLegada: estado === 'confirmada',
    puedeAceptar: estado === 'pendiente',
  };
}
