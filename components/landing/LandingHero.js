import Link from 'next/link';
import { HERO_ART } from './landingAssets';

const ROLE_STRIPS = [
  {
    id: 'comercio',
    title: '¿Tienes un comercio?',
    text: 'Regístrate, sube tu lista y deja que proveedores oferten.',
    btnClass: 'landing-btn--primary',
  },
  {
    id: 'proveedor',
    title: '¿Quieres proveer?',
    text: 'Encuentra demanda activa y ofrece tus productos donde ya existe intención de compra.',
    btnClass: 'landing-btn--teal',
  },
];

export default function LandingHero() {
  return (
    <section className="landing-hero">
      <div className="landing__inner">
        <div className="landing-hero__grid">
          <div className="landing-hero__main">
            <div className="landing-hero__brand">
              <p className="landing-hero__wordmark" aria-label="Kyntü">
                Kynt<span className="landing-hero__umlaut">ü</span>
              </p>
              <p className="landing-hero__slogan">
                <span>CONECTA</span>
                <span className="landing-slogan__dot landing-slogan__dot--blue">
                  •
                </span>
                <span>COTIZA</span>
                <span className="landing-slogan__dot landing-slogan__dot--teal">
                  •
                </span>
                <span>ELIGE</span>
                <span className="landing-slogan__dot landing-slogan__dot--orange">
                  •
                </span>
                <span>CRECE</span>
              </p>
            </div>

            <h1 className="landing-hero__headline">
              Donde la <span className="landing-accent-word">oferta</span>{' '}
              <span className="landing-text-gradient">encuentra la demanda</span>
            </h1>

            <p className="landing-hero__lead">
              No busques entre cientos de productos, precios y proveedores. En{' '}
              <span className="landing-brand">Kyntü</span> publicas lo que
              necesitas, recibes ofertas y{' '}
              <span className="landing-accent-word">comparas</span> las mejores
              alternativas en un solo lugar.
            </p>

            <div className="landing-hero__roles">
              {ROLE_STRIPS.map((strip) => (
                <div className="landing-role-strip" key={strip.id}>
                  <div>
                    <h2 className="landing-role-strip__title">{strip.title}</h2>
                    <p className="landing-role-strip__text">{strip.text}</p>
                  </div>
                  <Link
                    href="/register"
                    className={`landing-btn ${strip.btnClass} landing-btn--sm`}
                  >
                    Registrarme
                  </Link>
                </div>
              ))}
            </div>
          </div>

          <div className="landing-hero__visual">
            <img
              src={HERO_ART}
              alt=""
              className="landing-hero__art"
              aria-hidden="true"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
