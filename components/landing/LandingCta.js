import Link from 'next/link';

const ITEMS = [
  {
    title: '¿Tienes un comercio?',
    text: 'Sube tu lista y recibe ofertas comparables.',
  },
  {
    title: '¿Quieres proveer?',
    text: 'Encuentra compradores con demanda activa.',
  },
];

export default function LandingCta() {
  return (
    <section className="landing-section">
      <div className="landing__inner">
        <div className="landing-cta-band">
          <h2 className="landing-cta-band__title">Empieza con Kyntü</h2>
          <div className="landing-cta-band__grid">
            {ITEMS.map((item) => (
              <div className="landing-cta-band__item" key={item.title}>
                <h3>{item.title}</h3>
                <p>{item.text}</p>
                <Link
                  href="/register"
                  className="landing-btn landing-btn--primary"
                >
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
