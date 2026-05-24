// pages/_app.js
import '../styles/globals.css';
import React from 'react';
import Head from "next/head";

function MyApp({ Component, pageProps }) {
  return (
    <>
      <Head>
        <link rel="icon" href="/icono_1.png" />
      </Head>

      <Component {...pageProps} />
    </>
  );
}

export default MyApp;