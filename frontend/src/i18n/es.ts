// Spanish texts, the default language (context.md, "Interface language"). en.ts must have the same keys.

export const es = {
  health: {
    waiting: 'Comprobando la API...',
    connected: 'API: conectada',
    error: (code: string) => `API: error (${code})`,
    offline: 'API: sin conexión',
  },

  // Shared loading, empty, error and no connection states (Figma A-08: 107:1884, 107:1898, 132:3759, 132:3777).
  states: {
    loading: 'Cargando',
    empty: 'Sin resultados',
    errorTitle: 'Error al cargar',
    errorDetail: 'No pudimos cargar los datos. Inténtalo de nuevo.',
    retry: 'Reintentar',
    offlineTitle: 'Sin conexión',
    offlineLead: 'Sin conexión. Los datos pueden haber cambiado. Las acciones estarán disponibles al recuperar la conexión.',
  },

  // Texts for the stable API error codes. Keep them in sync with backend/lang/es/errors.php.
  errors: {
    bad_request: 'No se pudo procesar la solicitud.',
    unauthenticated: 'Inicia sesión para continuar.',
    forbidden: 'No tienes permiso para hacer esto.',
    not_found: 'No encontramos lo que buscabas.',
    method_not_allowed: 'Esta acción no está permitida aquí.',
    conflict: 'Esto choca con los datos actuales. Actualiza e intenta de nuevo.',
    payload_too_large: 'El archivo o la solicitud es demasiado grande.',
    session_expired: 'Tu sesión expiró. Actualiza la página e intenta de nuevo.',
    validation_failed: 'Algunos campos necesitan corrección.',
    too_many_requests: 'Demasiados intentos. Espera un momento e intenta de nuevo.',
    service_unavailable: 'El servicio no está disponible ahora. Intenta más tarde.',
    server_error: 'Algo salió mal de nuestro lado. Intenta más tarde.',
    database_unavailable: 'El servicio no está disponible ahora. Intenta más tarde.',
  } as Record<string, string> & { bad_request: string; server_error: string },
}

export type Messages = typeof es
