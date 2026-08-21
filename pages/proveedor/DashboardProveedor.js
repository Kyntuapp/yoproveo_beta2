import { showKyntuAlert } from '../../lib/kyntuAlert';
import {
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/router";
import { supabase } from "../../lib/supabaseClient";
import AppLayout from "../../components/Layout/AppLayout";
import Notificaciones from "../../components/Notificaciones";
import SoporteLauncher from "../../components/soporte/SoporteLauncher";

const normalizarEstado = (estado = "") =>
  estado
    .toString()
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");

const formatearMonto = (valor) =>
  new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(Number(valor || 0));

const mostrarEstado = (estado = "") => {
  const estados = {
    pendiente: "Oferta enviada",
    en_espera_confirmacion:
      "Oferta aceptada",
    pendiente_pago:
      "Pendiente de pago",
    pago_recibido: "Pago recibido",
    recepcion_conforme:
      "Recepción confirmada",
    pagada: "Pagada",
    rechazada: "Rechazada",
    cancelada: "Cancelada",
  };

  return (
    estados[normalizarEstado(estado)] ||
    estado ||
    "Sin estado"
  );
};

const esOfertaAceptada = (estado) =>
  [
    "en_espera_confirmacion",
    "pendiente_pago",
    "pago_recibido",
    "recepcion_conforme",
    "pagada",
  ].includes(normalizarEstado(estado));

const esVentaConfirmada = (estado) =>
  [
    "pago_recibido",
    "recepcion_conforme",
    "pagada",
  ].includes(normalizarEstado(estado));

export default function DashboardProveedor() {
  const router = useRouter();

  const [loading, setLoading] =
    useState(true);
  const [error, setError] = useState("");
  const [ofertas, setOfertas] =
    useState([]);
  const [
    calificaciones,
    setCalificaciones,
  ] = useState([]);
  const [perfilId, setPerfilId] =
    useState(null);

  useEffect(() => {
    cargarEstadisticas();
  }, []);

  const cargarEstadisticas =
    async () => {
      try {
        setLoading(true);
        setError("");

        const {
          data: { user },
          error: userError,
        } =
          await supabase.auth.getUser();

        if (userError || !user) {
          router.push("/login");
          return;
        }

        let {
          data: perfil,
          error: perfilError,
        } = await supabase
          .from("perfiles")
          .select(
            "id, auth_id, email, tipo",
          )
          .eq("auth_id", user.id)
          .eq("tipo", "proveedor")
          .maybeSingle();

        if (perfilError) {
          console.error(
            "Error buscando perfil por auth_id:",
            perfilError,
          );
        }

        if (!perfil && user.email) {
          const {
            data: perfilPorEmail,
            error: perfilEmailError,
          } = await supabase
            .from("perfiles")
            .select(
              "id, auth_id, email, tipo",
            )
            .eq("email", user.email)
            .eq("tipo", "proveedor")
            .maybeSingle();

          if (perfilEmailError) {
            console.error(
              "Error buscando perfil por correo:",
              perfilEmailError,
            );
          }

          perfil = perfilPorEmail;
        }

        if (!perfil) {
          throw new Error(
            "No se encontró el perfil del proveedor.",
          );
        }

        setPerfilId(perfil.id);

        const [
          {
            data: ofertasData,
            error: ofertasError,
          },
          {
            data: calificacionesData,
            error:
              calificacionesError,
          },
        ] = await Promise.all([
          supabase
            .from(
              "ofertas_productos",
            )
            .select("*")
            .eq(
              "proveedor_id",
              perfil.id,
            ),

          supabase
            .from(
              "calificaciones_proveedor",
            )
            .select("*")
            .eq(
              "proveedor_id",
              perfil.id,
            ),
        ]);

        if (ofertasError) {
          throw ofertasError;
        }

        if (calificacionesError) {
          console.error(
            "Error cargando calificaciones:",
            calificacionesError,
          );
        }

        const ofertasBase = ofertasData || [];
        const listaIds = [
          ...new Set(
            ofertasBase
              .map((oferta) => oferta.lista_id)
              .filter(Boolean),
          ),
        ];

        let fechaPorLista = new Map();

        if (listaIds.length > 0) {
          const { data: listasData, error: listasError } = await supabase
            .from("listas_compras")
            .select("id, fecha_creacion")
            .in("id", listaIds);

          if (listasError) {
            throw listasError;
          }

          fechaPorLista = new Map(
            (listasData || []).map((lista) => [
              lista.id,
              lista.fecha_creacion || null,
            ]),
          );
        }

        const ofertasOrdenadas = ofertasBase
          .map((oferta) => ({
            ...oferta,
            created_at: fechaPorLista.get(oferta.lista_id) || null,
          }))
          .sort(
            (a, b) =>
              new Date(b.created_at || 0).getTime() -
              new Date(a.created_at || 0).getTime(),
          );

        setOfertas(ofertasOrdenadas);

        setCalificaciones(
          calificacionesData || [],
        );
      } catch (err) {
        console.error(
          "Error cargando estadísticas del proveedor:",
          err,
        );

        setError(
          err?.message ||
            "No se pudieron cargar las estadísticas del proveedor.",
        );
      } finally {
        setLoading(false);
      }
    };

  const estadisticas = useMemo(() => {
    const ofertasAceptadas =
      ofertas.filter((oferta) =>
        esOfertaAceptada(
          oferta.estado,
        ),
      );

    const ventasConfirmadas =
      ofertas.filter((oferta) =>
        esVentaConfirmada(
          oferta.estado,
        ),
      );

    const ingresosGenerados =
      ventasConfirmadas.reduce(
        (total, oferta) =>
          total +
          Number(
            oferta.precio_ofertado ||
              0,
          ),
        0,
      );

    const estrellasValidas =
      calificaciones
        .map((calificacion) =>
          Number(
            calificacion.estrellas,
          ),
        )
        .filter(
          (estrellas) =>
            Number.isFinite(
              estrellas,
            ) && estrellas > 0,
        );

    const promedioCalificacion =
      estrellasValidas.length > 0
        ? estrellasValidas.reduce(
            (total, estrellas) =>
              total + estrellas,
            0,
          ) /
          estrellasValidas.length
        : 0;

    const conversion =
      ofertas.length > 0
        ? Math.round(
            (ofertasAceptadas.length /
              ofertas.length) *
              100,
          )
        : 0;

    return {
      ofertasEnviadas:
        ofertas.length,
      ofertasAceptadas:
        ofertasAceptadas.length,
      ventasConfirmadas:
        ventasConfirmadas.length,
      ingresosGenerados,
      promedioCalificacion,
      totalCalificaciones:
        estrellasValidas.length,
      conversion,
    };
  }, [ofertas, calificaciones]);

  const actividadMensual =
    useMemo(() => {
      const meses = Array.from(
        { length: 6 },
        (_, index) => {
          const fecha = new Date();

          fecha.setDate(1);
          fecha.setMonth(
            fecha.getMonth() -
              (5 - index),
          );

          return {
            key: `${fecha.getFullYear()}-${fecha.getMonth()}`,
            nombre: fecha
              .toLocaleDateString(
                "es-CL",
                {
                  month: "short",
                },
              )
              .replace(".", "")
              .toUpperCase(),
            enviadas: 0,
            aceptadas: 0,
          };
        },
      );

      ofertas.forEach((oferta) => {
        const fechaValor =
          oferta.created_at ||
          oferta.fecha_creacion;

        if (!fechaValor) return;

        const fecha = new Date(
          fechaValor,
        );

        if (
          Number.isNaN(
            fecha.getTime(),
          )
        ) {
          return;
        }

        const key = `${fecha.getFullYear()}-${fecha.getMonth()}`;

        const mes = meses.find(
          (item) => item.key === key,
        );

        if (!mes) return;

        mes.enviadas += 1;

        if (
          esOfertaAceptada(
            oferta.estado,
          )
        ) {
          mes.aceptadas += 1;
        }
      });

      return meses;
    }, [ofertas]);

  const maxActividad = Math.max(
    ...actividadMensual.map((mes) =>
      Math.max(
        mes.enviadas,
        mes.aceptadas,
      ),
    ),
    1,
  );

  const ofertasRecientes =
    ofertas.slice(0, 5);

  const cerrarSesion = async () => {
    const { error: logoutError } =
      await supabase.auth.signOut();

    if (logoutError) {
      console.error(
        "Error al cerrar sesión:",
        logoutError,
      );

      showKyntuAlert(
        "No se pudo cerrar la sesión.",
      );
      return;
    }

    localStorage.clear();
    router.push("/login");
  };

  const irDashboard = () => {
    router.push(
      "/proveedor/DashboardProveedor",
    );
  };

  const irDatosContacto = () => {
    router.push(
      "/proveedor/datos-contacto",
    );
  };

  const cambiarPerfil = () => {
    router.push(
      "/seleccionar-perfil",
    );
  };

  const layoutProps = {
    title: "Mis estadísticas",
    profileLabel: "Proveedor",
    showProfileSwitch: true,
    onChangeProfile: cambiarPerfil,
    onUpdateData: irDatosContacto,
    onDashboard: irDashboard,
    onLogout: cerrarSesion,
    notifications: perfilId ? (
      <Notificaciones
        userId={perfilId}
        rol="proveedor"
      />
    ) : null,
    support: perfilId ? (
      <SoporteLauncher perfilId={perfilId} rol="proveedor" />
    ) : null,
  };

  if (loading) {
    return (
      <AppLayout {...layoutProps}>
        <div className="loading-card">
          <div className="loading-circle" />

          <span>
            Cargando estadísticas...
          </span>
        </div>

        <DashboardStyles />
      </AppLayout>
    );
  }

  return (
    <AppLayout {...layoutProps}>
      <main className="provider-dashboard">
        {error && (
          <div className="error-box">
            <KyntuIcon
              name="alert"
              color="#e26720"
              size={21}
            />

            <span>{error}</span>
          </div>
        )}

        <section className="summary-grid">
          <StatCard
            icon="ofertas"
            tone="blue"
            label="Ofertas enviadas"
            value={
              estadisticas.ofertasEnviadas
            }
            detail="Todas tus propuestas"
          />

          <StatCard
            icon="aceptadas"
            tone="green"
            label="Ofertas aceptadas"
            value={
              estadisticas.ofertasAceptadas
            }
            detail={`${estadisticas.conversion}% de conversión`}
          />

          <StatCard
            icon="ventas"
            tone="orange"
            label="Ventas confirmadas"
            value={
              estadisticas.ventasConfirmadas
            }
            detail="Pagadas o recibidas"
          />

          <StatCard
            icon="ingresos"
            tone="navy"
            label="Ingresos generados"
            value={formatearMonto(
              estadisticas.ingresosGenerados,
            )}
            detail={
              estadisticas.promedioCalificacion >
              0
                ? `${estadisticas.promedioCalificacion.toFixed(
                    1,
                  )} de 5 en calificaciones`
                : "Todavía sin calificaciones"
            }
          />
        </section>

        <section className="main-grid">
          <article className="dashboard-card">
            <div className="card-header">
              <div>
                <span className="eyebrow">
                  ÚLTIMOS 6 MESES
                </span>

                <h2>
                  Rendimiento de ofertas
                </h2>
              </div>

              <div className="legend">
                <span>
                  <i className="dot blue" />
                  Enviadas
                </span>

                <span>
                  <i className="dot green" />
                  Aceptadas
                </span>
              </div>
            </div>

            <div className="chart">
              {actividadMensual.map(
                (mes) => (
                  <div
                    key={mes.key}
                    className="chart-column"
                  >
                    <div className="chart-track">
                      <div
                        title={`${mes.enviadas} ofertas enviadas`}
                        className="chart-bar sent"
                        style={{
                          height: `${Math.max(
                            (mes.enviadas /
                              maxActividad) *
                              100,
                            4,
                          )}%`,
                        }}
                      />

                      <div
                        title={`${mes.aceptadas} ofertas aceptadas`}
                        className="chart-bar accepted"
                        style={{
                          height: `${Math.max(
                            (mes.aceptadas /
                              maxActividad) *
                              100,
                            4,
                          )}%`,
                        }}
                      />
                    </div>

                    <span className="chart-label">
                      {mes.nombre}
                    </span>
                  </div>
                ),
              )}
            </div>
          </article>

          <article className="dashboard-card">
            <div className="card-header">
              <div>
                <span className="eyebrow">
                  DESEMPEÑO
                </span>

                <h2>
                  Conversión comercial
                </h2>
              </div>
            </div>

            <div
              className="conversion-ring"
              style={{
                background: `conic-gradient(
                  #176bff 0 ${estadisticas.conversion}%,
                  #e9eff7 ${estadisticas.conversion}% 100%
                )`,
              }}
            >
              <div className="ring-inner">
                <strong>
                  {
                    estadisticas.conversion
                  }
                  %
                </strong>

                <span>conversión</span>
              </div>
            </div>

            <div className="mini-summary">
              <MiniCard
                icon="ofertas"
                color="#176bff"
                background="#edf4ff"
                label="Enviadas"
                value={
                  estadisticas.ofertasEnviadas
                }
              />

              <MiniCard
                icon="aceptadas"
                color="#15a978"
                background="#eafbf5"
                label="Aceptadas"
                value={
                  estadisticas.ofertasAceptadas
                }
              />
            </div>

            <div className="rating-box">
              <div className="rating-icon">
                <KyntuIcon
                  name="star"
                  color="#f47a2a"
                  size={23}
                />
              </div>

              <div className="rating-content">
                <span className="rating-label">
                  Calificación promedio
                </span>

                {estadisticas.promedioCalificacion >
                0 ? (
                  <>
                    <div className="stars-row">
                      <div className="stars">
                        {[
                          1, 2, 3, 4, 5,
                        ].map(
                          (estrella) => (
                            <span
                              key={
                                estrella
                              }
                              style={{
                                color:
                                  estrella <=
                                  Math.round(
                                    estadisticas.promedioCalificacion,
                                  )
                                    ? "#f47a2a"
                                    : "#d8e1ec",
                              }}
                            >
                              ★
                            </span>
                          ),
                        )}
                      </div>

                      <strong>
                        {estadisticas.promedioCalificacion.toFixed(
                          1,
                        )}
                      </strong>
                    </div>

                    <small>
                      {
                        estadisticas.totalCalificaciones
                      }{" "}
                      {estadisticas.totalCalificaciones ===
                      1
                        ? "evaluación"
                        : "evaluaciones"}
                    </small>
                  </>
                ) : (
                  <strong className="no-rating">
                    Sin calificaciones
                  </strong>
                )}
              </div>
            </div>

            <button
              type="button"
              className="primary-button"
              onClick={() =>
                router.push(
                  "/proveedor",
                )
              }
            >
              Volver a mis ofertas
            </button>
          </article>
        </section>

        <section className="dashboard-card">
          <div className="card-header">
            <div>
              <span className="eyebrow">
                ACTIVIDAD RECIENTE
              </span>

              <h2>
                Últimas ofertas enviadas
              </h2>
            </div>
          </div>

          {ofertasRecientes.length ===
          0 ? (
            <div className="empty-state">
              <div className="empty-icon">
                <KyntuIcon
                  name="ofertas"
                  color="#176bff"
                  size={30}
                />
              </div>

              <strong>
                Todavía no tienes ofertas
              </strong>

              <p>
                Las ofertas que envíes
                aparecerán en esta sección.
              </p>
            </div>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th>Cantidad</th>
                    <th>Tu oferta</th>
                    <th>Despacho</th>
                    <th>Fecha</th>
                    <th>Estado</th>
                  </tr>
                </thead>

                <tbody>
                  {ofertasRecientes.map(
                    (oferta, index) => (
                      <tr
                        key={
                          oferta.id ||
                          index
                        }
                      >
                        <td>
                          <strong>
                            {oferta.producto ||
                              "Producto"}
                          </strong>
                        </td>

                        <td>
                          {oferta.cantidad ||
                            "—"}
                        </td>

                        <td>
                          {formatearMonto(
                            oferta.precio_ofertado,
                          )}
                        </td>

                        <td>
                          {oferta.incluye_despacho
                            ? "Incluido"
                            : "No incluido"}
                        </td>

                        <td>
                          {oferta.created_at
                            ? new Date(
                                oferta.created_at,
                              ).toLocaleDateString(
                                "es-CL",
                              )
                            : "—"}
                        </td>

                        <td>
                          <span className="status">
                            {mostrarEstado(
                              oferta.estado,
                            )}
                          </span>
                        </td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>

      <DashboardStyles />
    </AppLayout>
  );
}

function StatCard({
  icon,
  label,
  value,
  detail,
  tone = "blue",
}) {
  const tonos = {
    blue: {
      color: "#176bff",
      background: "#edf4ff",
      border: "#d8e6ff",
    },
    green: {
      color: "#15a978",
      background: "#eafbf5",
      border: "#cff4e6",
    },
    orange: {
      color: "#f47a2a",
      background: "#fff3e9",
      border: "#ffe0c7",
    },
    navy: {
      color: "#0a3472",
      background: "#edf3fa",
      border: "#d8e4f2",
    },
  };

  const tono =
    tonos[tone] || tonos.blue;

  return (
    <article className="stat-card">
      <div
        className="stat-icon"
        style={{
          color: tono.color,
          background:
            tono.background,
          borderColor: tono.border,
        }}
      >
        <KyntuIcon
          name={icon}
          color={tono.color}
          size={27}
        />
      </div>

      <div>
        <p>{label}</p>
        <strong>{value}</strong>
        <small>{detail}</small>
      </div>
    </article>
  );
}

function MiniCard({
  icon,
  color,
  background,
  label,
  value,
}) {
  return (
    <div className="mini-card">
      <div
        className="mini-icon"
        style={{ background }}
      >
        <KyntuIcon
          name={icon}
          color={color}
          size={19}
        />
      </div>

      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
    </div>
  );
}

function KyntuIcon({
  name,
  color = "#176bff",
  size = 24,
}) {
  const iconos = {
    alert: (
      <>
        <circle
          cx="12"
          cy="12"
          r="9"
        />
        <path d="M12 8v5" />
        <path d="M12 16h.01" />
      </>
    ),

    ofertas: (
      <>
        <path d="M4 5h16v11H8l-4 4V5Z" />
        <path d="M8 9h8" />
        <path d="M8 12h5" />
      </>
    ),

    aceptadas: (
      <>
        <circle
          cx="12"
          cy="12"
          r="9"
        />
        <path d="m8 12 2.5 2.5L16 9" />
      </>
    ),

    ventas: (
      <>
        <path d="M5 8 12 4l7 4v8l-7 4-7-4V8Z" />
        <path d="m5 8 7 4 7-4" />
        <path d="M12 12v8" />
      </>
    ),

    ingresos: (
      <>
        <circle
          cx="12"
          cy="12"
          r="9"
        />
        <path d="M15 9.5c-.5-1-1.6-1.5-3-1.5-1.7 0-3 1-3 2.2 0 1.4 1.2 2 3 2.3 1.8.3 3 .9 3 2.3 0 1.2-1.3 2.2-3 2.2-1.4 0-2.6-.6-3.2-1.6" />
        <path d="M12 6v2" />
        <path d="M12 17v2" />
      </>
    ),

    star: (
      <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3l-5.6 2.9 1.1-6.2L3 9.6l6.2-.9L12 3Z" />
    ),
  };

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {iconos[name]}
    </svg>
  );
}

function DashboardStyles() {
  return (
    <style jsx global>{`
      .provider-dashboard {
        width: min(
          1180px,
          100%
        );
        margin: 6px auto 46px;
        color: #071b3a;
      }

      .summary-grid {
        display: grid;
        grid-template-columns: repeat(
          4,
          minmax(0, 1fr)
        );
        gap: 18px;
        margin-bottom: 22px;
      }

      .stat-card {
        display: flex;
        align-items: center;
        gap: 17px;
        min-width: 0;
        min-height: 126px;
        padding: 23px;
        box-sizing: border-box;
        border: 1px solid #e4ecf7;
        border-radius: 22px;
        background: #fff;
        box-shadow: 0 16px 42px
          rgba(18, 55, 102, 0.08);
      }

      .stat-icon {
        display: grid;
        place-items: center;
        flex: 0 0 58px;
        width: 58px;
        height: 58px;
        border: 1px solid;
        border-radius: 50%;
      }

      .stat-card > div:last-child {
        min-width: 0;
      }

      .stat-card p {
        margin: 0;
        color: #596980;
        font-size: 13px;
        font-weight: 800;
      }

      .stat-card strong {
        display: block;
        margin-top: 5px;
        color: #071b3a;
        font-size: 29px;
        line-height: 1.1;
        font-weight: 900;
        overflow-wrap: anywhere;
      }

      .stat-card small {
        display: block;
        margin-top: 8px;
        color: #8a96a7;
        font-size: 12px;
      }

      .main-grid {
        display: grid;
        grid-template-columns: repeat(
          2,
          minmax(0, 1fr)
        );
        gap: 22px;
        margin-bottom: 22px;
      }

      .dashboard-card {
        min-width: 0;
        padding: 28px;
        box-sizing: border-box;
        border: 1px solid #e4ecf7;
        border-radius: 24px;
        background: #fff;
        box-shadow: 0 18px 48px
          rgba(18, 55, 102, 0.08);
      }

      .card-header {
        display: flex;
        align-items: flex-start;
        justify-content:
          space-between;
        gap: 18px;
        margin-bottom: 24px;
      }

      .card-header h2 {
        margin: 6px 0 0;
        color: #071b3a;
        font-size: 22px;
        font-weight: 900;
      }

      .eyebrow {
        color: #176bff;
        font-size: 11px;
        font-weight: 900;
        letter-spacing: 1.5px;
      }

      .legend {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
      }

      .legend span {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        color: #65748b;
        font-size: 11px;
        font-weight: 800;
      }

      .dot {
        width: 9px;
        height: 9px;
        border-radius: 50%;
      }

      .dot.blue {
        background: #176bff;
      }

      .dot.green {
        background: #15a978;
      }

      .chart {
        display: flex;
        align-items: flex-end;
        justify-content:
          space-between;
        gap: 14px;
        height: 250px;
        padding-top: 15px;
      }

      .chart-column {
        display: flex;
        flex: 1;
        height: 100%;
        min-width: 0;
        flex-direction: column;
        align-items: center;
      }

      .chart-track {
        display: flex;
        flex: 1;
        width: min(62px, 80%);
        align-items: flex-end;
        justify-content: center;
        gap: 5px;
        padding: 0 6px;
        border-radius: 16px;
        background: #eef3f9;
        overflow: hidden;
      }

      .chart-bar {
        width: 42%;
        min-height: 4px;
        border-radius:
          12px 12px 4px 4px;
      }

      .chart-bar.sent {
        background: linear-gradient(
          180deg,
          #4b91ff,
          #176bff
        );
      }

      .chart-bar.accepted {
        background: linear-gradient(
          180deg,
          #42d7aa,
          #15a978
        );
      }

      .chart-label {
        margin-top: 10px;
        color: #748299;
        font-size: 11px;
        font-weight: 800;
      }

      .conversion-ring {
        display: grid;
        place-items: center;
        width: 178px;
        height: 178px;
        margin: 5px auto 24px;
        border-radius: 50%;
      }

      .ring-inner {
        display: flex;
        width: 132px;
        height: 132px;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        background: #fff;
        box-shadow: inset 0 0 0 1px
          #edf1f6;
      }

      .ring-inner strong {
        color: #071b3a;
        font-size: 34px;
        font-weight: 900;
      }

      .ring-inner span {
        margin-top: 3px;
        color: #748299;
        font-size: 12px;
      }

      .mini-summary {
        display: grid;
        grid-template-columns: repeat(
          2,
          minmax(0, 1fr)
        );
        gap: 12px;
        margin-bottom: 14px;
      }

      .mini-card {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 13px;
        border: 1px solid #e7edf6;
        border-radius: 15px;
        background: #fbfcfe;
      }

      .mini-icon {
        display: grid;
        place-items: center;
        flex: 0 0 39px;
        width: 39px;
        height: 39px;
        border-radius: 50%;
      }

      .mini-card span {
        display: block;
        color: #748299;
        font-size: 11px;
        font-weight: 700;
      }

      .mini-card strong {
        display: block;
        margin-top: 2px;
        color: #071b3a;
        font-size: 18px;
      }

      .rating-box {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 14px;
        padding: 14px;
        border: 1px solid #ffe0c7;
        border-radius: 16px;
        background: #fff9f4;
      }

      .rating-icon {
        display: grid;
        place-items: center;
        flex: 0 0 44px;
        width: 44px;
        height: 44px;
        border-radius: 50%;
        background: #fff0e5;
      }

      .rating-content {
        min-width: 0;
        flex: 1;
      }

      .rating-label {
        display: block;
        color: #7b685a;
        font-size: 11px;
        font-weight: 700;
      }

      .stars-row {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-top: 5px;
      }

      .stars {
        display: flex;
        gap: 2px;
      }

      .stars span {
        font-size: 21px;
        line-height: 1;
      }

      .stars-row strong {
        color: #071b3a;
        font-size: 18px;
        font-weight: 900;
      }

      .rating-content small {
        display: block;
        margin-top: 3px;
        color: #a48a78;
      }

      .no-rating {
        display: block;
        margin-top: 3px;
        color: #a64b15;
        font-size: 16px;
      }

      .primary-button {
        width: 100%;
        margin-top: 10px;
        padding: 14px 18px;
        border: 0;
        border-radius: 14px;
        background: linear-gradient(
          135deg,
          #176bff,
          #0a55d9
        );
        color: #fff;
        font-weight: 900;
        cursor: pointer;
        box-shadow: 0 12px 26px
          rgba(23, 107, 255, 0.24);
      }

      .error-box {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 18px;
        padding: 14px 16px;
        border: 1px solid #ffd8c2;
        border-radius: 14px;
        background: #fff8f3;
        color: #b85018;
        font-size: 13px;
      }

      .table-wrapper {
        width: 100%;
        overflow-x: auto;
        -webkit-overflow-scrolling:
          touch;
      }

      .table-wrapper table {
        width: 100%;
        min-width: 820px;
        border-collapse: collapse;
      }

      .table-wrapper th {
        padding: 12px 14px;
        border-bottom: 1px solid
          #e4ecf7;
        color: #748299;
        font-size: 11px;
        text-align: left;
        text-transform: uppercase;
        letter-spacing: 0.8px;
      }

      .table-wrapper td {
        padding: 16px 14px;
        border-bottom: 1px solid
          #edf1f6;
        color: #53647b;
        font-size: 13px;
      }

      .table-wrapper td strong {
        color: #071b3a;
      }

      .status {
        display: inline-block;
        padding: 7px 11px;
        border: 1px solid #cfe1ff;
        border-radius: 999px;
        background: #edf4ff;
        color: #176bff;
        font-size: 11px;
        font-weight: 900;
      }

      .empty-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 42px 20px;
        border: 1px dashed #d9e4f3;
        border-radius: 18px;
        background: #fafcff;
        text-align: center;
      }

      .empty-icon {
        display: grid;
        place-items: center;
        width: 62px;
        height: 62px;
        margin-bottom: 13px;
        border-radius: 50%;
        background: #edf4ff;
      }

      .empty-state strong {
        color: #071b3a;
        font-size: 16px;
      }

      .empty-state p {
        margin: 7px 0 0;
        color: #7a879a;
        font-size: 13px;
      }

      .loading-card {
        display: flex;
        align-items: center;
        gap: 12px;
        width: fit-content;
        margin: 18vh auto;
        padding: 20px 28px;
        border: 1px solid #e4ecf7;
        border-radius: 18px;
        background: #fff;
        box-shadow: 0 16px 45px
          rgba(18, 55, 102, 0.1);
        color: #0a3472;
        font-weight: 800;
      }

      .loading-circle {
        width: 18px;
        height: 18px;
        border: 3px solid #d8e6ff;
        border-top-color: #176bff;
        border-radius: 50%;
      }

      @media (max-width: 1000px) {
        .summary-grid {
          grid-template-columns: repeat(
            2,
            minmax(0, 1fr)
          );
        }

        .main-grid {
          grid-template-columns: 1fr;
        }
      }

      @media (max-width: 620px) {
        .provider-dashboard {
          width: 100%;
          margin: 0 auto 32px;
        }

        .summary-grid {
          grid-template-columns: 1fr;
          gap: 14px;
        }

        .main-grid {
          gap: 16px;
          margin-bottom: 16px;
        }

        .stat-card {
          min-height: 112px;
          padding: 18px;
          border-radius: 18px;
        }

        .stat-card strong {
          font-size: 25px;
        }

        .dashboard-card {
          padding: 18px;
          border-radius: 18px;
        }

        .card-header {
          flex-direction: column;
          align-items: flex-start;
          gap: 10px;
          margin-bottom: 18px;
        }

        .card-header h2 {
          font-size: 19px;
        }

        .chart {
          height: 210px;
          gap: 6px;
        }

        .chart-track {
          width: 88%;
          gap: 3px;
          padding: 0 3px;
        }

        .mini-summary {
          grid-template-columns: 1fr;
        }

        .table-wrapper {
          margin: 0 -4px;
          padding-bottom: 6px;
        }
      }

      @media (max-width: 380px) {
        .dashboard-card {
          padding: 15px;
        }

        .stat-card {
          padding: 15px;
        }

        .stat-icon {
          flex-basis: 50px;
          width: 50px;
          height: 50px;
        }

        .chart {
          height: 185px;
          gap: 3px;
        }

        .conversion-ring {
          width: 156px;
          height: 156px;
        }

        .ring-inner {
          width: 116px;
          height: 116px;
        }
      }
    `}</style>
  );
}
