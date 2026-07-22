import LegalLayout from "../components/Legal/LegalLayout";

const TermSection = ({ number, title, children, accent = "blue" }) => {
  const accents = {
    blue: {
      background: "linear-gradient(135deg, #176BFF, #438CFF)",
      shadow: "0 12px 24px rgba(23,107,255,0.22)",
    },
    turquoise: {
      background: "linear-gradient(135deg, #00AFC8, #00C2A8)",
      shadow: "0 12px 24px rgba(0,175,200,0.20)",
    },
    orange: {
      background: "linear-gradient(135deg, #FF914D, #FFB15C)",
      shadow: "0 12px 24px rgba(255,145,77,0.22)",
    },
  };

  const accentStyle = accents[accent] || accents.blue;

  return (
    <article style={styles.section}>
      <div
        style={{
          ...styles.sectionNumber,
          background: accentStyle.background,
          boxShadow: accentStyle.shadow,
        }}
      >
        {number}
      </div>

      <div style={styles.sectionContent}>
        <h2 style={styles.sectionTitle}>{title}</h2>
        <div style={styles.sectionText}>{children}</div>
      </div>
    </article>
  );
};

export default function Terminos() {
  return (
    <LegalLayout
      type="terms"
      title="Términos y Condiciones"
      subtitle="Estas condiciones regulan el acceso, registro y uso de Kyntü por parte de compradores y proveedores."
      version="1.0"
      updatedAt="Julio 2026"
    >
      <TermSection number="01" title="Aceptación" accent="blue">
        <p style={styles.paragraph}>
          Al crear una cuenta o utilizar Kyntü, el usuario declara
          haber leído, comprendido y aceptado estos Términos y
          Condiciones de Uso.
        </p>

        <p style={styles.paragraph}>
          Si el usuario no está de acuerdo con estas condiciones,
          no deberá registrarse ni utilizar la plataforma.
        </p>
      </TermSection>

      <TermSection
        number="02"
        title="Objeto de la plataforma"
        accent="turquoise"
      >
        <p style={styles.paragraph}>
          Kyntü es una plataforma tecnológica que conecta compradores
          y proveedores, permitiendo publicar solicitudes, recibir
          ofertas y gestionar procesos de cotización de productos.
        </p>
      </TermSection>

      <TermSection
        number="03"
        title="Registro de usuarios"
        accent="orange"
      >
        <p style={styles.paragraph}>
          Para utilizar determinadas funciones, el usuario deberá
          crear una cuenta y seleccionar uno o ambos perfiles
          disponibles: comprador y proveedor.
        </p>

        <ul style={styles.list}>
          <li>Entregar información verdadera y actualizada.</li>
          <li>Mantener la confidencialidad de su contraseña.</li>
          <li>
            Informar oportunamente cualquier uso no autorizado de su
            cuenta.
          </li>
          <li>
            No utilizar cuentas de otras personas sin autorización.
          </li>
        </ul>
      </TermSection>

      <TermSection
        number="04"
        title="Obligaciones del comprador"
        accent="blue"
      >
        <ul style={styles.list}>
          <li>Publicar solicitudes reales y de buena fe.</li>
          <li>
            Describir correctamente los productos, cantidades y
            condiciones requeridas.
          </li>
          <li>
            Revisar las ofertas recibidas antes de aceptar una
            propuesta.
          </li>
          <li>
            Cumplir los compromisos asumidos con los proveedores.
          </li>
        </ul>
      </TermSection>

      <TermSection
        number="05"
        title="Obligaciones del proveedor"
        accent="turquoise"
      >
        <ul style={styles.list}>
          <li>Realizar ofertas reales y verificables.</li>
          <li>
            Informar correctamente precios, disponibilidad y
            condiciones de despacho.
          </li>
          <li>
            Mantener actualizada la información de sus ofertas.
          </li>
          <li>
            Cumplir los compromisos adquiridos con los compradores.
          </li>
        </ul>
      </TermSection>

      <TermSection
        number="06"
        title="Conductas prohibidas"
        accent="orange"
      >
        <p style={styles.paragraph}>
          El usuario no podrá utilizar Kyntü para actividades
          fraudulentas, ilegales o que afecten a otros usuarios o al
          funcionamiento de la plataforma.
        </p>

        <ul style={styles.list}>
          <li>Publicar información falsa o engañosa.</li>
          <li>Suplantar la identidad de otra persona.</li>
          <li>
            Intentar vulnerar la seguridad o funcionamiento de Kyntü.
          </li>
          <li>
            Utilizar la plataforma para actividades contrarias a la
            ley.
          </li>
        </ul>
      </TermSection>

      <TermSection
        number="07"
        title="Responsabilidad de las partes"
        accent="blue"
      >
        <p style={styles.paragraph}>
          Los compradores y proveedores son responsables de la
          información que publican y de los compromisos que asumen
          mediante la plataforma.
        </p>

        <p style={styles.paragraph}>
          Kyntü facilita el contacto entre las partes, pero no fabrica,
          almacena ni controla directamente los productos ofrecidos
          por los proveedores.
        </p>
      </TermSection>

      <TermSection
        number="08"
        title="Limitación de responsabilidad"
        accent="turquoise"
      >
        <p style={styles.paragraph}>
          Kyntü no garantiza la disponibilidad permanente de la
          plataforma ni la calidad, existencia, entrega o cumplimiento
          de los productos y ofertas publicados por sus usuarios.
        </p>

        <p style={styles.paragraph}>
          La plataforma no será responsable de pérdidas o perjuicios
          derivados de acuerdos, incumplimientos o conflictos entre
          compradores y proveedores, salvo que corresponda conforme a
          la legislación aplicable.
        </p>
      </TermSection>

      <TermSection
        number="09"
        title="Suspensión o eliminación de cuentas"
        accent="orange"
      >
        <p style={styles.paragraph}>
          Kyntü podrá limitar, suspender o eliminar cuentas cuando
          existan indicios de fraude, uso indebido, incumplimiento de
          estos términos o afectación a otros usuarios.
        </p>
      </TermSection>

      <TermSection
        number="10"
        title="Modificación de los términos"
        accent="blue"
      >
        <p style={styles.paragraph}>
          Estos términos podrán actualizarse por cambios legales,
          técnicos o funcionales. La versión vigente estará disponible
          en la plataforma.
        </p>

        <p style={styles.paragraph}>
          Cuando los cambios sean relevantes, Kyntü podrá solicitar
          una nueva aceptación por parte del usuario.
        </p>
      </TermSection>

      <TermSection
        number="11"
        title="Contacto"
        accent="turquoise"
      >
        <p style={styles.paragraph}>
          Las consultas relacionadas con estos términos podrán ser
          enviadas mediante los canales oficiales informados por
          Kyntü.
        </p>
      </TermSection>
    </LegalLayout>
  );
}

const styles = {
  section: {
    display: "flex",
    gap: "20px",
    alignItems: "flex-start",
    padding: "26px",
    borderRadius: "22px",
    background: "rgba(255,255,255,0.96)",
    border: "1px solid #e3ebf5",
    boxShadow: "0 18px 42px rgba(28,69,128,0.08)",
  },

  sectionNumber: {
    width: "52px",
    height: "52px",
    flexShrink: 0,
    borderRadius: "16px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#ffffff",
    fontSize: "15px",
    fontWeight: 900,
  },

  sectionContent: {
    flex: 1,
    minWidth: 0,
  },

  sectionTitle: {
    margin: "3px 0 12px",
    color: "#061b41",
    fontSize: "21px",
    lineHeight: 1.3,
    fontWeight: 900,
  },

  sectionText: {
    color: "#5d6c83",
    fontSize: "15px",
    lineHeight: 1.75,
  },

  paragraph: {
    margin: "0 0 12px",
  },

  list: {
    margin: "5px 0 0",
    paddingLeft: "21px",
  },
};