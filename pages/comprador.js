import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabaseClient';
import Notificaciones from '../components/Notificaciones';
import OfertaConversacionContenedor from '../components/OfertaConversacionContenedor';
import BandejaMensajesComerciales, {
  IconoChatPreOferta,
} from '../components/BandejaMensajesComerciales';
import SoporteLauncher from '../components/soporte/SoporteLauncher';
import {
  chatSoloLecturaPorAdjudicacion,
  esOfertaAdjudicada,
  marcarConversacionTraspasadaAOferta,
  MENSAJE_CHAT_CERRADO_ADJUDICACION,
  obtenerConversacionesSolicitud,
} from '../lib/ofertaMensajes';
import { comunasChile } from '../utils/comunasChile';
import KyntuModal, {
  createModalState,
} from '../pages/KyntuModal';
import ModalCalificacion from './ModalCalificacion';
import AppLayout from '../components/Layout/AppLayout';
import CarroCompradorButton from '../components/CarroCompradorButton';
import {
  CARRO_UPDATED_EVENT,
  notifyCarroUpdated,
} from '../lib/carroComprador';

const MAX_DETALLE_PEDIDO = 120;

const filaVacia = {
  producto: '',
  formato: '',
  marca: '',
  cantidad: '',
  precio: '',
  detalle_pedido: '',
};

function normalizarDetallePedido(valor) {
  const texto = (valor ?? '').toString().trim();

  return texto
    ? texto.slice(0, MAX_DETALLE_PEDIDO)
    : null;
}

function textoDetallePedidoVisible(item) {
  if (!item) return '';

  const detalles = (item.formatos_detalle || [])
    .map((formato) =>
      (formato?.detalle_pedido ?? '')
        .toString()
        .trim()
    )
    .filter(Boolean);

  return detalles.join(' · ');
}

export default function Comprador() {
  const [productos, setProductos] = useState([
    { ...filaVacia },
  ]);
  const [usuarioId, setUsuarioId] = useState(null);
  const [authUserId, setAuthUserId] = useState(null);
  const [stock, setStock] = useState([]);
  const [comunaDespacho, setComunaDespacho] =
    useState('');
  const [listas, setListas] = useState([]);
  const [expandedFechas, setExpandedFechas] =
    useState([]);
  const [editandoFechas, setEditandoFechas] =
    useState([]);
  const [
    ofertasPorProducto,
    setOfertasPorProducto,
  ] = useState({});
  const [
    ofertasCrudasPorProducto,
    setOfertasCrudasPorProducto,
  ] = useState({});
  const [
    nuevosProductos,
    setNuevosProductos,
  ] = useState({});
  const [
    listasConOfertas,
    setListasConOfertas,
  ] = useState([]);
  const [
    tienePerfilProveedor,
    setTienePerfilProveedor,
  ] = useState(false);
  const [
    conversacionAbiertaPorProducto,
    setConversacionAbiertaPorProducto,
  ] = useState({});
  const [
    bandejaAbiertaPorProducto,
    setBandejaAbiertaPorProducto,
  ] = useState({});
  const [
    conversacionBandejaPorProducto,
    setConversacionBandejaPorProducto,
  ] = useState({});
  const [
    traspasadasRevision,
    setTraspasadasRevision,
  ] = useState(0);
  const [
    ofertaDestacadaId,
    setOfertaDestacadaId,
  ] = useState(null);
  const [deepLinkError, setDeepLinkError] =
    useState('');
  const [
    productosConOfertasAbiertas,
    setProductosConOfertasAbiertas,
  ] = useState({});
  const [nombreLista, setNombreLista] =
    useState('');

  // Filtros
  const [
    filtroMejorPrecio,
    setFiltroMejorPrecio,
  ] = useState(true);
  const [filtroDespacho, setFiltroDespacho] =
    useState(false);
  const [
    filtroCincoEstrellas,
    setFiltroCincoEstrellas,
  ] = useState(false);
  const [mostrarComunas, setMostrarComunas] =
    useState(false);
  const [filtroDespacho24, setFiltroDespacho24] =
    useState(false);

  // Modal Kyntu
  const [modal, setModal] = useState(
    createModalState()
  );

  const showModal = ({
    type = 'info',
    title,
    message,
    confirmText = 'Aceptar',
    cancelText = 'Cancelar',
    showCancel = false,
    onConfirm,
    onCancel,
  }) => {
    setModal({
      ...createModalState(),
      open: true,
      type,
      title,
      message,
      confirmText,
      cancelText,
      showCancel,
      onConfirm:
        onConfirm ||
        (() => setModal(createModalState())),
      onCancel:
        onCancel ||
        (() => setModal(createModalState())),
    });
  };

  const [ratingModal, setRatingModal] = useState({
    open: false,
    oferta: null,
    fechaLista: null,
    estrellas: 5,
    comentario: '',
  });

  const [
    guardandoCalificacion,
    setGuardandoCalificacion,
  ] = useState(false);

  const comunasFiltradas = comunasChile.filter(
    (comuna) =>
      comuna
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .includes(
          comunaDespacho
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
        )
  );

  const router = useRouter();
  const scrolledToOfertaRef = useRef(null);

  const RUTA_MIS_OFERTAS =
    '/proveedor/ofertas_enviadas';

  const getRowId = (item) =>
    item?.id ??
    item?.identificacion ??
    item?.['identificación'] ??
    null;

  const groupByFecha = useMemo(() => {
    return listas.reduce((acumulador, item) => {
      const fecha = new Date(
        item.fecha_creacion
      ).toLocaleString();

      if (!acumulador[fecha]) {
        acumulador[fecha] = [];
      }

      acumulador[fecha].push(item);

      return acumulador;
    }, {});
  }, [listas]);

  const fetchData = async () => {
    const {
      data: userData,
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !userData?.user) {
      showModal({
        type: 'error',
        title: 'Sesión requerida',
        message:
          'Debes iniciar sesión para continuar.',
      });

      router.push('/');
      return;
    }

    setAuthUserId(userData.user.id);

    if (userData.user.email) {
      localStorage.setItem(
        'user_email',
        userData.user.email
      );
    }

    let {
      data: perfilData,
      error: perfilError,
    } = await supabase
      .from('perfiles')
      .select('id, tipo, email, auth_id')
      .eq('auth_id', userData.user.id)
      .eq('tipo', 'comprador')
      .maybeSingle();

    if (perfilError) {
      console.error(
        'Error buscando perfil comprador:',
        perfilError
      );
    }

    if (!perfilData) {
      const { data: perfilByEmail } =
        await supabase
          .from('perfiles')
          .select('id, tipo, email, auth_id')
          .eq('email', userData.user.email)
          .eq('tipo', 'comprador')
          .maybeSingle();

      perfilData = perfilByEmail;
    }

    if (!perfilData) {
      showModal({
        type: 'error',
        title: 'Perfil no encontrado',
        message:
          'No se encontró un perfil de comprador asociado a esta cuenta.',
      });

      router.push('/');
      return;
    }

    setUsuarioId(perfilData.id);

    const { data: perfilProveedor } =
      await supabase
        .from('perfiles')
        .select('id')
        .eq('auth_id', userData.user.id)
        .eq('tipo', 'proveedor')
        .maybeSingle();

    setTienePerfilProveedor(
      Boolean(perfilProveedor)
    );

    const { data: stockData } = await supabase
      .from('productos_proveedores')
      .select(
        'nombre, formato, marca, cantidad_disponible'
      )
      .gt('cantidad_disponible', 0);

    if (stockData) {
      setStock(stockData);
    }

    const {
      data: listasData,
      error: listasError,
    } = await supabase
      .from('listas_compras')
      .select('*')
      .eq('usuario_id', userData.user.id)
      .order('fecha_creacion', {
        ascending: false,
      });

    if (listasError) {
      console.error(
        'Error cargando listas de compra:',
        listasError
      );

      return;
    }

    const listaIds = Array.from(
      new Set(
        (listasData || [])
          .map((item) => item.lista_id)
          .filter(Boolean)
      )
    );

    let cabecerasPorId = {};

    if (listaIds.length > 0) {
      const {
        data: cabecerasData,
        error: cabecerasError,
      } = await supabase
        .from('listas')
        .select('id, nombre_lista, estado')
        .in('id', listaIds);

      if (cabecerasError) {
        console.error(
          'Error cargando estados de listas:',
          cabecerasError
        );
      }

      cabecerasPorId = Object.fromEntries(
        (cabecerasData || []).map((lista) => [
          lista.id,
          lista,
        ])
      );

    }

    // Las ofertas antiguas apuntan directamente al id de listas_compras,
    // incluso cuando la fila no tiene una cabecera en listas.
    const productIds = (listasData || [])
      .map((item) => getRowId(item))
      .filter(Boolean);
    let estadoPorProducto = {};

    if (productIds.length > 0) {
      const { data: lifecycleOffers, error: lifecycleError } = await supabase
        .from('ofertas_productos')
        .select('lista_id, estado')
        .in('lista_id', productIds);

      if (lifecycleError) {
        console.error('Error cargando ciclo de ofertas:', lifecycleError);
      }

      const paidStates = new Set([
        'pago_recibido',
        'recepcion_conforme',
        'pagada',
      ]);
      const pendingPaymentStates = new Set([
        'pendiente_pago',
        'en_espera_confirmacion',
        'confirmada',
      ]);

      (lifecycleOffers || []).forEach((offer) => {
        const productId = String(offer.lista_id);
        const offerState = (offer.estado || '').trim().toLowerCase();
        const currentState = estadoPorProducto[productId];

        if (paidStates.has(offerState)) {
          estadoPorProducto[productId] = 'comprada';
        } else if (
          pendingPaymentStates.has(offerState) &&
          currentState !== 'comprada'
        ) {
          estadoPorProducto[productId] = 'pago_pendiente';
        }
      });

      // Una lista moderna aparece comprada cuando todos sus productos están
      // pagados. Esta inferencia es solo de lectura y no modifica Supabase.
      listaIds.forEach((headerId) => {
        const products = (listasData || []).filter(
          (item) => String(item.lista_id) === String(headerId)
        );
        const productStates = products.map(
          (item) => estadoPorProducto[String(getRowId(item))]
        );
        const inferredState =
          productStates.length > 0 &&
          productStates.every((state) => state === 'comprada')
            ? 'comprada'
            : productStates.some((state) =>
                ['comprada', 'pago_pendiente'].includes(state)
              )
              ? 'pago_pendiente'
              : null;

        if (inferredState && cabecerasPorId[headerId]) {
          cabecerasPorId[headerId] = {
            ...cabecerasPorId[headerId],
            estado: inferredState,
          };
        }
      });
    }

    const listasEnriquecidas = (
      listasData || []
    ).map((item) => {
      const cabecera =
        cabecerasPorId[item.lista_id];

      return {
        ...item,

        estado_lista:
          cabecera?.estado ||
          estadoPorProducto[String(getRowId(item))] ||
          'publicada',

        nombre_lista:
          item.nombre_lista ||
          cabecera?.nombre_lista ||
          '',
      };
    });

    setListas(listasEnriquecidas);
  };

  useEffect(() => {
    fetchData();
  }, [router]);

  const abrirDesdeNotificacion = (tipoNotif) => {
    if (!router.isReady) return;
    if (router.query?.notif !== tipoNotif) return;
    if (!listas || listas.length === 0) return;

    let fechaKey = null;
    let listIdToOpen = null;

    const listIdParam = Array.isArray(
      router.query.list_id
    )
      ? router.query.list_id[0]
      : router.query.list_id;

    const ofertaIdParam = Array.isArray(
      router.query.oferta_id
    )
      ? router.query.oferta_id[0]
      : router.query.oferta_id;

    const conversacionIdParam = Array.isArray(
      router.query.conversacion_id
    )
      ? router.query.conversacion_id[0]
      : router.query.conversacion_id;

    if (listIdParam) {
      const listaMatch = listas.find(
        (lista) =>
          String(getRowId(lista)) ===
          String(listIdParam)
      );

      if (listaMatch) {
        listIdToOpen = getRowId(listaMatch);

        fechaKey = new Date(
          listaMatch.fecha_creacion
        ).toLocaleString();
      }
    }

    if (!fechaKey) {
      const ultima = listas.reduce(
        (listaA, listaB) =>
          new Date(listaA.fecha_creacion) >
          new Date(listaB.fecha_creacion)
            ? listaA
            : listaB
      );

      fechaKey = new Date(
        ultima.fecha_creacion
      ).toLocaleString();
    }

    if (!expandedFechas.includes(fechaKey)) {
      setExpandedFechas((anteriores) => [
        ...anteriores,
        fechaKey,
      ]);
    }

    if (listIdToOpen) {
      setProductosConOfertasAbiertas(
        (anteriores) => ({
          ...anteriores,
          [listIdToOpen]: true,
        })
      );
    }

    if (ofertaIdParam) {
      setOfertaDestacadaId(
        String(ofertaIdParam)
      );

      if (
        tipoNotif === 'chat' &&
        listIdToOpen
      ) {
        setConversacionAbiertaPorProducto(
          (anteriores) => ({
            ...anteriores,
            [listIdToOpen]:
              String(ofertaIdParam),
          })
        );
      }
    }

    if (
      conversacionIdParam &&
      tipoNotif === 'chat' &&
      listIdToOpen
    ) {
      setBandejaAbiertaPorProducto(
        (anteriores) => ({
          ...anteriores,
          [listIdToOpen]: true,
        })
      );

      setConversacionBandejaPorProducto(
        (anteriores) => ({
          ...anteriores,
          [listIdToOpen]:
            String(conversacionIdParam),
        })
      );
    }

    verOfertas(fechaKey);
  };
    const toggleBandejaProducto = (
    productoRowId
  ) => {
    setBandejaAbiertaPorProducto(
      (anteriores) => {
        if (anteriores[productoRowId]) {
          const siguiente = { ...anteriores };
          delete siguiente[productoRowId];

          return siguiente;
        }

        return {
          ...anteriores,
          [productoRowId]: true,
        };
      }
    );

    setConversacionAbiertaPorProducto(
      (anteriores) => {
        if (!anteriores[productoRowId]) {
          return anteriores;
        }

        const siguiente = { ...anteriores };
        delete siguiente[productoRowId];

        return siguiente;
      }
    );
  };

  const toggleConversacionProducto = (
    productoRowId,
    ofertaId
  ) => {
    const ofertaString = String(ofertaId);

    setConversacionAbiertaPorProducto(
      (anteriores) => {
        const debeAbrir =
          anteriores[productoRowId] !==
          ofertaString;

        if (debeAbrir) {
          obtenerConversacionesSolicitud(
            productoRowId
          )
            .then((conversaciones) => {
              const conversacion =
                conversaciones.find(
                  (item) =>
                    item.oferta_id &&
                    String(item.oferta_id) ===
                      ofertaString
                );

              if (conversacion?.id) {
                marcarConversacionTraspasadaAOferta(
                  productoRowId,
                  conversacion.id
                );

                setTraspasadasRevision(
                  (revision) => revision + 1
                );
              }
            })
            .catch(() => {});

          setBandejaAbiertaPorProducto(
            (bandejasAnteriores) => {
              if (
                !bandejasAnteriores[productoRowId]
              ) {
                return bandejasAnteriores;
              }

              const siguiente = {
                ...bandejasAnteriores,
              };

              delete siguiente[productoRowId];

              return siguiente;
            }
          );
        }

        if (
          anteriores[productoRowId] ===
          ofertaString
        ) {
          const siguiente = { ...anteriores };
          delete siguiente[productoRowId];

          return siguiente;
        }

        return {
          ...anteriores,
          [productoRowId]: ofertaString,
        };
      }
    );
  };

  useEffect(() => {
    abrirDesdeNotificacion('ofertas');
    abrirDesdeNotificacion('chat');

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.isReady, router.query, listas]);

  useEffect(() => {
    if (
      !router.isReady ||
      router.query?.notif !== 'chat'
    ) {
      return;
    }

    if (!ofertaDestacadaId) return;

    if (
      Object.keys(ofertasCrudasPorProducto)
        .length === 0
    ) {
      return;
    }

    const existe = Object.values(
      ofertasCrudasPorProducto
    )
      .flat()
      .some(
        (oferta) =>
          String(oferta.id) ===
          String(ofertaDestacadaId)
      );

    if (!existe) {
      setDeepLinkError(
        'No se pudo abrir la conversación solicitada. La oferta no está disponible o no tienes acceso.'
      );

      setConversacionAbiertaPorProducto(
        (anteriores) => {
          const siguiente = { ...anteriores };

          Object.keys(siguiente).forEach(
            (clave) => {
              if (
                siguiente[clave] ===
                String(ofertaDestacadaId)
              ) {
                delete siguiente[clave];
              }
            }
          );

          return siguiente;
        }
      );
    }
  }, [
    router.isReady,
    router.query,
    ofertaDestacadaId,
    ofertasCrudasPorProducto,
  ]);

  useEffect(() => {
    if (
      !router.isReady ||
      router.query?.notif !== 'chat'
    ) {
      return;
    }

    const ofertaIdParam = Array.isArray(
      router.query.oferta_id
    )
      ? router.query.oferta_id[0]
      : router.query.oferta_id;

    if (
      !ofertaIdParam ||
      Object.keys(ofertasCrudasPorProducto)
        .length === 0
    ) {
      return;
    }

    const ofertaEncontrada = Object.values(
      ofertasCrudasPorProducto
    )
      .flat()
      .find(
        (oferta) =>
          String(oferta.id) ===
          String(ofertaIdParam)
      );

    if (!ofertaEncontrada?.lista_id) return;

    setConversacionAbiertaPorProducto(
      (anteriores) => ({
        ...anteriores,
        [ofertaEncontrada.lista_id]:
          String(ofertaIdParam),
      })
    );
  }, [
    router.isReady,
    router.query,
    ofertasCrudasPorProducto,
  ]);

  useEffect(() => {
    if (
      !router.isReady ||
      router.query?.notif !== 'chat'
    ) {
      return;
    }

    const conversacionIdParam = Array.isArray(
      router.query.conversacion_id
    )
      ? router.query.conversacion_id[0]
      : router.query.conversacion_id;

    if (!conversacionIdParam) return;

    const listIdParam = Array.isArray(
      router.query.list_id
    )
      ? router.query.list_id[0]
      : router.query.list_id;

    if (!listIdParam) return;

    setBandejaAbiertaPorProducto(
      (anteriores) => ({
        ...anteriores,
        [listIdParam]: true,
      })
    );

    setConversacionBandejaPorProducto(
      (anteriores) => ({
        ...anteriores,
        [listIdParam]:
          String(conversacionIdParam),
      })
    );
  }, [router.isReady, router.query]);

  useEffect(() => {
    if (!router.isReady) return;

    if (
      !['ofertas', 'chat'].includes(
        router.query?.notif
      )
    ) {
      return;
    }

    const listIdParam = Array.isArray(
      router.query.list_id
    )
      ? router.query.list_id[0]
      : router.query.list_id;

    const ofertaIdParam = Array.isArray(
      router.query.oferta_id
    )
      ? router.query.oferta_id[0]
      : router.query.oferta_id;

    const conversacionIdParam = Array.isArray(
      router.query.conversacion_id
    )
      ? router.query.conversacion_id[0]
      : router.query.conversacion_id;

    const scrollKey = conversacionIdParam
      ? `chat-consolidado-${
          listIdParam || 'chat'
        }`
      : ofertaIdParam
        ? `oferta-card-${ofertaIdParam}`
        : listIdParam
          ? `oferta-${listIdParam}`
          : null;

    if (!scrollKey) return;

    if (
      listIdParam &&
      !conversacionIdParam &&
      !productosConOfertasAbiertas[
        listIdParam
      ]
    ) {
      return;
    }

    if (
      scrolledToOfertaRef.current === scrollKey
    ) {
      return;
    }

    const timer = setTimeout(() => {
      const elemento =
        document.getElementById(scrollKey);

      if (elemento) {
        elemento.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });

        scrolledToOfertaRef.current =
          scrollKey;
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [
    router.isReady,
    router.query,
    productosConOfertasAbiertas,
    expandedFechas,
  ]);

  const handleChange = (
    index,
    field,
    value
  ) => {
    const productosActualizados = [
      ...productos,
    ];

    productosActualizados[index][field] =
      field === 'detalle_pedido'
        ? value.slice(0, MAX_DETALLE_PEDIDO)
        : typeof value === 'string'
          ? value.toUpperCase()
          : value;

    if (field === 'producto') {
      productosActualizados[index].formato =
        '';

      productosActualizados[index].marca =
        '';
    } else if (field === 'formato') {
      productosActualizados[index].marca =
        '';
    }

    setProductos(productosActualizados);
  };

  const obtenerFormatos = (producto) => [
    ...new Set(
      stock
        .filter(
          (item) => item.nombre === producto
        )
        .map((item) => item.formato)
    ),
  ];

  const obtenerMarcas = (
    producto,
    formato
  ) => [
    ...new Set(
      stock
        .filter(
          (item) =>
            item.nombre === producto &&
            item.formato === formato
        )
        .map((item) => item.marca)
    ),
  ];

  const agregarFila = () => {
    setProductos((anteriores) => [
      ...anteriores,
      { ...filaVacia },
    ]);
  };

  const enviarLista = async () => {
    if (!authUserId || !comunaDespacho) {
      showModal({
        type: 'error',
        title: 'Faltan datos',
        message:
          'Debes iniciar sesión y completar la comuna.',
      });

      return;
    }

    const productosValidos = productos.filter(
      (producto) =>
        producto.producto &&
        producto.formato &&
        producto.marca &&
        producto.cantidad &&
        producto.precio
    );

    if (productosValidos.length === 0) {
      showModal({
        type: 'error',
        title: 'Lista incompleta',
        message:
          'Debes agregar al menos un producto completo.',
      });

      return;
    }

    const fecha = new Date().toISOString();

    const compradorEmail =
      localStorage.getItem('user_email') || '';

    const {
      data: listaCreada,
      error: listaError,
    } = await supabase
      .from('listas')
      .insert({
        nombre_lista: nombreLista.trim(),
        usuario_id: authUserId,
        comprador_email: compradorEmail,
        comuna_despacho:
          comunaDespacho.toUpperCase(),
        fecha_creacion: fecha,
        estado: 'publicada',
      })
      .select()
      .single();

    if (listaError) {
      showModal({
        type: 'error',
        title: 'No se pudo crear la lista',
        message: listaError.message,
      });

      return;
    }

    const productosAgrupados = Object.values(
      productosValidos.reduce(
        (acumulador, producto) => {
          const clave =
            `${producto.producto}-${producto.marca}`;

          if (!acumulador[clave]) {
            acumulador[clave] = {
              producto: producto.producto,
              marca: producto.marca,
              formatos_detalle: [],
            };
          }

          acumulador[
            clave
          ].formatos_detalle.push({
            formato: producto.formato,
            cantidad: Number(
              producto.cantidad
            ),
            precio: Number(producto.precio),
            detalle_pedido:
              normalizarDetallePedido(
                producto.detalle_pedido
              ),
          });

          return acumulador;
        },
        {}
      )
    );
        const lista = productosAgrupados.map(
      (producto) => ({
        producto: producto.producto,
        marca: producto.marca,

        formato: producto.formatos_detalle
          .map((formato) => formato.formato)
          .join(', '),

        formatos_detalle:
          producto.formatos_detalle,

        cantidad:
          producto.formatos_detalle.reduce(
            (total, formato) =>
              total + formato.cantidad,
            0
          ),

        precio:
          producto.formatos_detalle.reduce(
            (total, formato) =>
              total + formato.precio,
            0
          ),

        usuario_id: authUserId,
        comprador_email: compradorEmail,
        fecha_creacion: fecha,
        comuna_despacho:
          comunaDespacho.toUpperCase(),
        nombre_lista: nombreLista.trim(),
        lista_id: listaCreada.id,
      })
    );

    const { data, error } = await supabase
      .from('listas_compras')
      .insert(lista)
      .select();

    if (error) {
      showModal({
        type: 'error',
        title: 'No se pudo enviar la lista',
        message: error.message,
      });

      return;
    }

    const nombreListaEnviada =
      nombreLista.trim();

    setProductos([{ ...filaVacia }]);
    setComunaDespacho('');
    setNombreLista('');

    setListas((anteriores) => [
      ...(data || []),
      ...anteriores,
    ]);

    showModal({
      type: 'success',
      title: 'Lista enviada',
      message: `Lista "${nombreListaEnviada}" enviada correctamente.`,
      confirmText: 'Aceptar',
    });
  };

  const guardarLista = async () => {
    if (!authUserId) {
      showError(
        'Debes iniciar sesión para guardar una lista.'
      );

      return;
    }

    if (!nombreLista.trim()) {
      showError(
        'Debes ingresar un nombre para guardar la lista.'
      );

      return;
    }

    const productosValidos = productos.filter(
      (producto) =>
        producto.producto ||
        producto.formato ||
        producto.marca ||
        producto.cantidad ||
        producto.precio
    );

    if (productosValidos.length === 0) {
      showError(
        'Debes agregar al menos un producto antes de guardar.'
      );

      return;
    }

    const productosIncompletos =
      productosValidos.some(
        (producto) =>
          !producto.producto ||
          !producto.formato ||
          !producto.marca ||
          !producto.cantidad ||
          !producto.precio
      );

    if (productosIncompletos) {
      showError(
        'Completa todos los campos de los productos antes de guardar la lista.'
      );

      return;
    }

    const fecha = new Date().toISOString();

    const compradorEmail =
      localStorage.getItem('user_email') || '';

    const nombreListaGuardada =
      nombreLista.trim();

    const {
      data: listaCreada,
      error: listaError,
    } = await supabase
      .from('listas')
      .insert({
        nombre_lista: nombreListaGuardada,
        usuario_id: authUserId,
        comprador_email: compradorEmail,
        comuna_despacho: comunaDespacho
          ? comunaDespacho.toUpperCase()
          : '',
        fecha_creacion: fecha,
        estado: 'borrador',
      })
      .select()
      .single();

    if (listaError) {
      showError(
        `Error al guardar la lista: ${listaError.message}`
      );

      return;
    }

    const productosAgrupadosGuardados =
      Object.values(
        productosValidos.reduce(
          (acumulador, producto) => {
            const clave =
              `${producto.producto}-${producto.marca}`;

            if (!acumulador[clave]) {
              acumulador[clave] = {
                producto: producto.producto,
                marca: producto.marca,
                formatos_detalle: [],
              };
            }

            acumulador[
              clave
            ].formatos_detalle.push({
              formato: producto.formato,
              cantidad: Number(
                producto.cantidad
              ),
              precio: Number(
                producto.precio
              ),
              detalle_pedido:
                normalizarDetallePedido(
                  producto.detalle_pedido
                ),
            });

            return acumulador;
          },
          {}
        )
      );

    const listaProductos =
      productosAgrupadosGuardados.map(
        (producto) => ({
          producto: producto.producto,
          marca: producto.marca,

          formato: producto.formatos_detalle
            .map((formato) => formato.formato)
            .join(', '),

          formatos_detalle:
            producto.formatos_detalle,

          cantidad:
            producto.formatos_detalle.reduce(
              (total, formato) =>
                total + formato.cantidad,
              0
            ),

          precio:
            producto.formatos_detalle.reduce(
              (total, formato) =>
                total + formato.precio,
              0
            ),

          usuario_id: authUserId,
          comprador_email: compradorEmail,
          fecha_creacion: fecha,
          comuna_despacho: comunaDespacho
            ? comunaDespacho.toUpperCase()
            : '',
          nombre_lista: nombreListaGuardada,
          lista_id: listaCreada.id,
        })
      );

    const { error: productosError } =
      await supabase
        .from('listas_compras')
        .insert(listaProductos);

    if (productosError) {
      await supabase
        .from('listas')
        .delete()
        .eq('id', listaCreada.id);

      showError(
        `Error al guardar los productos: ${productosError.message}`
      );

      return;
    }

    setProductos([{ ...filaVacia }]);
    setComunaDespacho('');
    setNombreLista('');

    await fetchData();

    showModal({
      type: 'success',
      title: 'Lista guardada',
      message: `La lista "${nombreListaGuardada}" quedó guardada como borrador.`,
      confirmText: 'Aceptar',
    });
  };

  const publicarLista = async (listaId) => {
    if (!listaId) {
      showError(
        'No se encontró el identificador de la lista.'
      );

      return;
    }

    const { error } = await supabase
      .from('listas')
      .update({
        estado: 'publicada',
      })
      .eq('id', listaId);

    if (error) {
      showError(
        `No se pudo publicar la lista: ${error.message}`
      );

      return;
    }

    setListas((anteriores) =>
      anteriores.map((producto) =>
        producto.lista_id === listaId
          ? {
              ...producto,
              estado_lista: 'publicada',
            }
          : producto
      )
    );

    showModal({
      type: 'success',
      title: 'Lista publicada',
      message:
        'La lista ya está disponible para los proveedores.',
      confirmText: 'Aceptar',
    });
  };

  const toggleExpand = (fecha) => {
    setExpandedFechas((anteriores) =>
      anteriores.includes(fecha)
        ? anteriores.filter(
            (item) => item !== fecha
          )
        : [...anteriores, fecha]
    );
  };

  const toggleEdit = (fecha) => {
    setEditandoFechas((anteriores) =>
      anteriores.includes(fecha)
        ? anteriores.filter(
            (item) => item !== fecha
          )
        : [...anteriores, fecha]
    );
  };

  const toggleOfertasProducto = (
    productoId
  ) => {
    setProductosConOfertasAbiertas(
      (anteriores) => ({
        ...anteriores,
        [productoId]:
          !anteriores[productoId],
      })
    );
  };

  const actualizarProducto = async (
    id,
    field,
    value
  ) => {
    let payload;
    let estadoParcial;

    if (field === 'detalle_pedido') {
      const item = listas.find(
        (producto) => getRowId(producto) === id
      );

      if (!item) return;

      const detalle =
        normalizarDetallePedido(value);

      const formatos =
        Array.isArray(item.formatos_detalle) &&
        item.formatos_detalle.length > 0
          ? item.formatos_detalle.map(
              (formato) => ({
                ...formato,
                detalle_pedido: detalle,
              })
            )
          : [
              {
                formato: item.formato,
                cantidad: item.cantidad,
                precio: item.precio,
                detalle_pedido: detalle,
              },
            ];

      payload = {
        formatos_detalle: formatos,
      };

      estadoParcial = {
        formatos_detalle: formatos,
      };
    } else {
      payload = {
        [field]: value,
      };

      estadoParcial = {
        [field]: value,
      };
    }

    const { error } = await supabase
      .from('listas_compras')
      .update(payload)
      .eq('id', id);

    if (error) {
      showModal({
        type: 'error',
        title:
          'No se pudo actualizar el producto',
        message: error.message,
      });

      return;
    }

    setListas((anteriores) =>
      anteriores.map((producto) =>
        getRowId(producto) === id
          ? {
              ...producto,
              ...estadoParcial,
            }
          : producto
      )
    );
  };

  const eliminarProducto = async (id) => {
    const { error } = await supabase
      .from('listas_compras')
      .delete()
      .eq('id', id);

    if (error) {
      showModal({
        type: 'error',
        title:
          'No se pudo eliminar el producto',
        message: error.message,
      });

      return;
    }

    setListas((anteriores) =>
      anteriores.filter(
        (producto) =>
          getRowId(producto) !== id
      )
    );
  };

  const eliminarListaConfirmada = async (
    fecha
  ) => {
    const ids = (groupByFecha[fecha] || [])
      .map((producto) => getRowId(producto))
      .filter(Boolean);

    if (ids.length === 0) return;

    const { error } = await supabase
      .from('listas_compras')
      .delete()
      .in('id', ids);

    if (error) {
      showModal({
        type: 'error',
        title: 'No se pudo eliminar la lista',
        message: error.message,
      });

      return;
    }

    setListas((anteriores) =>
      anteriores.filter(
        (producto) =>
          !ids.includes(getRowId(producto))
      )
    );

    setExpandedFechas((anteriores) =>
      anteriores.filter(
        (item) => item !== fecha
      )
    );

    setEditandoFechas((anteriores) =>
      anteriores.filter(
        (item) => item !== fecha
      )
    );
  };

  const eliminarLista = (fecha) => {
    showModal({
      type: 'error',
      title: 'Eliminar lista',
      message:
        '¿Estás seguro de que quieres eliminar esta lista?',
      confirmText: 'Eliminar',
      cancelText: 'Cancelar',
      showCancel: true,

      onConfirm: async () => {
        setModal(createModalState());

        await eliminarListaConfirmada(fecha);
      },

      onCancel: () =>
        setModal(createModalState()),
    });
  };

  const aplicarFiltrosOfertas = useCallback(
    (ofertas) => {
      const resultado = [...(ofertas || [])];

      resultado.sort((ofertaA, ofertaB) => {
        if (filtroDespacho24) {
          const tiene24A =
            ofertaA.incluye_despacho &&
            Number(
              ofertaA.tiempo_despacho_horas
            ) === 24;

          const tiene24B =
            ofertaB.incluye_despacho &&
            Number(
              ofertaB.tiempo_despacho_horas
            ) === 24;

          if (tiene24A !== tiene24B) {
            return tiene24A ? -1 : 1;
          }
        }

        if (filtroDespacho) {
          const incluyeA = Boolean(
            ofertaA.incluye_despacho
          );

          const incluyeB = Boolean(
            ofertaB.incluye_despacho
          );

          if (incluyeA !== incluyeB) {
            return incluyeA ? -1 : 1;
          }
        }

        if (filtroCincoEstrellas) {
          const estrellasA =
            ofertaA.promedio_estrellas;

          const estrellasB =
            ofertaB.promedio_estrellas;

          if (estrellasA !== estrellasB) {
            return estrellasB - estrellasA;
          }
        }

        if (filtroMejorPrecio) {
          const precioA = Number(
            ofertaA.precio_ofertado || 0
          );

          const precioB = Number(
            ofertaB.precio_ofertado || 0
          );

          if (precioA !== precioB) {
            return precioA - precioB;
          }
        }

        return 0;
      });

      return resultado.slice(0, 3);
    },
    [
      filtroMejorPrecio,
      filtroDespacho,
      filtroDespacho24,
      filtroCincoEstrellas,
    ]
  );
    const combinarOfertasVisibles =
    useCallback(
      (ofertas, destacadaId) => {
        const base =
          aplicarFiltrosOfertas(ofertas);

        const visibles = [...base];

        const ids = new Set(
          visibles.map((oferta) =>
            String(oferta.id)
          )
        );

        (ofertas || []).forEach((oferta) => {
          const estado = (
            oferta.estado || ''
          ).toLowerCase();

          if (
            estado === 'rechazada' &&
            !ids.has(String(oferta.id))
          ) {
            visibles.push(oferta);
            ids.add(String(oferta.id));
          }
        });

        if (destacadaId) {
          const ofertaDestacada = (
            ofertas || []
          ).find(
            (oferta) =>
              String(oferta.id) ===
              String(destacadaId)
          );

          if (
            ofertaDestacada &&
            !ids.has(
              String(ofertaDestacada.id)
            )
          ) {
            visibles.push(ofertaDestacada);
          }
        }

        return visibles;
      },
      [aplicarFiltrosOfertas]
    );

  useEffect(() => {
    const claves = Object.keys(
      ofertasCrudasPorProducto
    );

    if (claves.length === 0) return;

    const ofertasFiltradas = {};

    claves.forEach((clave) => {
      ofertasFiltradas[clave] =
        combinarOfertasVisibles(
          ofertasCrudasPorProducto[clave],
          ofertaDestacadaId
        );
    });

    setOfertasPorProducto(ofertasFiltradas);
  }, [
    ofertasCrudasPorProducto,
    combinarOfertasVisibles,
    ofertaDestacadaId,
  ]);

  const verOfertas = async (fecha) => {
    if (!expandedFechas.includes(fecha)) {
      setExpandedFechas((anteriores) => [
        ...anteriores,
        fecha,
      ]);
    }

    const productosFecha =
      groupByFecha[fecha] || [];

    const listaIds = Array.from(
      new Set(
        productosFecha
          .map((item) => getRowId(item))
          .filter(Boolean)
      )
    );

    if (listaIds.length === 0) return;

    const {
      data: ofertasAll,
      error,
    } = await supabase
      .from('ofertas_productos')
      .select(`
        *,
        perfiles:proveedor_id (
          email,
          email_contacto,
          telefono_contacto
        )
      `)
      .in('lista_id', listaIds)
      .order('precio_ofertado', {
        ascending: true,
      });

    if (error) {
      showModal({
        type: 'error',
        title:
          'No se pudieron cargar las ofertas',
        message: error.message,
      });

      return;
    }

    const ofertasVisibles = ofertasAll || [];

    const proveedorIds = [
      ...new Set(
        ofertasVisibles.map(
          (oferta) => oferta.proveedor_id
        )
      ),
    ];

    const ofertaIds = ofertasVisibles
      .map((oferta) => oferta.id)
      .filter(Boolean);

    let calificaciones = [];

    if (ofertaIds.length > 0) {
      const {
        data: calificacionesData,
        error: calificacionesError,
      } = await supabase
        .from('calificaciones_proveedor')
        .select(
          'oferta_id, proveedor_id, estrellas'
        )
        .in('oferta_id', ofertaIds);

      if (calificacionesError) {
        showModal({
          type: 'error',
          title:
            'No se pudieron cargar las calificaciones',
          message: calificacionesError.message,
        });

        return;
      }

      calificaciones =
        calificacionesData || [];
    }

    const ofertasConCalificacion =
      new Set(
        calificaciones.map((calificacion) =>
          String(calificacion.oferta_id)
        )
      );

    const promedioProveedor = {};

    proveedorIds.forEach((proveedorId) => {
      const notas = calificaciones
        .filter(
          (calificacion) =>
            calificacion.proveedor_id ===
            proveedorId
        )
        .map((calificacion) =>
          Number(calificacion.estrellas)
        );

      promedioProveedor[proveedorId] =
        notas.length > 0
          ? notas.reduce(
              (total, nota) => total + nota,
              0
            ) / notas.length
          : 0;
    });

    const ofertasCrudas = {};

    for (const item of productosFecha) {
      const listaId = getRowId(item);

      const ofertasDeEste =
        ofertasVisibles
          .filter(
            (oferta) =>
              oferta.lista_id === listaId
          )
          .map((oferta) => ({
            ...oferta,

            promedio_estrellas:
              promedioProveedor[
                oferta.proveedor_id
              ] || 0,

            tiene_calificacion:
              ofertasConCalificacion.has(
                String(oferta.id)
              ),
          }));

      const clave =
        `${item.producto}__${listaId}`;

      ofertasCrudas[clave] =
        ofertasDeEste;
    }

    setOfertasCrudasPorProducto(
      (anteriores) => ({
        ...anteriores,
        ...ofertasCrudas,
      })
    );

    for (const listaId of listaIds) {
      obtenerConversacionesSolicitud(
        listaId
      )
        .then((conversaciones) => {
          let huboCambio = false;

          (conversaciones || []).forEach(
            (conversacion) => {
              if (
                conversacion?.oferta_id &&
                conversacion?.id
              ) {
                marcarConversacionTraspasadaAOferta(
                  listaId,
                  conversacion.id
                );

                huboCambio = true;
              }
            }
          );

          if (huboCambio) {
            setTraspasadasRevision(
              (revision) => revision + 1
            );
          }
        })
        .catch(() => {});
    }

    setListasConOfertas(
      (anteriores) => [
        ...new Set([
          ...anteriores,
          fecha,
        ]),
      ]
    );
  };

  useEffect(() => {
    const onCarroUpdated = () => {
      listasConOfertas.forEach((fecha) => {
        verOfertas(fecha);
      });
    };

    window.addEventListener(
      CARRO_UPDATED_EVENT,
      onCarroUpdated
    );

    return () => {
      window.removeEventListener(
        CARRO_UPDATED_EVENT,
        onCarroUpdated
      );
    };
  }, [listasConOfertas]);

  const aceptarOferta = async (oferta, fecha) => {
    const { error: ofertaError } =
      await supabase.rpc('adjudicar_oferta', {
        p_oferta_id: oferta.id,
      });

    if (ofertaError) {
      const yaNoDisponible =
        String(ofertaError.message || '')
          .toLowerCase()
          .includes('no está pendiente de adjudicación');

      if (yaNoDisponible) {
        if (fecha) await verOfertas(fecha);
        notifyCarroUpdated();
        showModal({
          type: 'info',
          title: 'Oferta actualizada',
          message: 'Esta solicitud ya fue adjudicada. Actualizamos su estado en pantalla.',
          confirmText: 'Aceptar',
        });
        return;
      }

      showError(
        `Error al aceptar la oferta: ${ofertaError.message}`
      );

      return;
    }

    if (fecha) {
      await verOfertas(fecha);
    }

    notifyCarroUpdated();

    showModal({
      type: 'success',
      title: 'Oferta agregada al carro',
      message:
        'Puedes seguir revisando tus solicitudes y pagar tus compras juntas cuando estés listo.',
      confirmText: 'Continuar',
    });
  };

  const showError = (
    message,
    title = 'Error'
  ) => {
    showModal({
      type: 'error',
      title,
      message,
      confirmText: 'Aceptar',
    });
  };

  /*
  const confirmarOferta = async (
    oferta,
    fecha
  ) => {
    const { error: ganadorError } =
      await supabase
        .from('ofertas_productos')
        .update({
          estado: 'pendiente_pago',
          comentario_comprador:
            comentariosCompra[oferta.id] || '',
        })
        .eq('id', oferta.id);

    if (ganadorError) {
      showModal({
        type: 'error',
        title:
          'No se pudo confirmar la oferta',
        message: ganadorError.message,
      });

      return;
    }

    await supabase
      .from('notificaciones')
      .insert([
        {
          usuario_id:
            oferta.proveedor_id,
          rol: 'proveedor',
          titulo:
            'Compra pendiente de pago',
          mensaje:
            `El comprador confirmó tu oferta para ${oferta.producto}, pero el pago aún está pendiente.`,
          ruta: RUTA_MIS_OFERTAS,
          leida: false,
        },
      ]);

    const { error: rechazadasError } =
      await supabase
        .from('ofertas_productos')
        .update({
          estado: 'rechazada',
        })
        .eq('lista_id', oferta.lista_id)
        .neq('id', oferta.id);

    if (rechazadasError) {
      showModal({
        type: 'error',
        title:
          'No se pudieron actualizar las otras ofertas',
        message: rechazadasError.message,
      });

      return;
    }

    await pagarOferta(oferta);
  };
  */

  const pagarOferta = async (oferta) => {
    router.push(`/pagos?oferta_id=${encodeURIComponent(oferta.id)}`);
    return;
    const {
      data: proveedor,
      error,
    } = await supabase
      .from('perfiles')
      .select(`
        banco,
        tipo_cuenta,
        numero_cuenta,
        rut_titular,
        nombre_titular,
        email_titular
      `)
      .eq('id', oferta.proveedor_id)
      .maybeSingle();

    if (error || !proveedor) {
      showModal({
        type: 'error',
        title:
          'Datos bancarios no encontrados',
        message:
          'No se encontraron los datos bancarios del proveedor.',
      });

      return;
    }

    const montoOferta = Number(
      oferta.precio_ofertado
    );

    const COMISION_KYNTU = 0;
    const IVA = 0.19;

    const comisionKyntu = Math.round(
      montoOferta * COMISION_KYNTU * (1 + IVA)
    );

    // La comisión se descuenta al proveedor; el comprador paga la oferta.
    const totalPagado = montoOferta;

    const {
      data: pagosRpc,
      error: pagoError,
    } = await supabase.rpc(
      'obtener_o_crear_pago_pendiente',
      { p_oferta_id: oferta.id }
    );

    if (pagoError) {
      showError(
        `Error creando registro de pago: ${pagoError.message}`
      );

      return;
    }

    const pagoCreado = Array.isArray(pagosRpc)
      ? pagosRpc[0]
      : pagosRpc;

    if (!pagoCreado?.id) {
      showError(
        'No se pudo obtener el registro de pago.'
      );

      return;
    }

    const response = await fetch(
      '/api/pagos/iniciar',
      {
        method: 'POST',
        headers: {
          'Content-Type':
            'application/json',
        },
        body: JSON.stringify({
          pago_id: pagoCreado.id,
          oferta_id: oferta.id,
          proveedor_id:
            oferta.proveedor_id,
          titulo: oferta.producto,
          precio:
            Number(pagoCreado.total_pagado) ||
            totalPagado,
        }),
      }
    );

    const data = await response.json();

    if (data.checkout_url) {
      router.push(data.checkout_url);
    } else {
      showModal({
        type: 'error',
        title:
          'No se pudo iniciar el pago',
        message:
          data?.error ||
          'No fue posible obtener el enlace de pago.',
      });
    }
  };

  const cerrarModalCalificacion = () => {
    setRatingModal({
      open: false,
      oferta: null,
      fechaLista: null,
      estrellas: 5,
      comentario: '',
    });
  };

  const actualizarOfertaAPagada = async (
    ofertaId
  ) => {
    const { data, error } = await supabase.rpc(
      'marcar_oferta_pagada',
      { p_oferta_id: ofertaId }
    );

    if (error) {
      return {
        ok: false,
        error,
      };
    }

    if (!data) {
      return {
        ok: false,
        error: new Error(
          'No se encontró la oferta para actualizar.'
        ),
      };
    }

    return {
      ok: true,
      error: null,
    };
  };

  const confirmarRecepcion = async (
    oferta,
    fechaLista
  ) => {
    const { error } = await supabase.rpc(
      'confirmar_recepcion_oferta',
      { p_oferta_id: oferta.id }
    );

    if (error) {
      showError(
        `Error al confirmar recepción: ${error.message}`
      );

      return;
    }

    if (fechaLista) {
      await verOfertas(fechaLista);
    }

    setRatingModal({
      open: true,
      oferta,
      fechaLista: fechaLista || null,
      estrellas: 5,
      comentario: '',
    });
  };

  const guardarCalificacion = async () => {
    const oferta = ratingModal.oferta;
    const fechaLista =
      ratingModal.fechaLista;

    if (
      !oferta ||
      guardandoCalificacion
    ) {
      return;
    }

    if (!usuarioId) {
      showError(
        'No se pudo identificar al comprador.'
      );

      return;
    }

    if (!oferta.proveedor_id) {
      showError(
        'No se pudo identificar al proveedor.'
      );

      return;
    }

    setGuardandoCalificacion(true);

    try {
      const {
        data: calificacionExistente,
        error: checkError,
      } = await supabase
        .from('calificaciones_proveedor')
        .select('id')
        .eq('oferta_id', oferta.id)
        .maybeSingle();

      if (checkError) {
        showError(
          `Error al verificar calificación: ${checkError.message}`
        );

        return;
      }

      if (calificacionExistente) {
        const {
          ok,
          error: updateError,
        } = await actualizarOfertaAPagada(
          oferta.id
        );

        if (fechaLista) {
          await verOfertas(fechaLista);
        }

        cerrarModalCalificacion();

        if (!ok) {
          showError(
            `Esta oferta ya fue calificada, pero no se pudo actualizar el estado final: ${
              updateError?.message ||
              'error desconocido'
            }`
          );

          return;
        }

        showModal({
          type: 'success',
          title:
            'Calificación registrada',
          message:
            'Esta oferta ya había sido calificada. Se actualizó el estado de la licitación.',
          confirmText: 'Aceptar',
        });

        return;
      }

      const { error: insertError } =
        await supabase
          .from(
            'calificaciones_proveedor'
          )
          .insert({
            oferta_id: oferta.id,
            proveedor_id:
              oferta.proveedor_id,
            comprador_id: usuarioId,
            estrellas:
              ratingModal.estrellas,
            comentario:
              ratingModal.comentario,
          });

      if (insertError) {
        if (insertError.code === '23505') {
          const {
            ok,
            error: updateError,
          } = await actualizarOfertaAPagada(
            oferta.id
          );

          if (fechaLista) {
            await verOfertas(fechaLista);
          }

          cerrarModalCalificacion();

          if (!ok) {
            showError(
              `La calificación ya existía, pero no se pudo cerrar la licitación: ${
                updateError?.message ||
                'error desconocido'
              }`
            );

            return;
          }

          showModal({
            type: 'success',
            title:
              'Calificación registrada',
            message:
              'Esta oferta ya había sido calificada. Se actualizó el estado de la licitación.',
            confirmText: 'Aceptar',
          });

          return;
        }

        showError(
          `Error al guardar calificación: ${insertError.message}`
        );

        return;
      }

      const {
        ok,
        error: updateError,
      } = await actualizarOfertaAPagada(
        oferta.id
      );

      if (!ok) {
        if (fechaLista) {
          await verOfertas(fechaLista);
        }

        cerrarModalCalificacion();

        showError(
          `La calificación se guardó, pero no se pudo cerrar la licitación: ${
            updateError?.message ||
            'error desconocido'
          }. Al recargar, la oferta quedará marcada como calificada.`
        );

        return;
      }

      if (fechaLista) {
        await verOfertas(fechaLista);
      }

      cerrarModalCalificacion();

      showModal({
        type: 'success',
        title: 'Calificación enviada',
        message:
          'Gracias por calificar al proveedor. Licitación adjudicada.',
        confirmText: 'Aceptar',
      });
    } finally {
      setGuardandoCalificacion(false);
    }
  };

  const rechazarOferta = async (
    oferta,
    producto,
    fecha
  ) => {
    const { error } = await supabase.rpc(
      'rechazar_oferta',
      { p_oferta_id: oferta.id }
    );

    if (error) {
      showModal({
        type: 'error',
        title:
          'No se pudo rechazar la oferta',
        message: error.message,
      });

      return;
    }

    await verOfertas(fecha);
  };

  const cerrarSesion = async () => {
    const { error } =
      await supabase.auth.signOut();

    if (error) {
      showModal({
        type: 'error',
        title:
          'No se pudo cerrar la sesión',
        message: error.message,
      });

      return;
    }

    localStorage.clear();
    router.push('/login');
  };

  const cambiarPerfil = () => {
    router.push('/seleccionar-perfil');
  };

  const agregarProductoEnLista = (
    fecha
  ) => {
    setNuevosProductos((anteriores) => ({
      ...anteriores,
      [fecha]: [
        ...(anteriores[fecha] || []),
        { ...filaVacia },
      ],
    }));
  };

  const handleNuevoChange = (
    fecha,
    index,
    field,
    value
  ) => {
    const productosActualizados = [
      ...(nuevosProductos[fecha] || []),
    ];

    productosActualizados[index][field] =
      field === 'detalle_pedido'
        ? value.slice(0, MAX_DETALLE_PEDIDO)
        : typeof value === 'string'
          ? value.toUpperCase()
          : value;

    if (field === 'producto') {
      productosActualizados[index].formato =
        '';

      productosActualizados[index].marca =
        '';
    } else if (field === 'formato') {
      productosActualizados[index].marca =
        '';
    }

    setNuevosProductos((anteriores) => ({
      ...anteriores,
      [fecha]: productosActualizados,
    }));
  };

  const guardarNuevoProducto = async (
    fecha,
    producto
  ) => {
    const listaBase =
      groupByFecha[fecha]?.[0];

    if (!listaBase) return;

    if (
      !producto.producto ||
      !producto.formato ||
      !producto.marca ||
      !producto.cantidad ||
      !producto.precio
    ) {
      showModal({
        type: 'error',
        title: 'Producto incompleto',
        message:
          'Completa todos los datos del producto.',
      });

      return;
    }

    const nuevoProducto = {
      producto: producto.producto,
      formato: producto.formato,
      marca: producto.marca,
      cantidad: Number(
        producto.cantidad
      ),
      precio: Number(producto.precio),

      formatos_detalle: [
        {
          formato: producto.formato,
          cantidad: Number(
            producto.cantidad
          ),
          precio: Number(
            producto.precio
          ),
          detalle_pedido:
            normalizarDetallePedido(
              producto.detalle_pedido
            ),
        },
      ],

      usuario_id: listaBase.usuario_id,

      comprador_email:
        listaBase.comprador_email ||
        localStorage.getItem(
          'user_email'
        ) ||
        '',

      fecha_creacion:
        listaBase.fecha_creacion,

      comuna_despacho:
        listaBase.comuna_despacho,

      nombre_lista:
        listaBase.nombre_lista || '',

      lista_id:
        listaBase.lista_id || null,
    };

    const { data, error } = await supabase
      .from('listas_compras')
      .insert([nuevoProducto])
      .select()
      .single();

    if (error) {
      showModal({
        type: 'error',
        title:
          'No se pudo guardar el producto',
        message: error.message,
      });

      return;
    }

    setListas((anteriores) => [
      data,
      ...anteriores,
    ]);

    setNuevosProductos(
      (anteriores) => ({
        ...anteriores,
        [fecha]: [],
      })
    );
  };

  const formatearPrecio = (valor) =>
    valor === '' ||
    valor === null ||
    valor === undefined
      ? ''
      : Number(valor).toLocaleString(
          'es-CL'
        );

  return (
    <AppLayout
      title="Panel del Comprador"
      showProfileSwitch={
        tienePerfilProveedor
      }
      onChangeProfile={cambiarPerfil}
      onUpdateData={() =>
        router.push(
          '/comprador/datos-contacto'
        )
      }
      onDashboard={() =>
        router.push(
          '/comprador/DashboardComprador'
        )
      }
      onLogout={cerrarSesion}
      cart={<CarroCompradorButton />}
      notifications={
        <Notificaciones
          userId={authUserId}
          rol="comprador"
        />
      }
      support={
        usuarioId ? (
          <SoporteLauncher perfilId={usuarioId} rol="comprador" />
        ) : null
      }
    >
          <section
        className="kyntu-card"
        style={styles.card}
      >
        <div
          className="kyntu-sectionHeading"
          style={styles.sectionHeading}
        >
          <img
            src="/icono_2.png"
            alt="Kyntü"
            className="kyntu-logo"
            style={styles.logo}
          />

          <h2
            className="kyntu-cardTitle"
            style={{
              ...styles.cardTitle,
              ...styles.addCardTitle,
            }}
          >
            Agrega productos a tu lista
          </h2>
        </div>

        <div
          className="kyntu-comunaBox"
          style={styles.comunaBox}
        >
          <label
            className="kyntu-label"
            style={styles.label}
          >
            Nombre de la lista
          </label>

          <input
            type="text"
            value={nombreLista}
            onChange={(event) =>
              setNombreLista(
                event.target.value
              )
            }
            placeholder="Ej: Compra semanal"
            className="kyntu-input"
            style={styles.input}
          />

          <label
            className="kyntu-label"
            style={styles.label}
          >
            Comuna de despacho
          </label>

          <input
            type="text"
            value={comunaDespacho}
            onChange={(event) => {
              setComunaDespacho(
                event.target.value
              );
              setMostrarComunas(true);
            }}
            onFocus={() =>
              setMostrarComunas(true)
            }
            placeholder="Ej: Santiago"
            className="kyntu-input"
            style={styles.input}
          />

          {mostrarComunas &&
            comunaDespacho && (
              <div
                className="kyntu-comunasDropdown"
                style={
                  styles.comunasDropdown
                }
              >
                {comunasFiltradas
                  .slice(0, 8)
                  .map((comuna) => (
                    <div
                      key={comuna}
                      className="kyntu-comunaItem"
                      style={
                        styles.comunaItem
                      }
                      onMouseDown={() => {
                        setComunaDespacho(
                          comuna
                        );
                        setMostrarComunas(
                          false
                        );
                      }}
                    >
                      {comuna}
                    </div>
                  ))}

                {comunasFiltradas.length ===
                  0 && (
                  <div
                    className="kyntu-comunaEmpty"
                    style={
                      styles.comunaEmpty
                    }
                  >
                    No se encontraron
                    comunas
                  </div>
                )}
              </div>
            )}
        </div>

        <div
          className="kyntu-tableWrapper mobile-card-table-wrap"
          style={styles.tableWrapper}
        >
          <table
            className="kyntu-table mobile-card-table"
            style={styles.table}
          >
            <thead>
              <tr>
                <th
                  className="kyntu-th"
                  style={styles.th}
                >
                  Producto
                </th>

                <th
                  className="kyntu-th"
                  style={styles.th}
                >
                  Formato
                </th>

                <th
                  className="kyntu-th"
                  style={styles.th}
                >
                  Marca
                </th>

                <th
                  className="kyntu-th"
                  style={styles.th}
                >
                  Cantidad
                </th>

                <th
                  className="kyntu-th"
                  style={styles.th}
                >
                  Precio
                </th>

                <th
                  className="kyntu-th"
                  style={styles.thDetalle}
                >
                  Detalles del pedido
                </th>
              </tr>
            </thead>

            <tbody>
              {productos.map(
                (item, index) => (
                  <tr key={index}>
                    <td
                      className="kyntu-td"
                      style={styles.td}
                    >
                      <select
                        value={
                          item.producto
                        }
                        onChange={(
                          event
                        ) =>
                          handleChange(
                            index,
                            'producto',
                            event.target
                              .value
                          )
                        }
                        className="kyntu-select"
                        style={
                          styles.select
                        }
                      >
                        <option value="">
                          Selecciona
                        </option>

                        {[
                          ...new Set(
                            stock.map(
                              (producto) =>
                                producto.nombre
                            )
                          ),
                        ].map(
                          (
                            nombre,
                            opcionIndex
                          ) => (
                            <option
                              key={
                                opcionIndex
                              }
                              value={nombre}
                            >
                              {nombre}
                            </option>
                          )
                        )}
                      </select>
                    </td>

                    <td
                      className="kyntu-td"
                      style={styles.td}
                    >
                      <select
                        value={item.formato}
                        onChange={(
                          event
                        ) =>
                          handleChange(
                            index,
                            'formato',
                            event.target
                              .value
                          )
                        }
                        disabled={
                          !item.producto
                        }
                        className="kyntu-select"
                        style={
                          styles.select
                        }
                      >
                        <option value="">
                          Selecciona
                        </option>

                        {obtenerFormatos(
                          item.producto
                        ).map(
                          (
                            formato,
                            opcionIndex
                          ) => (
                            <option
                              key={
                                opcionIndex
                              }
                              value={
                                formato
                              }
                            >
                              {formato}
                            </option>
                          )
                        )}
                      </select>
                    </td>

                    <td
                      className="kyntu-td"
                      style={styles.td}
                    >
                      <select
                        value={item.marca}
                        onChange={(
                          event
                        ) =>
                          handleChange(
                            index,
                            'marca',
                            event.target
                              .value
                          )
                        }
                        disabled={
                          !item.formato
                        }
                        className="kyntu-select"
                        style={
                          styles.select
                        }
                      >
                        <option value="">
                          Selecciona
                        </option>

                        {obtenerMarcas(
                          item.producto,
                          item.formato
                        ).map(
                          (
                            marca,
                            opcionIndex
                          ) => (
                            <option
                              key={
                                opcionIndex
                              }
                              value={marca}
                            >
                              {marca}
                            </option>
                          )
                        )}
                      </select>
                    </td>

                    <td
                      className="kyntu-td"
                      style={styles.td}
                    >
                      <input
                        type="number"
                        value={
                          item.cantidad
                        }
                        onChange={(
                          event
                        ) =>
                          handleChange(
                            index,
                            'cantidad',
                            event.target
                              .value
                          )
                        }
                        className="kyntu-quantityInput"
                        style={
                          styles.quantityInput
                        }
                      />
                    </td>

                    <td
                      className="kyntu-td"
                      style={styles.td}
                    >
                      <input
                        type="number"
                        value={item.precio}
                        onChange={(
                          event
                        ) =>
                          handleChange(
                            index,
                            'precio',
                            event.target
                              .value
                          )
                        }
                        className="kyntu-quantityInput"
                        style={
                          styles.quantityInput
                        }
                      />
                    </td>

                    <td
                      className="kyntu-td"
                      style={styles.td}
                    >
                      <input
                        type="text"
                        value={
                          item.detalle_pedido ||
                          ''
                        }
                        maxLength={
                          MAX_DETALLE_PEDIDO
                        }
                        placeholder="Ej: solo calibre grande"
                        onChange={(
                          event
                        ) =>
                          handleChange(
                            index,
                            'detalle_pedido',
                            event.target
                              .value
                          )
                        }
                        className="kyntu-detalleInput"
                        style={
                          styles.detalleInput
                        }
                      />
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>

        <div
          className="kyntu-actionRow"
          style={styles.actionRow}
        >
          <button
            type="button"
            onClick={agregarFila}
            className="kyntu-secondaryButton"
            style={styles.secondaryButton}
          >
            Agregar otro producto
          </button>

          <button
            type="button"
            onClick={enviarLista}
            className="kyntu-mainButton"
            style={styles.mainButton}
          >
            Enviar lista
          </button>

          <button
            type="button"
            onClick={guardarLista}
            className="kyntu-secondaryButton"
            style={styles.secondaryButton}
          >
            Guardar lista
          </button>
        </div>
      </section>

      <section
        className="kyntu-card"
        style={styles.card}
      >
        <h2
          className="kyntu-cardTitle"
          style={styles.cardTitle}
        >
          Mis listas
        </h2>

        <div
          className="kyntu-filtersBox"
          style={styles.filtersBox}
        >
          <p
            className="kyntu-filtersTitle"
            style={styles.filtersTitle}
          >
            Mostrar mejores ofertas según:
          </p>

          <label
            className="kyntu-filterLabel"
            style={styles.filterLabel}
          >
            <input
              type="checkbox"
              checked={filtroMejorPrecio}
              onChange={(event) =>
                setFiltroMejorPrecio(
                  event.target.checked
                )
              }
            />
            Mejor precio
          </label>

          <label
            className="kyntu-filterLabel"
            style={styles.filterLabel}
          >
            <input
              type="checkbox"
              checked={filtroDespacho}
              onChange={(event) =>
                setFiltroDespacho(
                  event.target.checked
                )
              }
            />
            Incluye despacho
          </label>

          <label
            className="kyntu-filterLabel"
            style={styles.filterLabel}
          >
            <input
              type="checkbox"
              checked={filtroDespacho24}
              onChange={(event) =>
                setFiltroDespacho24(
                  event.target.checked
                )
              }
            />
            Despacho en 24 horas
          </label>

          <label
            className="kyntu-filterLabel"
            style={styles.filterLabel}
          >
            <input
              type="checkbox"
              checked={
                filtroCincoEstrellas
              }
              onChange={(event) =>
                setFiltroCincoEstrellas(
                  event.target.checked
                )
              }
            />
            Solo 5 estrellas
          </label>
        </div>

        {Object.keys(groupByFecha).length ===
        0 ? (
          <p
            className="kyntu-emptyText"
            style={styles.emptyText}
          >
            Aún no has enviado listas de
            compra.
          </p>
        ) : (
          Object.entries(groupByFecha).map(
            ([fecha, productosLista]) => {
              const expanded =
                expandedFechas.includes(fecha);

              const editando =
                editandoFechas.includes(fecha);

              const nombreListaHistorial =
                productosLista[0]?.nombre_lista?.trim() ||
                '';

              const listaId =
                productosLista[0]?.lista_id;

              const esBorrador =
                productosLista[0]
                  ?.estado_lista ===
                'borrador';

              const esComprada =
                productosLista[0]
                  ?.estado_lista ===
                'comprada';

              const esPagoPendiente =
                productosLista[0]
                  ?.estado_lista ===
                'pago_pendiente';

              return (
                <div
                  key={fecha}
                  className="kyntu-listBox"
                  style={styles.listBox}
                >
                  <div
                    className="kyntu-listHeader"
                    style={
                      styles.listHeader
                    }
                  >
                    <div>
                      <h3
                        className="kyntu-listTitle"
                        style={
                          styles.listTitle
                        }
                      >
                        {nombreListaHistorial ||
                          `Lista del ${fecha}`}
                      </h3>

                      <span
                        style={
                          esBorrador
                            ? styles.draftBadge
                            : esComprada
                              ? styles.purchasedBadge
                              : esPagoPendiente
                                ? styles.pendingPaymentBadge
                            : styles.publishedBadge
                        }
                      >
                        {esBorrador
                          ? 'Borrador'
                          : esComprada
                            ? 'Comprada'
                            : esPagoPendiente
                              ? 'Pago pendiente'
                          : 'Publicada'}
                      </span>

                      <p
                        className="kyntu-listSubtitle"
                        style={
                          styles.listSubtitle
                        }
                      >
                        {nombreListaHistorial
                          ? `Enviada el ${fecha} · ${productosLista.length} productos`
                          : `${productosLista.length} productos`}
                      </p>
                    </div>

                    <div
                      className="kyntu-listActions"
                      style={
                        styles.listActions
                      }
                    >
                      <button
                        type="button"
                        onClick={() =>
                          toggleExpand(
                            fecha
                          )
                        }
                        className="kyntu-smallButton"
                        style={
                          styles.smallButton
                        }
                      >
                        {expanded
                          ? 'Ocultar'
                          : 'Ver'}
                      </button>

                      {!esComprada && !esPagoPendiente && <button
                        type="button"
                        onClick={() =>
                          toggleEdit(fecha)
                        }
                        className="kyntu-smallButton"
                        style={
                          styles.smallButton
                        }
                      >
                        {editando
                          ? 'Cerrar edición'
                          : 'Editar'}
                      </button>}

                      {esBorrador && (
                        <button
                          type="button"
                          onClick={() =>
                            publicarLista(
                              listaId
                            )
                          }
                          className="kyntu-mainButtonSmall"
                          style={
                            styles.mainButtonSmall
                          }
                        >
                          Publicar lista
                        </button>
                      )}

                      {!esBorrador && !esComprada && (
                        <button
                          type="button"
                          onClick={() =>
                            verOfertas(
                              fecha
                            )
                          }
                          className="kyntu-mainButtonSmall"
                          style={
                            styles.mainButtonSmall
                          }
                        >
                          Ver ofertas
                        </button>
                      )}

                      {!esComprada && (
                        <button
                          type="button"
                          onClick={() =>
                            eliminarLista(
                              fecha
                            )
                          }
                          className="kyntu-deleteButton"
                          style={
                            styles.deleteButton
                          }
                        >
                          Eliminar
                        </button>
                      )}
                    </div>
                  </div>

                  {expanded && (
                    <>
                      <div
                        className="kyntu-tableWrapper mobile-card-table-wrap"
                        style={
                          styles.tableWrapper
                        }
                      >
                        <table
                          className="kyntu-table mobile-card-table"
                          style={
                            styles.table
                          }
                        >
                          <thead>
                            <tr>
                              <th
                                className="kyntu-th"
                                style={
                                  styles.th
                                }
                              >
                                Producto
                              </th>

                              <th
                                className="kyntu-th"
                                style={
                                  styles.th
                                }
                              >
                                Formato
                              </th>

                              <th
                                className="kyntu-th"
                                style={
                                  styles.th
                                }
                              >
                                Marca
                              </th>

                              <th
                                className="kyntu-th"
                                style={
                                  styles.th
                                }
                              >
                                Cantidad
                              </th>

                              <th
                                className="kyntu-th"
                                style={
                                  styles.th
                                }
                              >
                                Precio
                              </th>

                              <th
                                className="kyntu-th"
                                style={
                                  styles.thDetalle
                                }
                              >
                                Detalles del
                                pedido
                              </th>

                              {!esComprada && (
                                <th
                                  className="kyntu-th"
                                  style={
                                    styles.th
                                  }
                                >
                                  Ofertas
                                </th>
                              )}
                            </tr>
                          </thead>

                          <tbody>
                            {productosLista.map(
                              (
                                item,
                                index
                              ) => {
                                const rowId =
                                  getRowId(
                                    item
                                  );

                                const clave =
                                  `${item.producto}__${rowId}`;

                                const ofertas =
                                  ofertasPorProducto[
                                    clave
                                  ] || [];

                                const abierto =
                                  productosConOfertasAbiertas[
                                    rowId
                                  ];

                                const chatAbierto =
                                  Boolean(
                                    bandejaAbiertaPorProducto[
                                      rowId
                                    ]
                                  );

                                return (
                                  <React.Fragment
                                    key={`producto-fragment-${
                                      rowId ||
                                      index
                                    }`}
                                  >
                                    <tr
                                      id={
                                        rowId
                                          ? `oferta-${rowId}`
                                          : undefined
                                      }
                                      onClick={
                                        esComprada
                                          ? undefined
                                          : () =>
                                              toggleOfertasProducto(
                                                rowId
                                              )
                                      }
                                      className={
                                        esComprada
                                          ? undefined
                                          : 'kyntu-clickableRow'
                                      }
                                      style={
                                        esComprada
                                          ? undefined
                                          : styles.clickableRow
                                      }
                                    >
                                      <td
                                        className="kyntu-td"
                                        style={
                                          styles.td
                                        }
                                      >
                                        {
                                          item.producto
                                        }
                                      </td>

                                      <td
                                        className="kyntu-td"
                                        style={
                                          styles.td
                                        }
                                      >
                                        {
                                          item.formato
                                        }
                                      </td>

                                      <td
                                        className="kyntu-td"
                                        style={
                                          styles.td
                                        }
                                      >
                                        {
                                          item.marca
                                        }
                                      </td>

                                      <td
                                        className="kyntu-td"
                                        style={
                                          styles.td
                                        }
                                      >
                                        {
                                          item.cantidad
                                        }
                                      </td>

                                      <td
                                        className="kyntu-td"
                                        style={
                                          styles.td
                                        }
                                      >
                                        $
                                        {formatearPrecio(
                                          item.precio
                                        )}
                                      </td>

                                      <td
                                        className="kyntu-td"
                                        style={
                                          styles.tdDetalle
                                        }
                                      >
                                        {textoDetallePedidoVisible(
                                          item
                                        ) ||
                                          '—'}
                                      </td>

                                      {!esComprada && (
                                      <td
                                        className="kyntu-td"
                                        style={
                                          styles.td
                                        }
                                      >
                                        <div
                                          className="kyntu-ofertasCell"
                                          style={
                                            styles.ofertasCell
                                          }
                                        >
                                          <span
                                            className="kyntu-offerCount"
                                            style={
                                              styles.offerCount
                                            }
                                          >
                                            {ofertas.length >
                                            0
                                              ? `${ofertas.length} ${
                                                  ofertas.length ===
                                                  1
                                                    ? 'oferta'
                                                    : 'ofertas'
                                                }`
                                              : 'Sin ofertas'}
                                          </span>

                                          {rowId &&
                                            authUserId && (
                                              <IconoChatPreOferta
                                                listasComprasId={
                                                  rowId
                                                }
                                                authUserId={
                                                  authUserId
                                                }
                                                traspasadasRevision={
                                                  traspasadasRevision
                                                }
                                                activo={
                                                  chatAbierto
                                                }
                                                onClick={() =>
                                                  toggleBandejaProducto(
                                                    rowId
                                                  )
                                                }
                                              />
                                            )}

                                          <span
                                            className="kyntu-arrow"
                                            style={
                                              styles.arrow
                                            }
                                          >
                                            {abierto
                                              ? '▲'
                                              : '▼'}
                                          </span>
                                        </div>
                                      </td>
                                      )}
                                    </tr>

                                    {!esComprada && chatAbierto &&
                                      rowId &&
                                      authUserId && (
                                        <tr>
                                          <td
                                            colSpan={
                                              7
                                            }
                                            className="kyntu-chatConsolidadoRow"
                                            style={
                                              styles.chatConsolidadoRow
                                            }
                                          >
                                            <BandejaMensajesComerciales
                                              listasComprasId={
                                                rowId
                                              }
                                              authUserId={
                                                authUserId
                                              }
                                              abierto={
                                                chatAbierto
                                              }
                                              conversacionDestacadaId={
                                                conversacionBandejaPorProducto[
                                                  rowId
                                                ] ||
                                                null
                                              }
                                              traspasadasRevision={
                                                traspasadasRevision
                                              }
                                            />
                                          </td>
                                        </tr>
                                      )}

                                    {!esComprada && abierto && (
                                      <tr>
                                        <td
                                          colSpan={7}
                                          className="kyntu-offersRow"
                                          style={
                                            styles.offersRow
                                          }
                                        >
                                          {ofertas.length ===
                                          0 ? (
                                            <p
                                              className="kyntu-waitingOffer"
                                              style={
                                                styles.waitingOffer
                                              }
                                            >
                                              Aún no has
                                              recibido
                                              ofertas por
                                              este
                                              producto.
                                            </p>
                                          ) : (
                                            <div
                                              className="kyntu-offersGrid"
                                              style={
                                                styles.offersGrid
                                              }
                                            >
                                              {deepLinkError && (
                                                <p
                                                  className="kyntu-deepLinkError"
                                                  style={
                                                    styles.deepLinkError
                                                  }
                                                >
                                                  {
                                                    deepLinkError
                                                  }
                                                </p>
                                              )}
                                                                                            {ofertas.map(
                                                (
                                                  oferta,
                                                  ofertaIndex
                                                ) => {
                                                  const estado =
                                                    (
                                                      oferta.estado ||
                                                      ''
                                                    )
                                                      .trim()
                                                      .toLowerCase();

                                                  const solicitudAdjudicada =
                                                    ofertas.some(
                                                      (
                                                        ofertaLista
                                                      ) =>
                                                        esOfertaAdjudicada(
                                                          ofertaLista.estado
                                                        )
                                                    );

                                                  const isPending =
                                                    estado ===
                                                    'pendiente';

                                                  const isWaiting =
                                                    estado ===
                                                    'en_espera_confirmacion';

                                                  const isPendingPayment =
                                                    estado ===
                                                    'pendiente_pago';

                                                  const isPaymentReceived =
                                                    estado ===
                                                    'pago_recibido';

                                                  const isReceptionConfirmed =
                                                    estado ===
                                                    'recepcion_conforme';

                                                  const isProviderPaid =
                                                    estado ===
                                                    'pagada';

                                                  const puedeResponderOferta =
                                                    [
                                                      '',
                                                      'pendiente',
                                                      'confirmada',
                                                      'enviada',
                                                      'activa',
                                                    ].includes(
                                                      estado
                                                    );

                                                  const isAdjudicada =
                                                    isProviderPaid ||
                                                    Boolean(
                                                      oferta.tiene_calificacion
                                                    );

                                                  const isRejected =
                                                    estado ===
                                                    'rechazada';

                                                  const esPerdedoraAdjudicacion =
                                                    chatSoloLecturaPorAdjudicacion(
                                                      {
                                                        estado,
                                                        solicitud_adjudicada:
                                                          solicitudAdjudicada,
                                                      }
                                                    );

                                                  const cardDestacada =
                                                    ofertaDestacadaId &&
                                                    String(
                                                      ofertaDestacadaId
                                                    ) ===
                                                      String(
                                                        oferta.id
                                                      );

                                                  return (
                                                    <div
                                                      key={
                                                        oferta.id ||
                                                        ofertaIndex
                                                      }
                                                      id={`oferta-card-${oferta.id}`}
                                                      className="kyntu-offerCard"
                                                      style={{
                                                        ...styles.offerCard,
                                                        ...(cardDestacada
                                                          ? styles.offerCardDestacada
                                                          : {}),
                                                      }}
                                                    >
                                                      <p
                                                        className="kyntu-offerPrice"
                                                        style={
                                                          styles.offerPrice
                                                        }
                                                      >
                                                        $
                                                        {formatearPrecio(
                                                          oferta.precio_ofertado
                                                        )}
                                                      </p>

                                                      <p
                                                        className="kyntu-offerMeta"
                                                        style={
                                                          styles.offerMeta
                                                        }
                                                      >
                                                        {oferta.incluye_despacho
                                                          ? `Incluye despacho · ${
                                                              oferta.tiempo_despacho_horas
                                                                ? `${oferta.tiempo_despacho_horas} horas`
                                                                : 'plazo no informado'
                                                            }`
                                                          : 'Sin despacho'}
                                                      </p>

                                                      {isRejected && (
                                                        <p
                                                          className="kyntu-rejectedText"
                                                          style={
                                                            styles.rejectedText
                                                          }
                                                        >
                                                          {esPerdedoraAdjudicacion
                                                            ? 'Adjudicada a otro proveedor'
                                                            : 'Oferta rechazada'}
                                                        </p>
                                                      )}

                                                      {authUserId && (
                                                        <OfertaConversacionContenedor
                                                          ofertaId={
                                                            oferta.id
                                                          }
                                                          authUserId={
                                                            authUserId
                                                          }
                                                          estadoOferta={
                                                            estado
                                                          }
                                                          soloLectura={
                                                            esPerdedoraAdjudicacion
                                                          }
                                                          mensajeCierre={
                                                            esPerdedoraAdjudicacion
                                                              ? MENSAJE_CHAT_CERRADO_ADJUDICACION
                                                              : ''
                                                          }
                                                          variant="light"
                                                          participanteLabel="Proveedor"
                                                          tooltipChat="Hablar con el proveedor"
                                                          mostrarAceptarRechazar={
                                                            puedeResponderOferta &&
                                                            !solicitudAdjudicada
                                                          }
                                                          chatAbierto={
                                                            conversacionAbiertaPorProducto[
                                                              rowId
                                                            ] ===
                                                            String(
                                                              oferta.id
                                                            )
                                                          }
                                                          onToggleChat={() =>
                                                            toggleConversacionProducto(
                                                              rowId,
                                                              oferta.id
                                                            )
                                                          }
                                                          onAceptar={(
                                                            event
                                                          ) => {
                                                            event.stopPropagation();

                                                            aceptarOferta(
                                                              oferta,
                                                              fecha
                                                            );
                                                          }}
                                                          onRechazar={(
                                                            event
                                                          ) => {
                                                            event.stopPropagation();

                                                            rechazarOferta(
                                                              oferta,
                                                              item,
                                                              fecha
                                                            );
                                                          }}
                                                        />
                                                      )}

                                                      {isAdjudicada && (
                                                        <p
                                                          className="kyntu-confirmedText"
                                                          style={
                                                            styles.confirmedText
                                                          }
                                                        >
                                                          Licitación
                                                          adjudicada
                                                        </p>
                                                      )}

                                                      {isWaiting &&
                                                        !isAdjudicada && (
                                                          <p
                                                            className="kyntu-pendingPaymentText"
                                                            style={
                                                              styles.pendingPaymentText
                                                            }
                                                          >
                                                            Esperando
                                                            confirmación
                                                          </p>
                                                        )}

                                                      {isPendingPayment &&
                                                        !isAdjudicada && (
                                                          <>
                                                            <p
                                                              className="kyntu-pendingPaymentText"
                                                              style={
                                                                styles.pendingPaymentText
                                                              }
                                                            >
                                                              En el carro
                                                              · pendiente
                                                              de pago
                                                            </p>

                                                            <button
                                                              type="button"
                                                              onClick={(
                                                                event
                                                              ) => {
                                                                event.stopPropagation();
                                                                router.push(
                                                                  '/comprador/carro'
                                                                );
                                                              }}
                                                              className="kyntu-mainButtonSmall"
                                                              style={
                                                                styles.mainButtonSmall
                                                              }
                                                            >
                                                              Ir al carro
                                                            </button>
                                                          </>
                                                        )}

                                                      {isPaymentReceived &&
                                                        !isAdjudicada && (
                                                          <>
                                                            <p
                                                              className="kyntu-confirmedText"
                                                              style={
                                                                styles.confirmedText
                                                              }
                                                            >
                                                              Pago
                                                              recibido
                                                              correctamente.
                                                            </p>

                                                            <div
                                                              className="kyntu-contactBox"
                                                              style={
                                                                styles.contactBox
                                                              }
                                                            >
                                                              <p
                                                                className="kyntu-contactText"
                                                                style={
                                                                  styles.contactText
                                                                }
                                                              >
                                                                <strong>
                                                                  Proveedor:
                                                                </strong>{' '}
                                                                {oferta
                                                                  .perfiles
                                                                  ?.email_contacto ||
                                                                  oferta
                                                                    .perfiles
                                                                    ?.email ||
                                                                  'No disponible'}
                                                              </p>

                                                              <p
                                                                className="kyntu-contactText"
                                                                style={
                                                                  styles.contactText
                                                                }
                                                              >
                                                                <strong>
                                                                  Teléfono:
                                                                </strong>{' '}
                                                                {oferta
                                                                  .perfiles
                                                                  ?.telefono_contacto ||
                                                                  'No disponible'}
                                                              </p>

                                                              {oferta.comentario_comprador && (
                                                                <p
                                                                  className="kyntu-contactText"
                                                                  style={
                                                                    styles.contactText
                                                                  }
                                                                >
                                                                  <strong>
                                                                    Comentario:
                                                                  </strong>{' '}
                                                                  {
                                                                    oferta.comentario_comprador
                                                                  }
                                                                </p>
                                                              )}
                                                            </div>

                                                            <p
                                                              className="kyntu-contactText"
                                                              style={
                                                                styles.contactText
                                                              }
                                                            >
                                                              Una vez
                                                              que
                                                              recibas
                                                              el
                                                              pedido,
                                                              presiona
                                                              <strong>
                                                                {' '}
                                                                “Recibí
                                                                conforme”
                                                              </strong>
                                                              .
                                                            </p>

                                                            <button
                                                              type="button"
                                                              onClick={(
                                                                event
                                                              ) => {
                                                                event.stopPropagation();

                                                                confirmarRecepcion(
                                                                  oferta,
                                                                  fecha
                                                                );
                                                              }}
                                                              className="kyntu-mainButtonSmall"
                                                              style={
                                                                styles.mainButtonSmall
                                                              }
                                                            >
                                                              Recibí
                                                              conforme
                                                            </button>
                                                          </>
                                                        )}

                                                      {isReceptionConfirmed &&
                                                        !isAdjudicada &&
                                                        !oferta.tiene_calificacion && (
                                                          <>
                                                            <p
                                                              className="kyntu-confirmedText"
                                                              style={
                                                                styles.confirmedText
                                                              }
                                                            >
                                                              Recepción
                                                              conforme
                                                              registrada.
                                                            </p>

                                                            <button
                                                              type="button"
                                                              onClick={(
                                                                event
                                                              ) => {
                                                                event.stopPropagation();

                                                                setRatingModal(
                                                                  {
                                                                    open: true,
                                                                    oferta,
                                                                    fechaLista:
                                                                      fecha,
                                                                    estrellas: 5,
                                                                    comentario:
                                                                      '',
                                                                  }
                                                                );
                                                              }}
                                                              className="kyntu-mainButtonSmall"
                                                              style={
                                                                styles.mainButtonSmall
                                                              }
                                                              disabled={
                                                                guardandoCalificacion
                                                              }
                                                            >
                                                              Calificar
                                                              proveedor
                                                            </button>
                                                          </>
                                                        )}
                                                    </div>
                                                  );
                                                }
                                              )}
                                            </div>
                                          )}
                                        </td>
                                      </tr>
                                    )}
                                  </React.Fragment>
                                );
                              }
                            )}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                </div>
              );
            }
          )
        )}
      </section>

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

        button:hover {
          transform: translateY(-1px);
        }

        button:focus-visible,
        input:focus-visible,
        select:focus-visible,
        textarea:focus-visible {
          outline: 3px solid
            rgba(23, 107, 255, 0.2);
          outline-offset: 2px;
        }

        .kyntu-tableWrapper {
          scrollbar-width: thin;
          scrollbar-color: #b9c9df
            transparent;
        }

        .kyntu-tableWrapper::-webkit-scrollbar {
          height: 8px;
        }

        .kyntu-tableWrapper::-webkit-scrollbar-thumb {
          border-radius: 999px;
          background: #b9c9df;
        }

        .kyntu-comunaItem:hover {
          background: #edf4ff !important;
          color: #176bff !important;
        }

        .kyntu-clickableRow:hover td {
          background: #f1f6fd !important;
        }
                  @media (max-width: 1120px) {
          .kyntu-content {
            width: 100% !important;
          }

          .kyntu-listHeader {
            align-items: flex-start !important;
          }

          .kyntu-listActions {
            justify-content: flex-start !important;
          }

          .kyntu-tableWrapper {
            width: 100% !important;
            overflow-x: auto !important;
          }
        }

        @media (max-width: 820px) {
          .kyntu-card {
            padding: 24px 18px !important;
            border-radius: 22px !important;
          }

          .kyntu-cardTitle {
            font-size: 22px !important;
          }

          .kyntu-comunaBox {
            grid-template-columns: 1fr !important;
            gap: 10px !important;
          }

          .kyntu-actionRow,
          .kyntu-listActions,
          .kyntu-offerActions {
            width: 100% !important;
          }

          .kyntu-actionRow > button,
          .kyntu-listActions > button,
          .kyntu-offerActions > button {
            flex: 1 1 160px !important;
          }

          .kyntu-listHeader {
            align-items: flex-start !important;
            flex-direction: column !important;
          }

          .kyntu-listHeader > div:first-child {
            width: 100% !important;
          }

          .kyntu-offersGrid {
            display: flex !important;
            flex-wrap: wrap !important;
            justify-content: flex-start !important;
            align-items: flex-start !important;
          }

          .kyntu-offerCard {
            width: 100% !important;
            max-width: 360px !important;
            flex: 0 0 auto !important;
            min-width: 0 !important;
          }

          .kyntu-filtersBox {
            justify-content: flex-start !important;
          }

          .kyntu-filtersTitle {
            width: 100% !important;
          }
        }

        @media (max-width: 620px) {
          .kyntu-card {
            padding: 20px 14px !important;
            border-radius: 18px !important;
          }

          .kyntu-logo {
            width: 52px !important;
            margin: 0 !important;
          }

          .kyntu-sectionHeading {
            gap: 10px !important;
          }

          .kyntu-cardTitle {
            font-size: 20px !important;
          }

          .kyntu-input,
          .kyntu-select,
          .kyntu-quantityInput,
          .kyntu-detalleInput {
            width: 100% !important;
            min-width: 120px !important;
          }

          .kyntu-table {
            min-width: 0 !important;
          }

          .kyntu-table.mobile-card-table td:nth-child(1)::before { content: 'Producto'; }
          .kyntu-table.mobile-card-table td:nth-child(2)::before { content: 'Formato'; }
          .kyntu-table.mobile-card-table td:nth-child(3)::before { content: 'Marca'; }
          .kyntu-table.mobile-card-table td:nth-child(4)::before { content: 'Cantidad'; }
          .kyntu-table.mobile-card-table td:nth-child(5)::before { content: 'Precio'; }
          .kyntu-table.mobile-card-table td:nth-child(6)::before { content: 'Detalle'; }
          .kyntu-table.mobile-card-table td:nth-child(7)::before { content: 'Ofertas'; }

          .kyntu-table.mobile-card-table td:nth-child(1) {
            color: #061b41;
            font-weight: 800;
          }

          .kyntu-table.mobile-card-table td:nth-child(3),
          .kyntu-table.mobile-card-table td:nth-child(6) {
            display: none !important;
          }

          .kyntu-actionRow {
            display: grid !important;
            grid-template-columns: 1fr !important;
          }

          .kyntu-actionRow > button {
            width: 100% !important;
          }

          .kyntu-filtersBox {
            display: grid !important;
            grid-template-columns: 1fr !important;
            gap: 10px !important;
          }

          .kyntu-filterLabel {
            width: 100% !important;
            min-height: 44px !important;
            padding: 10px 12px !important;
            border-radius: 12px !important;
            background: #f6f9fd !important;
            border: 1px solid
              #e1e9f4 !important;
          }

          .kyntu-listBox {
            padding: 16px 12px !important;
            border-radius: 16px !important;
          }

          .kyntu-listActions {
            display: grid !important;
            grid-template-columns:
              1fr 1fr !important;
          }

          .kyntu-listActions > button {
            width: 100% !important;
          }

          .kyntu-offersGrid {
            display: grid !important;
            grid-template-columns: 1fr !important;
            justify-content: stretch !important;
            width: 100% !important;
            gap: 10px !important;
          }

          .kyntu-offerCard {
            width: 100% !important;
            max-width: none !important;
            padding: 14px !important;
          }

          .kyntu-offerPrice {
            font-size: 22px !important;
          }

          .kyntu-contactBox,
          .kyntu-messageBox {
            padding: 12px !important;
          }
        }

        @media (max-width: 390px) {
          .kyntu-listActions {
            grid-template-columns:
              1fr !important;
          }

          .kyntu-cardTitle {
            font-size: 19px !important;
          }

          .kyntu-secondaryButton,
          .kyntu-mainButton,
          .kyntu-mainButtonSmall,
          .kyntu-smallButton,
          .kyntu-deleteButton,
          .kyntu-logoutButton {
            padding-left: 12px !important;
            padding-right: 12px !important;
          }
        }

        @media (
          prefers-reduced-motion: reduce
        ) {
          *,
          *::before,
          *::after {
            scroll-behavior: auto !important;
            transition: none !important;
            animation-duration: 0.01ms !important;
            animation-iteration-count:
              1 !important;
          }
        }
      `}</style>

      <ModalCalificacion
        open={ratingModal.open}
        estrellas={ratingModal.estrellas}
        comentario={ratingModal.comentario}
        guardando={guardandoCalificacion}
        onClose={
          cerrarModalCalificacion
        }
        onGuardar={guardarCalificacion}
        onEstrellasChange={(estrellas) =>
          setRatingModal(
            (estadoAnterior) => ({
              ...estadoAnterior,
              estrellas,
            })
          )
        }
        onComentarioChange={(
          comentario
        ) =>
          setRatingModal(
            (estadoAnterior) => ({
              ...estadoAnterior,
              comentario,
            })
          )
        }
      />

      <KyntuModal {...modal} />
    </AppLayout>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    minHeight: '100dvh',
    position: 'relative',
    overflowX: 'clip',
    overflowY: 'visible',
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
    maxWidth: '45vw',
    opacity: 0.035,
    zIndex: 0,
    pointerEvents: 'none',
    userSelect: 'none',
  },

  topBar: {
    position: 'sticky',
    top: '12px',
    zIndex: 1000,
    width: '100%',
    maxWidth: '1440px',
    margin: '0 auto 24px',
    display: 'grid',
    gridTemplateColumns:
      '1fr auto 1fr',
    alignItems: 'center',
    gap: '20px',
    padding: '18px 22px',
    borderRadius: '24px',
    background:
      'rgba(255,255,255,0.96)',
    border: '1px solid #e1e9f4',
    boxShadow:
      '0 20px 55px rgba(28,69,128,0.11)',
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
    fontSize:
      'clamp(26px, 3vw, 36px)',
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
    background:
      'rgba(255,255,255,0.96)',
    border: '1px solid #e1e9f4',
    boxShadow:
      '0 24px 65px rgba(28,69,128,0.10)',
    overflow: 'visible',
  },

  logo: {
    display: 'block',
    width: '64px',
    height: 'auto',
    objectFit: 'contain',
    flexShrink: 0,
  },

  sectionHeading: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: '14px',
    marginBottom: '22px',
  },

  cardTitle: {
    margin: '0 0 24px',
    color: '#061b41',
    fontSize: '26px',
    lineHeight: 1.25,
    textAlign: 'center',
    fontWeight: 900,
    letterSpacing: '-0.025em',
  },

  addCardTitle: {
    margin: 0,
    textAlign: 'left',
  },

  comunaBox: {
    position: 'relative',
    display: 'grid',
    gridTemplateColumns:
      'minmax(0, 1fr) minmax(0, 1fr)',
    gap: '12px 18px',
    maxWidth: '880px',
    margin: '0 auto 24px',
    padding: '20px',
    borderRadius: '18px',
    background: '#f7faff',
    border: '1px solid #e0e9f5',
  },

  label: {
    display: 'block',
    color: '#28466c',
    fontSize: '13px',
    fontWeight: 800,
    marginBottom: '7px',
  },

  input: {
    width: '100%',
    minHeight: '44px',
    padding: '11px 13px',
    borderRadius: '12px',
    border: '1px solid #ccd9ea',
    background: '#ffffff',
    color: '#132b4f',
    outline: 'none',
    boxSizing: 'border-box',
  },

  select: {
    width: '100%',
    minWidth: '150px',
    minHeight: '42px',
    padding: '10px 12px',
    borderRadius: '11px',
    border: '1px solid #ccd9ea',
    background: '#ffffff',
    color: '#132b4f',
    outline: 'none',
  },

  quantityInput: {
    width: '105px',
    minHeight: '42px',
    padding: '10px 11px',
    borderRadius: '11px',
    border: '1px solid #ccd9ea',
    background: '#ffffff',
    color: '#132b4f',
    outline: 'none',
    textAlign: 'center',
  },

  detalleInput: {
    width: '100%',
    minWidth: '160px',
    maxWidth: '220px',
    minHeight: '42px',
    padding: '10px 11px',
    borderRadius: '11px',
    border: '1px solid #ccd9ea',
    background: '#ffffff',
    color: '#132b4f',
    outline: 'none',
  },
    thDetalle: {
    minWidth: '160px',
    maxWidth: '220px',
    padding: '13px 12px',
    borderBottom:
      '1px solid #dfe8f3',
    background: '#f4f7fb',
    color: '#52627a',
    fontSize: '11px',
    lineHeight: 1.3,
    fontWeight: 900,
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    whiteSpace: 'normal',
  },

  tdDetalle: {
    minWidth: '160px',
    maxWidth: '220px',
    padding: '12px',
    borderBottom:
      '1px solid #e7edf5',
    background: '#ffffff',
    color: '#52627a',
    fontSize: '12px',
    lineHeight: 1.45,
    textAlign: 'left',
    verticalAlign: 'middle',
    overflowWrap: 'anywhere',
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
    minWidth: '980px',
    borderCollapse: 'collapse',
    borderSpacing: 0,
  },

  th: {
    padding: '13px 12px',
    borderBottom:
      '1px solid #dfe8f3',
    background: '#f4f7fb',
    color: '#52627a',
    fontSize: '12px',
    fontWeight: 900,
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    whiteSpace: 'nowrap',
  },

  td: {
    padding: '12px',
    borderBottom:
      '1px solid #e7edf5',
    background: '#ffffff',
    color: '#243a5a',
    textAlign: 'center',
    verticalAlign: 'middle',
  },

  actionRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
    flexWrap: 'wrap',
    marginTop: '20px',
  },

  mainButton: {
    minHeight: '44px',
    padding: '12px 24px',
    border: 'none',
    borderRadius: '12px',
    background:
      'linear-gradient(135deg, #176bff, #438cff)',
    color: '#ffffff',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 800,
    boxShadow:
      '0 12px 24px rgba(23,107,255,0.24)',
  },

  mainButtonSmall: {
    minHeight: '40px',
    padding: '10px 15px',
    border: 'none',
    borderRadius: '11px',
    background:
      'linear-gradient(135deg, #176bff, #438cff)',
    color: '#ffffff',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: 800,
    boxShadow:
      '0 9px 18px rgba(23,107,255,0.18)',
  },

  secondaryButton: {
    minHeight: '42px',
    padding: '11px 17px',
    borderRadius: '12px',
    border: '1px solid #d6e1ef',
    background: '#ffffff',
    color: '#315174',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 800,
  },

  logoutButton: {
    minHeight: '42px',
    padding: '11px 17px',
    borderRadius: '12px',
    border: '1px solid #ffd7d4',
    background: '#fff3f2',
    color: '#c1342d',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 800,
  },

  smallButton: {
    minHeight: '39px',
    padding: '9px 14px',
    borderRadius: '10px',
    border: '1px solid #dbe5f1',
    background: '#f5f8fc',
    color: '#315174',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: 800,
  },

  deleteButton: {
    minHeight: '39px',
    padding: '9px 14px',
    borderRadius: '10px',
    border: '1px solid #ffd7d4',
    background: '#fff3f2',
    color: '#c1342d',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: 800,
  },

  emptyText: {
    margin: '16px 0 0',
    padding: '24px',
    borderRadius: '16px',
    border: '1px dashed #cad6e5',
    background: '#f7f9fc',
    color: '#6a7a91',
    textAlign: 'center',
  },

  listBox: {
    marginTop: '16px',
    padding: '20px',
    borderRadius: '20px',
    border: '1px solid #e1e9f4',
    background: '#ffffff',
    boxShadow:
      '0 12px 30px rgba(28,69,128,0.06)',
  },

  listHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '20px',
    flexWrap: 'wrap',
    marginBottom: '16px',
  },

  listTitle: {
    margin: 0,
    color: '#061b41',
    fontSize: '19px',
    lineHeight: 1.3,
    fontWeight: 900,
  },

  listSubtitle: {
    margin: '6px 0 0',
    color: '#718096',
    fontSize: '13px',
    lineHeight: 1.5,
  },

  listActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '8px',
    flexWrap: 'wrap',
  },

  draftBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: '8px',
    padding: '5px 10px',
    borderRadius: '999px',
    border: '1px solid #f0d69a',
    background: '#fff6df',
    color: '#8a6214',
    fontSize: '11px',
    lineHeight: 1,
    fontWeight: 900,
  },

  publishedBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: '8px',
    padding: '5px 10px',
    borderRadius: '999px',
    border: '1px solid #bce3dc',
    background: '#edf8f6',
    color: '#287568',
    fontSize: '11px',
    lineHeight: 1,
    fontWeight: 900,
  },

  purchasedBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: '8px',
    padding: '5px 10px',
    borderRadius: '999px',
    border: '1px solid #bfd4ff',
    background: '#edf4ff',
    color: '#176bff',
    fontSize: '11px',
    lineHeight: 1,
    fontWeight: 900,
  },

  pendingPaymentBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: '8px',
    padding: '5px 10px',
    borderRadius: '999px',
    border: '1px solid #f0d69a',
    background: '#fff6df',
    color: '#8a6214',
    fontSize: '11px',
    lineHeight: 1,
    fontWeight: 900,
  },

  filtersBox: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px 18px',
    flexWrap: 'wrap',
    marginBottom: '22px',
    padding: '16px',
    borderRadius: '16px',
    border: '1px solid #e0e9f5',
    background: '#f7faff',
  },

  filtersTitle: {
    margin: 0,
    color: '#17375e',
    fontSize: '13px',
    fontWeight: 900,
  },

  filterLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    color: '#52627a',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 700,
  },

  clickableRow: {
    cursor: 'pointer',
  },

  offerCount: {
    color: '#176bff',
    fontWeight: 900,
  },

  ofertasCell: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    flexWrap: 'nowrap',
    maxWidth: '100%',
    minWidth: 0,
  },

  chatConsolidadoRow: {
    padding: '12px 16px 16px',
    borderBottom:
      '1px solid #e1e9f4',
    background: '#f8fbff',
  },

  arrow: {
    marginLeft: '4px',
    color: '#176bff',
    fontWeight: 900,
  },

  offersRow: {
    padding: '18px',
    borderBottom:
      '1px solid #e1e9f4',
    background: '#f8fbff',
  },
    bandejaAnchor: {
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
    boxSizing: 'border-box',
  },

  offersGrid: {
    display: 'grid',
    gridTemplateColumns:
      'repeat(auto-fit, minmax(270px, 360px))',
    alignItems: 'start',
    justifyContent: 'start',
    gap: '14px',
    marginTop: '10px',
  },

  offerCard: {
    width: '100%',
    minWidth: 0,
    padding: '18px',
    boxSizing: 'border-box',
    overflow: 'hidden',
    borderRadius: '17px',
    border: '1px solid #dfe8f3',
    background: '#ffffff',
    boxShadow:
      '0 12px 26px rgba(28,69,128,0.07)',
  },

  offerCardDestacada: {
    border:
      '1px solid rgba(23,107,255,0.45)',
    boxShadow:
      '0 0 0 3px rgba(23,107,255,0.12)',
  },

  deepLinkError: {
    gridColumn: '1 / -1',
    margin: 0,
    padding: '12px 14px',
    borderRadius: '11px',
    border: '1px solid #f0d69a',
    background: '#fff8e8',
    color: '#8a6214',
    fontSize: '13px',
    lineHeight: 1.5,
    fontWeight: 700,
  },

  rejectedText: {
    margin: '10px 0 0',
    color: '#8a94a6',
    fontSize: '12px',
    lineHeight: 1.45,
    fontWeight: 700,
    fontStyle: 'italic',
  },

  offerPrice: {
    margin: 0,
    color: '#176bff',
    fontSize: '25px',
    lineHeight: 1.2,
    fontWeight: 900,
  },

  offerMeta: {
    margin: '6px 0 0',
    color: '#6d7d92',
    fontSize: '13px',
    lineHeight: 1.5,
  },

  offerActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexWrap: 'wrap',
    marginTop: '14px',
  },

  contactBox: {
    marginTop: '13px',
    padding: '13px',
    borderRadius: '12px',
    border: '1px solid #e1e9f4',
    background: '#f6f9fd',
  },

  contactText: {
    margin: '6px 0',
    color: '#52627a',
    fontSize: '13px',
    lineHeight: 1.55,
    overflowWrap: 'anywhere',
  },

  confirmedText: {
    margin: '12px 0 0',
    color: '#07846f',
    fontSize: '13px',
    lineHeight: 1.5,
    fontWeight: 900,
  },

  waitingOffer: {
    margin: 0,
    padding: '16px',
    borderRadius: '12px',
    border: '1px dashed #cad6e5',
    background: '#ffffff',
    color: '#718096',
    fontSize: '13px',
    lineHeight: 1.5,
    fontStyle: 'italic',
    textAlign: 'center',
  },

  pendingPaymentText: {
    margin: '12px 0 0',
    color: '#a86a00',
    fontSize: '13px',
    lineHeight: 1.5,
    fontWeight: 900,
  },

  comunasDropdown: {
    position: 'absolute',
    top: 'calc(100% - 10px)',
    left: 'calc(50% + 9px)',
    right: 0,
    maxHeight: '230px',
    overflowY: 'auto',
    zIndex: 9999,
    borderRadius: '13px',
    border: '1px solid #d7e2ef',
    background: '#ffffff',
    boxShadow:
      '0 18px 38px rgba(28,69,128,0.16)',
  },

  comunaItem: {
    padding: '11px 13px',
    borderBottom:
      '1px solid #edf1f6',
    color: '#2c4567',
    cursor: 'pointer',
    fontSize: '13px',
    lineHeight: 1.4,
    textAlign: 'left',
  },

  comunaEmpty: {
    padding: '13px',
    color: '#718096',
    fontSize: '13px',
    lineHeight: 1.4,
    textAlign: 'left',
  },

  messageBox: {
    marginTop: '14px',
    padding: '13px',
    borderRadius: '12px',
    border: '1px solid #e1e9f4',
    background: '#f7faff',
  },

  messageLabel: {
    display: 'block',
    marginBottom: '8px',
    color: '#315174',
    fontSize: '12px',
    lineHeight: 1.4,
    fontWeight: 800,
    textAlign: 'left',
  },
};
