export function isForceEncuestaDev() {
  return (
    process.env.NODE_ENV !== 'production' &&
    process.env.NEXT_PUBLIC_FORCE_ENCUESTA === 'true'
  );
}
