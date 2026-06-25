import Link from 'next/link';
import { LOGO_CORPORATE, LOGO_ICON, LOGO_FALLBACK } from './landingAssets';

const ROLE_STRIPS = [
  {
    id: 'comercio',
    title: '¿Tienes un comercio?',
    text: 'Regístrate, sube tu lista y deja que proveedores oferten.',
  },
  {
    id: 'proveedor',
    title: '¿Quieres proveer?',
    text: 'Encuentra demanda activa y ofrece tus productos donde ya existe intención de compra.',
  },
];

export default function LandingHero() {
  return (
    <section className="landing-hero">
      <div className="landing__inner">
        <div className="landing-hero__grid">
          <div className="landing-hero__main">
            <img
              src={LOGO_CORPORATE}
              alt="Kyntü"
              className="landing-hero__logo"
              onError={(e) => {
                e.currentTarget.src = LOGO_FALLBACK;
              }}
            />

            <h1 className="landing-hero__headline">
              Donde la oferta encuentra la demanda
            </h1>

            <p className="landing-hero__lead">
              No busques entre cientos de productos, precios y proveedores. En
              Kyntü publicas lo que necesitas, recibes ofertas y comparas las
              mejores alternativas en un solo lugar.
            </p>

            <p className="landing-hero__tagline">
              <span className="landing-hero__tagline-dot" aria-hidden="true" />
              Compara. Cotiza. Elige. Crece.
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
                    className="landing-btn landing-btn--primary landing-btn--sm"
                  >
                    Registrarme
                  </Link>
                </div>
              ))}
            </div>
          </div>

          <div className="landing-hero__visual" aria-hidden="true">
            <img
              src={LOGO_ICON}
              alt=""
              className="landing-hero__icon-bg"
            />
            <img
              src={LOGO_ICON}
              alt=""
              className="landing-hero__icon-accent"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
