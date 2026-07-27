import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { resolveProveedorProfile } from '../../lib/resolveProveedorProfile';
import { useRouter } from 'next/router';

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
    if (valor === 'lista' || valor === 'cuadricula') return valor;
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
    <span className="kyntu-detalleCelda" style={styles.detalleCelda} title={detalle}>
      {detalle}
    </span>
  );
}

function BloqueOferta({ fila, variant, onChange, formatearNumero }) {
  const compacto = variant === 'lista';
  const boxStyle = compacto
    ? styles.offerHighlightBoxCompact
    : styles.offerHighlightBox;
  const inputId = `oferta-${fila.itemId}`;

  if (fila.ya_oferto) {
    return (
      <div className="kyntu-offerHighlight" style={boxStyle}>
        <span style={styles.offerBlockTitle}>Tu oferta</span>
        <span style={styles.sentOffer}>${formatearNumero(fila.oferta)}</span>
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
        <span style={styles.offerBlockHintCompact}>Ingresa tu precio</span>
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
        style={compacto ? styles.offerInputLista : styles.offerInputGrid}
      />
    </div>
  );
}

function SelectorVista({ vista, onChange, deshabilitarLista }) {
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
          ...(vista === 'lista' ? styles.viewToggleBtnActive : {}),
          ...(deshabilitarLista ? styles.viewToggleBtnDisabled : {}),
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
          ...(vista === 'cuadricula' ? styles.viewToggleBtnActive : {}),
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
  const [proveedorPerfilId, setProveedorPerfilId] = useState(null);
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
  const [detalleContactoId, setDetalleContactoId] = useState(null);
  const [vista, setVista] = useState('lista');
  const [vistaLista, setVistaLista] = useState(true);
  const [esMobile, setEsMobile] = useState(false);
  const itemsPorPagina = 20;
  const router = useRouter();

  useEffect(() => {
    setVista(leerVistaPreferida());
  }, []);

  useEffect(() => {
    if (vista) guardarVistaPreferida(vista);
  }, [vista]);

  useEffect(() => {
    const evaluarViewport = () => {
      const mobile = window.innerWidth <= MOBILE_BREAKPOINT;
      setEsMobile(mobile);
      setVistaLista(!mobile);
    };

    evaluarViewport();
    window.addEventListener('resize', evaluarViewport);
    return () => window.removeEventListener('resize', evaluarViewport);
  }, []);

  const vistaEfectiva = esMobile || !vistaLista ? 'cuadricula' : vista;

  const cambiarVista = (nuevaVista) => {
    if (nuevaVista === 'lista' && !vistaLista) return;
    setVista(nuevaVista);
  };

  useEffect(() => {
    const cargarDatos = async () => {
      const { data: userData, error: userError } = await supabase.auth.getUser();

      if (userError || !userData?.user) {
        alert('Debes iniciar sesión.');
        router.push('/');
        return;
      }

      const { perfil: perfilProv } = await resolveProveedorProfile(userData.user, {
        select: 'id, tipo',
      });

      if (!perfilProv) {
        alert('El usuario no tiene un perfil de proveedor asociado.');
        return;
      }

      setProveedorPerfilId(perfilProv.id);

      const { data: listasData, error: listasError } = await supabase
        .from('listas_compras')
        .select('*')
        .order('fecha_creacion', { ascending: false });

      const listaIds = Array.from(
        new Set((listasData || []).map((item) => item.lista_id).filter(Boolean))
      );

      let estadoPorLista = {};

      if (listaIds.length > 0) {
        const { data: cabecerasData, error: cabecerasError } = await supabase
          .from('listas')
          .select('id, estado')
          .in('id', listaIds);

        if (cabecerasError) {
          console.error('Error cargando estados de listas:', cabecerasError);
          return;
        }

        estadoPorLista = Object.fromEntries(
          (cabecerasData || []).map((lista) => [lista.id, lista.estado])
        );
      }

      const { data: perfilesData, error: perfilesError } = await supabase
        .from('perfiles')
        .select('*');

      const { data: ofertasData, error: ofertasError } = await supabase
        .from('ofertas_productos')
        .select('lista_id, proveedor_id, precio_ofertado, estado')
        .eq('proveedor_id', perfilProv.id);

      if (listasError || perfilesError || ofertasError) {
        console.error(listasError || perfilesError || ofertasError);
        alert('Error al cargar datos.');
        return;
      }

      const authUserId = userData.user.id;
      const listasAjenas = (listasData || []).filter((item) => {
        const perteneceAOtroUsuario =
          String(item.usuario_id || '') !== String(authUserId);

        const estaPublicada =
          !item.lista_id || estadoPorLista[item.lista_id] === 'publicada';

        return perteneceAOtroUsuario && estaPublicada;
      });

      setUsuarios(perfilesData || []);

      const compradoresPorAuth = Object.fromEntries(
        (perfilesData || [])
          .filter(
            (p) =>
              String(p.tipo || '').trim().toLowerCase() === 'comprador' &&
              p.auth_id
          )
          .map((p) => [String(p.auth_id).trim().toLowerCase(), p])
      );

      const enriquecida = listasAjenas
        .map((item) => {
          const perfilComprador =
            compradoresPorAuth[
              String(item.usuario_id || '').trim().toLowerCase()
            ] || null;

          const ofertaExistente = (ofertasData || []).find(
            (o) => o.lista_id === item.id
          );

          return {
            ...item,
            comprador_email:
              item.comprador_email || perfilComprador?.email || 'Desconocido',
            oferta: ofertaExistente ? ofertaExistente.precio_ofertado : '',
            incluye_despacho: false,
            tiempo_despacho_horas: '',
            ya_oferto: !!ofertaExistente,
            estado_oferta: ofertaExistente ? ofertaExistente.estado : null,
          };
        })
        .filter((item) => !item.ya_oferto);

      setListas(enriquecida);
    };

    cargarDatos();
  }, [router]);

  const calcularDiasRestantes = (fecha_cierre) => {
    if (!fecha_cierre) return '-';
    const cierre = new Date(fecha_cierre);
    const hoy = new Date();
    const diff = cierre - hoy;
    if (diff <= 0) return '0';
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  const manejarCambioOferta = (itemId, valor) => {
    setListas((prev) =>
      prev.map((item) =>
        item.id === itemId ? { ...item, oferta: valor } : item
      )
    );
  };

  const manejarDespacho = (itemId, valor) => {
    setListas((prev) =>
      prev.map((item) =>
        item.id === itemId
          ? {
              ...item,
              incluye_despacho: valor,
              tiempo_despacho_horas: valor ? item.tiempo_despacho_horas : '',
            }
          : item
      )
    );
  };

  const manejarTiempoDespacho = (itemId, valor) => {
    setListas((prev) =>
      prev.map((item) =>
        item.id === itemId
          ? {
              ...item,
              tiempo_despacho_horas: valor,
            }
          : item
      )
    );
  };

  const ofertarProducto = async (itemId) => {
    if (!proveedorPerfilId) {
      alert('No hay perfil de proveedor activo.');
      return;
    }

    const producto = listas.find((item) => item.id === itemId);

    if (!producto) return;

    const ofertaLimpia = parseFloat(
      (producto.oferta ?? '').toString().replace(/\./g, '')
    );

    if (isNaN(ofertaLimpia) || ofertaLimpia <= 0) {
      alert('Por favor ingresa un valor numérico válido en la oferta.');
      return;
    }

    if (producto.incluye_despacho && !producto.tiempo_despacho_horas) {
      alert('Selecciona el tiempo de despacho.');
      return;
    }

    if (
      producto.estado === 'cerrada' ||
      calcularDiasRestantes(producto.fecha_cierre) === '0'
    ) {
      alert('La licitación está cerrada.');
      return;
    }

    if (producto.ya_oferto) {
      alert(
        'Ya enviaste una oferta para este producto. Puedes verla en Mis ofertas enviadas.'
      );
      setListas((prev) => prev.filter((item) => item.id !== producto.id));
      return;
    }

    const { data: ofertaDuplicada, error: dupError } = await supabase
      .from('ofertas_productos')
      .select('id')
      .eq('proveedor_id', proveedorPerfilId)
      .eq('lista_id', producto.id)
      .maybeSingle();

    if (dupError) {
      alert('Error al verificar ofertas existentes: ' + dupError.message);
      return;
    }

    if (ofertaDuplicada) {
      alert(
        'Ya enviaste una oferta para este producto. Puedes verla en Mis ofertas enviadas.'
      );
      setListas((prev) => prev.filter((item) => item.id !== producto.id));
      return;
    }

    const { error } = await supabase.from('ofertas_productos').insert({
      lista_id: producto.id,
      proveedor_id: proveedorPerfilId,
      producto: producto.producto,
      formato: producto.formato,
      marca: producto.marca,
      precio_ofertado: ofertaLimpia,
      incluye_despacho: producto.incluye_despacho,
      tiempo_despacho_horas: producto.incluye_despacho
        ? Number(producto.tiempo_despacho_horas)
        : null,
      estado: 'pendiente',
    });

    if (error) {
      const esDuplicada =
        error.code === '23505' ||
        (error.message || '').toLowerCase().includes('unique');

      if (esDuplicada) {
        alert(
          'Ya enviaste una oferta para este producto. Puedes verla en Mis ofertas enviadas.'
        );
        setListas((prev) => prev.filter((item) => item.id !== producto.id));
      } else {
        alert('Error al enviar oferta: ' + error.message);
      }
    } else {
      await supabase.from('notificaciones').insert([
        {
          usuario_id: producto.usuario_id,
          rol: 'comprador',
          titulo: 'Nueva oferta recibida',
          mensaje: `Has recibido una oferta para el producto ${producto.producto}`,
          ruta: '/comprador?notif=ofertas&list_id=' + producto.id,
          leida: false,
        },
      ]);

      setListas((prev) => prev.filter((item) => item.id !== producto.id));

      alert('Oferta enviada correctamente.');
    }
  };

  const volverAlPanel = () => router.push('/proveedor');

  const normalizarTexto = (t) =>
    t ? t.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') : '';

  const manejarCambioFiltro = (campo, valor) => {
    setFiltros((prev) => ({
      ...prev,
      [campo]: valor.toUpperCase(),
    }));
    setPaginaActual(1);
  };

  const obtenerEstado = (item) => {
    if (item.estado === 'cerrada') return 'Cerrada';

    switch (item.estado_oferta) {
      case 'confirmada':
        return 'Confirmada';
      case 'en_espera_confirmacion':
        return 'En espera de confirmación';
      case 'rechazada':
        return 'Rechazada';
      case 'pendiente':
      case null:
      case undefined:
        if (item.ya_oferto) return 'Oferta enviada';
        break;
      default:
        if (item.ya_oferto) return 'Oferta enviada';
    }

    return 'Recibiendo ofertas';
  };

  const listasFiltradas = useMemo(
    () =>
      listas.filter((item) => {
        if (item.ya_oferto) return false;

        const formatos = normalizarFormatosItem(item);
        const estadoLabel = obtenerEstado(item);

        const coincideFormato =
          !filtros.formato ||
          formatos.some((f) =>
            normalizarTexto(f.formato).includes(normalizarTexto(filtros.formato))
          ) ||
          normalizarTexto(item.formato || '').includes(
            normalizarTexto(filtros.formato)
          );

        const coincideCantidad =
          !filtros.cantidad ||
          formatos.some((f) =>
            String(f.cantidad ?? '').includes(filtros.cantidad)
          ) ||
          String(item.cantidad ?? '').includes(filtros.cantidad);

        const coincidePrecio =
          !filtros.precio ||
          formatos.some((f) =>
            String(f.precio ?? '').includes(filtros.precio)
          ) ||
          String(item.precio ?? '').includes(filtros.precio);

        const valores = {
          producto: item.producto,
          marca: item.marca,
          comuna: item.comuna_despacho,
          fecha: item.fecha_creacion
            ? new Date(item.fecha_creacion).toISOString().split('T')[0]
            : '',
          estado: estadoLabel,
        };

        const coincideResto = Object.entries(valores).every(([campo, valor]) => {
          if (!filtros[campo]) return true;
          return normalizarTexto(valor || '').includes(
            normalizarTexto(filtros[campo])
          );
        });

        return (
          coincideFormato &&
          coincideCantidad &&
          coincidePrecio &&
          coincideResto
        );
      }),
    [listas, filtros]
  );

  const totalPaginas = Math.ceil(listasFiltradas.length / itemsPorPagina);
  const inicio = (paginaActual - 1) * itemsPorPagina;
  const fin = inicio + itemsPorPagina;
  const listasPaginadas = listasFiltradas.slice(inicio, fin);
  const filasListaPaginadas = useMemo(
    () => expandirItemsNormalizados(listasPaginadas),
    [listasPaginadas]
  );

  const formatearNumero = (num) =>
    num === '' || num === null || num === undefined
      ? ''
      : new Intl.NumberFormat('es-CL').format(num);

  const getEstadoStyle = (estadoTexto, compacto = false) => {
    let base;

    switch (estadoTexto) {
      case 'Recibiendo ofertas':
        base = styles.estadoVerde;
        break;
      case 'Oferta enviada':
        base = styles.estadoAzul;
        break;
      case 'En espera de confirmación':
        base = styles.estadoNaranja;
        break;
      case 'Confirmada':
        base = styles.estadoConfirmada;
        break;
      case 'Rechazada':
        base = styles.estadoGris;
        break;
      case 'Cerrada':
        base = styles.estadoRojo;
        break;
      default:
        base = styles.estadoDefault;
    }

    return compacto ? { ...base, ...styles.estadoBadgeTabla } : base;
  };

  const estadoTexto = (item) => obtenerEstado(item);

  const renderAccionOferta = (fila) => {
    const estado = estadoTexto(fila);
    const puedeOfertar = !fila.ya_oferto && fila.estado !== 'cerrada';
    const esConfirmada = fila.estado_oferta === 'confirmada';

    if (esConfirmada) {
      return (
        <button
          type="button"
          onClick={() =>
            setDetalleContactoId(
              detalleContactoId === fila.itemId ? null : fila.itemId
            )
          }
          className="kyntu-smallButton"
          style={styles.smallButton}
        >
          Ver contacto
        </button>
      );
    }

    if (puedeOfertar) {
      return (
        <button
          type="button"
          onClick={() => ofertarProducto(fila.itemId)}
          className="kyntu-mainButtonSmall"
          style={styles.mainButtonSmall}
        >
          Enviar oferta
        </button>
      );
    }

    return <span style={styles.emptyAction}>No disponible</span>;
  };

  const renderDespacho = (fila) => {
    if (fila.ya_oferto || fila.estado === 'cerrada') {
      return <span style={styles.metaValue}>No</span>;
    }

    return (
      <div style={styles.deliveryBoxCompact}>
        <label style={styles.checkLabel}>
          <input
            type="checkbox"
            checked={Boolean(fila.incluye_despacho)}
            onChange={(e) => manejarDespacho(fila.itemId, e.target.checked)}
            style={styles.checkbox}
          />
          {fila.incluye_despacho ? 'Sí' : 'No'}
        </label>

        {fila.incluye_despacho && (
          <select
            value={fila.tiempo_despacho_horas || ''}
            onChange={(e) =>
              manejarTiempoDespacho(fila.itemId, e.target.value)
            }
            className="kyntu-select"
            style={styles.selectCompact}
          >
            <option value="">Plazo</option>
            <option value="24">24 h</option>
            <option value="48">48 h</option>
            <option value="72">72 h</option>
            <option value="96">72+ h</option>
          </select>
        )}
      </div>
    );
  };

  const renderVistaCuadricula = () => (
    <div className="kyntu-cardsGrid" style={styles.cardsGrid}>
      {listasPaginadas.map((item) => {
        const estado = estadoTexto(item);
        const puedeOfertar = !item.ya_oferto && item.estado !== 'cerrada';
        const esConfirmada = item.estado_oferta === 'confirmada';
        const formatos = normalizarFormatosItem(item);

        return (
          <article
            key={item.id}
            className="kyntu-productCard"
            style={styles.productCard}
          >
            <div style={styles.cardHeader}>
              <div style={styles.cardHeaderMain}>
                <h3 style={styles.productName}>{item.producto}</h3>
                <p style={styles.productMeta}>
                  Marca: <strong>{item.marca}</strong>
                </p>
              </div>
              <span style={getEstadoStyle(estado)}>{estado}</span>
            </div>

            <div className="kyntu-metaGrid" style={styles.metaGrid}>
              <div style={styles.metaItem}>
                <span style={styles.metaLabel}>Comuna</span>
                <span style={styles.metaValue}>
                  {item.comuna_despacho || '—'}
                </span>
              </div>
              <div style={styles.metaItem}>
                <span style={styles.metaLabel}>Fecha</span>
                <span style={styles.metaValue}>
                  {formatearFechaCorta(item.fecha_creacion)}
                </span>
              </div>
              <div style={styles.metaItem}>
                <span style={styles.metaLabel}>Días restantes</span>
                <span style={styles.metaValue}>
                  {calcularDiasRestantes(item.fecha_cierre)}
                </span>
              </div>
            </div>

            <div style={styles.formatosSection}>
              {formatos.map((fmt, fmtIndex) => (
                <div
                  key={`${item.id}-fmt-${fmtIndex}`}
                  className="kyntu-formatoCard"
                  style={styles.formatoCard}
                >
                  <div className="kyntu-formatoGrid" style={styles.formatoGrid}>
                    <div style={styles.formatoField}>
                      <span style={styles.formatoLabel}>Formato</span>
                      <span style={styles.formatoValue}>
                        {fmt.formato || '—'}
                      </span>
                    </div>
                    <div style={styles.formatoField}>
                      <span style={styles.formatoLabel}>Cantidad</span>
                      <span style={styles.formatoValue}>
                        {fmt.cantidad ?? '—'}
                      </span>
                    </div>
                    <div style={styles.formatoField}>
                      <span style={styles.formatoLabel}>Precio referencia</span>
                      <span style={styles.formatoValue}>
                        {fmt.precio !== '' &&
                        fmt.precio !== null &&
                        fmt.precio !== undefined
                          ? `$${formatearNumero(fmt.precio)}`
                          : '—'}
                      </span>
                    </div>
                  </div>

                  <DetallePedidoBloque detalle={fmt.detalle_pedido} />
                </div>
              ))}
            </div>

            <div className="kyntu-offerSection" style={styles.offerSection}>
              <BloqueOferta
                fila={item}
                variant="cuadricula"
                onChange={manejarCambioOferta}
                formatearNumero={formatearNumero}
              />

              <div style={styles.offerField}>
                <label style={styles.label}>Despacho incluido</label>
                {renderDespacho(item)}
              </div>

              <div style={styles.offerActions}>
                {renderAccionOferta(item)}
              </div>
            </div>

            {esConfirmada && detalleContactoId === item.id && (
              <div style={styles.contactBox}>
                <strong>Datos de contacto</strong>
                <div style={styles.contactText}>
                  <p>
                    <strong>Correo:</strong> {item.comprador_email}
                  </p>
                  <p>
                    <strong>Precio aceptado:</strong> $
                    {formatearNumero(item.oferta)}
                  </p>
                  <p>
                    <strong>Dirección de despacho:</strong>{' '}
                    {item.comuna_despacho}
                  </p>
                </div>
              </div>
            )}
          </article>
        );
      })}
    </div>
  );

  const renderVistaLista = () => (
    <div className="kyntu-tableWrapper" style={styles.tableWrapper}>
      <table className="kyntu-table" style={styles.table}>
        <colgroup>
          <col style={styles.colProducto} />
          <col style={styles.colFormato} />
          <col style={styles.colMarca} />
          <col style={styles.colCantidad} />
          <col style={styles.colPrecio} />
          <col style={styles.colDetalle} />
          <col style={styles.colComuna} />
          <col style={styles.colFecha} />
          <col style={styles.colEstado} />
          <col style={styles.colOferta} />
          <col style={styles.colDespacho} />
          <col style={styles.colAccion} />
        </colgroup>
        <thead>
          <tr>
            <th style={styles.thProducto}>Producto</th>
            <th style={styles.thFormato}>Formato</th>
            <th style={styles.th}>Marca</th>
            <th style={styles.th}>Cantidad</th>
            <th style={styles.th}>Precio referencia</th>
            <th style={styles.thDetalle}>Detalle del pedido</th>
            <th style={styles.th}>Comuna</th>
            <th style={styles.thFecha}>Fecha</th>
            <th style={styles.thEstado}>Estado</th>
            <th style={styles.th}>
              Tu oferta{' '}
              <span
                title="La oferta corresponde al valor total por la cantidad solicitada."
                style={styles.tooltipIcon}
              >
                ⓘ
              </span>
            </th>
            <th style={styles.th}>Despacho</th>
            <th style={styles.thAccion}>Acción</th>
          </tr>
        </thead>
        <tbody>
          {filasListaPaginadas.map((fila) => {
            const estado = estadoTexto(fila);
            const rowSpan = fila.esPrimeraFilaFormato ? fila.totalFormatos : undefined;

            return (
              <React.Fragment key={fila.rowKey}>
                <tr style={styles.trRow}>
                  <td style={styles.tdProducto}>{fila.producto}</td>
                  <td style={styles.tdFormato}>{fila.formato || '—'}</td>
                  <td style={styles.td}>{fila.marca}</td>
                  <td style={styles.td}>{fila.cantidad ?? '—'}</td>
                  <td style={styles.td}>
                    {fila.precio !== '' &&
                    fila.precio !== null &&
                    fila.precio !== undefined
                      ? `$${formatearNumero(fila.precio)}`
                      : '—'}
                  </td>
                  <td style={styles.tdDetalle}>
                    <DetallePedidoCelda detalle={fila.detalle_pedido} />
                  </td>
                  {fila.esPrimeraFilaFormato && (
                    <>
                      <td style={styles.td} rowSpan={rowSpan}>
                        {fila.comuna || '—'}
                      </td>
                      <td style={styles.tdFecha} rowSpan={rowSpan}>
                        {formatearFechaCorta(fila.fecha)}
                      </td>
                      <td style={styles.tdEstado} rowSpan={rowSpan}>
                        <span style={getEstadoStyle(estado, true)}>{estado}</span>
                      </td>
                      <td style={styles.td} rowSpan={rowSpan}>
                        <BloqueOferta
                          fila={fila}
                          variant="lista"
                          onChange={manejarCambioOferta}
                          formatearNumero={formatearNumero}
                        />
                      </td>
                      <td style={styles.td} rowSpan={rowSpan}>
                        {renderDespacho(fila)}
                      </td>
                      <td style={styles.tdAccion} rowSpan={rowSpan}>
                        {renderAccionOferta(fila)}
                      </td>
                    </>
                  )}
                </tr>

                {fila.esPrimeraFilaFormato &&
                  fila.estado_oferta === 'confirmada' &&
                  detalleContactoId === fila.itemId && (
                    <tr>
                      <td colSpan={12} style={styles.contactBox}>
                        <strong>Datos de contacto</strong>
                        <div style={styles.contactText}>
                          <p>
                            <strong>Correo:</strong> {fila.comprador_email}
                          </p>
                          <p>
                            <strong>Precio aceptado:</strong> $
                            {formatearNumero(fila.oferta)}
                          </p>
                          <p>
                            <strong>Dirección de despacho:</strong>{' '}
                            {fila.comuna}
                          </p>
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
  );

  return (
    <div className="kyntu-page" style={styles.page}>
      <div className="kyntu-backgroundGlow" style={styles.backgroundGlow} />

      <img
        src="/yoproveo_logo_mvp.png"
        alt=""
        className="kyntu-watermark"
        style={styles.watermark}
      />

      <div className="kyntu-topBar" style={styles.topBar}>
        <div className="kyntu-leftActions" style={styles.leftActions}>
          <button
            onClick={volverAlPanel}
            className="kyntu-secondaryButton"
            style={styles.secondaryButton}
          >
            Volver al panel
          </button>
        </div>

        <div className="kyntu-centerTitle" style={styles.centerTitle}>
          <h1 className="kyntu-title" style={styles.title}>
            Ofertar productos
          </h1>
        </div>

        <div className="kyntu-rightActions" style={styles.rightActions} />
      </div>

      <main className="kyntu-content" style={styles.content}>
        <section className="kyntu-card" style={styles.card}>
          <img src="/icono_1.png" alt="Kyntü" className="kyntu-logo" style={styles.logo} />

          <div className="kyntu-cardTitleRow" style={styles.cardTitleRow}>
            <h2 className="kyntu-cardTitle" style={styles.cardTitleInline}>
              Listas de compra activas
            </h2>
            <SelectorVista
              vista={vistaEfectiva}
              onChange={cambiarVista}
              deshabilitarLista={!vistaLista}
            />
          </div>

          <div className="kyntu-filtersBox" style={styles.filtersBox}>
            <div style={styles.filtersGrid}>
              {[
                ['producto', 'Producto'],
                ['formato', 'Formato'],
                ['marca', 'Marca'],
                ['cantidad', 'Cantidad'],
                ['precio', 'Precio'],
                ['comuna', 'Comuna'],
                ['estado', 'Estado'],
              ].map(([campo, label]) => (
                <div key={campo} style={styles.filterGroup}>
                  <label className="kyntu-label" style={styles.label}>
                    {label}
                  </label>
                  <input
                    value={filtros[campo]}
                    onChange={(e) => manejarCambioFiltro(campo, e.target.value)}
                    className="kyntu-input"
                    style={styles.input}
                  />
                </div>
              ))}

              <div style={styles.filterGroup}>
                <label className="kyntu-label" style={styles.label}>
                  Fecha
                </label>
                <input
                  type="date"
                  value={filtros.fecha}
                  onChange={(e) =>
                    setFiltros((prev) => ({
                      ...prev,
                      fecha: e.target.value,
                    }))
                  }
                  className="kyntu-input"
                  style={styles.input}
                />
              </div>
            </div>
          </div>

          {listasFiltradas.length === 0 ? (
            <p className="kyntu-emptyText" style={styles.emptyText}>
              No hay listas disponibles.
            </p>
          ) : (
            <>
              {vistaEfectiva === 'lista'
                ? renderVistaLista()
                : renderVistaCuadricula()}

              <div className="kyntu-pagination" style={styles.pagination}>
                <button
                  onClick={() => setPaginaActual((p) => Math.max(p - 1, 1))}
                  disabled={paginaActual === 1}
                  className="kyntu-secondaryButton"
                  style={styles.secondaryButton}
                >
                  Anterior
                </button>

                <span style={styles.pageText}>
                  Página {paginaActual} de {totalPaginas || 1}
                </span>

                <button
                  onClick={() =>
                    setPaginaActual((p) => Math.min(p + 1, totalPaginas))
                  }
                  disabled={
                    paginaActual === totalPaginas || totalPaginas === 0
                  }
                  className="kyntu-secondaryButton"
                  style={styles.secondaryButton}
                >
                  Siguiente
                </button>
              </div>
            </>
          )}
        </section>
      </main>

      <style jsx global>{`
        * {
          box-sizing: border-box;
        }

        html,
        body {
          margin: 0;
          min-width: 320px;
          background: #f4f8fd;
        }

        button,
        input,
        select,
        textarea {
          font: inherit;
        }

        button {
          transition:
            transform 0.2s ease,
            box-shadow 0.2s ease,
            border-color 0.2s ease,
            background 0.2s ease;
        }

        button:hover:not(:disabled) {
          transform: translateY(-1px);
        }

        button:focus-visible,
        input:focus-visible,
        select:focus-visible {
          outline: 3px solid rgba(23, 107, 255, 0.2);
          outline-offset: 2px;
        }

        .kyntu-detalleCelda {
          display: -webkit-box;
          -webkit-line-clamp: 3;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .kyntu-offerInput:focus {
          border-color: #176bff !important;
          box-shadow: 0 0 0 3px rgba(23, 107, 255, 0.2) !important;
        }

        @media (max-width: 1120px) {
          .kyntu-topBar {
            grid-template-columns: 1fr !important;
            gap: 16px !important;
          }

          .kyntu-leftActions,
          .kyntu-rightActions {
            width: 100% !important;
            justify-content: center !important;
          }

          .kyntu-centerTitle {
            grid-row: 1 !important;
          }
        }

        @media (max-width: 820px) {
          .kyntu-page {
            padding: 16px !important;
          }

          .kyntu-topBar {
            padding: 18px !important;
            border-radius: 22px !important;
          }

          .kyntu-title {
            font-size: 28px !important;
          }

          .kyntu-card {
            padding: 24px 18px !important;
            border-radius: 22px !important;
          }

          .kyntu-cardTitleRow {
            flex-direction: column !important;
            align-items: stretch !important;
          }

          .kyntu-viewToggle {
            width: 100% !important;
            justify-content: center !important;
          }

          .kyntu-cardsGrid {
            grid-template-columns: 1fr !important;
          }

          .kyntu-metaGrid,
          .kyntu-formatoGrid {
            grid-template-columns: 1fr !important;
          }

          .kyntu-offerSection {
            grid-template-columns: 1fr !important;
          }
        }

        @media (max-width: 620px) {
          .kyntu-page {
            padding: 10px !important;
          }

          .kyntu-watermark {
            width: 210px !important;
            top: 8px !important;
            left: -28px !important;
          }

          .kyntu-logo {
            width: 190px !important;
            margin-top: -42px !important;
            margin-bottom: -42px !important;
          }

          .kyntu-input,
          .kyntu-select {
            width: 100% !important;
          }
        }
      `}</style>
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    minHeight: '100dvh',
    position: 'relative',
    overflowX: 'hidden',
    overflowY: 'auto',
    padding: '24px',
    boxSizing: 'border-box',
    fontFamily:
      'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    background:
      'radial-gradient(circle at 10% 8%, rgba(23,107,255,0.12), transparent 30%), radial-gradient(circle at 90% 82%, rgba(0,194,168,0.10), transparent 28%), linear-gradient(145deg, #f8fbff 0%, #eef5ff 48%, #f8fcfb 100%)',
  },

  backgroundGlow: {
    position: 'fixed',
    inset: 0,
    pointerEvents: 'none',
    background:
      'radial-gradient(circle at 18% 18%, rgba(23,107,255,0.08), transparent 34%), radial-gradient(circle at 82% 76%, rgba(0,194,168,0.07), transparent 30%)',
    zIndex: 0,
  },

  watermark: {
    position: 'fixed',
    top: '24px',
    left: '32px',
    width: '250px',
    opacity: 0.035,
    zIndex: 0,
    pointerEvents: 'none',
    userSelect: 'none',
  },

  topBar: {
    position: 'relative',
    zIndex: 2,
    width: '100%',
    maxWidth: '1440px',
    margin: '0 auto 24px',
    display: 'grid',
    gridTemplateColumns: '1fr auto 1fr',
    alignItems: 'center',
    gap: '20px',
    padding: '18px 22px',
    borderRadius: '24px',
    background: 'rgba(255,255,255,0.94)',
    border: '1px solid #e1e9f4',
    boxShadow: '0 20px 55px rgba(28,69,128,0.11)',
    backdropFilter: 'blur(18px)',
  },

  leftActions: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: '10px',
    flexWrap: 'wrap',
  },

  centerTitle: {
    minWidth: 0,
    textAlign: 'center',
  },

  rightActions: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: '10px',
    flexWrap: 'wrap',
  },

  title: {
    margin: 0,
    color: '#061b41',
    fontSize: 'clamp(26px, 3vw, 36px)',
    lineHeight: 1.15,
    fontWeight: 900,
    letterSpacing: '-0.035em',
  },

  content: {
    position: 'relative',
    zIndex: 2,
    width: '100%',
    maxWidth: '1440px',
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  },

  card: {
    width: '100%',
    padding: '32px',
    borderRadius: '26px',
    background: 'rgba(255,255,255,0.96)',
    border: '1px solid #e1e9f4',
    boxShadow: '0 24px 65px rgba(28,69,128,0.10)',
    overflow: 'visible',
  },

  logo: {
    display: 'block',
    width: '230px',
    maxWidth: '75%',
    height: 'auto',
    margin: '-52px auto -52px',
    objectFit: 'contain',
  },

  cardTitleRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '16px',
    flexWrap: 'wrap',
    marginBottom: '24px',
  },

  cardTitleInline: {
    margin: 0,
    color: '#061b41',
    fontSize: '26px',
    lineHeight: 1.25,
    fontWeight: 900,
    letterSpacing: '-0.025em',
  },

  viewToggle: {
    display: 'inline-flex',
    alignItems: 'stretch',
    borderRadius: '12px',
    border: '1px solid #d6e1ef',
    overflow: 'hidden',
    background: '#ffffff',
    flexShrink: 0,
  },

  viewToggleBtn: {
    minHeight: '40px',
    padding: '9px 14px',
    border: 'none',
    background: '#ffffff',
    color: '#52627a',
    cursor: 'pointer',
    fontWeight: 800,
    fontSize: '12px',
    whiteSpace: 'nowrap',
  },

  viewToggleBtnActive: {
    background: 'linear-gradient(135deg, #176BFF, #438CFF)',
    color: '#ffffff',
    boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.12)',
  },

  viewToggleBtnDisabled: {
    opacity: 0.45,
    cursor: 'not-allowed',
  },

  filtersBox: {
    marginBottom: '24px',
    padding: '18px',
    borderRadius: '16px',
    background: '#f7faff',
    border: '1px solid #e0e9f5',
  },

  filtersGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
    gap: '12px',
  },

  filterGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },

  label: {
    display: 'block',
    color: '#28466c',
    fontSize: '12px',
    fontWeight: 800,
    marginBottom: '4px',
  },

  input: {
    width: '100%',
    minHeight: '42px',
    padding: '10px 12px',
    borderRadius: '11px',
    border: '1px solid #ccd9ea',
    background: '#ffffff',
    color: '#132b4f',
    outline: 'none',
    boxSizing: 'border-box',
    fontSize: '13px',
  },

  select: {
    width: '100%',
    minHeight: '42px',
    padding: '10px 12px',
    borderRadius: '11px',
    border: '1px solid #ccd9ea',
    background: '#ffffff',
    color: '#132b4f',
    outline: 'none',
    fontSize: '13px',
  },

  selectCompact: {
    width: '100%',
    minHeight: '36px',
    padding: '6px 8px',
    borderRadius: '9px',
    border: '1px solid #ccd9ea',
    background: '#ffffff',
    color: '#132b4f',
    outline: 'none',
    fontSize: '12px',
  },

  emptyText: {
    margin: '16px 0 0',
    padding: '24px',
    borderRadius: '16px',
    color: '#6a7a91',
    background: '#f7f9fc',
    border: '1px dashed #cad6e5',
    textAlign: 'center',
  },

  tableWrapper: {
    width: '100%',
    overflowX: 'auto',
    borderRadius: '16px',
    border: '1px solid #e1e9f4',
    background: '#ffffff',
  },

  table: {
    width: '100%',
    tableLayout: 'fixed',
    borderCollapse: 'collapse',
    borderSpacing: 0,
  },

  colProducto: { width: '11%' },
  colFormato: { width: '8%' },
  colMarca: { width: '7%' },
  colCantidad: { width: '6%' },
  colPrecio: { width: '7%' },
  colDetalle: { width: '15%' },
  colComuna: { width: '8%' },
  colFecha: { width: '7%' },
  colEstado: { width: '6%' },
  colOferta: { width: '12%' },
  colDespacho: { width: '7%' },
  colAccion: { width: '10%' },

  thProducto: {
    padding: '10px 6px',
    color: '#52627a',
    background: '#f4f7fb',
    borderBottom: '1px solid #dfe8f3',
    fontSize: '11px',
    fontWeight: 900,
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },

  thFormato: {
    padding: '10px 6px',
    color: '#52627a',
    background: '#f4f7fb',
    borderBottom: '1px solid #dfe8f3',
    fontSize: '11px',
    fontWeight: 900,
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },

  thAccion: {
    padding: '10px 6px',
    color: '#52627a',
    background: '#f4f7fb',
    borderBottom: '1px solid #dfe8f3',
    fontSize: '11px',
    fontWeight: 900,
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },

  thFecha: {
    padding: '10px 4px',
    color: '#52627a',
    background: '#f4f7fb',
    borderBottom: '1px solid #dfe8f3',
    fontSize: '11px',
    fontWeight: 900,
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    whiteSpace: 'nowrap',
  },

  thEstado: {
    padding: '10px 4px',
    color: '#52627a',
    background: '#f4f7fb',
    borderBottom: '1px solid #dfe8f3',
    fontSize: '11px',
    fontWeight: 900,
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    whiteSpace: 'normal',
    lineHeight: 1.2,
  },

  th: {
    padding: '10px 6px',
    color: '#52627a',
    background: '#f4f7fb',
    borderBottom: '1px solid #dfe8f3',
    fontSize: '11px',
    fontWeight: 900,
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    whiteSpace: 'nowrap',
  },

  thDetalle: {
    padding: '10px 6px',
    color: '#52627a',
    background: '#f4f7fb',
    borderBottom: '1px solid #dfe8f3',
    fontSize: '11px',
    fontWeight: 900,
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    whiteSpace: 'normal',
    lineHeight: 1.2,
  },

  trRow: {
    background: '#ffffff',
  },

  td: {
    padding: '9px 6px',
    color: '#243a5a',
    background: '#ffffff',
    borderBottom: '1px solid #e7edf5',
    textAlign: 'center',
    verticalAlign: 'middle',
    fontSize: '12px',
  },

  tdProducto: {
    padding: '9px 6px',
    color: '#243a5a',
    background: '#ffffff',
    borderBottom: '1px solid #e7edf5',
    textAlign: 'left',
    verticalAlign: 'middle',
    fontSize: '12px',
    fontWeight: 700,
    overflowWrap: 'anywhere',
  },

  tdFormato: {
    padding: '9px 6px',
    color: '#243a5a',
    background: '#ffffff',
    borderBottom: '1px solid #e7edf5',
    textAlign: 'center',
    verticalAlign: 'middle',
    fontSize: '12px',
    overflowWrap: 'anywhere',
  },

  tdFecha: {
    padding: '9px 4px',
    color: '#243a5a',
    background: '#ffffff',
    borderBottom: '1px solid #e7edf5',
    textAlign: 'center',
    verticalAlign: 'middle',
    fontSize: '11px',
    fontWeight: 600,
    whiteSpace: 'nowrap',
  },

  tdEstado: {
    padding: '9px 4px',
    color: '#243a5a',
    background: '#ffffff',
    borderBottom: '1px solid #e7edf5',
    textAlign: 'center',
    verticalAlign: 'middle',
    fontSize: '12px',
  },

  tdAccion: {
    padding: '9px 4px',
    color: '#243a5a',
    background: '#ffffff',
    borderBottom: '1px solid #e7edf5',
    textAlign: 'center',
    verticalAlign: 'middle',
    fontSize: '12px',
  },

  tdDetalle: {
    padding: '9px 6px',
    color: '#243a5a',
    background: '#ffffff',
    borderBottom: '1px solid #e7edf5',
    textAlign: 'left',
    verticalAlign: 'top',
    fontSize: '12px',
  },

  detalleCelda: {
    color: '#243a5a',
    fontSize: '12px',
    lineHeight: 1.45,
    overflowWrap: 'anywhere',
  },

  detalleEmpty: {
    color: '#9aa8ba',
  },

  cardsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
    gap: '18px',
    width: '100%',
  },

  productCard: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    padding: '20px',
    borderRadius: '20px',
    background: '#ffffff',
    border: '1px solid #e1e9f4',
    boxShadow: '0 12px 30px rgba(28,69,128,0.06)',
    maxWidth: '100%',
  },

  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '12px',
    flexWrap: 'wrap',
  },

  cardHeaderMain: {
    minWidth: 0,
    flex: '1 1 180px',
  },

  productName: {
    margin: 0,
    color: '#061b41',
    fontSize: '18px',
    fontWeight: 900,
    lineHeight: 1.3,
  },

  productMeta: {
    margin: '6px 0 0',
    color: '#718096',
    fontSize: '13px',
  },

  metaGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: '10px 14px',
    padding: '12px 14px',
    borderRadius: '14px',
    background: '#f7faff',
    border: '1px solid #e0e9f5',
  },

  metaItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: '3px',
    minWidth: 0,
  },

  metaLabel: {
    color: '#6a7a91',
    fontSize: '11px',
    fontWeight: 800,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },

  metaValue: {
    color: '#243a5a',
    fontSize: '13px',
    fontWeight: 600,
    overflowWrap: 'anywhere',
  },

  formatosSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },

  formatoCard: {
    padding: '14px',
    borderRadius: '14px',
    background: '#fbfdff',
    border: '1px solid #e3ebf6',
  },

  formatoGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: '10px',
  },

  formatoField: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    minWidth: 0,
  },

  formatoLabel: {
    color: '#6a7a91',
    fontSize: '11px',
    fontWeight: 800,
    textTransform: 'uppercase',
    letterSpacing: '0.03em',
  },

  formatoValue: {
    color: '#132b4f',
    fontSize: '14px',
    fontWeight: 700,
    overflowWrap: 'anywhere',
  },

  detalleBox: {
    marginTop: '12px',
    padding: '12px 14px',
    borderRadius: '12px',
    background: 'linear-gradient(180deg, #eef5ff 0%, #f5f9ff 100%)',
    border: '1px solid #cfe0fb',
  },

  detalleLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    color: '#1a4f9c',
    fontSize: '11px',
    fontWeight: 900,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    marginBottom: '6px',
  },

  detalleIcon: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '18px',
    height: '18px',
    borderRadius: '999px',
    background: 'rgba(23,107,255,0.12)',
    color: '#176bff',
    fontSize: '12px',
    fontWeight: 900,
  },

  detalleText: {
    margin: 0,
    color: '#243a5a',
    fontSize: '13px',
    lineHeight: 1.5,
    overflowWrap: 'anywhere',
  },

  offerSection: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 1fr) auto',
    gap: '12px',
    alignItems: 'end',
    paddingTop: '8px',
    borderTop: '1px solid #e7edf5',
  },

  offerField: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    minWidth: 0,
  },

  offerHighlightBox: {
    padding: '12px 14px',
    borderRadius: '14px',
    background: 'linear-gradient(180deg, #eef5ff 0%, #f6faff 100%)',
    border: '1.5px solid #9ec0f5',
    boxShadow: '0 4px 14px rgba(23, 107, 255, 0.08)',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    minWidth: 0,
  },

  offerHighlightBoxCompact: {
    padding: '7px 8px',
    borderRadius: '12px',
    background: 'linear-gradient(180deg, #eef5ff 0%, #f8fbff 100%)',
    border: '1.5px solid #9ec0f5',
    boxShadow: '0 2px 8px rgba(23, 107, 255, 0.06)',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    minWidth: 0,
  },

  offerBlockHeader: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },

  offerBlockTitle: {
    color: '#1a4f9c',
    fontSize: '11px',
    fontWeight: 900,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },

  offerBlockHint: {
    color: '#52627a',
    fontSize: '12px',
    fontWeight: 600,
    lineHeight: 1.4,
  },

  offerBlockHintCompact: {
    color: '#52627a',
    fontSize: '10px',
    fontWeight: 700,
    lineHeight: 1.3,
  },

  offerInputGrid: {
    width: '100%',
    minHeight: '44px',
    padding: '11px 13px',
    borderRadius: '11px',
    border: '1.5px solid #6ea8ff',
    background: '#ffffff',
    color: '#061b41',
    outline: 'none',
    textAlign: 'right',
    fontWeight: 800,
    fontSize: '15px',
    boxSizing: 'border-box',
  },

  offerInputLista: {
    width: '100%',
    minHeight: '38px',
    padding: '8px 10px',
    borderRadius: '10px',
    border: '1.5px solid #6ea8ff',
    background: '#ffffff',
    color: '#061b41',
    outline: 'none',
    textAlign: 'right',
    fontWeight: 800,
    fontSize: '13px',
    boxSizing: 'border-box',
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

  deliveryBoxCompact: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    alignItems: 'stretch',
  },

  checkLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    color: '#315174',
    fontSize: '13px',
    fontWeight: 700,
    cursor: 'pointer',
  },

  checkbox: {
    width: '18px',
    height: '18px',
    cursor: 'pointer',
  },

  offerActions: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    minHeight: '42px',
  },

  mainButtonSmall: {
    minHeight: '38px',
    padding: '8px 11px',
    border: 'none',
    borderRadius: '11px',
    background: 'linear-gradient(135deg, #176BFF, #438CFF)',
    color: '#ffffff',
    cursor: 'pointer',
    fontWeight: 800,
    fontSize: '11px',
    boxShadow: '0 9px 18px rgba(23,107,255,0.18)',
    whiteSpace: 'nowrap',
  },

  smallButton: {
    minHeight: '40px',
    padding: '9px 14px',
    borderRadius: '10px',
    background: '#f5f8fc',
    color: '#315174',
    border: '1px solid #dbe5f1',
    cursor: 'pointer',
    fontWeight: 800,
    fontSize: '12px',
    whiteSpace: 'nowrap',
  },

  secondaryButton: {
    minHeight: '42px',
    padding: '11px 17px',
    borderRadius: '12px',
    background: '#ffffff',
    color: '#315174',
    border: '1px solid #d6e1ef',
    cursor: 'pointer',
    fontWeight: 800,
    fontSize: '13px',
  },

  pagination: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '14px',
    flexWrap: 'wrap',
    marginTop: '24px',
  },

  pageText: {
    color: '#52627a',
    fontWeight: 800,
    fontSize: '14px',
  },

  sentOffer: {
    color: '#315174',
    fontWeight: 800,
    fontSize: '14px',
  },

  emptyAction: {
    color: '#9aa8ba',
    fontSize: '13px',
    fontWeight: 700,
  },

  contactBox: {
    color: '#243a5a',
    textAlign: 'left',
    background: '#f7faff',
    padding: '16px 18px',
    borderRadius: '14px',
    border: '1px solid #e0e9f5',
  },

  contactText: {
    marginTop: '8px',
    fontSize: '14px',
    color: '#52627a',
    lineHeight: 1.55,
  },

  tooltipIcon: {
    color: '#176bff',
    cursor: 'help',
    fontWeight: 800,
  },

  estadoVerde: {
    color: '#0a9e7a',
    fontWeight: 800,
    fontSize: '12px',
    padding: '6px 10px',
    borderRadius: '999px',
    background: 'rgba(10,158,122,0.10)',
    whiteSpace: 'nowrap',
  },

  estadoAzul: {
    color: '#176bff',
    fontWeight: 800,
    fontSize: '12px',
    padding: '6px 10px',
    borderRadius: '999px',
    background: 'rgba(23,107,255,0.10)',
    whiteSpace: 'nowrap',
  },

  estadoNaranja: {
    color: '#c9770a',
    fontWeight: 800,
    fontSize: '12px',
    padding: '6px 10px',
    borderRadius: '999px',
    background: 'rgba(201,119,10,0.10)',
    whiteSpace: 'nowrap',
  },

  estadoConfirmada: {
    color: '#1f8f4e',
    fontWeight: 800,
    fontSize: '12px',
    padding: '6px 10px',
    borderRadius: '999px',
    background: 'rgba(31,143,78,0.10)',
    whiteSpace: 'nowrap',
  },

  estadoGris: {
    color: '#6a7a91',
    fontStyle: 'italic',
    fontSize: '12px',
    padding: '6px 10px',
    borderRadius: '999px',
    background: '#f3f6fa',
    whiteSpace: 'nowrap',
  },

  estadoRojo: {
    color: '#c1342d',
    fontWeight: 800,
    fontSize: '12px',
    padding: '6px 10px',
    borderRadius: '999px',
    background: 'rgba(193,52,45,0.10)',
    whiteSpace: 'nowrap',
  },

  estadoDefault: {
    color: '#315174',
    fontWeight: 800,
    fontSize: '12px',
  },

  estadoBadgeTabla: {
    display: 'inline-block',
    maxWidth: '68px',
    whiteSpace: 'normal',
    lineHeight: 1.25,
    padding: '4px 5px',
    fontSize: '10px',
    textAlign: 'center',
    wordBreak: 'break-word',
  },
};
