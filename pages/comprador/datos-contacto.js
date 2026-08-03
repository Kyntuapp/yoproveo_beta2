// pages/comprador/datos-contacto.js
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { MapPin, Save, Truck, UserRound } from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import { comunasChile } from "../../utils/comunasChile";
import { regionesChile } from "../../utils/regionesChile";
import AppLayout from "../../components/Layout/AppLayout";
import Notificaciones from "../../components/Notificaciones";

const normalizarTexto = (texto = "") =>
  texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

export default function DatosContactoComprador() {
  const router = useRouter();

  const [telefono, setTelefono] = useState("");
  const [direccion, setDireccion] = useState("");
  const [comuna, setComuna] = useState("");
  const [mostrarComunas, setMostrarComunas] = useState(false);
  const [region, setRegion] = useState("");
  const [nombreContacto, setNombreContacto] = useState("");
  const [referenciaEntrega, setReferenciaEntrega] = useState("");
  const [authUserId, setAuthUserId] = useState("");
  const [perfilId, setPerfilId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const comunasFiltradas = useMemo(() => {
    const busqueda = normalizarTexto(comuna.trim());

    if (!busqueda) return comunasChile;

    return comunasChile.filter((item) =>
      normalizarTexto(item).includes(busqueda),
    );
  }, [comuna]);

  useEffect(() => {
    const cargarDatos = async () => {
      try {
        const { data: userData, error: userError } =
          await supabase.auth.getUser();

        if (userError || !userData?.user) {
          router.push("/login");
          return;
        }

        const userId = userData.user.id;
        setAuthUserId(userId);

        const { data: perfil, error: perfilError } = await supabase
          .from("perfiles")
          .select(
            "id, telefono_contacto, direccion, comuna, region, nombre_contacto, referencia_entrega",
          )
          .eq("auth_id", userId)
          .eq("tipo", "comprador")
          .maybeSingle();

        if (perfilError) throw perfilError;

        if (perfil) {
          setPerfilId(perfil.id);
          setTelefono(perfil.telefono_contacto || "");
          setDireccion(perfil.direccion || "");
          setComuna(perfil.comuna || "");
          setRegion(perfil.region || "");
          setNombreContacto(perfil.nombre_contacto || "");
          setReferenciaEntrega(perfil.referencia_entrega || "");
        }
      } catch (error) {
        console.error(
          "Error cargando datos del comprador:",
          error,
        );
        alert("No se pudieron cargar tus datos de entrega.");
      } finally {
        setLoading(false);
      }
    };

    cargarDatos();
  }, [router]);

  const guardarDatos = async (event) => {
    event.preventDefault();

    if (saving) return;

    if (
      !telefono.trim() ||
      !direccion.trim() ||
      !comuna.trim()
    ) {
      alert("Completa teléfono, dirección y comuna.");
      return;
    }

    if (!authUserId) {
      alert("No se encontró la sesión del comprador.");
      return;
    }

    try {
      setSaving(true);

      const { error } = await supabase
        .from("perfiles")
        .update({
          telefono_contacto: telefono.trim(),
          direccion: direccion.trim(),
          comuna: comuna.trim().toUpperCase(),
          region: region.trim(),
          nombre_contacto: nombreContacto.trim(),
          referencia_entrega: referenciaEntrega.trim(),
        })
        .eq("auth_id", authUserId)
        .eq("tipo", "comprador");

      if (error) throw error;

      alert("Datos actualizados correctamente.");
      router.push("/comprador");
    } catch (error) {
      console.error(
        "Error guardando datos del comprador:",
        error,
      );
      alert(`Error al guardar: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const irDashboard = () =>
    router.push("/comprador/DashboardComprador");

  const irDatosContacto = () =>
    router.push("/comprador/datos-contacto");

  const cambiarPerfil = () =>
    router.push("/seleccionar-perfil");

  const cerrarSesion = async () => {
    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error("Error al cerrar sesión:", error);
      alert("No se pudo cerrar la sesión.");
      return;
    }

    localStorage.clear();
    router.push("/login");
  };

  const layoutProps = {
    title: "Actualizar datos",
    profileLabel: "Comprador",
    showProfileSwitch: true,
    onChangeProfile: cambiarPerfil,
    onUpdateData: irDatosContacto,
    onDashboard: irDashboard,
    onLogout: cerrarSesion,
    notifications: perfilId ? (
      <Notificaciones
        userId={perfilId}
        rol="comprador"
      />
    ) : null,
  };

  return (
    <AppLayout {...layoutProps}>
      <main
        className="delivery-page"
        style={styles.main}
      >
        <section
          className="delivery-hero"
          style={styles.hero}
        >
          <div style={styles.heroCopy}>
            <span style={styles.eyebrow}>
              PERFIL COMPRADOR
            </span>

            <h1 style={styles.heading}>
              Datos de entrega
            </h1>

            <p style={styles.heroText}>
              Mantén actualizada la información que usarán
              los proveedores para coordinar la entrega de
              tus compras.
            </p>
          </div>

          <div
            style={styles.heroIcon}
            aria-hidden="true"
          >
            <Truck size={31} />
          </div>
        </section>

        {loading ? (
          <section style={styles.loadingCard}>
            <span
              className="delivery-spinner"
              style={styles.spinner}
            />

            <p style={styles.loadingText}>
              Cargando tus datos...
            </p>
          </section>
        ) : (
          <form
            onSubmit={guardarDatos}
            style={styles.form}
          >
            <section
              className="delivery-card"
              style={styles.card}
            >
              <div style={styles.sectionHeader}>
                <span style={styles.sectionIconBlue}>
                  <UserRound size={21} />
                </span>

                <div>
                  <h2 style={styles.sectionTitle}>
                    Contacto de entrega
                  </h2>

                  <p style={styles.sectionDescription}>
                    Indica con quién debe comunicarse el
                    proveedor.
                  </p>
                </div>
              </div>

              <div
                className="delivery-grid"
                style={styles.twoColumnGrid}
              >
                <div style={styles.formGroup}>
                  <label
                    htmlFor="nombre-contacto"
                    style={styles.label}
                  >
                    Nombre de contacto
                  </label>

                  <input
                    id="nombre-contacto"
                    value={nombreContacto}
                    onChange={(event) =>
                      setNombreContacto(event.target.value)
                    }
                    placeholder="Ej: Miranda Naranjo"
                    style={styles.input}
                  />
                </div>

                <div style={styles.formGroup}>
                  <label
                    htmlFor="telefono"
                    style={styles.label}
                  >
                    Teléfono
                  </label>

                  <input
                    id="telefono"
                    type="tel"
                    value={telefono}
                    onChange={(event) =>
                      setTelefono(event.target.value)
                    }
                    placeholder="Ej: +569XXXXXXXX"
                    style={styles.input}
                    required
                  />
                </div>
              </div>
            </section>

            <section
              className="delivery-card"
              style={styles.card}
            >
              <div style={styles.sectionHeader}>
                <span style={styles.sectionIconGreen}>
                  <MapPin size={21} />
                </span>

                <div>
                  <h2 style={styles.sectionTitle}>
                    Dirección de entrega
                  </h2>

                  <p style={styles.sectionDescription}>
                    Esta ubicación se usará para coordinar
                    el despacho.
                  </p>
                </div>
              </div>

              <div
                className="delivery-grid"
                style={styles.twoColumnGrid}
              >
                <div
                  className="full-field"
                  style={styles.fullField}
                >
                  <label
                    htmlFor="direccion"
                    style={styles.label}
                  >
                    Dirección
                  </label>

                  <input
                    id="direccion"
                    value={direccion}
                    onChange={(event) =>
                      setDireccion(event.target.value)
                    }
                    placeholder="Ej: Av. Siempre Viva 123"
                    style={styles.input}
                    required
                  />
                </div>

                <div style={styles.comunaWrapper}>
                  <label
                    htmlFor="comuna"
                    style={styles.label}
                  >
                    Comuna
                  </label>

                  <input
                    id="comuna"
                    value={comuna}
                    onChange={(event) => {
                      setComuna(event.target.value);
                      setMostrarComunas(true);
                    }}
                    onFocus={() =>
                      setMostrarComunas(true)
                    }
                    onBlur={() => {
                      window.setTimeout(
                        () => setMostrarComunas(false),
                        150,
                      );
                    }}
                    placeholder="Escribe tu comuna"
                    style={styles.input}
                    autoComplete="off"
                    required
                  />

                  {mostrarComunas && comuna.trim() && (
                    <div style={styles.comunasDropdown}>
                      {comunasFiltradas
                        .slice(0, 8)
                        .map((item) => (
                          <button
                            key={item}
                            type="button"
                            style={styles.comunaItem}
                            onMouseDown={(event) =>
                              event.preventDefault()
                            }
                            onClick={() => {
                              setComuna(item);
                              setMostrarComunas(false);
                            }}
                          >
                            {item}
                          </button>
                        ))}

                      {comunasFiltradas.length === 0 && (
                        <div style={styles.comunaEmpty}>
                          No se encontraron comunas
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div style={styles.formGroup}>
                  <label
                    htmlFor="region"
                    style={styles.label}
                  >
                    Región
                  </label>

                  <select
                    id="region"
                    value={region}
                    onChange={(event) =>
                      setRegion(event.target.value)
                    }
                    style={styles.input}
                  >
                    <option value="">
                      Selecciona una región
                    </option>

                    {regionesChile.map((item) => (
                      <option
                        key={item}
                        value={item}
                      >
                        {item}
                      </option>
                    ))}
                  </select>
                </div>

                <div
                  className="full-field"
                  style={styles.fullField}
                >
                  <label
                    htmlFor="referencia-entrega"
                    style={styles.label}
                  >
                    Referencia de entrega
                  </label>

                  <textarea
                    id="referencia-entrega"
                    value={referenciaEntrega}
                    onChange={(event) =>
                      setReferenciaEntrega(
                        event.target.value,
                      )
                    }
                    placeholder="Ej: Dejar en conserjería, local 302, casa azul..."
                    style={styles.textArea}
                  />

                  <small style={styles.helpText}>
                    Agrega información que facilite
                    encontrar el lugar.
                  </small>
                </div>
              </div>
            </section>

            <div
              className="delivery-actions"
              style={styles.actionRow}
            >
              <button
                type="button"
                onClick={() =>
                  router.push("/comprador")
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
      </main>

      <style jsx>{`
        .delivery-spinner {
          animation: delivery-spin 0.8s linear infinite;
        }

        @keyframes delivery-spin {
          to {
            transform: rotate(360deg);
          }
        }

        input:focus,
        select:focus,
        textarea:focus {
          border-color: #176bff !important;
          box-shadow: 0 0 0 4px
            rgba(23, 107, 255, 0.1) !important;
          background: #ffffff !important;
        }

        button {
          transition:
            transform 0.2s ease,
            box-shadow 0.2s ease,
            background 0.2s ease;
        }

        button:not(:disabled):hover {
          transform: translateY(-1px);
        }

        @media (max-width: 760px) {
          .delivery-page {
            padding: 0 0 24px !important;
          }

          .delivery-hero {
            align-items: flex-start !important;
            padding: 22px !important;
          }

          .delivery-card {
            padding: 22px !important;
          }

          .delivery-grid {
            grid-template-columns: 1fr !important;
          }

          .full-field {
            grid-column: auto !important;
          }
        }

        @media (max-width: 520px) {
          .delivery-hero {
            padding: 20px 18px !important;
            border-radius: 18px !important;
          }

          .delivery-hero > div:last-child {
            display: none !important;
          }

          .delivery-card {
            padding: 19px 16px !important;
            border-radius: 18px !important;
          }

          .delivery-actions {
            flex-direction: column-reverse !important;
          }

          .delivery-actions button {
            width: 100% !important;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .delivery-spinner {
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

  twoColumnGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(2, minmax(0, 1fr))",
    gap: "20px",
  },

  fullField: {
    gridColumn: "1 / -1",
    minWidth: 0,
  },

  formGroup: {
    minWidth: 0,
  },

  comunaWrapper: {
    position: "relative",
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

  textArea: {
    width: "100%",
    minHeight: "112px",
    resize: "vertical",
    padding: "13px 14px",
    boxSizing: "border-box",
    border: "1px solid #ccd9e8",
    borderRadius: "12px",
    outline: "none",
    background: "#f9fbfe",
    color: "#183354",
    fontFamily: "inherit",
    fontSize: "14px",
    lineHeight: 1.5,
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

  comunasDropdown: {
    position: "absolute",
    top: "calc(100% + 7px)",
    right: 0,
    left: 0,
    zIndex: 30,
    maxHeight: "260px",
    overflowY: "auto",
    padding: "7px",
    border: "1px solid #d5e1ef",
    borderRadius: "13px",
    background: "#ffffff",
    boxShadow:
      "0 18px 42px rgba(32, 73, 130, 0.16)",
  },

  comunaItem: {
    width: "100%",
    minHeight: "40px",
    display: "flex",
    alignItems: "center",
    padding: "9px 11px",
    border: 0,
    borderRadius: "9px",
    background: "transparent",
    color: "#315173",
    cursor: "pointer",
    fontSize: "13px",
    fontWeight: 700,
    textAlign: "left",
  },

  comunaEmpty: {
    padding: "14px 11px",
    color: "#8493a7",
    fontSize: "12px",
    textAlign: "center",
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