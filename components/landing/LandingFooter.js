import Link from 'next/link';
import { LOGO_CORPORATE, LOGO_FALLBACK } from './landingAssets';

export default function LandingFooter() {
  return (
    <footer className="landing-footer">
      <div className="landing__inner landing-footer__inner">
        <div>
          <img
            src={LOGO_CORPORATE}
            alt="Kyntü"
            className="landing-footer__logo"
            onError={(e) => {
              e.currentTarget.src = LOGO_FALLBACK;
            }}
          />
          <p className="landing-footer__tagline">
            Publica tu necesidad, recibe ofertas y elige con claridad.
          </p>
        </div>
        <div>
          <nav className="landing-footer__links" aria-label="Enlaces">
            <Link href="/login">Iniciar sesión</Link>
            <Link href="/register">Registrarme</Link>
            <a href="mailto:contacto@kyntu.cl">contacto@kyntu.cl</a>
          </nav>
          <p className="landing-footer__legal">
            © {new Date().getFullYear()} Kyntü
          </p>
        </div>
      </div>
    </footer>
  );
}
