import type {
  ApiResponse,
  AuthResponse,
  AuthSession,
  Game,
  GameSession,
  LeaderboardEntry,
  MatchAnalysis,
  MeResponse,
  PageResponse,
  TacticalPattern,
} from '../types/api';
import { getStoredToken } from '../lib/authStorage';

const API_BASE = '/api/v1';
const PUBLIC_AUTH_PATHS = new Set([
  '/auth/login',
  '/auth/register',
  '/auth/forgot-password',
  '/auth/reset-password',
  '/auth/csrf',
  '/auth/oauth/providers',
  '/auth/oauth/providers/status',
]);

class ApiError extends Error {
  status?: number;
  code?: string;

  constructor(message: string, status?: number, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

let csrfToken: string | null = null;
let csrfHeaderName = 'X-XSRF-TOKEN';

function authHeaders(path: string): HeadersInit {
  if (PUBLIC_AUTH_PATHS.has(path)) {
    return {};
  }
  const token = getStoredToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function ensureCsrfToken(): Promise<void> {
  if (csrfToken) {
    return;
  }
  const response = await fetch(`${API_BASE}/auth/csrf`, {
    credentials: 'include',
  });
  if (!response.ok) {
    return;
  }
  try {
    const json: ApiResponse<{ token: string; headerName: string }> = await response.json();
    if (json.data?.token) {
      csrfToken = json.data.token;
      csrfHeaderName = json.data.headerName || 'X-XSRF-TOKEN';
    }
  } catch {
    csrfToken = readCookie('XSRF-TOKEN');
  }
}

function readCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

async function fetchApi<T>(path: string, init: RequestInit = {}): Promise<T> {
  const method = (init.method ?? 'GET').toUpperCase();
  if (method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS') {
    await ensureCsrfToken();
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...init,
      credentials: 'include',
      headers: {
        ...authHeaders(path),
        ...(csrfToken ? { [csrfHeaderName]: csrfToken } : {}),
        ...(init.headers ?? {}),
      },
    });
  } catch {
    throw new ApiError(
      'Cannot reach the API. Start the backend with: docker compose up -d java-backend',
    );
  }

  if (response.status === 403 && method !== 'GET') {
    csrfToken = null;
    await ensureCsrfToken();
    if (csrfToken) {
      response = await fetch(`${API_BASE}${path}`, {
        ...init,
        credentials: 'include',
        headers: {
          ...authHeaders(path),
          [csrfHeaderName]: csrfToken,
          ...(init.headers ?? {}),
        },
      });
    }
  }

  if (!response.ok) {
    const { message, code } = await readError(response);
    throw new ApiError(message, response.status, code);
  }

  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    throw new ApiError(
      'Cannot reach the API. Start the backend with: docker compose up -d java-backend',
    );
  }

  const json: ApiResponse<T> = await response.json();

  if (!json.success) {
    throw new ApiError(json.error?.message ?? json.message ?? 'API request failed', response.status, json.error?.code);
  }

  return json.data;
}

async function readError(response: Response): Promise<{ message: string; code?: string }> {
  if (response.status >= 500) {
    return {
      message: `Backend error (${response.status}). Ensure MySQL, Redis, and Kafka are running: docker compose up -d`,
    };
  }

  try {
    const json = (await response.json()) as ApiResponse<unknown> & {
      error?: { message?: string; code?: string; fieldErrors?: Record<string, string> };
    };
    const fieldErrors = json.error?.fieldErrors;
    if (fieldErrors && Object.keys(fieldErrors).length > 0) {
      return { message: Object.values(fieldErrors).join('. '), code: json.error?.code };
    }
    return {
      message: json.error?.message ?? json.message ?? `Request failed: ${response.status}`,
      code: json.error?.code,
    };
  } catch {
    return { message: `Request failed: ${response.status} ${response.statusText}` };
  }
}

export async function login(
  loginId: string,
  password: string,
  location?: string,
): Promise<AuthResponse> {
  return fetchApi<AuthResponse>('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ login: loginId, email: loginId, password, location }),
  });
}

export interface RegisterPayload {
  name: string;
  username: string;
  email: string;
  password: string;
  dateOfBirth: string;
  location?: string;
}

export async function register(payload: RegisterPayload): Promise<AuthResponse> {
  return fetchApi<AuthResponse>('/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function getOAuthProviders(): Promise<import('../types/api').OAuthProvider[]> {
  const providers = await fetchApi<string[]>('/auth/oauth/providers');
  return providers as import('../types/api').OAuthProvider[];
}

export async function getOAuthProviderStatus(): Promise<
  Record<import('../types/api').OAuthProvider, boolean>
> {
  const status = await fetchApi<Record<string, boolean>>('/auth/oauth/providers/status');
  return status as Record<import('../types/api').OAuthProvider, boolean>;
}

export async function forgotPassword(email: string): Promise<void> {
  await fetchApi<null>('/auth/forgot-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
}

export async function resetPassword(email: string, otp: string, newPassword: string): Promise<void> {
  await fetchApi<null>('/auth/reset-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, otp, newPassword }),
  });
}

export async function getCurrentUser(): Promise<MeResponse> {
  return fetchApi<MeResponse>('/auth/me');
}

export async function unlinkProvider(provider: string): Promise<void> {
  await fetchApi<null>(`/auth/link/${provider.toLowerCase()}`, {
    method: 'DELETE',
  });
}

export async function getGames(): Promise<Game[]> {
  return fetchApi<Game[]>('/games');
}

export async function getPatterns(
  gameId: number,
  sortBy = 'winRate',
  page = 0,
  size = 50,
): Promise<PageResponse<TacticalPattern>> {
  const params = new URLSearchParams({
    gameId: String(gameId),
    sortBy,
    page: String(page),
    size: String(size),
  });
  return fetchApi<PageResponse<TacticalPattern>>(`/patterns?${params}`);
}

export async function getLeaderboard(
  gameId: number,
  metric = 'tikitaka_score',
): Promise<LeaderboardEntry[]> {
  const params = new URLSearchParams({
    gameId: String(gameId),
    metric,
  });
  return fetchApi<LeaderboardEntry[]>(`/leaderboard?${params}`);
}

export async function getMatchAnalysis(matchId: number): Promise<MatchAnalysis> {
  return fetchApi<MatchAnalysis>(`/matches/${matchId}/analysis`);
}

export async function getAuthSessions(): Promise<AuthSession[]> {
  return fetchApi<AuthSession[]>('/sessions/auth');
}

export interface GameSessionQuery {
  gameId?: number;
  from?: string;
  to?: string;
}

export async function getGameSessions(query: GameSessionQuery = {}): Promise<GameSession[]> {
  const params = new URLSearchParams();
  if (query.gameId !== undefined) {
    params.set('gameId', String(query.gameId));
  }
  if (query.from) {
    params.set('from', query.from);
  }
  if (query.to) {
    params.set('to', query.to);
  }
  const qs = params.toString();
  return fetchApi<GameSession[]>(`/sessions/game${qs ? `?${qs}` : ''}`);
}

export async function getLatestMatch(gameId: number): Promise<MatchAnalysis | null> {
  let response: Response;

  try {
    await ensureCsrfToken();
    response = await fetch(`${API_BASE}/matches/latest?gameId=${gameId}`, {
      credentials: 'include',
      headers: {
        ...authHeaders('/matches/latest'),
        ...(csrfToken ? { [csrfHeaderName]: csrfToken } : {}),
      },
    });
  } catch {
    throw new ApiError(
      'Cannot reach the API. Start the backend with: docker compose up -d java-backend',
    );
  }

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    if (response.status >= 500) {
      throw new ApiError(
        `Backend error (${response.status}). Ensure MySQL, Redis, and Kafka are running: docker compose up -d`,
      );
    }
    throw new ApiError(`Request failed: ${response.status} ${response.statusText}`, response.status);
  }

  const json: ApiResponse<MatchAnalysis> = await response.json();

  if (!json.success) {
    throw new ApiError(json.message ?? 'API request failed', response.status, json.error?.code);
  }

  return json.data;
}

export { ApiError };
