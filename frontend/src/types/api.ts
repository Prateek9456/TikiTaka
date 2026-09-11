export interface ApiErrorDetail {
  code?: string;
  message?: string;
  fieldErrors?: Record<string, string>;
}

export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
  error?: ApiErrorDetail;
  timestamp?: string;
}

export interface PageResponse<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  first: boolean;
  last: boolean;
}

export interface Game {
  id: number;
  name: string;
  slug: string;
  apiSource: string;
  isActive: boolean;
}

export interface TacticalPattern {
  id: number;
  gameId: number;
  patternName: string;
  patternSlug: string;
  description: string;
  eventSequence: string[];
  winRate: number;
  sampleSize: number;
}

export interface LeaderboardEntry {
  playerId: number;
  username: string;
  gameId: number;
  metric: string;
  score: number;
  rank: number;
  currentUser?: boolean;
}

export interface DashboardStats {
  patternCount: number;
  avgWinRate: number;
  totalSamples: number;
  topPattern: TacticalPattern | null;
  leaderboardCount: number;
}

export interface PatternOccurrence {
  patternSlug: string;
  confidence: number;
  timestampMs: number;
}

export interface MatchAnalysis {
  matchId: number;
  externalMatchId: string;
  gameId: number;
  playedAt: string;
  durationSeconds: number | null;
  eventCount: number;
  patternOccurrenceCount: number;
  patterns: PatternOccurrence[];
}

export type UserRole = 'ADMIN' | 'ANALYST' | 'VIEWER';

export type OAuthProvider = 'GOOGLE' | 'RIOT' | 'STEAM' | 'FACEIT' | 'EPIC';

export interface AuthResponse {
  token: string;
  email: string;
  username?: string;
  role: UserRole;
}

export interface LinkedAccountSummary {
  provider: OAuthProvider;
  displayName: string | null;
  avatarUrl: string | null;
  linkedAt: string;
}

export interface UserGameAccountSummary {
  gameId: number;
  gameName: string;
  externalPlayerId: string;
}

export interface MeResponse {
  id: number;
  email: string;
  username?: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  dateOfBirth: string | null;
  location: string | null;
  lastLoginAt: string | null;
  role: UserRole;
  linkedAccounts: LinkedAccountSummary[];
  gameAccounts: UserGameAccountSummary[];
}

export type GameSessionSource = 'INFERRED';

export interface AuthSession {
  id: number;
  provider: OAuthProvider | null;
  loginAt: string;
  logoutAt: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  location: string | null;
}

export interface GameSession {
  id: number;
  gameId: number;
  gameName: string;
  startedAt: string;
  endedAt: string;
  matchCount: number;
  source: GameSessionSource;
}
