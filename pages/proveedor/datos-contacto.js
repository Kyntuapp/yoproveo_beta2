import { showKyntuAlert } from '../../lib/kyntuAlert';
// pages/proveedor/datos-contacto.js
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import {
  Building2,
  Lock,
  Mail,
  Save,
  WalletCards,
} from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import { resolveProveedorProfile } from "../../lib/resolveProveedorProfile";
import AppLayout from "../../components/Layout/AppLayout";
import Notificaciones from "../../components/Notificaciones";

export default function DatosContactoProveedor() {
  const router = useRouter();

  const [perfil, setPerfil] = useState(null);
  const [emailContacto, setEmailContacto] =
    useState("");
  const [fono8, setFono8] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [banco, setBanco] = useState("");
  const [tipoCuenta, setTipoCuenta] = useState("");
  const [numeroCuenta, setNumeroCuenta] =
    useState("");
  const [rutTitular, setRutTitular] = useState("");
  const [nombreTitular, setNombreTitular] =
    useState("");

  useEffect(() => {
    const cargar = async () => {
      try {
        const {
          data: userWrap,
          error: userErr,
        } = await supabase.auth.getUser();

        if (userErr || !userWrap?.user) {
          showKyntuAlert("Debes iniciar sesión.");
          router.push("/login");
          return;
        }

        const { perfil: perfilData } =
          await resolveProveedorProfile(
            userWrap.user,
            {
              select: "*",
            },
          );

        if (!perfilData) {
          showKyntuAlert(
            'No se encontró perfil de proveedor.\nVe a "Cambiar perfil" y crea o selecciona el perfil de proveedor.',
          );

          router.push("/proveedor");
          return;
        }

        setPerfil(perfilData);

        setEmailContacto(
          perfilData.email_contacto ??
            perfilData.email ??
            "",
        );

        const telefono = (
          perfilData.telefono_contacto || ""
        )
          .replace("+569", "")
          .replace(/\D/g, "")
          .slice(0, 8);

        setFono8(telefono);
        setBanco(perfilData.banco || "");
        setTipoCuenta(perfilData.tipo_cuenta || "");
        setNumeroCuenta(
          perfilData.numero_cuenta || "",
        );
        setRutTitular(perfilData.rut_titular || "");
        setNombreTitular(
          perfilData.nombre_titular || "",
        );
      } catch (error) {
        console.error(
          "Error cargando los datos del proveedor:",
          error,
        );

        showKyntuAlert("No se pudieron cargar tus datos.");
      } finally {
        setLoading(false);
      }
    };

    cargar();
  }, [router]);

  const normalizar8 = (valor) =>
    valor.replace(/\D/g, "").slice(0, 8);

  const guardar = async (event) => {
    event.preventDefault();

    if (!perfil || saving) return;

    if (!emailContacto.trim()) {
      showKyntuAlert("Ingresa un correo de contacto.");
      return;
    }

    const solo8 = normalizar8(fono8);

    if (solo8.length !== 8) {
      showKyntuAlert(
        "El teléfono debe tener exactamente 8 dígitos después de +569.",
      );
      return;
    }

    try {
      setSaving(true);

      const { error } = await supabase
        .from("perfiles")
        .update({
          email_contacto: emailContacto.trim(),
          telefono_contacto: `+569${solo8}`,
          banco: banco.trim(),
          tipo_cuenta: tipoCuenta.trim(),
          numero_cuenta: numeroCuenta.trim(),
          rut_titular: rutTitular.trim(),
          nombre_titular: nombreTitular.trim(),
        })
        .eq("id", perfil.id);

      if (error) {
        throw error;
      }

      showKyntuAlert("Datos de contacto actualizados.");
      router.push("/proveedor");
    } catch (error) {
      console.error(
        "Error guardando datos del proveedor:",
        error,
      );

      showKyntuAlert(
        `No se pudieron guardar los datos: ${error.message}`,
      );
    } finally {
      setSaving(false);
    }
  };

  const irDashboard = () => {
    router.push("/proveedor");
  };

  const irDatosContacto = () => {
    router.push("/proveedor/datos-contacto");
  };

  const cambiarPerfil = () => {
    router.push("/seleccionar-perfil");
  };

  const cerrarSesion = async () => {
    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error(
        "Error cerrando sesión:",
        error,
      );

      showKyntuAlert("No se pudo cerrar la sesión.");
      return;
    }

    localStorage.clear();
    router.push("/login");
  };

  return (
    <AppLayout
      title="Actualizar datos"
      profileLabel="Proveedor"
      showProfileSwitch
      onChangeProfile={cambiarPerfil}
      onUpdateData={irDatosContacto}
      onDashboard={irDashboard}
      onLogout={cerrarSesion}
      notifications={
        perfil?.id ? (
          <Notificaciones
            userId={perfil.id}
            rol="proveedor"
          />
        ) : null
      }
    >
      <main
        className="contact-page"
        style={styles.main}
      >
        <section
          className="contact-hero"
          style={styles.hero}
        >
          <div style={styles.heroCopy}>
            <span style={styles.eyebrow}>
              PERFIL PROVEEDOR
            </span>

            <h1 style={styles.heading}>
              Actualiza tus datos
            </h1>

            <p style={styles.heroText}>
              Mantén actualizada tu información de
              contacto y tus datos bancarios para
              facilitar la comunicación con los
              compradores.
            </p>
          </div>

          <div
            style={styles.heroIcon}
            aria-hidden="true"
          >
            <Building2 size={30} />
          </div>
        </section>

        {loading ? (
          <section style={styles.loadingCard}>
            <span
              className="contact-spinner"
              style={styles.spinner}
            />

            <p style={styles.loadingText}>
              Cargando tus datos...
            </p>
          </section>
        ) : (
          <form
            onSubmit={guardar}
            style={styles.form}
          >
            <section
              className="contact-card"
              style={styles.card}
            >
              <div style={styles.sectionHeader}>
                <span style={styles.sectionIconBlue}>
                  <Mail size={21} />
                </span>

                <div>
                  <h2 style={styles.sectionTitle}>
                    Datos de contacto
                  </h2>

                  <p
                    style={
                      styles.sectionDescription
                    }
                  >
                    Serán visibles para el comprador
                    cuando acepte una de tus ofertas.
                  </p>
                </div>
              </div>

              <div
                className="contact-grid"
                style={styles.contactGrid}
              >
                <div style={styles.formGroup}>
                  <label
                    htmlFor="email-contacto"
                    style={styles.label}
                  >
                    Correo de contacto
                  </label>

                  <input
                    id="email-contacto"
                    type="email"
                    value={emailContacto}
                    onChange={(event) =>
                      setEmailContacto(
                        event.target.value,
                      )
                    }
                    placeholder="Ej: ventas@tuempresa.cl"
                    style={styles.input}
                    required
                  />

                  <small style={styles.helpText}>
                    Usa el correo donde quieres recibir
                    comunicaciones comerciales.
                  </small>
                </div>

                <div style={styles.formGroup}>
                  <label
                    htmlFor="telefono-contacto"
                    style={styles.label}
                  >
                    Teléfono de contacto
                  </label>

                  <div style={styles.phoneRow}>
                    <span style={styles.prefix}>
                      +569
                    </span>

                    <input
                      id="telefono-contacto"
                      inputMode="numeric"
                      pattern="[0-9]{8}"
                      value={fono8}
                      onChange={(event) =>
                        setFono8(
                          normalizar8(
                            event.target.value,
                          ),
                        )
                      }
                      placeholder="XXXXXXXX"
                      style={styles.phoneInput}
                      required
                    />
                  </div>

                  <small style={styles.helpText}>
                    Ingresa solamente los 8 dígitos
                    finales.
                  </small>
                </div>
              </div>
            </section>

            <section
              className="contact-card"
              style={styles.card}
            >
              <div style={styles.sectionHeader}>
                <span
                  style={styles.sectionIconGreen}
                >
                  <WalletCards size={21} />
                </span>

                <div>
                  <h2 style={styles.sectionTitle}>
                    Tu cuenta bancaria
                  </h2>

                  <p
                    style={
                      styles.sectionDescription
                    }
                  >
                    Ingresa los datos de la cuenta
                    donde deseas recibir el pago por
                    tus ventas.
                  </p>
                </div>
              </div>

              <div
                className="bank-grid"
                style={styles.bankGrid}
              >
                <div style={styles.formGroup}>
                  <label
                    htmlFor="banco"
                    style={styles.label}
                  >
                    Banco
                  </label>

                  <input
                    id="banco"
                    value={banco}
                    onChange={(event) =>
                      setBanco(event.target.value)
                    }
                    style={styles.input}
                    placeholder="Ej: Banco de Chile"
                  />
                </div>

                <div style={styles.formGroup}>
                  <label
                    htmlFor="tipo-cuenta"
                    style={styles.label}
                  >
                    Tipo de cuenta
                  </label>

                  <input
                    id="tipo-cuenta"
                    value={tipoCuenta}
                    onChange={(event) =>
                      setTipoCuenta(
                        event.target.value,
                      )
                    }
                    style={styles.input}
                    placeholder="Ej: Cuenta corriente"
                  />
                </div>

                <div style={styles.formGroup}>
                  <label
                    htmlFor="numero-cuenta"
                    style={styles.label}
                  >
                    Número de cuenta
                  </label>

                  <input
                    id="numero-cuenta"
                    value={numeroCuenta}
                    onChange={(event) =>
                      setNumeroCuenta(
                        event.target.value,
                      )
                    }
                    style={styles.input}
                    placeholder="Ej: 123456789"
                  />
                </div>

                <div style={styles.formGroup}>
                  <label
                    htmlFor="rut-titular"
                    style={styles.label}
                  >
                    RUT del titular
                  </label>

                  <input
                    id="rut-titular"
                    value={rutTitular}
                    onChange={(event) =>
                      setRutTitular(
                        event.target.value,
                      )
                    }
                    style={styles.input}
                    placeholder="Ej: 12.345.678-9"
                  />
                </div>

                <div
                  className="owner-field"
                  style={styles.ownerField}
                >
                  <label
                    htmlFor="nombre-titular"
                    style={styles.label}
                  >
                    Nombre del titular
                  </label>

                  <input
                    id="nombre-titular"
                    value={nombreTitular}
                    onChange={(event) =>
                      setNombreTitular(
                        event.target.value,
                      )
                    }
                    style={styles.input}
                    placeholder="Ej: Juan Pérez"
                  />
                </div>
              </div>
            </section>

            <div
              className="contact-actions"
              style={styles.actionRow}
            >
              <button
                type="button"
                onClick={() =>
                  router.push("/proveedor")
                }
                style={styles.secondaryButton}
              >
                Cancelar
              </button>

              <button
                type="submit"
                disabled={saving}
                style={{
                  ...styles.mainButton,
                  ...(saving
                    ? styles.mainButtonDisabled
                    : {}),
                }}
              >
                <Save size={18} />

                {saving
                  ? "Guardando..."
                  : "Guardar cambios"}
              </button>
            </div>
          </form>
        )}

        {!loading && (
          <section
            className="contact-card"
            style={{
              ...styles.card,
              marginTop: "20px",
            }}
          >
            <div style={styles.sectionHeader}>
              <span style={styles.sectionIconNeutral}>
                <Lock size={21} />
              </span>

              <div>
                <h2 style={styles.sectionTitle}>
                  Seguridad
                </h2>

                <p style={styles.sectionDescription}>
                  Opciones de acceso a tu cuenta.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() =>
                router.push("/reset-password")
              }
              style={styles.secondaryActionButton}
            >
              Cambiar contraseña
            </button>
          </section>
        )}
      </main>

      <style jsx>{`
        .contact-spinner {
          animation: contact-spin 0.8s linear
            infinite;
        }

        @keyframes contact-spin {
          to {
            transform: rotate(360deg);
          }
        }

        input:focus {
          border-color: #176bff !important;
          box-shadow: 0 0 0 4px
            rgba(23, 107, 255, 0.1) !important;
          background: #ffffff !important;
        }

        button {
          transition:
            transform 0.2s ease,
            box-shadow 0.2s ease,
            border-color 0.2s ease;
        }

        button:not(:disabled):hover {
          transform: translateY(-1px);
        }

        @media (max-width: 760px) {
          .contact-page {
            padding: 0 0 24px !important;
          }

          .contact-hero {
            align-items: flex-start !important;
            padding: 22px !important;
          }

          .contact-card {
            padding: 22px !important;
          }

          .contact-grid,
          .bank-grid {
            grid-template-columns: 1fr !important;
          }

          .owner-field {
            grid-column: auto !important;
          }
        }

        @media (max-width: 520px) {
          .contact-hero {
            padding: 20px 18px !important;
            border-radius: 18px !important;
          }

          .contact-hero > div:last-child {
            display: none !important;
          }

          .contact-card {
            padding: 19px 16px !important;
            border-radius: 18px !important;
          }

          .contact-actions {
            flex-direction: column-reverse !important;
          }

          .contact-actions button {
            width: 100% !important;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .contact-spinner {
            animation: none;
          }

          button {
            transition: none;
          }
        }
      `}</style>
    </AppLayout>
  );
}

const styles = {
  main: {
    width: "100%",
    maxWidth: "1120px",
    margin: "0 auto",
    padding: "0 0 44px",
    boxSizing: "border-box",
  },

  hero: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "20px",
    marginBottom: "24px",
    padding: "28px 30px",
    border: "1px solid #dce7f4",
    borderRadius: "22px",
    background:
      "linear-gradient(135deg, rgba(255,255,255,0.99), rgba(241,247,255,0.98))",
    boxShadow:
      "0 18px 45px rgba(32, 73, 130, 0.08)",
  },

  heroCopy: {
    minWidth: 0,
  },

  eyebrow: {
    display: "block",
    marginBottom: "8px",
    color: "#176bff",
    fontSize: "11px",
    fontWeight: 900,
    letterSpacing: "0.12em",
  },

  heading: {
    margin: 0,
    color: "#071c41",
    fontSize: "clamp(27px, 4vw, 38px)",
    lineHeight: 1.12,
    fontWeight: 900,
    letterSpacing: "-0.04em",
  },

  heroText: {
    maxWidth: "700px",
    margin: "10px 0 0",
    color: "#65758b",
    fontSize: "14px",
    lineHeight: 1.65,
  },

  heroIcon: {
    width: "62px",
    height: "62px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    borderRadius: "19px",
    color: "#ffffff",
    background:
      "linear-gradient(135deg, #176bff, #00afc8)",
    boxShadow:
      "0 15px 30px rgba(23, 107, 255, 0.22)",
  },

  form: {
    display: "flex",
    flexDirection: "column",
    gap: "20px",
  },

  card: {
    padding: "28px",
    border: "1px solid #dfe8f3",
    borderRadius: "22px",
    background: "#ffffff",
    boxShadow:
      "0 16px 42px rgba(32, 73, 130, 0.07)",
  },

  sectionHeader: {
    display: "flex",
    alignItems: "flex-start",
    gap: "13px",
    marginBottom: "24px",
  },

  sectionIconBlue: {
    width: "42px",
    height: "42px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    borderRadius: "13px",
    color: "#176bff",
    background: "#eaf2ff",
  },

  sectionIconGreen: {
    width: "42px",
    height: "42px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    borderRadius: "13px",
    color: "#008f7c",
    background: "#e7f8f4",
  },

  sectionIconNeutral: {
    width: "42px",
    height: "42px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    borderRadius: "13px",
    color: "#5b6f8a",
    background: "#edf2f7",
  },

  sectionTitle: {
    margin: 0,
    color: "#102b50",
    fontSize: "20px",
    lineHeight: 1.25,
    fontWeight: 900,
  },

  sectionDescription: {
    margin: "5px 0 0",
    color: "#748399",
    fontSize: "13px",
    lineHeight: 1.5,
  },

  contactGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(2, minmax(0, 1fr))",
    gap: "20px",
  },

  bankGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(2, minmax(0, 1fr))",
    gap: "20px",
  },

  ownerField: {
    gridColumn: "1 / -1",
  },

  formGroup: {
    minWidth: 0,
  },

  label: {
    display: "block",
    marginBottom: "8px",
    color: "#354e6d",
    fontSize: "12px",
    fontWeight: 900,
  },

  input: {
    width: "100%",
    minWidth: 0,
    minHeight: "48px",
    padding: "12px 14px",
    boxSizing: "border-box",
    border: "1px solid #ccd9e8",
    borderRadius: "12px",
    outline: "none",
    background: "#f9fbfe",
    color: "#183354",
    fontSize: "14px",
    transition:
      "border-color 0.2s ease, box-shadow 0.2s ease",
  },

  phoneRow: {
    display: "flex",
    alignItems: "stretch",
    gap: "9px",
    width: "100%",
  },

  prefix: {
    minWidth: "70px",
    minHeight: "48px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "0 12px",
    boxSizing: "border-box",
    border: "1px solid #cddfff",
    borderRadius: "12px",
    background: "#edf4ff",
    color: "#176bff",
    fontSize: "14px",
    fontWeight: 900,
  },

  phoneInput: {
    width: "100%",
    minWidth: 0,
    minHeight: "48px",
    flex: 1,
    padding: "12px 14px",
    boxSizing: "border-box",
    border: "1px solid #ccd9e8",
    borderRadius: "12px",
    outline: "none",
    background: "#f9fbfe",
    color: "#183354",
    fontSize: "14px",
    transition:
      "border-color 0.2s ease, box-shadow 0.2s ease",
  },

  helpText: {
    display: "block",
    marginTop: "7px",
    color: "#7d8da2",
    fontSize: "11px",
    lineHeight: 1.45,
  },

  actionRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: "12px",
    paddingTop: "2px",
  },

  mainButton: {
    minWidth: "190px",
    minHeight: "48px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "9px",
    padding: "12px 22px",
    border: 0,
    borderRadius: "12px",
    background:
      "linear-gradient(135deg, #176bff, #2e6bff)",
    color: "#ffffff",
    cursor: "pointer",
    fontSize: "14px",
    fontWeight: 900,
    boxShadow:
      "0 12px 26px rgba(23, 107, 255, 0.25)",
  },

  mainButtonDisabled: {
    opacity: 0.65,
    cursor: "not-allowed",
    boxShadow: "none",
  },

  secondaryButton: {
    minWidth: "120px",
    minHeight: "48px",
    padding: "12px 20px",
    border: "1px solid #cbd9e9",
    borderRadius: "12px",
    background: "#ffffff",
    color: "#3b5575",
    cursor: "pointer",
    fontSize: "14px",
    fontWeight: 900,
  },

  secondaryActionButton: {
    width: "100%",
    maxWidth: "360px",
    minHeight: "48px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "12px 20px",
    border: "1px solid #cbd9e9",
    borderRadius: "12px",
    background: "#ffffff",
    color: "#3b5575",
    cursor: "pointer",
    fontSize: "14px",
    fontWeight: 900,
  },

  loadingCard: {
    minHeight: "260px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "14px",
    padding: "30px",
    border: "1px solid #dfe8f3",
    borderRadius: "22px",
    background: "#ffffff",
    boxShadow:
      "0 16px 42px rgba(32, 73, 130, 0.07)",
  },

  spinner: {
    width: "34px",
    height: "34px",
    border: "4px solid #dbe8fb",
    borderTopColor: "#176bff",
    borderRadius: "50%",
  },

  loadingText: {
    margin: 0,
    color: "#647790",
    fontSize: "14px",
    fontWeight: 800,
  },
};