// Spanish texts, the default language (context.md, "Interface language"). en.ts must have the same keys.

export const es = {
  health: {
    waiting: 'Comprobando la API...',
    connected: 'API: conectada',
    error: (code: string) => `API: error (${code})`,
    offline: 'API: sin conexión',
  },

  // A time from today shows this word instead of the date (REQ-NF-38, E-152).
  dates: { today: 'Hoy' },

  // Dashboard shell and sidebar (Figma "Dashboard / Shell", 98:5).
  dashboard: {
    skipToContent: 'Saltar al contenido',
    brandCampus: 'RUM',
    brandName: 'Gimnasio de pesas',
    menu: 'Menú del dashboard',
    staffSection: 'Staff',
    generalSection: 'General',
    adminSection: 'Administración',
    staffItems: {
      activeSessions: 'Sesiones activas',
      searchPerson: 'Buscar persona',
      athleteRoster: 'Roster de atletas',
    },
    generalItems: {
      schedules: 'Horarios',
      notices: 'Avisos',
      information: 'Información',
      statistics: 'Estadísticas',
    },
    adminItems: {
      terms: 'Términos',
      manageAthletes: 'Gestionar atletas',
      storeSync: 'Sincronización de la tienda',
      accounts: 'Cuentas',
      staffAccounts: 'Cuentas del staff',
      backups: 'Respaldos',
      manualEntries: 'Entradas manuales',
      auditLog: 'Registro de auditoría',
    },
    // Neutral: staff accounts have no gender, so not "Administrador" or "Administradora".
    roles: { staff: 'Staff', admin: 'Administración' },
    signOut: 'Cerrar sesión',
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

  // The PWA owns the texts for stable API error codes (E-154).
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
  },

  validation: {
    required: 'Este campo es obligatorio.',
    email: 'Escribe un correo electrónico válido.',
    min: 'El valor es demasiado corto o pequeño.',
    max: 'El valor es demasiado largo o grande.',
    string: 'Escribe un texto.',
    in: 'Selecciona una opción válida.',
    unique: 'Este valor ya está en uso.',
    confirmed: 'La confirmación no coincide.',
    invalid: 'Revisa este campo.',
  },
}

export type Messages = typeof es
