import {
  LEGAL_DOCUMENT_TYPES,
  LEGAL_DOCUMENT_VERSIONS,
} from '../lib/legalDocumentVersions';

export const RUTAS_PUBLICAS = [
  '/',
  '/login',
  '/register',
  '/reset-password',
  '/aceptar-documentos',
  '/terminos',
  '/privacidad',
  '/links',
  '/auth/confirm',
  '/admin-login',
];

export const RUTAS_EXENTAS_GATE_LEGAL = ['/admin-login'];

export function esRutaPublica(pathname) {
  return RUTAS_PUBLICAS.includes(pathname);
}

export function esRutaMaster(pathname) {
  return pathname === '/master' || pathname.startsWith('/master/');
}

export function esRutaExentaGateLegal(pathname) {
  return esRutaPublica(pathname) || esRutaMaster(pathname);
}

export function sanitizeInternalNextPath(next, fallback = '/seleccionar-perfil') {
  if (typeof next !== 'string' || !next.startsWith('/') || next.startsWith('//')) {
    return fallback;
  }

  if (next.startsWith('/http') || next.includes('://')) {
    return fallback;
  }

  const basePath = next.split('?')[0].split('#')[0];

  if (basePath === '/aceptar-documentos' || basePath === '/login') {
    return fallback;
  }

  return next.split('#')[0];
}

export function buildAceptarDocumentosPath(next, fallback = '/seleccionar-perfil') {
  const safeNext = sanitizeInternalNextPath(next, fallback);
  return `/aceptar-documentos?next=${encodeURIComponent(safeNext)}`;
}

export function resolverDestinoPorPerfiles(tipos) {
  const tiposUnicos = [...new Set((tipos || []).filter(Boolean))];

  if (tiposUnicos.length === 1) {
    return `/${tiposUnicos[0]}`;
  }

  if (tiposUnicos.length > 1) {
    return '/seleccionar-perfil';
  }

  return null;
}

async function assertSesionPropia(supabase, usuarioId) {
  if (!usuarioId) {
    return {
      ok: false,
      code: 'INVALID_USER_ID',
      message: 'Identificador de usuario inválido.',
    };
  }

  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError) {
    return {
      ok: false,
      code: 'SESSION_ERROR',
      message: sessionError.message,
    };
  }

  if (!session?.user?.id) {
    return {
      ok: false,
      code: 'NO_SESSION',
      message: 'Debes iniciar sesión para continuar.',
    };
  }

  if (session.user.id !== usuarioId) {
    return {
      ok: false,
      code: 'USER_MISMATCH',
      message: 'La sesión activa no coincide con el usuario solicitado.',
    };
  }

  return { ok: true, session };
}

export async function obtenerEstadoAceptacionesLegales(supabase, usuarioId) {
  const sesion = await assertSesionPropia(supabase, usuarioId);
  if (!sesion.ok) {
    return {
      ok: false,
      code: sesion.code,
      message: sesion.message,
      faltantes: LEGAL_DOCUMENT_TYPES,
    };
  }

  const { data, error } = await supabase
    .from('aceptaciones_documentos')
    .select('tipo_documento, version')
    .eq('usuario_id', usuarioId);

  if (error) {
    return {
      ok: false,
      code: 'QUERY_ERROR',
      message: error.message,
      faltantes: LEGAL_DOCUMENT_TYPES,
    };
  }

  const aceptados = new Set(
    (data || [])
      .filter(
        (row) =>
          LEGAL_DOCUMENT_VERSIONS[row.tipo_documento] === row.version
      )
      .map((row) => row.tipo_documento)
  );

  const faltantes = LEGAL_DOCUMENT_TYPES.filter(
    (tipo) => !aceptados.has(tipo)
  );

  return {
    ok: true,
    faltantes,
    completas: faltantes.length === 0,
  };
}

export async function tieneAceptacionesLegalesVigentes(supabase, usuarioId) {
  const estado = await obtenerEstadoAceptacionesLegales(supabase, usuarioId);

  if (!estado.ok) {
    return {
      ok: false,
      code: estado.code,
      message: estado.message,
      vigentes: false,
    };
  }

  return {
    ok: true,
    vigentes: estado.completas,
    faltantes: estado.faltantes,
  };
}

export async function registrarAceptacionesLegales(supabase, usuarioId) {
  const sesion = await assertSesionPropia(supabase, usuarioId);
  if (!sesion.ok) {
    return {
      ok: false,
      code: sesion.code,
      message: sesion.message,
    };
  }

  const registros = LEGAL_DOCUMENT_TYPES.map((tipo) => ({
    usuario_id: usuarioId,
    tipo_documento: tipo,
    version: LEGAL_DOCUMENT_VERSIONS[tipo],
  }));

  const { error } = await supabase.from('aceptaciones_documentos').upsert(
    registros,
    {
      onConflict: 'usuario_id,tipo_documento,version',
      ignoreDuplicates: true,
    }
  );

  if (error) {
    return {
      ok: false,
      code: 'UPSERT_ERROR',
      message: `No se pudieron registrar las aceptaciones legales: ${error.message}`,
    };
  }

  const verificacion = await tieneAceptacionesLegalesVigentes(
    supabase,
    usuarioId
  );

  if (!verificacion.ok || !verificacion.vigentes) {
    return {
      ok: false,
      code: 'VERIFICATION_ERROR',
      message:
        'Las aceptaciones legales no quedaron registradas correctamente.',
    };
  }

  return { ok: true };
}

export async function navegarTrasAutenticacion(
  supabase,
  router,
  normalizedEmail,
  destinoFallback = '/seleccionar-perfil'
) {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.user?.id) {
    return {
      ok: false,
      code: 'NO_SESSION',
      message: 'No se pudo establecer la sesión.',
    };
  }

  const { data: perfiles, error: perfilesError } = await supabase
    .from('perfiles')
    .select('tipo')
    .eq('email', normalizedEmail);

  if (perfilesError) {
    return {
      ok: false,
      code: 'PERFILES_ERROR',
      message: 'Error al obtener perfiles.',
    };
  }

  const destino = resolverDestinoPorPerfiles(
    (perfiles || []).map((p) => p.tipo)
  );

  if (!destino) {
    return {
      ok: false,
      code: 'NO_PROFILES',
      message: 'No tienes perfiles asignados.',
    };
  }

  const aceptaciones = await tieneAceptacionesLegalesVigentes(
    supabase,
    session.user.id
  );

  if (!aceptaciones.ok) {
    return {
      ok: false,
      code: aceptaciones.code,
      message: aceptaciones.message,
    };
  }

  if (!aceptaciones.vigentes) {
    await router.push(buildAceptarDocumentosPath(destino, destinoFallback));
    return { ok: true, redirected: true };
  }

  await router.push(destino);
  return { ok: true, redirected: true, destino };
}
