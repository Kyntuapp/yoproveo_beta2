import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabaseClient';
import { ShoppingCart, Store, ArrowLeft } from 'lucide-react';

export default function SeleccionarPerfil() {
  const router = useRouter();

  const [perfiles, setPerfiles] = useState([]);
  const [email, setEmail] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const obtenerPerfiles = async () => {
      try {
        const emailGuardado = localStorage.getItem('user_email');

        if (!emailGuardado) {
          setErrorMessage('No se encontró información del usuario.');
          return;
        }

        const normalizedEmail = emailGuardado.trim().toLowerCase();

        setEmail(normalizedEmail);

        const { data, error } = await supabase
          .from('perfiles')
          .select('tipo')
          .eq('email', normalizedEmail);

        if (error) {
          console.error('Error al obtener perfiles:', error);
          setErrorMessage('No fue posible obtener tus perfiles.');
          return;
        }

        setPerfiles(
          [...new Set((data || []).map((perfil) => perfil.tipo))]
        );
      } catch (error) {
        console.error('Error inesperado:', error);
        setErrorMessage('Ocurrió un error al cargar tus perfiles.');
      } finally {
        setLoading(false);
      }
    };

    obtenerPerfiles();
  }, []);

  const irAPerfil = (tipo) => {
    router.push(`/${tipo}`);
  };

  return (
    <>
      <main className="profile-page">
        <div className="background-decoration background-decoration-one" />
        <div className="background-decoration background-decoration-two" />

        <img
          src="/icono_1.png"
          alt=""
          aria-hidden="true"
          className="background-logo"
        />

        <section className="profile-card">
          <header className="profile-header">
            <img
              src="/icono_1.png"
              alt="Kyntü"
              className="kyntu-logo"
            />

            <span className="profile-badge">
              Acceso a tu cuenta
            </span>

            <h1>Selecciona tu perfil</h1>

            {email && (
              <p className="profile-subtitle">
                Estás ingresando como
                <strong>{email}</strong>
              </p>
            )}
          </header>

          {loading && (
            <div className="status-container">
              <span className="loader" />

              <p>Cargando tus perfiles...</p>
            </div>
          )}

          {!loading && errorMessage && (
            <div className="error-message" role="alert">
              {errorMessage}
            </div>
          )}

          {!loading && !errorMessage && (
            <>
              <div className="profile-options">
                {perfiles.includes('comprador') && (
                  <button
                    type="button"
                    className="profile-option"
                    onClick={() => irAPerfil('comprador')}
                  >
                    <span className="option-icon buyer-icon">
                      <ShoppingCart size={27} strokeWidth={2} />
                    </span>

                    <span className="option-content">
                      <strong>Comprador</strong>

                      <small>
                        Publica solicitudes, compara ofertas y gestiona
                        tus compras.
                      </small>
                    </span>

                    <span className="option-action">
                      Ingresar
                    </span>
                  </button>
                )}

                {perfiles.includes('proveedor') && (
                  <button
                    type="button"
                    className="profile-option"
                    onClick={() => irAPerfil('proveedor')}
                  >
                    <span className="option-icon provider-icon">
                      <Store size={27} strokeWidth={2} />
                    </span>

                    <span className="option-content">
                      <strong>Proveedor</strong>

                      <small>
                        Revisa solicitudes, envía ofertas y administra
                        tus ventas.
                      </small>
                    </span>

                    <span className="option-action">
                      Ingresar
                    </span>
                  </button>
                )}
              </div>

              {perfiles.length === 0 && (
                <div className="empty-message">
                  No tienes perfiles disponibles para seleccionar.
                </div>
              )}
            </>
          )}

          <button
            type="button"
            className="back-button"
            onClick={() => router.push('/')}
          >
            <ArrowLeft size={18} strokeWidth={2.2} />
            Volver al inicio
          </button>
        </section>
      </main>

      <style jsx>{`
        .profile-page {
          position: relative;
          width: 100%;
          min-height: 100vh;
          min-height: 100dvh;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          padding: 48px 24px;
          box-sizing: border-box;
          font-family: 'Plus Jakarta Sans', Inter, system-ui, sans-serif;
          background:
            radial-gradient(
              circle at 12% 12%,
              rgba(23, 107, 255, 0.16),
              transparent 32%
            ),
            radial-gradient(
              circle at 88% 82%,
              rgba(0, 194, 168, 0.12),
              transparent 30%
            ),
            linear-gradient(
              145deg,
              #f8fbff 0%,
              #eef5ff 48%,
              #f8fcfb 100%
            );
        }

        .background-decoration {
          position: absolute;
          border-radius: 999px;
          pointer-events: none;
          filter: blur(2px);
        }

        .background-decoration-one {
          top: -160px;
          right: -130px;
          width: 390px;
          height: 390px;
          background: rgba(23, 107, 255, 0.09);
        }

        .background-decoration-two {
          bottom: -190px;
          left: -130px;
          width: 420px;
          height: 420px;
          background: rgba(0, 194, 168, 0.08);
        }

        .background-logo {
          position: absolute;
          right: -50px;
          bottom: -55px;
          width: min(440px, 45vw);
          opacity: 0.035;
          pointer-events: none;
          user-select: none;
        }

        .profile-card {
          position: relative;
          z-index: 2;
          width: 100%;
          max-width: 760px;
          padding: 42px;
          box-sizing: border-box;
          overflow: hidden;
          background: rgba(255, 255, 255, 0.94);
          border: 1px solid rgba(220, 231, 245, 0.95);
          border-radius: 30px;
          box-shadow: 0 30px 90px rgba(20, 55, 120, 0.15);
          backdrop-filter: blur(18px);
        }

        .profile-header {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
        }

        .kyntu-logo {
          display: block;
          width: 235px;
          max-width: 78%;
          margin: -46px auto -54px;
          object-fit: contain;
        }

        .profile-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 13px;
          padding: 7px 13px;
          border-radius: 999px;
          background: #edf4ff;
          color: #176bff;
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 0.02em;
          text-transform: uppercase;
        }

        h1 {
          margin: 0;
          color: #061b41;
          font-size: clamp(28px, 4vw, 38px);
          line-height: 1.15;
          font-weight: 900;
          letter-spacing: -0.035em;
        }

        .profile-subtitle {
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
          gap: 5px;
          margin: 13px 0 0;
          color: #687991;
          font-size: 14px;
          line-height: 1.6;
          overflow-wrap: anywhere;
        }

        .profile-subtitle strong {
          color: #244366;
        }

        .profile-options {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 16px;
          margin-top: 32px;
        }

        .profile-option {
          width: 100%;
          min-width: 0;
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          padding: 24px;
          text-align: left;
          font-family: inherit;
          border: 1px solid #e1e9f4;
          border-radius: 22px;
          background: #ffffff;
          cursor: pointer;
          transition:
            transform 0.2s ease,
            border-color 0.2s ease,
            box-shadow 0.2s ease;
        }

        .profile-option:hover {
          transform: translateY(-4px);
          border-color: rgba(23, 107, 255, 0.35);
          box-shadow: 0 20px 38px rgba(20, 55, 120, 0.12);
        }

        .profile-option:focus-visible,
        .back-button:focus-visible {
          outline: 3px solid rgba(23, 107, 255, 0.25);
          outline-offset: 3px;
        }

        .option-icon {
          width: 54px;
          height: 54px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 19px;
          border-radius: 17px;
        }

        .buyer-icon {
          color: #176bff;
          background: linear-gradient(145deg, #eaf2ff, #f4f8ff);
          box-shadow: 0 12px 25px rgba(23, 107, 255, 0.14);
        }

        .provider-icon {
          color: #00a98f;
          background: linear-gradient(145deg, #e8faf6, #f4fffc);
          box-shadow: 0 12px 25px rgba(0, 175, 200, 0.13);
        }

        .option-content {
          display: flex;
          flex-direction: column;
          flex: 1;
        }

        .option-content strong {
          margin-bottom: 8px;
          color: #061b41;
          font-size: 19px;
          font-weight: 900;
        }

        .option-content small {
          color: #687991;
          font-size: 13px;
          line-height: 1.55;
        }

        .option-action {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          margin-top: 20px;
          padding: 10px 17px;
          border-radius: 12px;
          background: #176bff;
          color: #ffffff;
          font-size: 13px;
          font-weight: 900;
          box-shadow: 0 10px 22px rgba(23, 107, 255, 0.2);
        }

        .back-button {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          margin: 25px auto 0;
          padding: 12px 18px;
          border: 0;
          border-radius: 12px;
          background: transparent;
          color: #52627a;
          font-family: inherit;
          font-size: 14px;
          font-weight: 800;
          cursor: pointer;
          transition:
            color 0.2s ease,
            background 0.2s ease;
        }

        .back-button:hover {
          color: #176bff;
          background: #f0f5fd;
        }

        .status-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 13px;
          margin-top: 34px;
          color: #687991;
          font-size: 14px;
        }

        .status-container p {
          margin: 0;
        }

        .loader {
          width: 32px;
          height: 32px;
          box-sizing: border-box;
          border: 3px solid #dbe8ff;
          border-top-color: #176bff;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        .error-message,
        .empty-message {
          margin-top: 28px;
          padding: 14px 18px;
          border-radius: 14px;
          text-align: center;
          font-size: 14px;
          font-weight: 700;
          line-height: 1.5;
        }

        .error-message {
          color: #b42318;
          background: #fff1f1;
          border: 1px solid #ffd4d4;
        }

        .empty-message {
          color: #52627a;
          background: #f6f9fd;
          border: 1px solid #e1e9f4;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        @media (max-width: 700px) {
          .profile-page {
            align-items: flex-start;
            padding: 24px 16px;
          }

          .profile-card {
            margin: auto 0;
            padding: 30px 22px;
            border-radius: 24px;
          }

          .kyntu-logo {
            width: 205px;
            margin: -43px auto -47px;
          }

          .profile-options {
            grid-template-columns: 1fr;
            margin-top: 26px;
          }

          .profile-option {
            display: grid;
            grid-template-columns: auto minmax(0, 1fr);
            column-gap: 15px;
            padding: 19px;
          }

          .option-icon {
            grid-row: 1 / span 2;
            width: 48px;
            height: 48px;
            margin: 0;
            border-radius: 15px;
          }

          .option-content {
            min-width: 0;
          }

          .option-content strong {
            font-size: 17px;
          }

          .option-action {
            grid-column: 1 / -1;
            width: 100%;
            margin-top: 17px;
            box-sizing: border-box;
          }
        }

        @media (max-width: 420px) {
          .profile-page {
            padding: 14px 10px;
          }

          .profile-card {
            padding: 26px 17px;
            border-radius: 21px;
          }

          .kyntu-logo {
            width: 185px;
            margin: -38px auto -43px;
          }

          h1 {
            font-size: 27px;
          }

          .profile-badge {
            font-size: 10px;
          }

          .profile-subtitle {
            font-size: 13px;
          }

          .profile-option {
            padding: 17px;
          }

          .background-logo {
            width: 300px;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .profile-option,
          .back-button {
            transition: none;
          }

          .loader {
            animation-duration: 1.5s;
          }
        }
      `}</style>
    </>
  );
}