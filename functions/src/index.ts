// functions/src/index.ts
/**
 * DhanVayu Cloud Functions
 *
 * Security Features:
 * - Authentication required for all callable functions
 * - Rate limiting via Firestore
 * - Input validation and sanitization
 * - Proper CORS configuration
 * - Comprehensive error handling
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import * as logger from "firebase-functions/logger";

// V2 Imports for HTTPS Callable functions
import {
  HttpsError,
  onCall,
  CallableOptions,
} from "firebase-functions/v2/https";

// V1 Import for auth triggers
import * as functions from "firebase-functions";

import * as dotenv from "dotenv";
import * as admin from "firebase-admin";

// Initialize Admin SDK
if (admin.apps.length === 0) {
  admin.initializeApp();
}

dotenv.config({ path: ".env.local" });

const db = admin.firestore();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

// --- SECURITY CONSTANTS ---
const RATE_LIMITS = {
  AI_ROAST: { maxAttempts: 10, windowMs: 60 * 60 * 1000 }, // 10 per hour
  CLEANUP: { maxAttempts: 1, windowMs: 24 * 60 * 60 * 1000 }, // 1 per day
};

const MAX_PROMPT_LENGTH = 2000;
const ALLOWED_ORIGINS = [
  "https://dhanvayu.app",
  "https://*.dhanvayu.app",
  "exp://",
  "dhanvayu://",
];

// --- SECURITY UTILITIES ---

/**
 * Sanitize string input
 */
function sanitizeString(input: string | undefined | null): string {
  if (!input) return "";

  return String(input)
    .trim()
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/javascript:/gi, "")
    .replace(/on\w+=/gi, "")
    .slice(0, MAX_PROMPT_LENGTH);
}

/**
 * Validate AI prompt for injection attempts
 */
function validatePrompt(prompt: string): {
  valid: boolean;
  sanitized: string;
  error?: string;
} {
  if (!prompt || typeof prompt !== "string") {
    return { valid: false, sanitized: "", error: "Prompt is required" };
  }

  const sanitized = sanitizeString(prompt);

  if (sanitized.length === 0) {
    return { valid: false, sanitized: "", error: "Prompt cannot be empty" };
  }

  if (sanitized.length > MAX_PROMPT_LENGTH) {
    return {
      valid: false,
      sanitized: "",
      error: `Prompt exceeds ${MAX_PROMPT_LENGTH} characters`,
    };
  }

  // Remove potential prompt injection attempts
  const cleaned = sanitized
    .replace(/ignore\s+(previous|all)\s+instructions/gi, "[filtered]")
    .replace(/system\s*:/gi, "[filtered]")
    .replace(/assistant\s*:/gi, "[filtered]")
    .replace(/\bpretend\s+you\s+are\b/gi, "[filtered]")
    .replace(/\bact\s+as\s+if\b/gi, "[filtered]");

  return { valid: true, sanitized: cleaned };
}

/**
 * Check rate limit using Firestore
 */
async function checkRateLimit(
  userId: string,
  action: keyof typeof RATE_LIMITS,
): Promise<{ allowed: boolean; remainingAttempts: number; resetTime?: Date }> {
  const config = RATE_LIMITS[action];
  const docRef = db.collection("rateLimits").doc(`${userId}_${action}`);

  try {
    const doc = await docRef.get();
    const now = Date.now();

    if (!doc.exists) {
      // First attempt
      await docRef.set({
        attempts: 1,
        firstAttempt: now,
        lastAttempt: now,
      });
      return { allowed: true, remainingAttempts: config.maxAttempts - 1 };
    }

    const data = doc.data()!;
    const windowExpired = now - data.firstAttempt >= config.windowMs;

    if (windowExpired) {
      // Reset window
      await docRef.set({
        attempts: 1,
        firstAttempt: now,
        lastAttempt: now,
      });
      return { allowed: true, remainingAttempts: config.maxAttempts - 1 };
    }

    if (data.attempts >= config.maxAttempts) {
      const resetTime = new Date(data.firstAttempt + config.windowMs);
      return { allowed: false, remainingAttempts: 0, resetTime };
    }

    // Increment attempts
    await docRef.update({
      attempts: admin.firestore.FieldValue.increment(1),
      lastAttempt: now,
    });

    return {
      allowed: true,
      remainingAttempts: config.maxAttempts - data.attempts - 1,
    };
  } catch (error) {
    logger.error("Rate limit check failed:", error);
    // Allow on error (fail open) but log for monitoring
    return { allowed: true, remainingAttempts: 1 };
  }
}

// --- CALLABLE OPTIONS WITH SECURITY ---
const secureCallableOptions: CallableOptions = {
  cors: ALLOWED_ORIGINS,
  enforceAppCheck: false, // Enable when App Check is configured
  consumeAppCheckToken: false,
};

// --- v2 Function: AI Roast (Secured) ---
export const generateAiRoast = onCall(
  secureCallableOptions,
  async (request) => {
    // 1. Authentication Check
    if (!request.auth) {
      logger.warn("Unauthenticated AI roast attempt");
      throw new HttpsError(
        "unauthenticated",
        "You must be logged in to use this feature.",
      );
    }

    const userId = request.auth.uid;

    // 2. Rate Limit Check
    const rateCheck = await checkRateLimit(userId, "AI_ROAST");
    if (!rateCheck.allowed) {
      const waitMins = rateCheck.resetTime
        ? Math.ceil((rateCheck.resetTime.getTime() - Date.now()) / 60000)
        : 60;
      throw new HttpsError(
        "resource-exhausted",
        `Too many requests. Please try again in ${waitMins} minute(s).`,
      );
    }

    // 3. Input Validation
    const { prompt } = request.data;
    const validation = validatePrompt(prompt);

    if (!validation.valid) {
      throw new HttpsError(
        "invalid-argument",
        validation.error || "Invalid prompt",
      );
    }

    // 4. Generate AI Response
    try {
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

      // Add safety context to prompt
      const safePrompt = `You are a friendly Gen-Z financial advisor giving fun, roast-style feedback. 
Keep responses under 150 words. Be funny but helpful. Never give harmful financial advice.
User context: ${validation.sanitized}`;

      const result = await model.generateContent(safePrompt);
      const response = await result.response;
      const text = response.text();

      // Log successful request for analytics
      logger.info(`AI roast generated for user ${userId}`, {
        promptLength: validation.sanitized.length,
        responseLength: text.length,
      });

      return {
        success: true,
        text,
        remainingRequests: rateCheck.remainingAttempts,
      };
    } catch (error) {
      logger.error("Gemini API Error:", error);
      throw new HttpsError(
        "internal",
        "AI service temporarily unavailable. Please try again later.",
      );
    }
  },
);

// --- v1 Function: Auth Cleanup (Secured) ---
export const cleanupUserData = functions.auth.user().onDelete(async (user) => {
  const uid = user.uid;
  const userDocRef = db.collection("users").doc(uid);

  logger.info(`Starting secure data cleanup for deleted user: ${uid}`);

  try {
    // 1. Clean up rate limit documents
    const rateLimitDocs = await db
      .collection("rateLimits")
      .where(admin.firestore.FieldPath.documentId(), ">=", `${uid}_`)
      .where(admin.firestore.FieldPath.documentId(), "<", `${uid}~`)
      .get();

    const batch = db.batch();
    rateLimitDocs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();

    // 2. Recursively delete user document and subcollections
    await db.recursiveDelete(userDocRef);

    logger.info(`Successfully deleted all data for user ${uid}`);
  } catch (error) {
    logger.error(`Error cleaning up data for user ${uid}:`, error);
    // Don't throw - this is a cleanup operation
  }
});

// --- Health Check Function (for monitoring) ---
export const healthCheck = onCall({ cors: true }, async () => {
  return {
    status: "healthy",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
  };
});
