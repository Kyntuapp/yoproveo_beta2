const ITEMS = [
  {
    title: 'Para quien compra',
    text: 'Cotizar proveedores hoy implica buscar en distintos canales, comparar precios manualmente y perder tiempo coordinando cada respuesta.',
  },
  {
    title: 'Para quien provee',
    text: 'Vender servicios y productos a empresas ya no significa salir a buscar clientes potenciales uno por uno: te encuentran donde ya existe la necesidad.',
  },
];

export default function LandingProblema() {
  return (
    <section className="landing-section landing-section--alt">
      <div className="landing__inner">
        <p className="landing-section__eyebrow">Contexto</p>
        <h2 className="landing-section__title">El problema hoy</h2>
        <div className="landing-problema__grid">
          {ITEMS.map((item) => (
            <div className="landing-problema__item" key={item.title}>
              <div className="landing-problema__divider" aria-hidden="true" />
              <h3>{item.title}</h3>
              <p>{item.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
