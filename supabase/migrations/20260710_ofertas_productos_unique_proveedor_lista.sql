-- Una oferta por proveedor por producto/lista (listas_compras.id).
-- Verificado: 0 pares duplicados en ofertas_productos (proveedor_id, lista_id) al 2026-07-10.

CREATE UNIQUE INDEX IF NOT EXISTS ofertas_productos_proveedor_lista_unique
  ON public.ofertas_productos (proveedor_id, lista_id);
