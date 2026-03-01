import crypto from 'crypto';

/**
 * Generate a cryptographically secure API key
 * Format: ak_live_<32_char_random>
 */
export function generateApiKey(): { key: string; hash: string; prefix: string } {
  const randomBytes = crypto.randomBytes(32);
  const keyBody = randomBytes.toString('base64url').substring(0, 32);
  const key = `ak_live_${keyBody}`;
  const hash = hashApiKey(key);
  const prefix = key.substring(0, 15); // ak_live_ + first 7 chars

  return { key, hash, prefix };
}

/**
 * Hash API key using SHA-256
 */
export function hashApiKey(apiKey: string): string {
  return crypto.createHash('sha256').update(apiKey).digest('hex');
}

/**
 * Mask API key for display (show only prefix and last 4 chars)
 */
export function maskApiKey(apiKey: string): string {
  if (apiKey.length < 12) return '****';
  
  const prefix = apiKey.substring(0, 8); // "ak_live_"
  const lastFour = apiKey.substring(apiKey.length - 4);
  
  return `${prefix}****${lastFour}`;
}

/**
 * Validate API key format
 */
export function isValidApiKeyFormat(apiKey: string): boolean {
  return /^ak_live_[A-Za-z0-9_-]{32}$/.test(apiKey);
}
