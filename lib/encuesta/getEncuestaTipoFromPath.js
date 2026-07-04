export function getEncuestaTipoFromPath(pathname) {
  if (!pathname) return null;
  if (pathname.startsWith('/comprador')) return 'comprador';
  if (pathname.startsWith('/proveedor')) return 'proveedor';
  return null;
}
