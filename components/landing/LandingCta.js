import Link from 'next/link';
import { FiShoppingBag, FiTruck } from 'react-icons/fi';

const ITEMS = [
  {
    id: 'comercio',
    title: '¿Tienes un comercio?',
    text: 'Sube tu lista y recibe ofertas comparables.',
    Icon: FiShoppingBag,
    btnClass: 'landing-btn--primary',
  },
  {
    id: 'proveedor',
    title: '¿Quieres proveer?',
    text: 'Encuentra compradores con demanda activa.',
    Icon: FiTruck,
    btnClass: 'landing-btn--teal',
  },
];

export default function LandingCta() {
  return (
    <section className="landing-section">
      <div className="landing__inner">
        <div className="landing-cta-band">
          <h2 className="landing-cta-band__title">
            Empieza con <span className="landing-brand">Kyntü</span>
          </h2>
          <div className="landing-cta-band__grid">
            {ITEMS.map(({ id, title, text, Icon, btnClass }) => (
              <div className="landing-cta-band__item" key={id}>
                <div className="landing-cta-band__icon-wrap">
                  <Icon aria-hidden="true" />
                </div>
                <h3>{title}</h3>
                <p>{text}</p>
                <Link href="/register" className={`landing-btn ${btnClass}`}>
                  Registrarme
                </Link>
              </div>
            ))}
          </div>
          <p className="landing-cta-band__login">
            ¿Ya tienes cuenta? <Link href="/login">Iniciar sesión</Link>
          </p>
        </div>
      </div>
    </section>
  );
}
