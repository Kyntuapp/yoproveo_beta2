import { useEffect } from 'react';
import Head from 'next/head';
import { FiGlobe } from 'react-icons/fi';
import { FaInstagram, FaLinkedinIn } from 'react-icons/fa';
import { LOGO_ICON } from '../components/landing/landingAssets';
import styles from '../styles/Links.module.css';

const LINKS = [
  {
    id: 'web',
    href: 'https://www.kyntu.cl',
    label: 'Sitio web — kyntu.cl',
    ariaLabel: 'Sitio web de Kyntü, kyntu.cl',
    Icon: FiGlobe,
    className: styles.btnWeb,
    external: false,
  },
  {
    id: 'instagram',
    href: 'https://www.instagram.com/kyntu_app?utm_source=ig_web_button_share_sheet&igsi=ZDNlZDc0MzIxNw==',
    label: 'Instagram — @kyntu_app',
    ariaLabel: 'Instagram de Kyntü, @kyntu_app',
    Icon: FaInstagram,
    className: styles.btnIg,
    external: true,
  },
  {
    id: 'linkedin',
    href: 'https://www.linkedin.com/in/kynt%C3%BC-app-b7a131417/',
    label: 'LinkedIn — Kyntü',
    ariaLabel: 'LinkedIn de Kyntü',
    Icon: FaLinkedinIn,
    className: styles.btnLi,
    external: true,
  },
];

export default function LinksPage() {
  useEffect(() => {
    document.body.classList.add('links-page');
    return () => {
      document.body.classList.remove('links-page');
    };
  }, []);

  return (
    <>
      <Head>
        <title>Kyntü | Enlaces oficiales</title>
        <meta
          name="description"
          content="Sitio web y redes oficiales de Kyntü."
        />
        <link rel="canonical" href="https://www.kyntu.cl/links" />
        <meta property="og:title" content="Kyntü | Enlaces oficiales" />
        <meta
          property="og:description"
          content="Sitio web y redes oficiales de Kyntü."
        />
        <meta property="og:url" content="https://www.kyntu.cl/links" />
        <meta property="og:type" content="website" />
        <meta name="robots" content="index,follow" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div className={styles.page}>
        <main className={styles.main}>
          <header className={styles.brand}>
            <img
              src={LOGO_ICON}
              alt="Kyntü"
              className={styles.logo}
              width={96}
              height={96}
            />
            <h1 className={styles.name}>
              Kynt<span className={styles.nameAccent}>ü</span>
            </h1>
            <p className={styles.tagline} aria-label="CONECTA COTIZA ELIGE CRECE">
              <span>CONECTA</span>
              <span className={styles.dotBlue} aria-hidden="true">
                •
              </span>
              <span>COTIZA</span>
              <span className={styles.dotMint} aria-hidden="true">
                •
              </span>
              <span>ELIGE</span>
              <span className={styles.dotOrange} aria-hidden="true">
                •
              </span>
              <span>CRECE</span>
            </p>
          </header>

          <nav className={styles.actions} aria-label="Enlaces oficiales">
            {LINKS.map(({ id, href, label, ariaLabel, Icon, className, external }) => (
              <a
                key={id}
                href={href}
                className={`${styles.btn} ${className}`}
                aria-label={ariaLabel}
                {...(external
                  ? { target: '_blank', rel: 'noopener noreferrer' }
                  : {})}
              >
                <span className={styles.iconWrap} aria-hidden="true">
                  <Icon />
                </span>
                <span className={styles.btnLabel}>{label}</span>
              </a>
            ))}
          </nav>
        </main>

        <footer className={styles.footer}>© Kyntü 2026</footer>
      </div>
    </>
  );
}
