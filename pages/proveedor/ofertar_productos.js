import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { resolveProveedorProfile } from '../../lib/resolveProveedorProfile';
import { useRouter } from 'next/router';
import AppLayout from '../../components/Layout/AppLayout';
import Notificaciones from '../../components/Notificaciones';

const VISTA_STORAGE_KEY = 'kyntu_proveedor_vista_ofertas';
const MOBILE_BREAKPOINT = 820;

function formatearFechaCorta(fecha) {
  if (!fecha) return '—';

  const d = new Date(fecha);
  if (Number.isNaN(d.getTime())) return '—';

  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();

  return `${dd}-${mm}-${yyyy}`;
}

function leerVistaPreferida() {
  try {
    const valor = localStorage.getItem(VISTA_STORAGE_KEY);

    if (valor === 'lista' || valor === 'cuadricula') {
      return valor;
    }
  } catch (_) {
    /* localStorage no disponible */
  }

  return 'lista';
}

function guardarVistaPreferida(vista) {
  try {
    localStorage.setItem(VISTA_STORAGE_KEY, vista);
  } catch (_) {
    /* ignorar */
  }
}

function normalizarFormatosItem(item) {
  const formatos = Array.isArray(item?.formatos_detalle)
    ? item.formatos_detalle.filter(Boolean)
    : [];

  if (formatos.length > 0) {
    return formatos.map((f) => ({
      formato: (f.formato ?? '').toString(),
      cantidad: f.cantidad ?? '',
      precio: f.precio ?? '',
      detalle_pedido: (f?.detalle_pedido ?? '').toString().trim(),
    }));
  }

  return [
    {
      formato: (item?.formato ?? '').toString(),
      cantidad: item?.cantidad ?? '',
      precio: item?.precio ?? '',
      detalle_pedido: '',
    },
  ];
}

function expandirItemsNormalizados(listasItems) {
  return listasItems.flatMap((item) => {
    const formatos = normalizarFormatosItem(item);
    const totalFormatos = formatos.length;

    return formatos.map((fmt, fmtIndex) => ({
      rowKey: `${item.id}-${fmtIndex}`,
      itemId: item.id,
      esPrimeraFilaFormato: fmtIndex === 0,
      totalFormatos,
      producto: item.producto,
      marca: item.marca,
      formato: fmt.formato,
      cantidad: fmt.cantidad,
      precio: fmt.precio,
      detalle_pedido: fmt.detalle_pedido,
      comuna: item.comuna_despacho,
      comprador_email: item.comprador_email,
      fecha: item.fecha_creacion,
      fecha_cierre: item.fecha_cierre,
      estado: item.estado,
      estado_oferta: item.estado_oferta,
      ya_oferto: item.ya_oferto,
      oferta: item.oferta,
      incluye_despacho: item.incluye_despacho,
      tiempo_despacho_horas: item.tiempo_despacho_horas,
      usuario_id: item.usuario_id,
    }));
  });
}

function DetallePedidoBloque({ detalle }) {
  if (!detalle) return null;

  return (
    <div className="kyntu-detalleBox" style={styles.detalleBox}>
      <div className="kyntu-detalleLabel" style={styles.detalleLabel}>
        <span style={styles.detalleIcon} aria-hidden="true">
          ℹ
        </span>

        Detalle del pedido
      </div>

      <p className="kyntu-detalleText" style={styles.detalleText}>
        {detalle}
      </p>
    </div>
  );
}

function DetallePedidoCelda({ detalle }) {
  if (!detalle) {
    return <span style={styles.detalleEmpty}>—</span>;
  }

  return (
    <span
      className="kyntu-detalleCelda"
      style={styles.detalleCelda}
      title={detalle}
    >
      {detalle}
    </span>
  );
}

function BloqueOferta({
  fila,
  variant,
  onChange,
  formatearNumero,
}) {
  const compacto = variant === 'lista';

  const boxStyle = compacto
    ? styles.offerHighlightBoxCompact
    : styles.offerHighlightBox;

  const inputId = `oferta-${fila.itemId}`;

  if (fila.ya_oferto) {
    return (
      <div className="kyntu-offerHighlight" style={boxStyle}>
        <span style={styles.offerBlockTitle}>Tu oferta</span>

        <span style={styles.sentOffer}>
          ${formatearNumero(fila.oferta)}
        </span>
      </div>
    );
  }

  if (fila.estado === 'cerrada') {
    return (
      <div className="kyntu-offerHighlight" style={boxStyle}>
        <span style={styles.offerBlockTitle}>Tu oferta</span>
        <span style={styles.sentOffer}>Cerrada</span>
      </div>
    );
  }

  return (
    <div className="kyntu-offerHighlight" style={boxStyle}>
      <div style={styles.offerBlockHeader}>
        <span style={styles.offerBlockTitle}>Tu oferta</span>

        {!compacto && (
          <span style={styles.offerBlockHint}>
            Ingresa tu precio · monto total ofertado
          </span>
        )}
      </div>

      {compacto && (
        <span style={styles.offerBlockHintCompact}>
          Ingresa tu precio
        </span>
      )}

      <label htmlFor={inputId} style={styles.srOnly}>
        Ingresar monto total de la oferta
      </label>

      <input
        id={inputId}
        type="text"
        value={fila.oferta}
        onChange={(e) => onChange(fila.itemId, e.target.value)}
        placeholder="Monto total"
        aria-label="Ingresar monto total de la oferta"
        className="kyntu-offerInput"
        style={
          compacto
            ? styles.offerInputLista
            : styles.offerInputGrid
        }
      />
    </div>
  );
}

function SelectorVista({
  vista,
  onChange,
  deshabilitarLista,
}) {
  return (
    <div
      className="kyntu-viewToggle"
      style={styles.viewToggle}
      role="group"
      aria-label="Selector de visualización"
    >
      <button
        type="button"
        className="kyntu-viewToggleBtn"
        style={{
          ...styles.viewToggleBtn,
          ...(vista === 'lista'
            ? styles.viewToggleBtnActive
            : {}),
          ...(deshabilitarLista
            ? styles.viewToggleBtnDisabled
            : {}),
        }}
        aria-label="Ver como lista"
        aria-pressed={vista === 'lista'}
        title="Ver como lista"
        disabled={deshabilitarLista}
        onClick={() => onChange('lista')}
      >
        ☰ Lista
      </button>

      <button
        type="button"
        className="kyntu-viewToggleBtn"
        style={{
          ...styles.viewToggleBtn,
          ...(vista === 'cuadricula'
            ? styles.viewToggleBtnActive
            : {}),
        }}
        aria-label="Ver como cuadrícula"
        aria-pressed={vista === 'cuadricula'}
        title="Ver como cuadrícula"
        onClick={() => onChange('cuadricula')}
      >
        ▦ Cuadrícula
      </button>
    </div>
  );
}

export default function OfertarProductos() {
  const [listas, setListas] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [proveedorPerfilId, setProveedorPerfilId] =
    useState(null);

  const [filtros, setFiltros] = useState({
    producto: '',
    formato: '',
    marca: '',
    cantidad: '',
    precio: '',
    comuna: '',
    fecha: '',
    estado: '',
  });

  const [paginaActual, setPaginaActual] = useState(1);
  const [detalleContactoId, setDetalleContactoId] =
    useState(null);

  const [vista, setVista] = useState('lista');
  const [vistaLista, setVistaLista] = useState(true);
  const [esMobile, setEsMobile] = useState(false);

  const itemsPorPagina = 20;
  const router = useRouter();

  useEffect(() => {
    setVista(leerVistaPreferida());
  }, []);

  useEffect(() => {
    if (vista) {
      guardarVistaPreferida(vista);
    }
  }, [vista]);

  useEffect(() => {
    const evaluarViewport = () => {
      const mobile =
        window.innerWidth <= MOBILE_BREAKPOINT;

      setEsMobile(mobile);
      setVistaLista(!mobile);
    };

    evaluarViewport();

    window.addEventListener(
      'resize',
      evaluarViewport
    );

    return () =>
      window.removeEventListener(
        'resize',
        evaluarViewport
      );
  }, []);

  const vistaEfectiva =
    esMobile || !vistaLista
      ? 'cuadricula'
      : vista;

  const cambiarVista = (nuevaVista) => {
    if (
      nuevaVista === 'lista' &&
      !vistaLista
    ) {
      return;
    }

    setVista(nuevaVista);
  };

  useEffect(() => {
    const cargarDatos = async () => {
      const {
        data: userData,
        error: userError,
      } = await supabase.auth.getUser();

      if (
        userError ||
        !userData?.user
      ) {
        alert('Debes iniciar sesión.');
        router.push('/');
        return;
      }

      const {
        perfil: perfilProv,
      } = await resolveProveedorProfile(
        userData.user,
        {
          select: 'id, tipo',
        }
      );

      if (!perfilProv) {
        alert(
          'El usuario no tiene un perfil de proveedor asociado.'
        );

        return;
      }

      setProveedorPerfilId(
        perfilProv.id
      );

      const {
        data: listasData,
        error: listasError,
      } = await supabase
        .from('listas_compras')
        .select('*')
        .order(
          'fecha_creacion',
          {
            ascending: false,
          }
        );

      const listaIds =
        Array.from(
          new Set(
            (listasData || [])
              .map(
                (item) =>
                  item.lista_id
              )
              .filter(Boolean)
          )
        );

      let estadoPorLista = {};

      if (listaIds.length > 0) {
        const {
          data: cabecerasData,
          error: cabecerasError,
        } = await supabase
          .from('listas')
          .select('id, estado')
          .in('id', listaIds);

        if (cabecerasError) {
          console.error(
            'Error cargando estados de listas:',
            cabecerasError
          );

          return;
        }

        estadoPorLista =
          Object.fromEntries(
            (
              cabecerasData || []
            ).map((lista) => [
              lista.id,
              lista.estado,
            ])
          );
      }

      const {
        data: perfilesData,
        error: perfilesError,
      } = await supabase
        .from('perfiles')
        .select('*');

      const {
        data: ofertasData,
        error: ofertasError,
      } = await supabase
        .from(
          'ofertas_productos'
        )
        .select(
          'lista_id, proveedor_id, precio_ofertado, estado'
        )
        .eq(
          'proveedor_id',
          perfilProv.id
        );

      if (
        listasError ||
        perfilesError ||
        ofertasError
      ) {
        console.error(
          listasError ||
            perfilesError ||
            ofertasError
        );

        alert(
          'Error al cargar datos.'
        );

        return;
      }

      const authUserId =
        userData.user.id;

      const listasAjenas =
        (listasData || []).filter(
          (item) => {
            const perteneceAOtroUsuario =
              String(
                item.usuario_id || ''
              ) !==
              String(authUserId);

            const estaPublicada =
              !item.lista_id ||
              estadoPorLista[
                item.lista_id
              ] === 'publicada';

            return (
              perteneceAOtroUsuario &&
              estaPublicada
            );
          }
        );

      setUsuarios(
        perfilesData || []
      );

      const compradoresPorAuth =
        Object.fromEntries(
          (
            perfilesData || []
          )
            .filter(
              (p) =>
                String(
                  p.tipo || ''
                )
                  .trim()
                  .toLowerCase() ===
                  'comprador' &&
                p.auth_id
            )
            .map((p) => [
              String(
                p.auth_id
              )
                .trim()
                .toLowerCase(),
              p,
            ])
        );

      const enriquecida =
        listasAjenas
          .map((item) => {
            const perfilComprador =
              compradoresPorAuth[
                String(
                  item.usuario_id ||
                    ''
                )
                  .trim()
                  .toLowerCase()
              ] || null;

            const ofertaExistente =
              (
                ofertasData || []
              ).find(
                (o) =>
                  o.lista_id ===
                  item.id
              );

            return {
              ...item,

              comprador_email:
                item.comprador_email ||
                perfilComprador?.email ||
                'Desconocido',

              oferta:
                ofertaExistente
                  ? ofertaExistente.precio_ofertado
                  : '',

              incluye_despacho:
                false,

              tiempo_despacho_horas:
                '',

              ya_oferto:
                !!ofertaExistente,

              estado_oferta:
                ofertaExistente
                  ? ofertaExistente.estado
                  : null,
            };
          })
          .filter(
            (item) =>
              !item.ya_oferto
          );

      setListas(enriquecida);
    };

    cargarDatos();
  }, [router]);

  const calcularDiasRestantes = (
    fecha_cierre
  ) => {
    if (!fecha_cierre) {
      return '-';
    }

    const cierre =
      new Date(fecha_cierre);

    const hoy =
      new Date();

    const diff =
      cierre - hoy;

    if (diff <= 0) {
      return '0';
    }

    return Math.ceil(
      diff /
        (
          1000 *
          60 *
          60 *
          24
        )
    );
  };

  const manejarCambioOferta = (
    itemId,
    valor
  ) => {
    setListas((prev) =>
      prev.map((item) =>
        item.id === itemId
          ? {
              ...item,
              oferta: valor,
            }
          : item
      )
    );
  };

  const manejarDespacho = (
    itemId,
    valor
  ) => {
    setListas((prev) =>
      prev.map((item) =>
        item.id === itemId
          ? {
              ...item,
              incluye_despacho:
                valor,

              tiempo_despacho_horas:
                valor
                  ? item.tiempo_despacho_horas
                  : '',
            }
          : item
      )
    );
  };

  const manejarTiempoDespacho = (
    itemId,
    valor
  ) => {
    setListas((prev) =>
      prev.map((item) =>
        item.id === itemId
          ? {
              ...item,
              tiempo_despacho_horas:
                valor,
            }
          : item
      )
    );
  };

  const ofertarProducto = async (
    itemId
  ) => {
    if (!proveedorPerfilId) {
      alert(
        'No hay perfil de proveedor activo.'
      );

      return;
    }

    const producto =
      listas.find(
        (item) =>
          item.id === itemId
      );

    if (!producto) {
      return;
    }

    const ofertaLimpia =
      parseFloat(
        (
          producto.oferta ?? ''
        )
          .toString()
          .replace(/\./g, '')
      );

    if (
      isNaN(ofertaLimpia) ||
      ofertaLimpia <= 0
    ) {
      alert(
        'Por favor ingresa un valor numérico válido en la oferta.'
      );

      return;
    }

    if (
      producto.incluye_despacho &&
      !producto.tiempo_despacho_horas
    ) {
      alert(
        'Selecciona el tiempo de despacho.'
      );

      return;
    }

    if (
      producto.estado ===
        'cerrada' ||
      calcularDiasRestantes(
        producto.fecha_cierre
      ) === '0'
    ) {
      alert(
        'La licitación está cerrada.'
      );

      return;
    }

    if (producto.ya_oferto) {
      alert(
        'Ya enviaste una oferta para este producto. Puedes verla en Mis ofertas enviadas.'
      );

      setListas((prev) =>
        prev.filter(
          (item) =>
            item.id !==
            producto.id
        )
      );

      return;
    }

    const {
      data: ofertaDuplicada,
      error: dupError,
    } = await supabase
      .from(
        'ofertas_productos'
      )
      .select('id')
      .eq(
        'proveedor_id',
        proveedorPerfilId
      )
      .eq(
        'lista_id',
        producto.id
      )
      .maybeSingle();

    if (dupError) {
      alert(
        'Error al verificar ofertas existentes: ' +
          dupError.message
      );

      return;
    }

    if (ofertaDuplicada) {
      alert(
        'Ya enviaste una oferta para este producto. Puedes verla en Mis ofertas enviadas.'
      );

      setListas((prev) =>
        prev.filter(
          (item) =>
            item.id !==
            producto.id
        )
      );

      return;
    }

    const { error } =
      await supabase
        .from(
          'ofertas_productos'
        )
        .insert({
          lista_id:
            producto.id,

          proveedor_id:
            proveedorPerfilId,

          producto:
            producto.producto,

          formato:
            producto.formato,

          marca:
            producto.marca,

          precio_ofertado:
            ofertaLimpia,

          incluye_despacho:
            producto.incluye_despacho,

          tiempo_despacho_horas:
            producto.incluye_despacho
              ? Number(
                  producto.tiempo_despacho_horas
                )
              : null,

          estado:
            'pendiente',
        });

    if (error) {
      const esDuplicada =
        error.code ===
          '23505' ||
        (
          error.message || ''
        )
          .toLowerCase()
          .includes('unique');

      if (esDuplicada) {
        alert(
          'Ya enviaste una oferta para este producto. Puedes verla en Mis ofertas enviadas.'
        );

        setListas((prev) =>
          prev.filter(
            (item) =>
              item.id !==
              producto.id
          )
        );
      } else {
        alert(
          'Error al enviar oferta: ' +
            error.message
        );
      }
    } else {
      await supabase
        .from(
          'notificaciones'
        )
        .insert([
          {
            usuario_id:
              producto.usuario_id,

            rol:
              'comprador',

            titulo:
              'Nueva oferta recibida',

            mensaje:
              `Has recibido una oferta para el producto ${producto.producto}`,

            ruta:
              '/comprador?notif=ofertas&list_id=' +
              producto.id,

            leida: false,
          },
        ]);

      setListas((prev) =>
        prev.filter(
          (item) =>
            item.id !==
            producto.id
        )
      );

      alert(
        'Oferta enviada correctamente.'
      );
    }
  };

  const irDashboard = () => {
    router.push(
      '/proveedor/DashboardProveedor'
    );
  };

  const irDatosContacto = () => {
    router.push(
      '/proveedor/datos-contacto'
    );
  };

  const cambiarPerfil = () => {
    router.push(
      '/seleccionar-perfil'
    );
  };

  const cerrarSesion = async () => {
    const { error } =
      await supabase.auth.signOut();

    if (error) {
      console.error(
        'Error al cerrar sesión:',
        error
      );

      alert(
        'No se pudo cerrar la sesión.'
      );

      return;
    }

    localStorage.clear();
    router.push('/login');
  };

  const normalizarTexto = (t) =>
    t
      ? t
          .toUpperCase()
          .normalize('NFD')
          .replace(
            /[\u0300-\u036f]/g,
            ''
          )
      : '';

  const manejarCambioFiltro = (
    campo,
    valor
  ) => {
    setFiltros((prev) => ({
      ...prev,
      [campo]:
        valor.toUpperCase(),
    }));

    setPaginaActual(1);
  };

  const obtenerEstado = (
    item
  ) => {
    if (
      item.estado ===
      'cerrada'
    ) {
      return 'Cerrada';
    }

    switch (
      item.estado_oferta
    ) {
      case 'confirmada':
        return 'Confirmada';

      case 'en_espera_confirmacion':
        return 'En espera de confirmación';

      case 'rechazada':
        return 'Rechazada';

      case 'pendiente':
      case null:
      case undefined:
        if (item.ya_oferto) {
          return 'Oferta enviada';
        }

        break;

      default:
        if (item.ya_oferto) {
          return 'Oferta enviada';
        }
    }

    return 'Recibiendo ofertas';
  };
  const listasFiltradas = useMemo(() => {
  return listas.filter((item) => {
    const coincideProducto = normalizarTexto(item.producto).includes(
      normalizarTexto(filtros.producto)
    );

    const coincideFormato = normalizarTexto(item.formato).includes(
      normalizarTexto(filtros.formato)
    );

    const coincideMarca = normalizarTexto(item.marca).includes(
      normalizarTexto(filtros.marca)
    );

    const coincideCantidad = String(item.cantidad ?? "").includes(
      filtros.cantidad
    );

    const coincidePrecio = String(item.precio ?? "").includes(
      filtros.precio
    );

    const coincideComuna = normalizarTexto(
      item.comuna_despacho
    ).includes(normalizarTexto(filtros.comuna));

    const fechaTexto = item.fecha_creacion
      ? formatearFechaCorta(item.fecha_creacion)
      : "";

    const coincideFecha = fechaTexto.includes(filtros.fecha);

    const estado = obtenerEstado(item);

    const coincideEstado =
      !filtros.estado ||
      normalizarTexto(estado).includes(
        normalizarTexto(filtros.estado)
      );

    return (
      coincideProducto &&
      coincideFormato &&
      coincideMarca &&
      coincideCantidad &&
      coincidePrecio &&
      coincideComuna &&
      coincideFecha &&
      coincideEstado
    );
  });
}, [listas, filtros]);

const filas = useMemo(
  () => expandirItemsNormalizados(listasFiltradas),
  [listasFiltradas]
);

const totalPaginas = Math.ceil(
  filas.length / itemsPorPagina
);

const filasPaginadas = filas.slice(
  (paginaActual - 1) * itemsPorPagina,
  paginaActual * itemsPorPagina
);

const cambiarPagina = (numero) => {
  if (
    numero < 1 ||
    numero > totalPaginas
  ) {
    return;
  }

  setPaginaActual(numero);

  window.scrollTo({
    top: 0,
    behavior: "smooth",
  });
};

const formatearNumero = (valor) => {
  if (
    valor === null ||
    valor === undefined ||
    valor === ""
  ) {
    return "";
  }

  const numero = Number(
    String(valor).replace(/\./g, "")
  );

  if (Number.isNaN(numero)) {
    return valor;
  }

  return numero.toLocaleString("es-CL");
};

return (
  <AppLayout
    title="Ofertar productos"
    profileLabel="Proveedor"
    showProfileSwitch
    onChangeProfile={cambiarPerfil}
    onUpdateData={irDatosContacto}
    onDashboard={irDashboard}
    onLogout={cerrarSesion}
    notifications={
      <Notificaciones
        userId={proveedorPerfilId}
        rol="proveedor"
      />
    }
  >
    <main
      className="kyntu-main"
      style={styles.main}
    >
      <section
        className="kyntu-headerSection"
        style={styles.headerSection}
      >
        <div>
          <h1 style={styles.heading}>
            Solicitudes de compra
          </h1>

          <p style={styles.subtitle}>
            Revisa las solicitudes publicadas y
            envía tu mejor oferta.
          </p>
        </div>

        <SelectorVista
          vista={vistaEfectiva}
          onChange={cambiarVista}
          deshabilitarLista={!vistaLista}
        />
      </section>
            <section
        className="kyntu-filterCard"
        style={styles.filterCard}
      >
        <div style={styles.filterHeader}>
          <div>
            <h2 style={styles.filterTitle}>
              Filtros
            </h2>

            <p style={styles.filterSubtitle}>
              Encuentra rápidamente las solicitudes
              que te interesan.
            </p>
          </div>

          <button
            type="button"
            style={styles.clearFiltersButton}
            onClick={() => {
              setFiltros({
                producto: "",
                formato: "",
                marca: "",
                cantidad: "",
                precio: "",
                comuna: "",
                fecha: "",
                estado: "",
              });

              setPaginaActual(1);
            }}
          >
            Limpiar filtros
          </button>
        </div>

        <div
          className="kyntu-filterGrid"
          style={styles.filterGrid}
        >
          <input
            style={styles.filterInput}
            placeholder="Producto"
            value={filtros.producto}
            onChange={(e) =>
              manejarCambioFiltro(
                "producto",
                e.target.value
              )
            }
          />

          <input
            style={styles.filterInput}
            placeholder="Formato"
            value={filtros.formato}
            onChange={(e) =>
              manejarCambioFiltro(
                "formato",
                e.target.value
              )
            }
          />

          <input
            style={styles.filterInput}
            placeholder="Marca"
            value={filtros.marca}
            onChange={(e) =>
              manejarCambioFiltro(
                "marca",
                e.target.value
              )
            }
          />

          <input
            style={styles.filterInput}
            placeholder="Cantidad"
            value={filtros.cantidad}
            onChange={(e) =>
              manejarCambioFiltro(
                "cantidad",
                e.target.value
              )
            }
          />

          <input
            style={styles.filterInput}
            placeholder="Precio"
            value={filtros.precio}
            onChange={(e) =>
              manejarCambioFiltro(
                "precio",
                e.target.value
              )
            }
          />

          <input
            style={styles.filterInput}
            placeholder="Comuna"
            value={filtros.comuna}
            onChange={(e) =>
              manejarCambioFiltro(
                "comuna",
                e.target.value
              )
            }
          />

          <input
            style={styles.filterInput}
            placeholder="Fecha"
            value={filtros.fecha}
            onChange={(e) =>
              manejarCambioFiltro(
                "fecha",
                e.target.value
              )
            }
          />

          <input
            style={styles.filterInput}
            placeholder="Estado"
            value={filtros.estado}
            onChange={(e) =>
              manejarCambioFiltro(
                "estado",
                e.target.value
              )
            }
          />
        </div>
      </section>
            {vistaEfectiva === 'lista' ? (
        <div
          className="kyntu-tableWrapper"
          style={styles.tableWrapper}
        >
          <table
            className="kyntu-table"
            style={styles.table}
          >
            <thead>
              <tr style={styles.tableHeadRow}>
                <th style={styles.tableHeader}>
                  Producto
                </th>

                <th style={styles.tableHeader}>
                  Formato
                </th>

                <th style={styles.tableHeader}>
                  Cantidad
                </th>

                <th style={styles.tableHeader}>
                  Precio referencia
                </th>

                <th style={styles.tableHeader}>
                  Detalle del pedido
                </th>

                <th style={styles.tableHeader}>
                  Comuna
                </th>

                <th style={styles.tableHeader}>
                  Fecha
                </th>

                <th style={styles.tableHeader}>
                  Días restantes
                </th>

                <th style={styles.tableHeader}>
                  Estado
                </th>

                <th style={styles.tableHeader}>
                  Tu oferta
                </th>

                <th style={styles.tableHeader}>
                  Despacho
                </th>

                <th style={styles.tableHeader}>
                  Acción
                </th>
              </tr>
            </thead>

            <tbody>
              {filasPaginadas.map((fila) => {
                const estado =
                  obtenerEstado(fila);

                const puedeOfertar =
                  !fila.ya_oferto &&
                  fila.estado !==
                    'cerrada';

                const esConfirmada =
                  fila.estado_oferta ===
                  'confirmada';

                return (
                  <React.Fragment
                    key={fila.rowKey}
                  >
                    <tr
                      className="kyntu-tableRow"
                      style={styles.tableRow}
                    >
                      {fila.esPrimeraFilaFormato && (
                        <td
                          rowSpan={
                            fila.totalFormatos
                          }
                          style={{
                            ...styles.tableCell,
                            ...styles.productCell,
                          }}
                        >
                          <strong
                            style={
                              styles.tableProductName
                            }
                          >
                            {fila.producto ||
                              '—'}
                          </strong>

                          <span
                            style={
                              styles.tableProductBrand
                            }
                          >
                            Marca:{' '}
                            {fila.marca ||
                              '—'}
                          </span>
                        </td>
                      )}

                      <td
                        style={
                          styles.tableCell
                        }
                      >
                        {fila.formato ||
                          '—'}
                      </td>

                      <td
                        style={
                          styles.tableCell
                        }
                      >
                        {fila.cantidad ??
                          '—'}
                      </td>

                      <td
                        style={
                          styles.tableCell
                        }
                      >
                        {fila.precio !==
                          '' &&
                        fila.precio !==
                          null &&
                        fila.precio !==
                          undefined
                          ? `$${formatearNumero(
                              fila.precio
                            )}`
                          : '—'}
                      </td>

                      <td
                        style={{
                          ...styles.tableCell,
                          ...styles.detailCell,
                        }}
                      >
                        <DetallePedidoCelda
                          detalle={
                            fila.detalle_pedido
                          }
                        />
                      </td>

                      {fila.esPrimeraFilaFormato && (
                        <>
                          <td
                            rowSpan={
                              fila.totalFormatos
                            }
                            style={
                              styles.tableCell
                            }
                          >
                            {fila.comuna ||
                              '—'}
                          </td>

                          <td
                            rowSpan={
                              fila.totalFormatos
                            }
                            style={
                              styles.tableCell
                            }
                          >
                            {formatearFechaCorta(
                              fila.fecha
                            )}
                          </td>

                          <td
                            rowSpan={
                              fila.totalFormatos
                            }
                            style={{
                              ...styles.tableCell,
                              ...styles.centerCell,
                            }}
                          >
                            {calcularDiasRestantes(
                              fila.fecha_cierre
                            )}
                          </td>

                          <td
                            rowSpan={
                              fila.totalFormatos
                            }
                            style={
                              styles.tableCell
                            }
                          >
                            <span
                              style={getEstadoStyle(
                                estado,
                                true
                              )}
                            >
                              {estado}
                            </span>
                          </td>

                          <td
                            rowSpan={
                              fila.totalFormatos
                            }
                            style={{
                              ...styles.tableCell,
                              ...styles.offerTableCell,
                            }}
                          >
                            <BloqueOferta
                              fila={fila}
                              variant="lista"
                              onChange={
                                manejarCambioOferta
                              }
                              formatearNumero={
                                formatearNumero
                              }
                            />
                          </td>

                          <td
                            rowSpan={
                              fila.totalFormatos
                            }
                            style={{
                              ...styles.tableCell,
                              ...styles.deliveryTableCell,
                            }}
                          >
                            {fila.ya_oferto ||
                            fila.estado ===
                              'cerrada' ? (
                              <span
                                style={
                                  styles.metaValue
                                }
                              >
                                No
                              </span>
                            ) : (
                              <div
                                style={
                                  styles.deliveryBoxCompact
                                }
                              >
                                <label
                                  style={
                                    styles.checkLabel
                                  }
                                >
                                  <input
                                    type="checkbox"
                                    checked={Boolean(
                                      fila.incluye_despacho
                                    )}
                                    onChange={(
                                      e
                                    ) =>
                                      manejarDespacho(
                                        fila.itemId,
                                        e.target
                                          .checked
                                      )
                                    }
                                    style={
                                      styles.checkbox
                                    }
                                  />

                                  {fila.incluye_despacho
                                    ? 'Sí'
                                    : 'No'}
                                </label>

                                {fila.incluye_despacho && (
                                  <select
                                    value={
                                      fila.tiempo_despacho_horas ||
                                      ''
                                    }
                                    onChange={(
                                      e
                                    ) =>
                                      manejarTiempoDespacho(
                                        fila.itemId,
                                        e.target
                                          .value
                                      )
                                    }
                                    className="kyntu-select"
                                    style={
                                      styles.selectCompact
                                    }
                                  >
                                    <option value="">
                                      Plazo
                                    </option>

                                    <option value="24">
                                      24 h
                                    </option>

                                    <option value="48">
                                      48 h
                                    </option>

                                    <option value="72">
                                      72 h
                                    </option>

                                    <option value="96">
                                      72+ h
                                    </option>
                                  </select>
                                )}
                              </div>
                            )}
                          </td>

                          <td
                            rowSpan={
                              fila.totalFormatos
                            }
                            style={{
                              ...styles.tableCell,
                              ...styles.actionTableCell,
                            }}
                          >
                            {esConfirmada ? (
                              <button
                                type="button"
                                onClick={() =>
                                  setDetalleContactoId(
                                    detalleContactoId ===
                                      fila.itemId
                                      ? null
                                      : fila.itemId
                                  )
                                }
                                className="kyntu-smallButton"
                                style={
                                  styles.smallButton
                                }
                              >
                                Ver contacto
                              </button>
                            ) : puedeOfertar ? (
                              <button
                                type="button"
                                onClick={() =>
                                  ofertarProducto(
                                    fila.itemId
                                  )
                                }
                                className="kyntu-mainButtonSmall"
                                style={
                                  styles.mainButtonSmall
                                }
                              >
                                Enviar oferta
                              </button>
                            ) : (
                              <span
                                style={
                                  styles.emptyAction
                                }
                              >
                                No disponible
                              </span>
                            )}
                          </td>
                        </>
                      )}
                    </tr>

                    {fila.esPrimeraFilaFormato &&
                      esConfirmada &&
                      detalleContactoId ===
                        fila.itemId && (
                        <tr
                          style={
                            styles.contactTableRow
                          }
                        >
                          <td
                            colSpan="12"
                            style={
                              styles.contactTableCell
                            }
                          >
                            <div
                              style={
                                styles.contactBox
                              }
                            >
                              <strong>
                                Datos de
                                contacto
                              </strong>

                              <div
                                style={
                                  styles.contactText
                                }
                              >
                                <p>
                                  <strong>
                                    Correo:
                                  </strong>{' '}
                                  {
                                    fila.comprador_email
                                  }
                                </p>

                                <p>
                                  <strong>
                                    Precio
                                    aceptado:
                                  </strong>{' '}
                                  $
                                  {formatearNumero(
                                    fila.oferta
                                  )}
                                </p>

                                <p>
                                  <strong>
                                    Dirección de
                                    despacho:
                                  </strong>{' '}
                                  {fila.comuna}
                                </p>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
            <div
        className="kyntu-grid"
        style={styles.grid}
      >
        {listasFiltradas.map((item) => {
          const estado = obtenerEstado(item);

          const puedeOfertar =
            !item.ya_oferto &&
            item.estado !== "cerrada";

          const esConfirmada =
            item.estado_oferta === "confirmada";

          return (
            <article
              key={item.id}
              className="kyntu-card"
              style={styles.card}
            >
              <div style={styles.cardHeader}>
                <div>
                  <span style={styles.cardLabel}>
                    Producto
                  </span>

                  <h3 style={styles.cardTitle}>
                    {item.producto}
                  </h3>

                  <span style={styles.cardBrand}>
                    {item.marca || "Sin marca"}
                  </span>
                </div>

                <span
                  style={getEstadoStyle(
                    estado,
                    false
                  )}
                >
                  {estado}
                </span>
              </div>

              <div style={styles.cardBody}>
                {normalizarFormatosItem(item).map(
                  (formato, index) => (
                    <div
                      key={index}
                      style={
                        styles.formatCard
                      }
                    >
                      <div
                        style={
                          styles.formatHeader
                        }
                      >
                        <span
                          style={
                            styles.metaLabel
                          }
                        >
                          Formato
                        </span>

                        <strong>
                          {formato.formato ||
                            "—"}
                        </strong>
                      </div>

                      <div
                        style={
                          styles.metaGrid
                        }
                      >
                        <div>
                          <span
                            style={
                              styles.metaLabel
                            }
                          >
                            Cantidad
                          </span>

                          <div
                            style={
                              styles.metaValue
                            }
                          >
                            {formato.cantidad ??
                              "—"}
                          </div>
                        </div>

                        <div>
                          <span
                            style={
                              styles.metaLabel
                            }
                          >
                            Precio referencia
                          </span>

                          <div
                            style={
                              styles.metaValue
                            }
                          >
                            {formato.precio
                              ? `$${formatearNumero(
                                  formato.precio
                                )}`
                              : "—"}
                          </div>
                        </div>
                      </div>

                      <DetallePedidoBloque
                        detalle={
                          formato.detalle_pedido
                        }
                      />
                    </div>
                  )
                )}

                <div
                  style={styles.metaGrid}
                >
                  <div>
                    <span
                      style={
                        styles.metaLabel
                      }
                    >
                      Comuna
                    </span>

                    <div
                      style={
                        styles.metaValue
                      }
                    >
                      {item.comuna_despacho}
                    </div>
                  </div>

                  <div>
                    <span
                      style={
                        styles.metaLabel
                      }
                    >
                      Fecha
                    </span>

                    <div
                      style={
                        styles.metaValue
                      }
                    >
                      {formatearFechaCorta(
                        item.fecha_creacion
                      )}
                    </div>
                  </div>

                  <div>
                    <span
                      style={
                        styles.metaLabel
                      }
                    >
                      Días restantes
                    </span>

                    <div
                      style={
                        styles.metaValue
                      }
                    >
                      {calcularDiasRestantes(
                        item.fecha_cierre
                      )}
                    </div>
                  </div>
                </div>

                <BloqueOferta
                  fila={item}
                  variant="grid"
                  onChange={
                    manejarCambioOferta
                  }
                  formatearNumero={
                    formatearNumero
                  }
                />
                              {!item.ya_oferto &&
                  item.estado !== "cerrada" && (
                    <div style={styles.deliveryBox}>
                      <label style={styles.checkLabel}>
                        <input
                          type="checkbox"
                          checked={Boolean(item.incluye_despacho)}
                          onChange={(e) =>
                            manejarDespacho(
                              item.id,
                              e.target.checked
                            )
                          }
                          style={styles.checkbox}
                        />

                        Incluye despacho
                      </label>

                      {item.incluye_despacho && (
                        <select
                          value={
                            item.tiempo_despacho_horas || ""
                          }
                          onChange={(e) =>
                            manejarTiempoDespacho(
                              item.id,
                              e.target.value
                            )
                          }
                          className="kyntu-select"
                          style={styles.select}
                        >
                          <option value="">
                            Tiempo de despacho
                          </option>

                          <option value="24">
                            24 horas
                          </option>

                          <option value="48">
                            48 horas
                          </option>

                          <option value="72">
                            72 horas
                          </option>

                          <option value="96">
                            Más de 72 horas
                          </option>
                        </select>
                      )}
                    </div>
                  )}

                {esConfirmada &&
                  detalleContactoId === item.id && (
                    <div style={styles.contactBox}>
                      <strong>
                        Datos de contacto
                      </strong>

                      <div style={styles.contactText}>
                        <p>
                          <strong>
                            Correo:
                          </strong>{" "}
                          {item.comprador_email}
                        </p>

                        <p>
                          <strong>
                            Precio aceptado:
                          </strong>{" "}
                          $
                          {formatearNumero(item.oferta)}
                        </p>

                        <p>
                          <strong>
                            Comuna:
                          </strong>{" "}
                          {item.comuna_despacho}
                        </p>
                      </div>
                    </div>
                  )}
              </div>

              <div style={styles.cardFooter}>
                {esConfirmada ? (
                  <button
                    type="button"
                    style={styles.secondaryButton}
                    onClick={() =>
                      setDetalleContactoId(
                        detalleContactoId === item.id
                          ? null
                          : item.id
                      )
                    }
                  >
                    {detalleContactoId === item.id
                      ? "Ocultar contacto"
                      : "Ver contacto"}
                  </button>
                ) : puedeOfertar ? (
                  <button
                    type="button"
                    style={styles.mainButton}
                    onClick={() =>
                      ofertarProducto(item.id)
                    }
                  >
                    Enviar oferta
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled
                    style={styles.disabledButton}
                  >
                    No disponible
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>
      )}

      {totalPaginas > 1 && (
        <div style={styles.pagination}>
          <button
            type="button"
            style={styles.pageButton}
            disabled={paginaActual === 1}
            onClick={() =>
              cambiarPagina(
                paginaActual - 1
              )
            }
          >
            Anterior
          </button>

          {Array.from(
            { length: totalPaginas },
            (_, i) => i + 1
          ).map((pagina) => (
            <button
              key={pagina}
              type="button"
              onClick={() =>
                cambiarPagina(pagina)
              }
              style={{
                ...styles.pageButton,
                ...(paginaActual === pagina
                  ? styles.pageButtonActive
                  : {}),
              }}
            >
              {pagina}
            </button>
          ))}

          <button
            type="button"
            style={styles.pageButton}
            disabled={
              paginaActual === totalPaginas
            }
            onClick={() =>
              cambiarPagina(
                paginaActual + 1
              )
            }
          >
            Siguiente
          </button>
        </div>
      )}
    </main>

    <style jsx>{`
      @media (max-width: 820px) {
        .kyntu-filterGrid {
          grid-template-columns: 1fr !important;
        }

        .kyntu-grid {
          grid-template-columns: 1fr !important;
        }
      }
    `}</style>
  </AppLayout>
);
}
const styles = {
  main: {
    width: '100%',
    maxWidth: '1500px',
    margin: '0 auto',
    padding: '32px 24px 48px',
    boxSizing: 'border-box',
  },

  headerSection: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '24px',
    marginBottom: '24px',
    padding: '26px 28px',
    borderRadius: '22px',
    background:
      'linear-gradient(135deg, rgba(255,255,255,0.98), rgba(244,249,255,0.98))',
    border: '1px solid #dce7f4',
    boxShadow: '0 18px 45px rgba(32, 73, 130, 0.08)',
  },

  heading: {
    margin: 0,
    color: '#071c41',
    fontSize: 'clamp(25px, 3vw, 34px)',
    lineHeight: 1.15,
    fontWeight: 900,
    letterSpacing: '-0.035em',
  },

  subtitle: {
    margin: '8px 0 0',
    color: '#65758b',
    fontSize: '14px',
    lineHeight: 1.6,
  },

  viewToggle: {
    display: 'inline-flex',
    alignItems: 'stretch',
    flexShrink: 0,
    overflow: 'hidden',
    borderRadius: '12px',
    border: '1px solid #d4dfec',
    background: '#ffffff',
    boxShadow: '0 7px 18px rgba(34, 67, 110, 0.06)',
  },

  viewToggleBtn: {
    minHeight: '42px',
    padding: '9px 15px',
    border: 'none',
    borderRight: '1px solid #e2e9f2',
    background: '#ffffff',
    color: '#607086',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: 800,
    whiteSpace: 'nowrap',
  },

  viewToggleBtnActive: {
    background: 'linear-gradient(135deg, #176bff, #438cff)',
    color: '#ffffff',
    boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.15)',
  },

  viewToggleBtnDisabled: {
    opacity: 0.45,
    cursor: 'not-allowed',
  },

  filterCard: {
    marginBottom: '24px',
    padding: '22px',
    borderRadius: '20px',
    background: '#ffffff',
    border: '1px solid #dfe8f3',
    boxShadow: '0 14px 38px rgba(32, 73, 130, 0.07)',
  },

  filterHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: '18px',
    marginBottom: '18px',
  },

  filterTitle: {
    margin: 0,
    color: '#071c41',
    fontSize: '19px',
    lineHeight: 1.25,
    fontWeight: 900,
  },

  filterSubtitle: {
    margin: '5px 0 0',
    color: '#748399',
    fontSize: '13px',
    lineHeight: 1.5,
  },

  clearFiltersButton: {
    minHeight: '38px',
    padding: '8px 14px',
    flexShrink: 0,
    borderRadius: '10px',
    border: '1px solid #cfdbea',
    background: '#f8fbff',
    color: '#315173',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: 800,
  },

  filterGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, minmax(150px, 1fr))',
    gap: '12px',
  },

  filterInput: {
    width: '100%',
    minWidth: 0,
    minHeight: '43px',
    padding: '10px 12px',
    boxSizing: 'border-box',
    borderRadius: '11px',
    border: '1px solid #ccd9e8',
    background: '#fbfdff',
    color: '#183354',
    outline: 'none',
    fontSize: '13px',
  },

  tableWrapper: {
    width: '100%',
    overflowX: 'auto',
    marginBottom: '24px',
    borderRadius: '18px',
    border: '1px solid #dfe8f3',
    background: '#ffffff',
    boxShadow: '0 16px 42px rgba(32, 73, 130, 0.07)',
  },

  table: {
    width: '100%',
    minWidth: '1380px',
    borderCollapse: 'separate',
    borderSpacing: 0,
    tableLayout: 'auto',
  },

  tableHeadRow: {
    background: '#f3f7fc',
  },

  tableHeader: {
    padding: '13px 10px',
    borderBottom: '1px solid #dce5f0',
    color: '#52647b',
    background: '#f3f7fc',
    textAlign: 'center',
    verticalAlign: 'middle',
    fontSize: '11px',
    lineHeight: 1.3,
    fontWeight: 900,
    textTransform: 'uppercase',
    letterSpacing: '0.035em',
    whiteSpace: 'nowrap',
  },

  tableRow: {
    background: '#ffffff',
  },

  tableCell: {
    padding: '12px 10px',
    borderBottom: '1px solid #e7edf5',
    color: '#293f5f',
    background: '#ffffff',
    textAlign: 'center',
    verticalAlign: 'middle',
    fontSize: '12px',
    lineHeight: 1.45,
  },

  productCell: {
    minWidth: '150px',
    textAlign: 'left',
  },

  tableProductName: {
    display: 'block',
    color: '#102b50',
    fontSize: '13px',
    lineHeight: 1.4,
    fontWeight: 900,
    overflowWrap: 'anywhere',
  },

  tableProductBrand: {
    display: 'block',
    marginTop: '5px',
    color: '#758399',
    fontSize: '11px',
    lineHeight: 1.4,
    overflowWrap: 'anywhere',
  },

  detailCell: {
    width: '210px',
    minWidth: '180px',
    maxWidth: '240px',
    textAlign: 'left',
    verticalAlign: 'top',
  },

  centerCell: {
    textAlign: 'center',
    fontWeight: 800,
  },

  offerTableCell: {
    width: '160px',
    minWidth: '150px',
  },

  deliveryTableCell: {
    width: '120px',
    minWidth: '110px',
  },

  actionTableCell: {
    width: '130px',
    minWidth: '120px',
  },

  detalleCelda: {
    display: '-webkit-box',
    color: '#344a68',
    fontSize: '12px',
    lineHeight: 1.45,
    overflow: 'hidden',
    overflowWrap: 'anywhere',
    WebkitBoxOrient: 'vertical',
    WebkitLineClamp: 4,
  },

  detalleEmpty: {
    color: '#9aa8ba',
  },
    grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
    gap: '20px',
    marginBottom: '24px',
  },

  card: {
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
    overflow: 'hidden',
    borderRadius: '20px',
    border: '1px solid #dde7f2',
    background: '#ffffff',
    boxShadow: '0 16px 40px rgba(32, 73, 130, 0.08)',
  },

  cardHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: '16px',
    padding: '20px',
    borderBottom: '1px solid #e6edf5',
    background:
      'linear-gradient(135deg, #f8fbff 0%, #ffffff 100%)',
  },

  cardLabel: {
    display: 'block',
    marginBottom: '5px',
    color: '#7c899b',
    fontSize: '10px',
    lineHeight: 1.3,
    fontWeight: 900,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
  },

  cardTitle: {
    margin: 0,
    color: '#102b50',
    fontSize: '20px',
    lineHeight: 1.25,
    fontWeight: 900,
    letterSpacing: '-0.02em',
    overflowWrap: 'anywhere',
  },

  cardBrand: {
    display: 'block',
    marginTop: '6px',
    color: '#6f7f94',
    fontSize: '12px',
    lineHeight: 1.4,
  },

  cardBody: {
    display: 'flex',
    flex: 1,
    flexDirection: 'column',
    gap: '16px',
    padding: '20px',
  },

  formatCard: {
    padding: '15px',
    borderRadius: '14px',
    border: '1px solid #e0e8f2',
    background: '#f8fbff',
  },

  formatHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    marginBottom: '14px',
    color: '#183354',
    fontSize: '13px',
  },

  metaGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: '14px',
  },

  metaLabel: {
    display: 'block',
    marginBottom: '4px',
    color: '#8290a3',
    fontSize: '10px',
    lineHeight: 1.3,
    fontWeight: 900,
    textTransform: 'uppercase',
    letterSpacing: '0.055em',
  },

  metaValue: {
    color: '#28415f',
    fontSize: '13px',
    lineHeight: 1.45,
    fontWeight: 700,
    overflowWrap: 'anywhere',
  },

  detalleBox: {
    marginTop: '13px',
    padding: '12px',
    borderRadius: '11px',
    border: '1px solid #d9e5f3',
    background: '#ffffff',
  },

  detalleLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    marginBottom: '6px',
    color: '#315b8a',
    fontSize: '11px',
    fontWeight: 900,
  },

  detalleIcon: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '17px',
    height: '17px',
    flexShrink: 0,
    borderRadius: '50%',
    background: '#e8f1ff',
    color: '#176bff',
    fontSize: '11px',
    fontWeight: 900,
  },

  detalleText: {
    margin: 0,
    color: '#4d6078',
    fontSize: '12px',
    lineHeight: 1.55,
    overflowWrap: 'anywhere',
  },

  offerHighlightBox: {
    display: 'flex',
    flexDirection: 'column',
    gap: '9px',
    padding: '16px',
    borderRadius: '15px',
    border: '1px solid #cddfff',
    background:
      'linear-gradient(135deg, rgba(23,107,255,0.08), rgba(67,140,255,0.03))',
  },

  offerHighlightBoxCompact: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    minWidth: 0,
    padding: '10px',
    borderRadius: '11px',
    border: '1px solid #d2e1fa',
    background: '#f5f9ff',
  },

  offerBlockHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
  },

  offerBlockTitle: {
    color: '#173c69',
    fontSize: '12px',
    lineHeight: 1.3,
    fontWeight: 900,
  },

  offerBlockHint: {
    color: '#75869c',
    fontSize: '10px',
    lineHeight: 1.4,
    textAlign: 'right',
  },

  offerBlockHintCompact: {
    color: '#7a899d',
    fontSize: '9px',
    lineHeight: 1.3,
  },

  offerInputGrid: {
    width: '100%',
    minHeight: '45px',
    padding: '10px 13px',
    boxSizing: 'border-box',
    borderRadius: '11px',
    border: '1px solid #a9c6ef',
    background: '#ffffff',
    color: '#102b50',
    outline: 'none',
    fontSize: '14px',
    fontWeight: 800,
  },

  offerInputLista: {
    width: '100%',
    minWidth: 0,
    minHeight: '37px',
    padding: '8px 9px',
    boxSizing: 'border-box',
    borderRadius: '9px',
    border: '1px solid #afc8eb',
    background: '#ffffff',
    color: '#102b50',
    outline: 'none',
    fontSize: '11px',
    fontWeight: 800,
  },

  sentOffer: {
    color: '#176bff',
    fontSize: '16px',
    lineHeight: 1.3,
    fontWeight: 900,
  },

  deliveryBox: {
    display: 'flex',
    flexDirection: 'column',
    gap: '11px',
    padding: '14px',
    borderRadius: '14px',
    border: '1px solid #e0e8f2',
    background: '#fafcff',
  },

  deliveryBoxCompact: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '7px',
  },

  checkLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    color: '#314c6c',
    cursor: 'pointer',
    fontSize: '12px',
    lineHeight: 1.4,
    fontWeight: 800,
  },

  checkbox: {
    width: '17px',
    height: '17px',
    flexShrink: 0,
    cursor: 'pointer',
    accentColor: '#176bff',
  },

  select: {
    width: '100%',
    minHeight: '42px',
    padding: '9px 11px',
    boxSizing: 'border-box',
    borderRadius: '10px',
    border: '1px solid #ccd9e8',
    background: '#ffffff',
    color: '#28415f',
    outline: 'none',
    cursor: 'pointer',
    fontSize: '12px',
  },

  selectCompact: {
    width: '100%',
    minWidth: '88px',
    minHeight: '34px',
    padding: '6px 7px',
    boxSizing: 'border-box',
    borderRadius: '8px',
    border: '1px solid #ccd9e8',
    background: '#ffffff',
    color: '#28415f',
    outline: 'none',
    cursor: 'pointer',
    fontSize: '10px',
  },

  cardFooter: {
    padding: '16px 20px 20px',
    borderTop: '1px solid #e6edf5',
    background: '#fbfdff',
  },

  mainButton: {
    width: '100%',
    minHeight: '45px',
    padding: '11px 18px',
    border: 'none',
    borderRadius: '11px',
    background: 'linear-gradient(135deg, #176bff, #438cff)',
    boxShadow: '0 10px 22px rgba(23,107,255,0.22)',
    color: '#ffffff',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 900,
  },

  mainButtonSmall: {
    width: '100%',
    minHeight: '36px',
    padding: '8px 10px',
    border: 'none',
    borderRadius: '9px',
    background: 'linear-gradient(135deg, #176bff, #438cff)',
    boxShadow: '0 7px 16px rgba(23,107,255,0.18)',
    color: '#ffffff',
    cursor: 'pointer',
    fontSize: '10px',
    lineHeight: 1.3,
    fontWeight: 900,
  },

  secondaryButton: {
    width: '100%',
    minHeight: '45px',
    padding: '11px 18px',
    borderRadius: '11px',
    border: '1px solid #a9c5e8',
    background: '#f5f9ff',
    color: '#24507f',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 900,
  },

  smallButton: {
    width: '100%',
    minHeight: '36px',
    padding: '8px 10px',
    borderRadius: '9px',
    border: '1px solid #a9c5e8',
    background: '#f5f9ff',
    color: '#24507f',
    cursor: 'pointer',
    fontSize: '10px',
    lineHeight: 1.3,
    fontWeight: 900,
  },

  disabledButton: {
    width: '100%',
    minHeight: '45px',
    padding: '11px 18px',
    border: '1px solid #d9e1eb',
    borderRadius: '11px',
    background: '#edf1f6',
    color: '#9aa7b7',
    cursor: 'not-allowed',
    fontSize: '13px',
    fontWeight: 800,
  },

  emptyAction: {
    color: '#9aa7b7',
    fontSize: '10px',
    fontWeight: 700,
  },

  contactTableRow: {
    background: '#f8fbff',
  },

  contactTableCell: {
    padding: '12px 18px 18px',
    borderBottom: '1px solid #e4ebf4',
    background: '#f8fbff',
  },

  contactBox: {
    padding: '15px',
    borderRadius: '13px',
    border: '1px solid #b9d3f2',
    background: '#f2f8ff',
    color: '#234b77',
    fontSize: '12px',
    lineHeight: 1.5,
  },

  contactText: {
    display: 'grid',
    gap: '5px',
    marginTop: '9px',
  },

  pagination: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    flexWrap: 'wrap',
    marginTop: '8px',
  },

  pageButton: {
    minWidth: '40px',
    minHeight: '38px',
    padding: '8px 12px',
    borderRadius: '9px',
    border: '1px solid #ccd9e8',
    background: '#ffffff',
    color: '#365372',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: 800,
  },

  pageButtonActive: {
    borderColor: '#176bff',
    background: '#176bff',
    color: '#ffffff',
    boxShadow: '0 7px 16px rgba(23,107,255,0.2)',
  },

  srOnly: {
    position: 'absolute',
    width: '1px',
    height: '1px',
    padding: 0,
    margin: '-1px',
    overflow: 'hidden',
    clip: 'rect(0, 0, 0, 0)',
    whiteSpace: 'nowrap',
    border: 0,
  },
};

function getEstadoStyle(estado, compacto = false) {
  const base = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    maxWidth: '100%',
    padding: compacto ? '5px 8px' : '7px 10px',
    borderRadius: '999px',
    fontSize: compacto ? '9px' : '10px',
    lineHeight: 1.25,
    fontWeight: 900,
    textAlign: 'center',
    whiteSpace: 'normal',
  };

  switch (estado) {
    case 'Confirmada':
      return {
        ...base,
        background: '#e8f8ef',
        border: '1px solid #b8e4c9',
        color: '#237444',
      };

    case 'En espera de confirmación':
      return {
        ...base,
        background: '#fff6df',
        border: '1px solid #f0d69a',
        color: '#8a6214',
      };

    case 'Rechazada':
      return {
        ...base,
        background: '#fff0f0',
        border: '1px solid #f0bebe',
        color: '#a43c3c',
      };

    case 'Cerrada':
      return {
        ...base,
        background: '#edf0f4',
        border: '1px solid #d3d9e1',
        color: '#677486',
      };

    case 'Oferta enviada':
      return {
        ...base,
        background: '#e9f2ff',
        border: '1px solid #bed5f5',
        color: '#225d9f',
      };

    default:
      return {
        ...base,
        background: '#edf8f6',
        border: '1px solid #bce3dc',
        color: '#287568',
      };
  }
}
