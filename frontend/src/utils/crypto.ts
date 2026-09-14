/**
 * Browser-native Zero-Knowledge End-to-End Encryption (E2EE) helper
 * powered by Web Crypto API (AES-GCM 256-bit).
 */

const ALGORITHM = 'AES-GCM';
const KEY_LENGTH = 256;
const IV_LENGTH_BYTES = 12;

// Utility functions for base64url encoding / decoding
function bufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function base64UrlToBuffer(base64url: string): ArrayBuffer {
  let base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Derives a deterministic 256-bit AES-GCM key from the 6-character room code.
 * This allows seamless Zero-Knowledge E2EE without needing an out-of-band key transfer via URL fragment.
 */
export async function deriveRoomKey(roomCode: string): Promise<string> {
  const encoder = new TextEncoder();
  const salt = 'dropx-secure-salt-v1:';
  const hashBuffer = await window.crypto.subtle.digest(
    'SHA-256', 
    encoder.encode(salt + roomCode.toUpperCase())
  );
  return bufferToBase64Url(hashBuffer);
}

/**
 * Imports a base64url key string into a CryptoKey object.
 */
async function importRoomKey(keyStr: string): Promise<CryptoKey> {
  const rawKey = base64UrlToBuffer(keyStr);
  return window.crypto.subtle.importKey(
    'raw',
    rawKey,
    { name: ALGORITHM, length: KEY_LENGTH },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypts a File/Blob using AES-256-GCM.
 * Prepends a random 12-byte IV to the encrypted payload.
 */
export async function encryptBlob(blob: Blob, keyStr: string): Promise<Blob> {
  const key = await importRoomKey(keyStr);
  const iv = window.crypto.getRandomValues(new Uint8Array(IV_LENGTH_BYTES));
  const fileData = await blob.arrayBuffer();

  const ciphertext = await window.crypto.subtle.encrypt(
    { name: ALGORITHM, iv },
    key,
    fileData
  );

  // Combine IV (12 bytes) + Ciphertext into single payload
  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.length);

  return new Blob([combined], { type: 'application/octet-stream' });
}

/**
 * Decrypts an encrypted Blob/ArrayBuffer containing IV + Ciphertext using AES-256-GCM.
 */
export async function decryptBlob(encryptedBlob: Blob, keyStr: string, originalMimeType?: string): Promise<Blob> {
  const key = await importRoomKey(keyStr);
  const buffer = await encryptedBlob.arrayBuffer();

  if (buffer.byteLength <= IV_LENGTH_BYTES) {
    throw new Error('Encrypted payload too short');
  }

  const iv = buffer.slice(0, IV_LENGTH_BYTES);
  const ciphertext = buffer.slice(IV_LENGTH_BYTES);

  const decryptedData = await window.crypto.subtle.decrypt(
    { name: ALGORITHM, iv: new Uint8Array(iv) },
    key,
    ciphertext
  );

  return new Blob([decryptedData], { type: originalMimeType || 'application/octet-stream' });
}

/**
 * Encrypts a plain text string to base64url ciphertext string.
 */
export async function encryptText(text: string, keyStr: string): Promise<string> {
  const encoder = new TextEncoder();
  const textBuffer = encoder.encode(text);
  const blob = new Blob([textBuffer]);
  const encryptedBlob = await encryptBlob(blob, keyStr);
  const arrayBuffer = await encryptedBlob.arrayBuffer();
  return bufferToBase64Url(arrayBuffer);
}

/**
 * Decrypts base64url ciphertext string back to plain text string.
 */
export async function decryptText(cipherBase64Url: string, keyStr: string): Promise<string> {
  const encryptedBuffer = base64UrlToBuffer(cipherBase64Url);
  const blob = new Blob([encryptedBuffer]);
  const decryptedBlob = await decryptBlob(blob, keyStr, 'text/plain');
  const textBuffer = await decryptedBlob.arrayBuffer();
  const decoder = new TextDecoder();
  return decoder.decode(textBuffer);
}
