import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "../../lib/supabaseClient";

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
    en_espera_confirmacion: "Oferta aceptada",
    pendiente_pago: "Pendiente de pago",
    pago_recibido: "Pago recibido",
    recepcion_conforme: "Recepción confirmada",
    pagada: "Pagada",
    rechazada: "Rechazada",
    cancelada: "Cancelada",
  };

  return estados[normalizarEstado(estado)] || estado || "Sin estado";
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

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [ofertas, setOfertas] = useState([]);
  const [calificaciones, setCalificaciones] =
    useState([]);

  useEffect(() => {
    cargarEstadisticas();
  }, []);

  const cargarEstadisticas = async () => {
    try {
      setLoading(true);
      setError("");

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        router.push("/login");
        return;
      }

      let { data: perfil, error: perfilError } =
        await supabase
          .from("perfiles")
          .select("id, auth_id, email, tipo")
          .eq("auth_id", user.id)
          .eq("tipo", "proveedor")
          .maybeSingle();

      if (perfilError) {
        console.error(
          "Error buscando perfil por auth_id:",
          perfilError
        );
      }

      if (!perfil && user.email) {
        const {
          data: perfilPorEmail,
          error: perfilEmailError,
        } = await supabase
          .from("perfiles")
          .select("id, auth_id, email, tipo")
          .eq("email", user.email)
          .eq("tipo", "proveedor")
          .maybeSingle();

        if (perfilEmailError) {
          console.error(
            "Error buscando perfil por correo:",
            perfilEmailError
          );
        }

        perfil = perfilPorEmail;
      }

      if (!perfil) {
        throw new Error(
          "No se encontró el perfil del proveedor."
        );
      }

      const [
        { data: ofertasData, error: ofertasError },
        {
          data: calificacionesData,
          error: calificacionesError,
        },
      ] = await Promise.all([
        supabase
          .from("ofertas_productos")
          .select("*")
          .eq("proveedor_id", perfil.id)
          .order("created_at", {
            ascending: false,
          }),

        supabase
          .from("calificaciones_proveedor")
          .select("*")
          .eq("proveedor_id", perfil.id)
          .order("created_at", {
            ascending: false,
          }),
      ]);

      if (ofertasError) {
        throw ofertasError;
      }

      if (calificacionesError) {
        console.error(
          "Error cargando calificaciones:",
          calificacionesError
        );
      }

      setOfertas(ofertasData || []);
      setCalificaciones(calificacionesData || []);
    } catch (err) {
      console.error(
        "Error cargando estadísticas del proveedor:",
        err
      );

      setError(
        err?.message ||
          "No se pudieron cargar las estadísticas del proveedor."
      );
    } finally {
      setLoading(false);
    }
  };

  const estadisticas = useMemo(() => {
    const ofertasAceptadas = ofertas.filter((oferta) =>
      esOfertaAceptada(oferta.estado)
    );

    const ventasConfirmadas = ofertas.filter((oferta) =>
      esVentaConfirmada(oferta.estado)
    );

    const ingresosGenerados = ventasConfirmadas.reduce(
      (total, oferta) =>
        total + Number(oferta.precio_ofertado || 0),
      0
    );

    const estrellasValidas = calificaciones
      .map((calificacion) =>
        Number(calificacion.estrellas)
      )
      .filter(
        (estrellas) =>
          Number.isFinite(estrellas) && estrellas > 0
      );

    const promedioCalificacion =
      estrellasValidas.length > 0
        ? estrellasValidas.reduce(
            (total, estrellas) =>
              total + estrellas,
            0
          ) / estrellasValidas.length
        : 0;

    const conversion =
      ofertas.length > 0
        ? Math.round(
            (ofertasAceptadas.length / ofertas.length) *
              100
          )
        : 0;

    return {
      ofertasEnviadas: ofertas.length,
      ofertasAceptadas: ofertasAceptadas.length,
      ventasConfirmadas: ventasConfirmadas.length,
      ingresosGenerados,
      promedioCalificacion,
      totalCalificaciones: estrellasValidas.length,
      conversion,
    };
  }, [ofertas, calificaciones]);

  const actividadMensual = useMemo(() => {
    const meses = Array.from({ length: 6 }, (_, index) => {
      const fecha = new Date();

      fecha.setDate(1);
      fecha.setMonth(fecha.getMonth() - (5 - index));

      return {
        key: `${fecha.getFullYear()}-${fecha.getMonth()}`,
        nombre: fecha
          .toLocaleDateString("es-CL", {
            month: "short",
          })
          .replace(".", "")
          .toUpperCase(),
        enviadas: 0,
        aceptadas: 0,
      };
    });

    ofertas.forEach((oferta) => {
      const fechaValor =
        oferta.created_at || oferta.fecha_creacion;

      if (!fechaValor) return;

      const fecha = new Date(fechaValor);

      if (Number.isNaN(fecha.getTime())) return;

      const key = `${fecha.getFullYear()}-${fecha.getMonth()}`;
      const mes = meses.find((item) => item.key === key);

      if (!mes) return;

      mes.enviadas += 1;

      if (esOfertaAceptada(oferta.estado)) {
        mes.aceptadas += 1;
      }
    });

    return meses;
  }, [ofertas]);

  const maxActividad = Math.max(
    ...actividadMensual.map((mes) =>
      Math.max(mes.enviadas, mes.aceptadas)
    ),
    1
  );

  const ofertasRecientes = ofertas.slice(0, 5);

  const cerrarSesion = async () => {
    await supabase.auth.signOut();
    localStorage.clear();
    router.push("/login");
  };

  if (loading) {
    return (
      <div style={styles.page}>
        <div style={styles.backgroundGlow} />

        <div style={styles.loadingCard}>
          <div style={styles.loadingCircle} />

          <span>Cargando estadísticas...</span>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.backgroundGlow} />

      <img
        src="/yoproveo_logo_mvp.png"
        alt=""
        style={styles.watermark}
      />

      <header style={styles.topBar}>
        <div style={styles.headerSide}>
          <button
            type="button"
            onClick={() => router.push("/proveedor")}
            style={styles.secondaryButton}
          >
            <KyntuIcon
              name="arrowLeft"
              color="#0A3472"
              size={18}
            />

            Volver al panel
          </button>
        </div>

        <div style={styles.headerCenter}>
          <span style={styles.eyebrow}>
            PANEL PROVEEDOR
          </span>

          <h1 style={styles.title}>
            Mis estadísticas
          </h1>

          <p style={styles.headerSubtitle}>
            Revisa tus ofertas, ventas y desempeño comercial.
          </p>
        </div>

        <div
          style={{
            ...styles.headerSide,
            ...styles.headerSideRight,
          }}
        >
          <button
            type="button"
            onClick={cerrarSesion}
            style={styles.logoutButton}
          >
            Cerrar sesión
          </button>
        </div>
      </header>

      <main style={styles.content}>
        {error && (
          <div style={styles.errorBox}>
            <KyntuIcon
              name="alert"
              color="#E26720"
              size={21}
            />

            <span>{error}</span>
          </div>
        )}

        <section style={styles.summaryGrid}>
          <StatCard
            icon="ofertas"
            tone="blue"
            label="Ofertas enviadas"
            value={estadisticas.ofertasEnviadas}
            detail="Todas tus propuestas"
          />

          <StatCard
            icon="aceptadas"
            tone="green"
            label="Ofertas aceptadas"
            value={estadisticas.ofertasAceptadas}
            detail={`${estadisticas.conversion}% de conversión`}
          />

          <StatCard
            icon="ventas"
            tone="orange"
            label="Ventas confirmadas"
            value={estadisticas.ventasConfirmadas}
            detail="Pagadas o recibidas"
          />

          <StatCard
            icon="ingresos"
            tone="navy"
            label="Ingresos generados"
            value={formatearMonto(
              estadisticas.ingresosGenerados
            )}
            detail={
              estadisticas.promedioCalificacion > 0
                ? `${estadisticas.promedioCalificacion.toFixed(
                    1
                  )} de 5 en calificaciones`
                : "Todavía sin calificaciones"
            }
          />
        </section>

        <section style={styles.dashboardGrid}>
          <article style={styles.card}>
            <div style={styles.cardHeader}>
              <div>
                <span style={styles.cardEyebrow}>
                  ÚLTIMOS 6 MESES
                </span>

                <h2 style={styles.cardTitle}>
                  Rendimiento de ofertas
                </h2>
              </div>

              <div style={styles.legend}>
                <span style={styles.legendItem}>
                  <i
                    style={{
                      ...styles.legendDot,
                      background: "#176BFF",
                    }}
                  />

                  Enviadas
                </span>

                <span style={styles.legendItem}>
                  <i
                    style={{
                      ...styles.legendDot,
                      background: "#15A978",
                    }}
                  />

                  Aceptadas
                </span>
              </div>
            </div>

            <div style={styles.chart}>
              {actividadMensual.map((mes) => (
                <div
                  key={mes.key}
                  style={styles.chartColumn}
                >
                  <div style={styles.chartTrack}>
                    <div
                      title={`${mes.enviadas} ofertas enviadas`}
                      style={{
                        ...styles.chartBar,
                        background:
                          "linear-gradient(180deg, #4B91FF, #176BFF)",
                        height: `${Math.max(
                          (mes.enviadas /
                            maxActividad) *
                            100,
                          4
                        )}%`,
                      }}
                    />

                    <div
                      title={`${mes.aceptadas} ofertas aceptadas`}
                      style={{
                        ...styles.chartBar,
                        background:
                          "linear-gradient(180deg, #42D7AA, #15A978)",
                        height: `${Math.max(
                          (mes.aceptadas /
                            maxActividad) *
                            100,
                          4
                        )}%`,
                      }}
                    />
                  </div>

                  <span style={styles.chartLabel}>
                    {mes.nombre}
                  </span>
                </div>
              ))}
            </div>
          </article>

          <article style={styles.card}>
            <div style={styles.cardHeader}>
              <div>
                <span style={styles.cardEyebrow}>
                  DESEMPEÑO
                </span>

                <h2 style={styles.cardTitle}>
                  Conversión comercial
                </h2>
              </div>
            </div>

            <div
              style={{
                ...styles.ring,
                background: `conic-gradient(
                  #176BFF 0 ${estadisticas.conversion}%,
                  #E9EFF7 ${estadisticas.conversion}% 100%
                )`,
              }}
            >
              <div style={styles.ringInner}>
                <strong style={styles.ringValue}>
                  {estadisticas.conversion}%
                </strong>

                <span style={styles.ringLabel}>
                  conversión
                </span>
              </div>
            </div>

            <div style={styles.miniSummary}>
              <div style={styles.miniSummaryItem}>
                <div
                  style={{
                    ...styles.miniIcon,
                    background: "#EDF4FF",
                  }}
                >
                  <KyntuIcon
                    name="ofertas"
                    color="#176BFF"
                    size={19}
                  />
                </div>

                <div>
                  <span style={styles.miniLabel}>
                    Enviadas
                  </span>

                  <strong style={styles.miniValue}>
                    {estadisticas.ofertasEnviadas}
                  </strong>
                </div>
              </div>

              <div style={styles.miniSummaryItem}>
                <div
                  style={{
                    ...styles.miniIcon,
                    background: "#EAFBF5",
                  }}
                >
                  <KyntuIcon
                    name="aceptadas"
                    color="#15A978"
                    size={19}
                  />
                </div>

                <div>
                  <span style={styles.miniLabel}>
                    Aceptadas
                  </span>

                  <strong style={styles.miniValue}>
                    {estadisticas.ofertasAceptadas}
                  </strong>
                </div>
              </div>
            </div>

           <div style={styles.ratingBox}>
  <div style={styles.ratingIcon}>
    <KyntuIcon
      name="star"
      color="#F47A2A"
      size={23}
    />
  </div>

  <div style={styles.ratingContent}>
    <span style={styles.ratingLabel}>
      Calificación promedio
    </span>

    {estadisticas.promedioCalificacion > 0 ? (
      <>
        <div style={styles.starsRow}>
          <div style={styles.stars}>
            {[1, 2, 3, 4, 5].map((estrella) => (
              <span
                key={estrella}
                style={{
                  ...styles.star,
                  color:
                    estrella <=
                    Math.round(
                      estadisticas.promedioCalificacion
                    )
                      ? "#F47A2A"
                      : "#D8E1EC",
                }}
              >
                ★
              </span>
            ))}
          </div>

          <strong style={styles.ratingNumber}>
            {estadisticas.promedioCalificacion.toFixed(1)}
          </strong>
        </div>

        <small style={styles.ratingDetail}>
          {estadisticas.totalCalificaciones}{" "}
          {estadisticas.totalCalificaciones === 1
            ? "evaluación"
            : "evaluaciones"}
        </small>
      </>
    ) : (
      <strong style={styles.ratingValue}>
        Sin calificaciones
      </strong>
    )}
  </div>
</div>

            <button
              type="button"
              onClick={() => router.push("/proveedor")}
              style={styles.primaryButton}
            >
              Volver a mis ofertas
            </button>
          </article>
        </section>

        <section style={styles.card}>
          <div style={styles.cardHeader}>
            <div>
              <span style={styles.cardEyebrow}>
                ACTIVIDAD RECIENTE
              </span>

              <h2 style={styles.cardTitle}>
                Últimas ofertas enviadas
              </h2>
            </div>
          </div>

          {ofertasRecientes.length === 0 ? (
            <div style={styles.emptyState}>
              <div style={styles.emptyIcon}>
                <KyntuIcon
                  name="ofertas"
                  color="#176BFF"
                  size={30}
                />
              </div>

              <strong style={styles.emptyTitle}>
                Todavía no tienes ofertas
              </strong>

              <p style={styles.emptyText}>
                Las ofertas que envíes aparecerán en esta
                sección.
              </p>
            </div>
          ) : (
            <div style={styles.tableWrapper}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Producto</th>
                    <th style={styles.th}>Cantidad</th>
                    <th style={styles.th}>Tu oferta</th>
                    <th style={styles.th}>Despacho</th>
                    <th style={styles.th}>Fecha</th>
                    <th style={styles.th}>Estado</th>
                  </tr>
                </thead>

                <tbody>
                  {ofertasRecientes.map(
                    (oferta, index) => (
                      <tr key={oferta.id || index}>
                        <td style={styles.td}>
                          <strong style={styles.productName}>
                            {oferta.producto ||
                              "Producto"}
                          </strong>
                        </td>

                        <td style={styles.td}>
                          {oferta.cantidad || "—"}
                        </td>

                        <td style={styles.td}>
                          {formatearMonto(
                            oferta.precio_ofertado
                          )}
                        </td>

                        <td style={styles.td}>
                          {oferta.incluye_despacho
                            ? "Incluido"
                            : "No incluido"}
                        </td>

                        <td style={styles.td}>
                          {oferta.created_at
                            ? new Date(
                                oferta.created_at
                              ).toLocaleDateString(
                                "es-CL"
                              )
                            : "—"}
                        </td>

                        <td style={styles.td}>
                          <span style={styles.statusBadge}>
                            {mostrarEstado(
                              oferta.estado
                            )}
                          </span>
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
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
      color: "#176BFF",
      background: "#EDF4FF",
      border: "#D8E6FF",
    },

    green: {
      color: "#15A978",
      background: "#EAFBF5",
      border: "#CFF4E6",
    },

    orange: {
      color: "#F47A2A",
      background: "#FFF3E9",
      border: "#FFE0C7",
    },

    navy: {
      color: "#0A3472",
      background: "#EDF3FA",
      border: "#D8E4F2",
    },
  };

  const tono = tonos[tone] || tonos.blue;

  return (
    <article style={styles.statCard}>
      <div
        style={{
          ...styles.statIcon,
          color: tono.color,
          background: tono.background,
          borderColor: tono.border,
        }}
      >
        <KyntuIcon
          name={icon}
          color={tono.color}
          size={27}
        />
      </div>

      <div style={styles.statContent}>
        <p style={styles.statLabel}>
          {label}
        </p>

        <strong style={styles.statValue}>
          {value}
        </strong>

        <p style={styles.statDetail}>
          {detail}
        </p>
      </div>
    </article>
  );
}

function KyntuIcon({
  name,
  color = "#176BFF",
  size = 24,
}) {
  const iconos = {
    arrowLeft: (
      <>
        <path d="m15 18-6-6 6-6" />
        <path d="M9 12h10" />
      </>
    ),

    alert: (
      <>
        <circle cx="12" cy="12" r="9" />
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
        <circle cx="12" cy="12" r="9" />
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
        <circle cx="12" cy="12" r="9" />
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

const styles = {
  page: {
    minHeight: "100vh",
    position: "relative",
    overflowX: "hidden",
    background:
      "linear-gradient(180deg, #F7FAFF 0%, #FFFFFF 48%, #F8FBFF 100%)",
    color: "#071B3A",
    fontFamily:
      "'Inter', 'Segoe UI', Arial, sans-serif",
  },

  backgroundGlow: {
    position: "fixed",
    inset: 0,
    pointerEvents: "none",
    background:
      "radial-gradient(circle at 9% 12%, rgba(23,107,255,0.10), transparent 28%), radial-gradient(circle at 90% 10%, rgba(244,122,42,0.09), transparent 24%), radial-gradient(circle at 76% 78%, rgba(21,169,120,0.07), transparent 26%)",
  },

  watermark: {
    position: "fixed",
    right: "-65px",
    bottom: "-75px",
    width: "390px",
    opacity: 0.025,
    pointerEvents: "none",
  },

  topBar: {
    position: "relative",
    zIndex: 2,
    display: "grid",
    gridTemplateColumns:
      "minmax(190px, 1fr) minmax(300px, 2fr) minmax(190px, 1fr)",
    alignItems: "center",
    gap: "24px",
    padding:
      "32px clamp(18px, 5vw, 72px) 12px",
  },

  headerSide: {
    display: "flex",
    alignItems: "center",
  },

  headerSideRight: {
    justifyContent: "flex-end",
  },

  headerCenter: {
    textAlign: "center",
  },

  eyebrow: {
    display: "inline-block",
    color: "#176BFF",
    fontSize: "12px",
    fontWeight: 900,
    letterSpacing: "1.8px",
  },

  title: {
    margin: "7px 0 5px",
    color: "#071B3A",
    fontSize: "clamp(32px, 4vw, 46px)",
    fontWeight: 900,
  },

  headerSubtitle: {
    margin: 0,
    color: "#65748B",
    fontSize: "15px",
  },

  content: {
    position: "relative",
    zIndex: 2,
    width: "min(1180px, calc(100% - 32px))",
    margin: "30px auto 70px",
  },

  summaryGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit, minmax(235px, 1fr))",
    gap: "18px",
    marginBottom: "22px",
  },

  statCard: {
    display: "flex",
    gap: "17px",
    alignItems: "center",
    minHeight: "126px",
    padding: "23px",
    border: "1px solid #E4ECF7",
    borderRadius: "22px",
    background: "#FFFFFF",
    boxShadow:
      "0 16px 42px rgba(18, 55, 102, 0.08)",
  },

  statIcon: {
    display: "grid",
    placeItems: "center",
    flex: "0 0 58px",
    width: "58px",
    height: "58px",
    border: "1px solid",
    borderRadius: "50%",
  },

  statContent: {
    minWidth: 0,
  },

  statLabel: {
    margin: 0,
    color: "#596980",
    fontSize: "13px",
    fontWeight: 800,
  },

  statValue: {
    display: "block",
    marginTop: "5px",
    color: "#071B3A",
    fontSize: "29px",
    lineHeight: 1.1,
    fontWeight: 900,
  },

  statDetail: {
    margin: "8px 0 0",
    color: "#8A96A7",
    fontSize: "12px",
  },

  dashboardGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit, minmax(320px, 1fr))",
    gap: "22px",
    marginBottom: "22px",
  },

  card: {
    padding: "28px",
    border: "1px solid #E4ECF7",
    borderRadius: "24px",
    background: "#FFFFFF",
    boxShadow:
      "0 18px 48px rgba(18, 55, 102, 0.08)",
  },

  cardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "18px",
    marginBottom: "24px",
  },

  cardEyebrow: {
    color: "#176BFF",
    fontSize: "11px",
    fontWeight: 900,
    letterSpacing: "1.5px",
  },

  cardTitle: {
    margin: "6px 0 0",
    color: "#071B3A",
    fontSize: "22px",
    fontWeight: 900,
  },

  legend: {
    display: "flex",
    flexWrap: "wrap",
    gap: "12px",
  },

  legendItem: {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    color: "#65748B",
    fontSize: "11px",
    fontWeight: 800,
  },

  legendDot: {
    display: "inline-block",
    width: "9px",
    height: "9px",
    borderRadius: "50%",
  },

  chart: {
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: "14px",
    height: "250px",
    paddingTop: "15px",
  },

  chartColumn: {
    display: "flex",
    flex: 1,
    height: "100%",
    minWidth: 0,
    flexDirection: "column",
    alignItems: "center",
  },

  chartTrack: {
    display: "flex",
    flex: 1,
    width: "min(62px, 80%)",
    alignItems: "flex-end",
    justifyContent: "center",
    gap: "5px",
    padding: "0 6px",
    borderRadius: "16px",
    background: "#EEF3F9",
    overflow: "hidden",
  },

  chartBar: {
    width: "42%",
    minHeight: "4px",
    borderRadius: "12px 12px 4px 4px",
  },

  chartLabel: {
    marginTop: "10px",
    color: "#748299",
    fontSize: "11px",
    fontWeight: 800,
  },

  ring: {
    display: "grid",
    placeItems: "center",
    width: "178px",
    height: "178px",
    margin: "5px auto 24px",
    borderRadius: "50%",
  },

  ringInner: {
    display: "flex",
    width: "132px",
    height: "132px",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: "50%",
    background: "#FFFFFF",
    boxShadow:
      "inset 0 0 0 1px #EDF1F6",
  },

  ringValue: {
    color: "#071B3A",
    fontSize: "34px",
    fontWeight: 900,
  },

  ringLabel: {
    marginTop: "3px",
    color: "#748299",
    fontSize: "12px",
  },

  ratingContent: {
  minWidth: 0,
  flex: 1,
},

starsRow: {
  display: "flex",
  alignItems: "center",
  gap: "10px",
  marginTop: "5px",
},

stars: {
  display: "flex",
  gap: "2px",
},

star: {
  fontSize: "21px",
  lineHeight: 1,
},

ratingNumber: {
  color: "#071B3A",
  fontSize: "18px",
  fontWeight: 900,
},

  miniSummary: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit, minmax(130px, 1fr))",
    gap: "12px",
    marginBottom: "14px",
  },

  miniSummaryItem: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "13px",
    border: "1px solid #E7EDF6",
    borderRadius: "15px",
    background: "#FBFCFE",
  },

  miniIcon: {
    display: "grid",
    placeItems: "center",
    width: "39px",
    height: "39px",
    borderRadius: "50%",
  },

  miniLabel: {
    display: "block",
    color: "#748299",
    fontSize: "11px",
    fontWeight: 700,
  },

  miniValue: {
    display: "block",
    marginTop: "2px",
    color: "#071B3A",
    fontSize: "18px",
  },

  ratingBox: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    marginBottom: "14px",
    padding: "14px",
    border: "1px solid #FFE0C7",
    borderRadius: "16px",
    background: "#FFF9F4",
  },

  ratingIcon: {
    display: "grid",
    placeItems: "center",
    flex: "0 0 44px",
    width: "44px",
    height: "44px",
    borderRadius: "50%",
    background: "#FFF0E5",
  },

  ratingLabel: {
    display: "block",
    color: "#7B685A",
    fontSize: "11px",
    fontWeight: 700,
  },

  ratingValue: {
    display: "block",
    marginTop: "3px",
    color: "#A64B15",
    fontSize: "16px",
  },

  ratingDetail: {
    display: "block",
    marginTop: "3px",
    color: "#A48A78",
  },

  primaryButton: {
    width: "100%",
    marginTop: "10px",
    padding: "14px 18px",
    border: 0,
    borderRadius: "14px",
    background:
      "linear-gradient(135deg, #176BFF, #0A55D9)",
    color: "#FFFFFF",
    fontWeight: 900,
    cursor: "pointer",
    boxShadow:
      "0 12px 26px rgba(23,107,255,0.24)",
  },

  secondaryButton: {
    display: "inline-flex",
    alignItems: "center",
    gap: "7px",
    padding: "11px 17px",
    border: "1px solid #D9E4F3",
    borderRadius: "13px",
    background: "#FFFFFF",
    color: "#0A3472",
    fontWeight: 800,
    cursor: "pointer",
    boxShadow:
      "0 8px 20px rgba(18,55,102,0.06)",
  },

  logoutButton: {
    padding: "11px 17px",
    border: "1px solid #FFD8C2",
    borderRadius: "13px",
    background: "#FFF8F3",
    color: "#E26720",
    fontWeight: 800,
    cursor: "pointer",
  },

  errorBox: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    marginBottom: "18px",
    padding: "14px 16px",
    border: "1px solid #FFD8C2",
    borderRadius: "14px",
    background: "#FFF8F3",
    color: "#B85018",
    fontSize: "13px",
  },

  tableWrapper: {
    width: "100%",
    overflowX: "auto",
  },

  table: {
    width: "100%",
    minWidth: "820px",
    borderCollapse: "collapse",
  },

  th: {
    padding: "12px 14px",
    borderBottom: "1px solid #E4ECF7",
    color: "#748299",
    fontSize: "11px",
    textAlign: "left",
    textTransform: "uppercase",
    letterSpacing: "0.8px",
  },

  td: {
    padding: "16px 14px",
    borderBottom: "1px solid #EDF1F6",
    color: "#53647B",
    fontSize: "13px",
  },

  productName: {
    color: "#071B3A",
  },

  statusBadge: {
    display: "inline-block",
    padding: "7px 11px",
    border: "1px solid #CFE1FF",
    borderRadius: "999px",
    background: "#EDF4FF",
    color: "#176BFF",
    fontSize: "11px",
    fontWeight: 900,
  },

  emptyState: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: "42px 20px",
    border: "1px dashed #D9E4F3",
    borderRadius: "18px",
    background: "#FAFCFF",
    textAlign: "center",
  },

  emptyIcon: {
    display: "grid",
    placeItems: "center",
    width: "62px",
    height: "62px",
    marginBottom: "13px",
    borderRadius: "50%",
    background: "#EDF4FF",
  },

  emptyTitle: {
    color: "#071B3A",
    fontSize: "16px",
  },

  emptyText: {
    margin: "7px 0 0",
    color: "#7A879A",
    fontSize: "13px",
  },

  loadingCard: {
    position: "relative",
    zIndex: 2,
    display: "flex",
    alignItems: "center",
    gap: "12px",
    width: "fit-content",
    margin: "18vh auto",
    padding: "20px 28px",
    border: "1px solid #E4ECF7",
    borderRadius: "18px",
    background: "#FFFFFF",
    boxShadow:
      "0 16px 45px rgba(18,55,102,0.10)",
    color: "#0A3472",
    fontWeight: 800,
  },

  loadingCircle: {
    width: "18px",
    height: "18px",
    border: "3px solid #D8E6FF",
    borderTopColor: "#176BFF",
    borderRadius: "50%",
  },
};