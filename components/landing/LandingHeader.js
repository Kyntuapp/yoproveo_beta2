import Link from 'next/link';
import { LOGO_CORPORATE, LOGO_FALLBACK } from './landingAssets';

export default function LandingHeader() {
  return (
    <header className="landing-header">
      <div className="landing-header__inner">
        <Link href="/" className="landing-header__brand">
          <img
            src={LOGO_CORPORATE}
            alt="Kyntü"
            className="landing-header__logo"
            onError={(e) => {
              e.currentTarget.src = LOGO_FALLBACK;
            }}
          />
        </Link>

        <nav className="landing-header__nav" aria-label="Secciones">
          <a href="#como-funciona">Cómo funciona</a>
          <a href="#por-que-funciona">Por qué funciona</a>
        </nav>

        <div className="landing-header__actions">
          <Link href="/login" className="landing-btn landing-btn--ghost">
            Iniciar sesión
          </Link>
          <Link href="/register" className="landing-btn landing-btn--primary">
            Registrarme
          </Link>
        </div>
      </div>
    </header>
  );
}
