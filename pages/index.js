import Head from 'next/head';
import LandingPage from '../components/landing/LandingPage';

export default function Home() {
  return (
    <>
      <Head>
        <title>Kyntü | Cotiza Proveedores y Consigue Clientes en Chile</title>
        <meta
          name="description"
          content="Publica lo que necesitas y recibe cotizaciones de proveedores en minutos. Compara ofertas y elige la mejor opción con Kyntü, la plataforma que conecta compradores y proveedores en Chile."
        />
        <meta
          property="og:title"
          content="Kyntü | Cotiza Proveedores y Consigue Clientes en Chile"
        />
        <meta
          property="og:description"
          content="Publica lo que necesitas y recibe cotizaciones de proveedores en minutos. Compara ofertas y elige la mejor opción con Kyntü, la plataforma que conecta compradores y proveedores en Chile."
        />
        <meta property="og:type" content="website" />
      </Head>
      <LandingPage />
    </>
  );
}
