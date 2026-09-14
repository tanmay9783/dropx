const ROOM_CODE_REGEX = /^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6}$/i;

/**
 * Validates whether a room code is formatted properly (6 uppercase alphanumeric characters excluding ambiguous ones).
 */
export function isValidRoomCode(code: string): boolean {
  if (!code || typeof code !== 'string') return false;
  return ROOM_CODE_REGEX.test(code.trim());
}

/**
 * Generates the full frontend join URL for a given room code.
 * Prefers current window origin if available (so LAN testing auto-uses computer IP),
 * falling back to VITE_APP_BASE_URL or localhost:5173.
 */
export function getJoinUrl(roomCode: string, roomKey?: string): string {
  const cleanCode = roomCode.trim().toUpperCase();
  const baseUrl =
    typeof window !== 'undefined' && window.location.origin
      ? window.location.origin
      : import.meta.env.VITE_APP_BASE_URL || 'http://localhost:5173';
  const url = `${baseUrl}/join/${cleanCode}`;
  return roomKey ? `${url}#key=${roomKey}` : url;
}
