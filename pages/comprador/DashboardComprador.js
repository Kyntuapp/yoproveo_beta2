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
    pendiente: "Pendiente",
    en_espera_confirmacion: "Esperando confirmación",
    pendiente_pago: "Pendiente de pago",
    pago_recibido: "Pago recibido",
    recepcion_conforme: "Recepción confirmada",
    pagada: "Pagada",
    rechazada: "Rechazada",
    cancelada: "Cancelada",
  };

  return estados[normalizarEstado(estado)] || estado || "Sin estado";
};

export default function DashboardComprador() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [listas, setListas] = useState([]);
  const [ofertas, setOfertas] = useState([]);

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

      const { data: listasData, error: listasError } = await supabase
        .from("listas_compras")
        .select("*")
        .eq("usuario_id", user.id)
        .order("fecha_creacion", {
          ascending: false,
        });

      if (listasError) {
        throw listasError;
      }

      const listasObtenidas = listasData || [];
      const idsListas = listasObtenidas
        .map((lista) => lista.id)
        .filter(Boolean);

      let ofertasData = [];

      if (idsListas.length > 0) {
        const { data, error: ofertasError } = await supabase
          .from("ofertas_productos")
          .select("*")
          .in("lista_id", idsListas)
          .order("created_at", {
            ascending: false,
          });

        if (ofertasError) {
          throw ofertasError;
        }

        ofertasData = data || [];
      }

      setListas(listasObtenidas);
      setOfertas(ofertasData);
    } catch (err) {
      console.error(
        "Error cargando estadísticas del comprador:",
        err
      );

      setError(
        err?.message ||
          "No se pudieron cargar las estadísticas del comprador."
      );
    } finally {
      setLoading(false);
    }
  };

  const estadisticas = useMemo(() => {
    const listasUnicas = new Set(
      listas.map(
        (lista) =>
          lista.lista_id ||
          lista.nombre_lista ||
          lista.fecha_creacion
      )
    );

    const ofertasVisibles = ofertas.filter(
      (oferta) =>
        normalizarEstado(oferta.estado) !== "rechazada"
    );

    const comprasRealizadas = ofertas.filter((oferta) =>
      [
        "pago_recibido",
        "recepcion_conforme",
        "pagada",
      ].includes(normalizarEstado(oferta.estado))
    );

    const totalComprado = comprasRealizadas.reduce(
      (total, oferta) =>
        total + Number(oferta.precio_ofertado || 0),
      0
    );

    const procesosTerminados = ofertas.filter((oferta) =>
      ["recepcion_conforme", "pagada"].includes(
        normalizarEstado(oferta.estado)
      )
    ).length;

    return {
      listasCreadas: listasUnicas.size,
      ofertasRecibidas: ofertasVisibles.length,
      comprasRealizadas: comprasRealizadas.length,
      totalComprado,
      procesosTerminados,
    };
  }, [listas, ofertas]);

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
        total: 0,
      };
    });

    const gruposVistos = new Set();

    listas.forEach((lista) => {
      if (!lista.fecha_creacion) return;

      const grupo =
        lista.lista_id ||
        `${lista.nombre_lista}-${lista.fecha_creacion}`;

      if (gruposVistos.has(grupo)) return;

      gruposVistos.add(grupo);

      const fecha = new Date(lista.fecha_creacion);

      if (Number.isNaN(fecha.getTime())) return;

      const key = `${fecha.getFullYear()}-${fecha.getMonth()}`;
      const mes = meses.find((item) => item.key === key);

      if (mes) {
        mes.total += 1;
      }
    });

    return meses;
  }, [listas]);

  const maxActividad = Math.max(
    ...actividadMensual.map((mes) => mes.total),
    1
  );

  const actividadReciente = useMemo(() => {
    return ofertas.slice(0, 5);
  }, [ofertas]);

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
            onClick={() => router.push("/comprador")}
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
            PANEL COMPRADOR
          </span>

          <h1 style={styles.title}>
            Mis estadísticas
          </h1>

          <p style={styles.headerSubtitle}>
            Revisa tus solicitudes, ofertas y compras.
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
            icon="solicitudes"
            tone="blue"
            label="Listas creadas"
            value={estadisticas.listasCreadas}
            detail="Solicitudes de compra publicadas"
          />

          <StatCard
            icon="ofertas"
            tone="green"
            label="Ofertas recibidas"
            value={estadisticas.ofertasRecibidas}
            detail="Propuestas de proveedores"
          />

          <StatCard
            icon="compras"
            tone="orange"
            label="Compras realizadas"
            value={estadisticas.comprasRealizadas}
            detail="Ofertas pagadas o recibidas"
          />

          <StatCard
            icon="total"
            tone="navy"
            label="Total comprado"
            value={formatearMonto(
              estadisticas.totalComprado
            )}
            detail={`${estadisticas.procesosTerminados} procesos terminados`}
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
                  Listas publicadas
                </h2>
              </div>

              <div style={styles.cardBadge}>
                {estadisticas.listasCreadas} en total
              </div>
            </div>

            <div style={styles.chart}>
              {actividadMensual.map((mes) => (
                <div
                  key={mes.key}
                  style={styles.chartColumn}
                >
                  <span style={styles.chartValue}>
                    {mes.total}
                  </span>

                  <div style={styles.chartTrack}>
                    <div
                      style={{
                        ...styles.chartBar,
                        height: `${Math.max(
                          (mes.total / maxActividad) * 100,
                          5
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
                  RESUMEN
                </span>

                <h2 style={styles.cardTitle}>
                  Estado de tus compras
                </h2>
              </div>
            </div>

            <SummaryRow
              icon="solicitudes"
              color="#176BFF"
              background="#EDF4FF"
              label="Listas creadas"
              value={estadisticas.listasCreadas}
            />

            <SummaryRow
              icon="ofertas"
              color="#15A978"
              background="#EAFBF5"
              label="Ofertas recibidas"
              value={estadisticas.ofertasRecibidas}
            />

            <SummaryRow
              icon="aceptadas"
              color="#F47A2A"
              background="#FFF3E9"
              label="Compras completadas"
              value={estadisticas.procesosTerminados}
            />

            <button
              type="button"
              onClick={() => router.push("/comprador")}
              style={styles.primaryButton}
            >
              Ir a mis listas
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
                Últimas ofertas recibidas
              </h2>
            </div>
          </div>

          {actividadReciente.length === 0 ? (
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
                Cuando un proveedor realice una oferta,
                aparecerá aquí.
              </p>
            </div>
          ) : (
            <div style={styles.tableWrapper}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Producto</th>
                    <th style={styles.th}>Oferta</th>
                    <th style={styles.th}>Despacho</th>
                    <th style={styles.th}>Fecha</th>
                    <th style={styles.th}>Estado</th>
                  </tr>
                </thead>

                <tbody>
                  {actividadReciente.map(
                    (oferta, index) => (
                      <tr key={oferta.id || index}>
                        <td style={styles.td}>
                          <strong style={styles.productName}>
                            {oferta.producto ||
                              "Producto"}
                          </strong>
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

function SummaryRow({
  icon,
  color,
  background,
  label,
  value,
}) {
  return (
    <div style={styles.summaryRow}>
      <div
        style={{
          ...styles.summaryIcon,
          background,
        }}
      >
        <KyntuIcon
          name={icon}
          color={color}
          size={20}
        />
      </div>

      <span style={styles.summaryLabel}>
        {label}
      </span>

      <strong style={styles.summaryValue}>
        {value}
      </strong>
    </div>
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

    solicitudes: (
      <>
        <path d="M7 3h10v18H7z" />
        <path d="M9 7h6" />
        <path d="M9 11h6" />
        <path d="M9 15h4" />
      </>
    ),

    ofertas: (
      <>
        <path d="M4 5h16v11H8l-4 4V5Z" />
        <path d="M8 9h8" />
        <path d="M8 12h5" />
      </>
    ),

    compras: (
      <>
        <path d="M4 8h16l-1.5 10h-13L4 8Z" />
        <path d="M8 8a4 4 0 0 1 8 0" />
      </>
    ),

    total: (
      <>
        <rect
          x="3"
          y="6"
          width="18"
          height="12"
          rx="2"
        />
        <path d="M3 10h18" />
        <path d="M7 15h2" />
      </>
    ),

    aceptadas: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="m8 12 2.5 2.5L16 9" />
      </>
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

  cardBadge: {
    padding: "8px 12px",
    border: "1px solid #D8E6FF",
    borderRadius: "999px",
    background: "#EDF4FF",
    color: "#176BFF",
    fontSize: "12px",
    fontWeight: 900,
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

  chartValue: {
    marginBottom: "7px",
    color: "#0A3472",
    fontSize: "12px",
    fontWeight: 800,
  },

  chartTrack: {
    position: "relative",
    flex: 1,
    width: "min(46px, 72%)",
    borderRadius: "16px",
    background: "#EEF3F9",
    overflow: "hidden",
  },

  chartBar: {
    position: "absolute",
    right: 0,
    bottom: 0,
    left: 0,
    borderRadius: "16px",
    background:
      "linear-gradient(180deg, #4B91FF, #176BFF)",
  },

  chartLabel: {
    marginTop: "10px",
    color: "#748299",
    fontSize: "11px",
    fontWeight: 800,
  },

  summaryRow: {
    display: "grid",
    gridTemplateColumns: "42px 1fr auto",
    alignItems: "center",
    gap: "12px",
    marginBottom: "14px",
    padding: "13px",
    border: "1px solid #E7EDF6",
    borderRadius: "15px",
    background: "#FBFCFE",
  },

  summaryIcon: {
    display: "grid",
    placeItems: "center",
    width: "40px",
    height: "40px",
    borderRadius: "50%",
  },

  summaryLabel: {
    color: "#596980",
    fontSize: "13px",
    fontWeight: 700,
  },

  summaryValue: {
    color: "#071B3A",
    fontSize: "18px",
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
    minWidth: "720px",
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