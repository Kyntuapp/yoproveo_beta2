import LegalLayout from "../components/Legal/LegalLayout";

const PrivacySection = ({
  number,
  title,
  children,
  accent = "blue",
}) => {
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

export default function Privacidad() {
  return (
    <LegalLayout
      type="privacy"
      title="Política de Privacidad"
      subtitle="Conoce qué información utiliza Kyntü, para qué se utiliza y cuáles son tus derechos respecto de tus datos."
      version="1.0"
      updatedAt="Julio 2026"
    >
      <PrivacySection
        number="01"
        title="Introducción"
        accent="blue"
      >
        <p style={styles.paragraph}>
          En Kyntü respetamos la privacidad de nuestros usuarios y
          procuramos proteger la información personal utilizada
          durante el registro y funcionamiento de la plataforma.
        </p>

        <p style={styles.paragraph}>
          Esta política explica qué información se recopila, cómo se
          utiliza y qué opciones tiene el usuario respecto de sus
          datos.
        </p>
      </PrivacySection>

      <PrivacySection
        number="02"
        title="Información que recopilamos"
        accent="turquoise"
      >
        <p style={styles.paragraph}>
          Dependiendo del uso de la plataforma, Kyntü podrá recopilar:
        </p>

        <ul style={styles.list}>
          <li>Correo electrónico.</li>
          <li>
            Perfil seleccionado: comprador, proveedor o ambos.
          </li>
          <li>
            Información ingresada voluntariamente en el perfil.
          </li>
          <li>
            Solicitudes de compra, listas y productos publicados.
          </li>
          <li>
            Ofertas, precios, cantidades y condiciones comerciales.
          </li>
          <li>
            Comentarios, calificaciones y comunicaciones realizadas
            dentro de la plataforma.
          </li>
          <li>
            Información técnica necesaria para seguridad y
            funcionamiento.
          </li>
        </ul>
      </PrivacySection>

      <PrivacySection
        number="03"
        title="Finalidad del tratamiento"
        accent="orange"
      >
        <p style={styles.paragraph}>
          La información podrá utilizarse para:
        </p>

        <ul style={styles.list}>
          <li>Crear y administrar cuentas.</li>
          <li>
            Identificar al usuario y mantener su sesión.
          </li>
          <li>
            Permitir la interacción entre compradores y proveedores.
          </li>
          <li>
            Gestionar solicitudes, listas, ofertas y calificaciones.
          </li>
          <li>
            Enviar comunicaciones relacionadas con la cuenta.
          </li>
          <li>
            Prevenir fraudes, abusos o accesos no autorizados.
          </li>
          <li>
            Mejorar la experiencia y funcionamiento de Kyntü.
          </li>
        </ul>
      </PrivacySection>

      <PrivacySection
        number="04"
        title="Información visible para otros usuarios"
        accent="blue"
      >
        <p style={styles.paragraph}>
          Parte de la información ingresada podrá ser visible para
          otros usuarios cuando sea necesaria para el funcionamiento
          de la plataforma.
        </p>

        <p style={styles.paragraph}>
          Por ejemplo, compradores y proveedores podrán visualizar
          información relacionada con solicitudes, ofertas, productos,
          comentarios o perfiles involucrados en una operación.
        </p>
      </PrivacySection>

      <PrivacySection
        number="05"
        title="Compartición de información"
        accent="turquoise"
      >
        <p style={styles.paragraph}>
          Kyntü no vende información personal a terceros.
        </p>

        <p style={styles.paragraph}>
          Los datos podrán compartirse únicamente cuando sea necesario
          para prestar el servicio, cumplir una obligación legal,
          prevenir fraudes o trabajar con proveedores tecnológicos
          necesarios para el funcionamiento de la plataforma.
        </p>
      </PrivacySection>

      <PrivacySection
        number="06"
        title="Proveedores tecnológicos"
        accent="orange"
      >
        <p style={styles.paragraph}>
          Kyntü puede utilizar servicios externos para autenticación,
          almacenamiento, envío de correos, alojamiento y otras
          funciones técnicas.
        </p>

        <p style={styles.paragraph}>
          Estos servicios podrán procesar información únicamente para
          cumplir las funciones contratadas y conforme a sus propias
          condiciones de privacidad.
        </p>
      </PrivacySection>

      <PrivacySection
        number="07"
        title="Seguridad de los datos"
        accent="blue"
      >
        <p style={styles.paragraph}>
          Kyntü aplica medidas técnicas y organizativas destinadas a
          evitar accesos no autorizados, alteraciones, pérdidas o
          divulgaciones indebidas.
        </p>

        <p style={styles.paragraph}>
          Sin embargo, ningún sistema conectado a internet puede
          garantizar una seguridad absoluta.
        </p>
      </PrivacySection>

      <PrivacySection
        number="08"
        title="Conservación de información"
        accent="turquoise"
      >
        <p style={styles.paragraph}>
          Los datos se conservarán durante el tiempo necesario para
          mantener la cuenta, prestar el servicio, resolver conflictos
          y cumplir obligaciones legales o administrativas.
        </p>
      </PrivacySection>

      <PrivacySection
        number="09"
        title="Derechos del usuario"
        accent="orange"
      >
        <p style={styles.paragraph}>
          El usuario podrá solicitar, cuando corresponda:
        </p>

        <ul style={styles.list}>
          <li>Acceso a su información personal.</li>
          <li>Actualización o corrección de datos.</li>
          <li>
            Eliminación de información o cierre de la cuenta.
          </li>
          <li>
            Información sobre el uso dado a sus datos.
          </li>
        </ul>
      </PrivacySection>

      <PrivacySection
        number="10"
        title="Responsabilidad del usuario"
        accent="blue"
      >
        <p style={styles.paragraph}>
          El usuario es responsable de proteger su contraseña,
          mantener actualizada su información y evitar publicar datos
          personales innecesarios dentro de solicitudes, comentarios u
          ofertas.
        </p>
      </PrivacySection>

      <PrivacySection
        number="11"
        title="Cambios a esta política"
        accent="turquoise"
      >
        <p style={styles.paragraph}>
          Esta Política de Privacidad podrá actualizarse por cambios
          técnicos, funcionales o legales.
        </p>

        <p style={styles.paragraph}>
          La versión vigente y su fecha de actualización estarán
          disponibles en esta página.
        </p>
      </PrivacySection>

      <PrivacySection
        number="12"
        title="Contacto"
        accent="orange"
      >
        <p style={styles.paragraph}>
          Las solicitudes o consultas relacionadas con privacidad y
          tratamiento de datos podrán realizarse mediante los canales
          oficiales informados por Kyntü.
        </p>
      </PrivacySection>
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