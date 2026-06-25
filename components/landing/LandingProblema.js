const ITEMS = [
  {
    title: 'Para quien compra',
    text: 'Comprar suele implicar buscar proveedores, comparar precios en distintos canales y perder tiempo coordinando.',
  },
  {
    title: 'Para quien provee',
    text: 'Vender implica salir a buscar compradores sin saber quién necesita realmente tu producto hoy.',
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
