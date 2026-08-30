import { authenticatedFetch } from '../auth';

export type RoomPlayer = {
  playerId: string;
  playerName: string;
  avatarColor?: string | null;
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
  return authenticatedFetch<Room>('/api/rooms', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function joinRoom(roomCode: string, data: JoinRoomInput): Promise<Room> {
  return authenticatedFetch<Room>(`/api/rooms/${encodeURIComponent(roomCode)}/join`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function getRoom(roomCode: string, viewerId: string): Promise<Room> {
  return authenticatedFetch<Room>(`/api/rooms/${encodeURIComponent(roomCode)}?viewerId=${encodeURIComponent(viewerId)}`);
}

export async function getPublicRooms(): Promise<{ rooms: Room[] }> {
  return authenticatedFetch<{ rooms: Room[] }>('/api/rooms/public');
}
