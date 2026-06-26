import {
  FiActivity,
  FiClock,
  FiGrid,
  FiTrendingUp,
  FiSliders,
  FiAward,
} from 'react-icons/fi';

const ITEMS = [
  {
    title: 'Demanda real en vivo',
    text: 'Cada solicitud nace de una necesidad concreta de compra.',
    Icon: FiActivity,
    color: 'blue',
  },
  {
    title: 'Menos tiempo cotizando',
    text: 'No necesitas buscar entre cientos de productos, precios y proveedores.',
    Icon: FiClock,
    color: 'turquoise',
  },
  {
    title: 'Todo en un solo lugar',
    text: 'Publica, recibe ofertas y compara alternativas dentro del mismo flujo.',
    Icon: FiGrid,
    color: 'orange',
  },
  {
    title: 'Más oportunidades comerciales',
    text: 'Los proveedores llegan donde ya existe intención de compra.',
    Icon: FiTrendingUp,
    color: 'violet',
  },
  {
    title: 'Comparación simple',
    text: 'Las ofertas se ordenan para facilitar la decisión.',
    Icon: FiSliders,
    color: 'celeste',
  },
  {
    title: 'Mejor relación valor-condiciones',
    text: 'El comprador puede elegir considerando precio, despacho y condiciones.',
    Icon: FiAward,
    color: 'green',
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
        <h2 className="landing-section__title">
          Por qué funciona <span className="landing-brand">Kyntü</span>
        </h2>
        <div className="landing-porque__grid">
          {ITEMS.map(({ title, text, Icon, color }) => (
            <article className="landing-porque__card" key={title}>
              <div
                className={`landing-porque__icon landing-porque__icon--${color}`}
              >
                <Icon aria-hidden="true" />
              </div>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
