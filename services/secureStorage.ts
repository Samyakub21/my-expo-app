/**
 * Secure Storage Service for DhanVayu
 *
 * Handles all sensitive data storage using expo-secure-store
 * which uses Keychain on iOS and EncryptedSharedPreferences on Android
 */

import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";

// Storage keys - never expose these in logs
const KEYS = {
  USER_PIN: "dhanvayu_user_pin",
  PIN_SALT: "dhanvayu_pin_salt",
  PIN_ENABLED: "dhanvayu_pin_enabled",
  BIOMETRIC_ENABLED: "dhanvayu_biometric_enabled",
  FAILED_ATTEMPTS: "dhanvayu_failed_attempts",
  LOCKOUT_UNTIL: "dhanvayu_lockout_until",
} as const;

// Security constants
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 5 * 60 * 1000; // 5 minutes
const PIN_LENGTH = 4;

/**
 * Hash PIN with salt for secure storage
 */
async function hashPin(pin: string, salt: string): Promise<string> {
  const data = pin + salt;
  const hash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    data,
  );
  return hash;
}

/**
 * Generate a random salt for PIN hashing
 */
async function generateSalt(): Promise<string> {
  const randomBytes = await Crypto.getRandomBytesAsync(16);
  return Array.from(randomBytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Secure PIN Storage Service
 */
export const SecurePinService = {
  /**
   * Check if user has set up a PIN
   */
  async isPinSetup(): Promise<boolean> {
    try {
      const pin = await SecureStore.getItemAsync(KEYS.USER_PIN);
      return pin !== null;
    } catch (error) {
      console.error("Error checking PIN setup:", error);
      return false;
    }
  },

  /**
   * Check if PIN lock is enabled
   */
  async isPinEnabled(): Promise<boolean> {
    try {
      const enabled = await SecureStore.getItemAsync(KEYS.PIN_ENABLED);
      return enabled === "true";
    } catch {
      return false;
    }
  },

  /**
   * Enable or disable PIN lock
   */
  async setPinEnabled(enabled: boolean): Promise<void> {
    await SecureStore.setItemAsync(
      KEYS.PIN_ENABLED,
      enabled ? "true" : "false",
    );
  },

  /**
   * Set up a new PIN (first time or change)
   */
  async setupPin(pin: string): Promise<{ success: boolean; error?: string }> {
    // Validate PIN
    if (!pin || pin.length !== PIN_LENGTH) {
      return { success: false, error: `PIN must be ${PIN_LENGTH} digits` };
    }

    if (!/^\d+$/.test(pin)) {
      return { success: false, error: "PIN must contain only numbers" };
    }

    // Check for weak PINs
    const weakPins = [
      "0000",
      "1111",
      "2222",
      "3333",
      "4444",
      "5555",
      "6666",
      "7777",
      "8888",
      "9999",
      "1234",
      "4321",
      "0123",
      "3210",
    ];
    if (weakPins.includes(pin)) {
      return {
        success: false,
        error: "PIN is too weak. Choose a stronger PIN.",
      };
    }

    try {
      // Generate salt and hash
      const salt = await generateSalt();
      const hashedPin = await hashPin(pin, salt);

      // Store securely
      await SecureStore.setItemAsync(KEYS.PIN_SALT, salt);
      await SecureStore.setItemAsync(KEYS.USER_PIN, hashedPin);
      await SecureStore.setItemAsync(KEYS.PIN_ENABLED, "true");

      // Reset failed attempts
      await SecureStore.deleteItemAsync(KEYS.FAILED_ATTEMPTS);
      await SecureStore.deleteItemAsync(KEYS.LOCKOUT_UNTIL);

      return { success: true };
    } catch (error) {
      console.error("Error setting up PIN:", error);
      return { success: false, error: "Failed to save PIN securely" };
    }
  },

  /**
   * Verify entered PIN against stored hash
   */
  async verifyPin(enteredPin: string): Promise<{
    success: boolean;
    error?: string;
    attemptsRemaining?: number;
    lockedUntil?: Date;
  }> {
    try {
      // Check for lockout
      const lockoutUntil = await SecureStore.getItemAsync(KEYS.LOCKOUT_UNTIL);
      if (lockoutUntil) {
        const lockoutDate = new Date(parseInt(lockoutUntil, 10));
        if (lockoutDate > new Date()) {
          return {
            success: false,
            error: "Too many failed attempts",
            lockedUntil: lockoutDate,
          };
        } else {
          // Lockout expired, reset
          await SecureStore.deleteItemAsync(KEYS.LOCKOUT_UNTIL);
          await SecureStore.deleteItemAsync(KEYS.FAILED_ATTEMPTS);
        }
      }

      // Get stored data
      const storedHash = await SecureStore.getItemAsync(KEYS.USER_PIN);
      const salt = await SecureStore.getItemAsync(KEYS.PIN_SALT);

      if (!storedHash || !salt) {
        return { success: false, error: "PIN not set up" };
      }

      // Hash entered PIN and compare
      const enteredHash = await hashPin(enteredPin, salt);

      if (enteredHash === storedHash) {
        // Success - reset failed attempts
        await SecureStore.deleteItemAsync(KEYS.FAILED_ATTEMPTS);
        return { success: true };
      } else {
        // Failed attempt
        const attemptsStr = await SecureStore.getItemAsync(
          KEYS.FAILED_ATTEMPTS,
        );
        const attempts = attemptsStr ? parseInt(attemptsStr, 10) + 1 : 1;

        await SecureStore.setItemAsync(
          KEYS.FAILED_ATTEMPTS,
          attempts.toString(),
        );

        if (attempts >= MAX_FAILED_ATTEMPTS) {
          // Lock out user
          const lockoutTime = Date.now() + LOCKOUT_DURATION_MS;
          await SecureStore.setItemAsync(
            KEYS.LOCKOUT_UNTIL,
            lockoutTime.toString(),
          );
          return {
            success: false,
            error: "Too many failed attempts. Try again in 5 minutes.",
            lockedUntil: new Date(lockoutTime),
          };
        }

        return {
          success: false,
          error: "Incorrect PIN",
          attemptsRemaining: MAX_FAILED_ATTEMPTS - attempts,
        };
      }
    } catch (error) {
      console.error("Error verifying PIN:", error);
      return { success: false, error: "Verification failed" };
    }
  },

  /**
   * Change PIN (requires current PIN verification)
   */
  async changePin(
    currentPin: string,
    newPin: string,
  ): Promise<{ success: boolean; error?: string }> {
    const verification = await this.verifyPin(currentPin);
    if (!verification.success) {
      return {
        success: false,
        error: verification.error || "Current PIN is incorrect",
      };
    }

    return await this.setupPin(newPin);
  },

  /**
   * Remove PIN (disable PIN lock)
   */
  async removePin(
    currentPin: string,
  ): Promise<{ success: boolean; error?: string }> {
    const verification = await this.verifyPin(currentPin);
    if (!verification.success) {
      return {
        success: false,
        error: verification.error || "Current PIN is incorrect",
      };
    }

    try {
      await SecureStore.deleteItemAsync(KEYS.USER_PIN);
      await SecureStore.deleteItemAsync(KEYS.PIN_SALT);
      await SecureStore.setItemAsync(KEYS.PIN_ENABLED, "false");
      await SecureStore.deleteItemAsync(KEYS.FAILED_ATTEMPTS);
      await SecureStore.deleteItemAsync(KEYS.LOCKOUT_UNTIL);
      return { success: true };
    } catch {
      return { success: false, error: "Failed to remove PIN" };
    }
  },

  /**
   * Get lockout status
   */
  async getLockoutStatus(): Promise<{ isLocked: boolean; lockedUntil?: Date }> {
    try {
      const lockoutUntil = await SecureStore.getItemAsync(KEYS.LOCKOUT_UNTIL);
      if (lockoutUntil) {
        const lockoutDate = new Date(parseInt(lockoutUntil, 10));
        if (lockoutDate > new Date()) {
          return { isLocked: true, lockedUntil: lockoutDate };
        }
      }
      return { isLocked: false };
    } catch {
      return { isLocked: false };
    }
  },

  /**
   * Check if biometric is enabled
   */
  async isBiometricEnabled(): Promise<boolean> {
    try {
      const enabled = await SecureStore.getItemAsync(KEYS.BIOMETRIC_ENABLED);
      return enabled === "true";
    } catch {
      return true; // Default to enabled
    }
  },

  /**
   * Enable or disable biometric authentication
   */
  async setBiometricEnabled(enabled: boolean): Promise<void> {
    await SecureStore.setItemAsync(
      KEYS.BIOMETRIC_ENABLED,
      enabled ? "true" : "false",
    );
  },

  /**
   * Get failed attempts count
   */
  async getFailedAttempts(): Promise<number> {
    try {
      const attempts = await SecureStore.getItemAsync(KEYS.FAILED_ATTEMPTS);
      return attempts ? parseInt(attempts, 10) : 0;
    } catch {
      return 0;
    }
  },
};
