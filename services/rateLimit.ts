/**
 * Rate Limiting Service for DhanVayu
 * 
 * Prevents abuse by limiting the frequency of certain actions.
 * Uses in-memory storage for simplicity (resets on app restart).
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

// Rate limit configurations
const RATE_LIMITS = {
  // Auth actions
  LOGIN_ATTEMPT: { maxAttempts: 5, windowMs: 15 * 60 * 1000 }, // 5 attempts per 15 min
  SIGNUP_ATTEMPT: { maxAttempts: 3, windowMs: 60 * 60 * 1000 }, // 3 per hour
  PASSWORD_RESET: { maxAttempts: 3, windowMs: 60 * 60 * 1000 }, // 3 per hour
  
  // API calls
  AI_ROAST: { maxAttempts: 10, windowMs: 60 * 60 * 1000 }, // 10 per hour
  TRANSACTION_CREATE: { maxAttempts: 50, windowMs: 60 * 60 * 1000 }, // 50 per hour
  EXPORT_PDF: { maxAttempts: 5, windowMs: 60 * 60 * 1000 }, // 5 per hour
  
  // General
  GENERIC: { maxAttempts: 100, windowMs: 60 * 1000 }, // 100 per minute
} as const;

type RateLimitKey = keyof typeof RATE_LIMITS;

interface RateLimitEntry {
  attempts: number;
  firstAttempt: number;
  lastAttempt: number;
}

// In-memory cache for current session
const memoryCache: Map<string, RateLimitEntry> = new Map();

// Storage key prefix
const STORAGE_PREFIX = '@dhanvayu_ratelimit_';

/**
 * Generate a unique key for rate limiting
 */
function getStorageKey(action: RateLimitKey, identifier?: string): string {
  return `${STORAGE_PREFIX}${action}_${identifier || 'default'}`;
}

/**
 * Get rate limit entry from storage or memory
 */
async function getEntry(key: string): Promise<RateLimitEntry | null> {
  // Check memory first
  if (memoryCache.has(key)) {
    return memoryCache.get(key)!;
  }
  
  // Check AsyncStorage
  try {
    const stored = await AsyncStorage.getItem(key);
    if (stored) {
      const entry = JSON.parse(stored) as RateLimitEntry;
      memoryCache.set(key, entry);
      return entry;
    }
  } catch (error) {
    console.error('Rate limit storage error:', error);
  }
  
  return null;
}

/**
 * Save rate limit entry to storage
 */
async function saveEntry(key: string, entry: RateLimitEntry): Promise<void> {
  memoryCache.set(key, entry);
  
  try {
    await AsyncStorage.setItem(key, JSON.stringify(entry));
  } catch (error) {
    console.error('Rate limit save error:', error);
  }
}

/**
 * Clear rate limit entry
 */
async function clearEntry(key: string): Promise<void> {
  memoryCache.delete(key);
  
  try {
    await AsyncStorage.removeItem(key);
  } catch (error) {
    console.error('Rate limit clear error:', error);
  }
}

export interface RateLimitResult {
  allowed: boolean;
  remainingAttempts: number;
  resetTime?: Date;
  waitTimeMs?: number;
  message?: string;
}

/**
 * Check if an action is rate limited
 */
export async function checkRateLimit(
  action: RateLimitKey,
  identifier?: string
): Promise<RateLimitResult> {
  const config = RATE_LIMITS[action];
  const key = getStorageKey(action, identifier);
  const now = Date.now();
  
  const entry = await getEntry(key);
  
  // No previous attempts
  if (!entry) {
    return {
      allowed: true,
      remainingAttempts: config.maxAttempts - 1,
    };
  }
  
  // Check if window has expired
  const windowExpired = (now - entry.firstAttempt) >= config.windowMs;
  
  if (windowExpired) {
    // Reset the window
    await clearEntry(key);
    return {
      allowed: true,
      remainingAttempts: config.maxAttempts - 1,
    };
  }
  
  // Check if limit reached
  if (entry.attempts >= config.maxAttempts) {
    const resetTime = new Date(entry.firstAttempt + config.windowMs);
    const waitTimeMs = resetTime.getTime() - now;
    
    return {
      allowed: false,
      remainingAttempts: 0,
      resetTime,
      waitTimeMs,
      message: `Too many attempts. Please try again in ${Math.ceil(waitTimeMs / 60000)} minute(s).`,
    };
  }
  
  // Allowed, but update count
  return {
    allowed: true,
    remainingAttempts: config.maxAttempts - entry.attempts - 1,
  };
}

/**
 * Record an action attempt
 */
export async function recordAttempt(
  action: RateLimitKey,
  identifier?: string
): Promise<RateLimitResult> {
  const config = RATE_LIMITS[action];
  const key = getStorageKey(action, identifier);
  const now = Date.now();
  
  let entry = await getEntry(key);
  
  // Check if window has expired
  if (entry && (now - entry.firstAttempt) >= config.windowMs) {
    entry = null;
  }
  
  if (!entry) {
    // Create new entry
    entry = {
      attempts: 1,
      firstAttempt: now,
      lastAttempt: now,
    };
  } else {
    // Update existing entry
    entry.attempts += 1;
    entry.lastAttempt = now;
  }
  
  await saveEntry(key, entry);
  
  // Check if now rate limited
  if (entry.attempts >= config.maxAttempts) {
    const resetTime = new Date(entry.firstAttempt + config.windowMs);
    const waitTimeMs = resetTime.getTime() - now;
    
    return {
      allowed: false,
      remainingAttempts: 0,
      resetTime,
      waitTimeMs,
      message: `Rate limit exceeded. Please try again in ${Math.ceil(waitTimeMs / 60000)} minute(s).`,
    };
  }
  
  return {
    allowed: true,
    remainingAttempts: config.maxAttempts - entry.attempts,
  };
}

/**
 * Reset rate limit for an action
 */
export async function resetRateLimit(
  action: RateLimitKey,
  identifier?: string
): Promise<void> {
  const key = getStorageKey(action, identifier);
  await clearEntry(key);
}

/**
 * Clear all rate limits (for logout/account deletion)
 */
export async function clearAllRateLimits(): Promise<void> {
  // Clear memory cache
  memoryCache.clear();
  
  // Clear AsyncStorage rate limit keys
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    const rateLimitKeys = allKeys.filter(key => key.startsWith(STORAGE_PREFIX));
    if (rateLimitKeys.length > 0) {
      await AsyncStorage.multiRemove(rateLimitKeys);
    }
  } catch (error) {
    console.error('Error clearing rate limits:', error);
  }
}

/**
 * Decorator-style function to wrap actions with rate limiting
 */
export async function withRateLimit<T>(
  action: RateLimitKey,
  fn: () => Promise<T>,
  identifier?: string
): Promise<T> {
  const check = await checkRateLimit(action, identifier);
  
  if (!check.allowed) {
    throw new Error(check.message || 'Rate limit exceeded');
  }
  
  await recordAttempt(action, identifier);
  return fn();
}

export const RateLimitService = {
  checkRateLimit,
  recordAttempt,
  resetRateLimit,
  clearAllRateLimits,
  withRateLimit,
  RATE_LIMITS,
};

export default RateLimitService;
