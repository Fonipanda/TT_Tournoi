const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000/api';

export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  const headers: Record<string, string> = { ...options.headers as Record<string, string> };
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }
  let response: Response;
  try {
    response = await fetch(url, {
      ...options,
      headers,
    });
  } catch (e) {
    throw new Error('Erreur reseau : verifiez que le serveur backend est demarre (python manage.py runserver)');
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Erreur serveur' }));
    throw new Error(error.error || error.detail || 'Une erreur est survenue');
  }

  if (response.status === 204 || response.headers.get('content-length') === '0') {
    return undefined as T;
  }

  const text = await response.text();
  if (!text) return undefined as T;
  return JSON.parse(text);
}

export const api = {
  tournaments: {
    list: () => apiRequest<any[]>('/tournaments/'),
    get: (id: string) => apiRequest<any>(`/tournaments/${id}/`),
    create: (data: any) => apiRequest<any>('/tournaments/', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) => apiRequest<any>(`/tournaments/${id}/`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) => apiRequest<void>(`/tournaments/${id}/`, { method: 'DELETE' }),
    exportSpidUrl: (id: string) => `${API_BASE_URL}/tournaments/${id}/export_spid/`,
  },
  brackets: {
    list: (tournamentId?: string) => apiRequest<any[]>(tournamentId ? `/brackets/?tournament_id=${tournamentId}` : '/brackets/'),
    get: (id: string) => apiRequest<any>(`/brackets/${id}/`),
    stats: (id: string) => apiRequest<any>(`/brackets/${id}/stats/`),
    registeredPlayers: (id: string) => apiRequest<any[]>(`/brackets/${id}/registered_players/`),
    generateMatches: (id: string, data: any) => apiRequest<any>(`/brackets/${id}/generate_matches/`, { method: 'POST', body: JSON.stringify(data) }),
    checkinList: (id: string) => apiRequest<any[]>(`/brackets/${id}/checkin_list/`),
    assignDossards: (id: string) => apiRequest<any>(`/brackets/${id}/assign_dossards/`, { method: 'POST' }),
    create: (data: any) => apiRequest<any>('/brackets/', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) => apiRequest<any>(`/brackets/${id}/`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) => apiRequest<void>(`/brackets/${id}/`, { method: 'DELETE' }),
  },
  players: {
    list: (search?: string) => apiRequest<any[]>(search ? `/players/?search=${encodeURIComponent(search)}` : '/players/'),
    get: (id: string) => apiRequest<any>(`/players/${id}/`),
    getByEmail: (email: string) => apiRequest<any[]>(`/players/?email=${encodeURIComponent(email)}`),
    getByLicense: (license: string) => apiRequest<any[]>(`/players/?license_number=${encodeURIComponent(license)}`),
    getByName: (name: string) => apiRequest<any[]>(`/players/?search=${encodeURIComponent(name)}`),
    brackets: (id: string) => apiRequest<any[]>(`/players/${id}/brackets/`),
    registrationSummary: (id: string) => apiRequest<any>(`/players/${id}/registration_summary/`),
    create: (data: any) => apiRequest<any>('/players/', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) => apiRequest<any>(`/players/${id}/`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) => apiRequest<void>(`/players/${id}/`, { method: 'DELETE' }),
  },
  registrations: {
    list: (params?: { player_id?: string; bracket_id?: string }) => {
      const query = new URLSearchParams();
      if (params?.player_id) query.set('player_id', params.player_id);
      if (params?.bracket_id) query.set('bracket_id', params.bracket_id);
      return apiRequest<any[]>(`/player-bracket-registrations/?${query.toString()}`);
    },
    create: (data: any) => apiRequest<any>('/player-bracket-registrations/', { method: 'POST', body: JSON.stringify(data) }),
    delete: (id: string) => apiRequest<void>(`/player-bracket-registrations/${id}/`, { method: 'DELETE' }),
  },
  rooms: {
    list: (tournamentId?: string) => apiRequest<any[]>(tournamentId ? `/rooms/?tournament_id=${tournamentId}` : '/rooms/'),
    create: (data: any) => apiRequest<any>('/rooms/', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) => apiRequest<any>(`/rooms/${id}/`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id: string) => apiRequest<void>(`/rooms/${id}/`, { method: 'DELETE' }),
  },
  tables: {
    list: (roomId?: string) => apiRequest<any[]>(roomId ? `/tables/?room_id=${roomId}` : '/tables/'),
    create: (data: any) => apiRequest<any>('/tables/', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) => apiRequest<any>(`/tables/${id}/`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id: string) => apiRequest<void>(`/tables/${id}/`, { method: 'DELETE' }),
  },
  matches: {
    list: (params?: { bracket_id?: string; status?: string }) => {
      const query = new URLSearchParams();
      if (params?.bracket_id) query.set('bracket_id', params.bracket_id);
      if (params?.status) query.set('status', params.status);
      return apiRequest<any[]>(`/matches/?${query.toString()}`);
    },
    create: (data: any) => apiRequest<any>('/matches/', { method: 'POST', body: JSON.stringify(data) }),
    assignTable: (matchId: string, tableId: string) => 
      apiRequest<any>(`/matches/${matchId}/assign_table/`, { method: 'POST', body: JSON.stringify({ table_id: tableId }) }),
    assignPool: (bracketId: string, poolName: string, tableId: string) =>
      apiRequest<any>('/matches/assign_pool/', { method: 'POST', body: JSON.stringify({ bracket_id: bracketId, pool_name: poolName, table_id: tableId }) }),
    finish: (matchId: string, data: any) => 
      apiRequest<any>(`/matches/${matchId}/finish/`, { method: 'POST', body: JSON.stringify(data) }),
    modify: (matchId: string, data: any) =>
      apiRequest<any>(`/matches/${matchId}/modify/`, { method: 'POST', body: JSON.stringify(data) }),
    delete: (id: string) => apiRequest<void>(`/matches/${id}/`, { method: 'DELETE' }),
  },
  menuSections: {
    list: () => apiRequest<any[]>('/menu-sections/'),
    create: (data: any) => apiRequest<any>('/menu-sections/', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) => apiRequest<any>(`/menu-sections/${id}/`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) => apiRequest<void>(`/menu-sections/${id}/`, { method: 'DELETE' }),
  },
  menuItems: {
    list: (sectionId?: string) => apiRequest<any[]>(sectionId ? `/menu-items/?section_id=${sectionId}` : '/menu-items/'),
    create: (data: any) => apiRequest<any>('/menu-items/', { method: 'POST', body: JSON.stringify(data) }),
    createWithImage: (formData: FormData) => apiRequest<any>('/menu-items/', { method: 'POST', body: formData }),
    update: (id: string, data: any) => apiRequest<any>(`/menu-items/${id}/`, { method: 'PUT', body: JSON.stringify(data) }),
    updateWithImage: (id: string, formData: FormData) => apiRequest<any>(`/menu-items/${id}/`, { method: 'PATCH', body: formData }),
    delete: (id: string) => apiRequest<void>(`/menu-items/${id}/`, { method: 'DELETE' }),
  },
  notifications: {
    list: (playerId?: string) => apiRequest<any[]>(playerId ? `/notifications/?player_id=${playerId}` : '/notifications/'),
    markRead: (id: string) => apiRequest<any>(`/notifications/${id}/mark_read/`, { method: 'POST' }),
  },
  notificationSubscriptions: {
    list: (playerId?: string) => apiRequest<any[]>(playerId ? `/notification-subscriptions/?player_id=${playerId}` : '/notification-subscriptions/'),
    create: (data: any) => apiRequest<any>('/notification-subscriptions/', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) => apiRequest<any>(`/notification-subscriptions/${id}/`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id: string) => apiRequest<void>(`/notification-subscriptions/${id}/`, { method: 'DELETE' }),
  },
  live: {
    tables: (tournamentId?: string) => apiRequest<any[]>(tournamentId ? `/live/tables/?tournament_id=${tournamentId}` : '/live/tables/'),
    matches: (tournamentId?: string) => apiRequest<any[]>(tournamentId ? `/live/matches/?tournament_id=${tournamentId}` : '/live/matches/'),
  },
  fftt: {
    lookup: (licenseNumber: string) => apiRequest<any>(`/fftt/lookup/${licenseNumber}/`),
  },
  auth: {
    adminLogin: (username: string, password: string) => 
      apiRequest<any>('/auth/admin-login/', { method: 'POST', body: JSON.stringify({ username, password }) }),
    playerRegister: (username: string, password: string, licenseNumber?: string) =>
      apiRequest<any>('/auth/player-register/', { method: 'POST', body: JSON.stringify({ username, password, license_number: licenseNumber || '' }) }),
  },
  checkin: {
    scan: (qrToken: string) => apiRequest<any>('/checkin/scan/', { method: 'POST', body: JSON.stringify({ qr_token: qrToken }) }),
  },
  payments: {
    createCheckoutSession: (registrationIds: string[]) =>
      apiRequest<any>('/payments/create-checkout-session/', { method: 'POST', body: JSON.stringify({ registration_ids: registrationIds }) }),
    sessionStatus: (sessionId: string) => apiRequest<any>(`/payments/session-status/${sessionId}/`),
  },
  sms: {
    adapters: {
      list: () => apiRequest<any[]>('/sms/adapters/'),
      get: (id: string) => apiRequest<any>(`/sms/adapters/${id}/`),
      create: (data: any) => apiRequest<any>('/sms/adapters/', { method: 'POST', body: JSON.stringify(data) }),
      update: (id: string, data: any) => apiRequest<any>(`/sms/adapters/${id}/`, { method: 'PATCH', body: JSON.stringify(data) }),
      delete: (id: string) => apiRequest<void>(`/sms/adapters/${id}/`, { method: 'DELETE' }),
    },
    adapterFields: (type: string) => apiRequest<any[]>(`/sms/adapter-fields/${type}/`),
    templates: {
      list: () => apiRequest<any[]>('/sms/templates/'),
      get: (id: string) => apiRequest<any>(`/sms/templates/${id}/`),
      create: (data: any) => apiRequest<any>('/sms/templates/', { method: 'POST', body: JSON.stringify(data) }),
      update: (id: string, data: any) => apiRequest<any>(`/sms/templates/${id}/`, { method: 'PATCH', body: JSON.stringify(data) }),
      delete: (id: string) => apiRequest<void>(`/sms/templates/${id}/`, { method: 'DELETE' }),
    },
    templateVariables: () => apiRequest<any[]>('/sms/template-variables/'),
    logs: {
      list: (params?: { player_id?: string; status?: string }) => {
        const query = new URLSearchParams();
        if (params?.player_id) query.set('player_id', params.player_id);
        if (params?.status) query.set('status', params.status);
        return apiRequest<any[]>(`/sms/logs/?${query.toString()}`);
      },
    },
    send: (data: any) => apiRequest<any>('/sms/send/', { method: 'POST', body: JSON.stringify(data) }),
    test: (data: any) => apiRequest<any>('/sms/test/', { method: 'POST', body: JSON.stringify(data) }),
    stats: () => apiRequest<any>('/sms/stats/'),
  },
};
