import { useRouter } from "next/router";
import {
  ArrowLeft,
  FileText,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

export default function LegalLayout({
  type = "terms",
  title,
  subtitle,
  version = "1.0",
  updatedAt = "Julio 2026",
  children,
}) {
  const router = useRouter();

  const isPrivacy = type === "privacy";

  return (
    <main style={styles.page}>
      <div style={styles.backgroundShapeOne} />
      <div style={styles.backgroundShapeTwo} />
      <div style={styles.backgroundShapeThree} />

      <div style={styles.wrapper}>
        <header style={styles.header}>
          <button
            type="button"
            onClick={() => router.push("/register")}
            style={styles.backButton}
          >
            <ArrowLeft size={18} />
            Volver al registro
          </button>

          <img
            src="/icono_1.png"
            alt="Kyntü"
            style={styles.logo}
          />
        </header>

        <section style={styles.hero}>
          <div style={styles.heroIcon}>
            {isPrivacy ? (
              <ShieldCheck size={31} strokeWidth={2.2} />
            ) : (
              <FileText size={31} strokeWidth={2.2} />
            )}
          </div>

          <div style={styles.eyebrow}>
            <Sparkles size={15} />
            {isPrivacy
              ? "PROTECCIÓN DE DATOS"
              : "INFORMACIÓN LEGAL"}
          </div>

          <h1 style={styles.title}>{title}</h1>

          <p style={styles.subtitle}>{subtitle}</p>

          <div style={styles.metadata}>
            <span style={styles.metadataItem}>
              Versión {version}
            </span>

            <span style={styles.metadataDivider} />

            <span style={styles.metadataItem}>
              Última actualización: {updatedAt}
            </span>
          </div>
        </section>

        <section style={styles.content}>
          {children}
        </section>

        <footer style={styles.footer}>
          <div>
            <p style={styles.footerBrand}>Kyntü</p>
            <p style={styles.footerText}>
              Conectamos compradores y proveedores de forma simple.
            </p>
          </div>

          <button
            type="button"
            onClick={() => router.push("/register")}
            style={styles.primaryButton}
          >
            <ArrowLeft size={18} />
            Volver al registro
          </button>
        </footer>
      </div>
    </main>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    position: "relative",
    overflow: "hidden",
    background:
      "linear-gradient(180deg, #f5f9ff 0%, #f8fbff 45%, #ffffff 100%)",
    fontFamily:
      "'Plus Jakarta Sans', Arial, Helvetica, sans-serif",
    color: "#061b41",
    padding: "28px 20px 48px",
  },

  backgroundShapeOne: {
    position: "fixed",
    width: "420px",
    height: "420px",
    borderRadius: "50%",
    background:
      "radial-gradient(circle, rgba(23,107,255,0.18) 0%, rgba(23,107,255,0) 70%)",
    top: "-160px",
    left: "-130px",
    pointerEvents: "none",
  },

  backgroundShapeTwo: {
    position: "fixed",
    width: "390px",
    height: "390px",
    borderRadius: "50%",
    background:
      "radial-gradient(circle, rgba(0,180,216,0.16) 0%, rgba(0,180,216,0) 72%)",
    right: "-150px",
    top: "220px",
    pointerEvents: "none",
  },

  backgroundShapeThree: {
    position: "fixed",
    width: "330px",
    height: "330px",
    borderRadius: "50%",
    background:
      "radial-gradient(circle, rgba(255,145,77,0.13) 0%, rgba(255,145,77,0) 72%)",
    bottom: "-120px",
    left: "20%",
    pointerEvents: "none",
  },

  wrapper: {
    width: "100%",
    maxWidth: "980px",
    margin: "0 auto",
    position: "relative",
    zIndex: 2,
  },

  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "20px",
    marginBottom: "26px",
  },

  backButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    minHeight: "44px",
    padding: "10px 16px",
    borderRadius: "13px",
    border: "1px solid #d9e5f5",
    background: "rgba(255,255,255,0.88)",
    color: "#176BFF",
    fontWeight: 800,
    fontSize: "14px",
    cursor: "pointer",
    boxShadow: "0 10px 26px rgba(23,107,255,0.08)",
    backdropFilter: "blur(10px)",
  },

  logo: {
    width: "155px",
    maxWidth: "42vw",
    display: "block",
    objectFit: "contain",
  },

  hero: {
    position: "relative",
    textAlign: "center",
    background:
      "linear-gradient(145deg, rgba(255,255,255,0.98), rgba(247,251,255,0.96))",
    border: "1px solid #e3ecf7",
    borderRadius: "30px",
    padding: "48px 34px 42px",
    boxShadow: "0 32px 80px rgba(27,75,145,0.12)",
    overflow: "hidden",
    marginBottom: "24px",
  },

  heroIcon: {
    width: "68px",
    height: "68px",
    borderRadius: "20px",
    margin: "0 auto 18px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#ffffff",
    background:
      "linear-gradient(135deg, #176BFF 0%, #00B4D8 58%, #00C2A8 100%)",
    boxShadow: "0 18px 34px rgba(23,107,255,0.25)",
  },

  eyebrow: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "7px",
    marginBottom: "14px",
    padding: "8px 13px",
    borderRadius: "999px",
    background: "#edf5ff",
    color: "#176BFF",
    fontSize: "12px",
    fontWeight: 900,
    letterSpacing: "0.08em",
  },

  title: {
    margin: 0,
    color: "#061b41",
    fontSize: "clamp(32px, 5vw, 48px)",
    lineHeight: 1.08,
    fontWeight: 900,
    letterSpacing: "-0.04em",
  },

  subtitle: {
    maxWidth: "710px",
    margin: "18px auto 0",
    color: "#60708a",
    fontSize: "16px",
    lineHeight: 1.75,
  },

  metadata: {
    marginTop: "23px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexWrap: "wrap",
    gap: "10px",
  },

  metadataItem: {
    color: "#52637d",
    background: "#f5f8fc",
    border: "1px solid #e5ebf5",
    borderRadius: "999px",
    padding: "8px 13px",
    fontSize: "13px",
    fontWeight: 800,
  },

  metadataDivider: {
    width: "6px",
    height: "6px",
    borderRadius: "50%",
    background: "#ff914d",
  },

  content: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  },

  footer: {
    marginTop: "24px",
    padding: "25px 28px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "20px",
    flexWrap: "wrap",
    background: "#061b41",
    color: "#ffffff",
    borderRadius: "24px",
    boxShadow: "0 24px 55px rgba(6,27,65,0.18)",
  },

  footerBrand: {
    margin: 0,
    fontSize: "22px",
    fontWeight: 900,
  },

  footerText: {
    margin: "6px 0 0",
    color: "#bfcce0",
    fontSize: "14px",
  },

  primaryButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "9px",
    padding: "13px 20px",
    borderRadius: "13px",
    border: "none",
    color: "#ffffff",
    background:
      "linear-gradient(135deg, #176BFF 0%, #00B4D8 100%)",
    boxShadow: "0 14px 28px rgba(23,107,255,0.28)",
    fontSize: "14px",
    fontWeight: 900,
    cursor: "pointer",
  },
};