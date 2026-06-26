import Head from 'next/head';
import LandingPage from '../components/landing/LandingPage';

export default function Home() {
  return (
    <>
      <Head>
        <title>Kyntü — Donde la oferta encuentra la demanda</title>
        <meta
          name="description"
          content="Publica lo que necesitas, recibe ofertas y compara las mejores alternativas en un solo lugar. Compara. Cotiza. Elige. Crece."
        />
        <meta
          property="og:title"
          content="Kyntü — Donde la oferta encuentra la demanda"
        />
        <meta
          property="og:description"
          content="No busques entre cientos de productos y proveedores. Publica tu necesidad, recibe ofertas y elige con claridad."
        />
        <meta property="og:type" content="website" />
      </Head>
      <LandingPage />
    </>
  );
}
