import Link from 'next/link';
import { FaInstagram, FaLinkedinIn } from 'react-icons/fa';
import { LOGO_CORPORATE, LOGO_FALLBACK } from './landingAssets';

const SOCIAL_LINKS = [
  {
    label: 'Instagram',
    href: 'https://www.instagram.com/kyntu_app?igsh=MXZzMjRlMm95cThiOQ%3D%3D&utm_source=qr',
    Icon: FaInstagram,
  },
  {
    label: 'LinkedIn',
    href: 'https://www.linkedin.com/in/kynt%C3%BC-app-b7a131417?utm_source=share_via&utm_content=profile&utm_medium=member_ios',
    Icon: FaLinkedinIn,
  },
];

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
          <div className="landing-footer__social">
            <p className="landing-footer__social-label">Síguenos</p>
            <div className="landing-footer__social-links">
              {SOCIAL_LINKS.map(({ label, href, Icon }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  className="landing-footer__social-link"
                >
                  <Icon aria-hidden="true" />
                </a>
              ))}
            </div>
          </div>
          <p className="landing-footer__legal">
            © {new Date().getFullYear()} Kyntü
          </p>
        </div>
      </div>
    </footer>
  );
}
