import { authenticatedFetch } from '../auth';

export type RoomPlayer = {
  playerId: string;
  playerName: string;
  avatarColor?: string | null;
  score?: number;
  roundScore?: number;
  isHost?: boolean;
  isReady?: boolean;
  answers?: Record<string, string>;
};

export type Room = {
  roomCode: string;
  hostId: string;
  hostName: string;
  maxRounds: number;
  language: string;
  playerCount?: number;
  players?: RoomPlayer[];
  status?: string;
  gameMode?: string;
  maxPlayers?: number;
  isPublic?: boolean;
  currentRound?: number;
  currentLetter?: string | null;
  roundStartedAt?: number | null;
  roundEndsAt?: number | null;
  roundDurationSecs?: number | null;
  serverNow?: number;
  stopper?: { id?: string; name?: string; stopTimestamp?: number } | null;
};

export type CreateRoomInput = {
  hostId: string;
  hostName: string;
  avatarColor?: string | null;
  maxRounds?: number;
  language?: string;
  loginMethod?: string | null;
  isPublic?: boolean;
  gameMode?: 'classic' | 'blitz' | 'challenge' | 'random';
  maxPlayers?: number;
};

export type JoinRoomInput = {
  playerId: string;
  playerName: string;
  avatarColor?: string | null;
  loginMethod?: string | null;
};

export async function createRoom(data: CreateRoomInput): Promise<Room> {
  return authenticatedFetch<Room>('/api/rooms', { method: 'POST', body: JSON.stringify(data) });
}

export async function joinRoom(roomCode: string, data: JoinRoomInput): Promise<Room> {
  return authenticatedFetch<Room>(`/api/rooms/${encodeURIComponent(roomCode)}/join`, { method: 'POST', body: JSON.stringify(data) });
}

export async function getRoom(roomCode: string, viewerId: string): Promise<Room> {
  return authenticatedFetch<Room>(`/api/rooms/${encodeURIComponent(roomCode)}?viewerId=${encodeURIComponent(viewerId)}`);
}

export async function getPublicRooms(): Promise<{ rooms: Room[] }> {
  return authenticatedFetch<{ rooms: Room[] }>('/api/rooms/public');
}

export async function startRoom(roomCode: string, hostId: string): Promise<Room> {
  return authenticatedFetch<Room>(`/api/rooms/${encodeURIComponent(roomCode)}/start`, {
    method: 'POST',
    body: JSON.stringify({ hostId }),
  });
}

export async function stopRoom(roomCode: string, playerId: string, playerName: string): Promise<Room> {
  return authenticatedFetch<Room>(`/api/rooms/${encodeURIComponent(roomCode)}/stop`, {
    method: 'POST',
    body: JSON.stringify({ playerId, playerName }),
  });
}

export async function submitRoomResults(
  roomCode: string,
  data: { playerId: string; answers: Record<string, string>; bluffedCategories?: string[]; bluffedWords?: Record<string, string> },
): Promise<Room> {
  return authenticatedFetch<Room>(`/api/rooms/${encodeURIComponent(roomCode)}/results`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}
