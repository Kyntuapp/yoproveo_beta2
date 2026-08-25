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
    text: 'Cada solicitud nace de una necesidad real de compra, no de una búsqueda al azar.',
    Icon: FiActivity,
    color: 'blue',
  },
  {
    title: 'Menos tiempo cotizando',
    text: 'Cotiza proveedores online sin buscar entre cientos de productos, precios y proveedores.',
    Icon: FiClock,
    color: 'turquoise',
  },
  {
    title: 'Todo en un solo lugar',
    text: 'Tu gestión de compras para pyme en un solo flujo: publica, recibe ofertas y compara.',
    Icon: FiGrid,
    color: 'orange',
  },
  {
    title: 'Más oportunidades comerciales',
    text: 'Más clientes sin salir a buscarlos: accedes a oportunidades de negocio B2B donde ya existe intención real de compra.',
    Icon: FiTrendingUp,
    color: 'violet',
  },
  {
    title: 'Comparación simple',
    text: 'Compara proveedores en Chile con las ofertas ya ordenadas para decidir fácil.',
    Icon: FiSliders,
    color: 'celeste',
  },
  {
    title: 'Mejor relación valor-condiciones',
    text: 'Elige considerando precio, despacho y condiciones — sin sacrificar valor.',
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
