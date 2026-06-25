const ITEMS = [
  {
    title: 'Demanda real en vivo',
    text: 'Cada solicitud nace de una necesidad concreta de compra.',
  },
  {
    title: 'Menos tiempo cotizando',
    text: 'No necesitas buscar entre cientos de productos, precios y proveedores.',
  },
  {
    title: 'Todo en un solo lugar',
    text: 'Publica, recibe ofertas y compara alternativas dentro del mismo flujo.',
  },
  {
    title: 'Más oportunidades comerciales',
    text: 'Los proveedores llegan donde ya existe intención de compra.',
  },
  {
    title: 'Comparación simple',
    text: 'Las ofertas se ordenan para facilitar la decisión.',
  },
  {
    title: 'Mejor relación valor-condiciones',
    text: 'El comprador puede elegir considerando precio, despacho y condiciones.',
  },
];

export default function LandingPorQue() {
  return (
    <section
      className="landing-section landing-section--alt"
      id="por-que-funciona"
    >
      <div className="landing__inner">
        <p className="landing-section__eyebrow">Beneficios</p>
        <h2 className="landing-section__title">Por qué funciona</h2>
        <div className="landing-porque__grid">
          {ITEMS.map((item) => (
            <article className="landing-porque__item" key={item.title}>
              <h3>{item.title}</h3>
              <p>{item.text}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
