/**
 * Input Validation & Sanitization Service for DhanVayu
 * 
 * Provides comprehensive validation for all user inputs to prevent
 * injection attacks, XSS, and ensure data integrity.
 */

// Email validation regex (RFC 5322 compliant)
const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

// Phone number regex (international format)
const PHONE_REGEX = /^\+?[1-9]\d{1,14}$/;

// Amount regex (positive numbers with up to 2 decimal places)
const AMOUNT_REGEX = /^\d+(\.\d{1,2})?$/;

// Dangerous patterns to sanitize
const DANGEROUS_PATTERNS = [
  /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
  /javascript:/gi,
  /on\w+=/gi,
  /<iframe/gi,
  /<object/gi,
  /<embed/gi,
  /data:/gi,
];

// SQL injection patterns
const SQL_PATTERNS = [
  /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|TRUNCATE|EXEC|UNION|FETCH|DECLARE|CAST)\b)/gi,
  /(--)|(;)|(\|\|)|(')/g,
];

/**
 * Check if string contains SQL injection patterns
 */
export function containsSqlInjection(input: string): boolean {
  if (!input) return false;
  return SQL_PATTERNS.some(pattern => pattern.test(input));
}

export interface ValidationResult {
  isValid: boolean;
  error?: string;
  sanitizedValue?: string;
}

/**
 * Sanitize string input by removing dangerous characters
 */
export function sanitizeString(input: string | undefined | null): string {
  if (!input) return '';
  
  let sanitized = String(input).trim();
  
  // Remove dangerous HTML/script patterns
  DANGEROUS_PATTERNS.forEach(pattern => {
    sanitized = sanitized.replace(pattern, '');
  });
  
  // Escape HTML entities
  sanitized = sanitized
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
  
  return sanitized;
}

/**
 * Sanitize for database queries (prevent NoSQL injection)
 */
export function sanitizeForDatabase(input: string | undefined | null): string {
  if (!input) return '';
  
  let sanitized = String(input).trim();
  
  // Remove $ and . which are special in MongoDB/Firestore
  sanitized = sanitized.replace(/[$.]|__/g, '');
  
  return sanitized;
}

/**
 * Validate email address
 */
export function validateEmail(email: string): ValidationResult {
  const sanitized = sanitizeString(email).toLowerCase();
  
  if (!sanitized) {
    return { isValid: false, error: 'Email is required' };
  }
  
  if (sanitized.length > 254) {
    return { isValid: false, error: 'Email is too long' };
  }
  
  if (!EMAIL_REGEX.test(sanitized)) {
    return { isValid: false, error: 'Please enter a valid email address' };
  }
  
  return { isValid: true, sanitizedValue: sanitized };
}

/**
 * Validate password strength
 */
export function validatePassword(password: string): ValidationResult {
  if (!password) {
    return { isValid: false, error: 'Password is required' };
  }
  
  if (password.length < 8) {
    return { isValid: false, error: 'Password must be at least 8 characters' };
  }
  
  if (password.length > 128) {
    return { isValid: false, error: 'Password is too long' };
  }
  
  // Check for at least one number
  if (!/\d/.test(password)) {
    return { isValid: false, error: 'Password must contain at least one number' };
  }
  
  // Check for at least one letter
  if (!/[a-zA-Z]/.test(password)) {
    return { isValid: false, error: 'Password must contain at least one letter' };
  }
  
  return { isValid: true };
}

/**
 * Validate transaction amount
 */
export function validateAmount(amount: string | number): ValidationResult {
  const amountStr = String(amount).trim();
  
  if (!amountStr) {
    return { isValid: false, error: 'Amount is required' };
  }
  
  if (!AMOUNT_REGEX.test(amountStr)) {
    return { isValid: false, error: 'Please enter a valid amount' };
  }
  
  const numAmount = parseFloat(amountStr);
  
  if (numAmount <= 0) {
    return { isValid: false, error: 'Amount must be greater than zero' };
  }
  
  if (numAmount > 999999999) {
    return { isValid: false, error: 'Amount is too large' };
  }
  
  return { isValid: true, sanitizedValue: numAmount.toFixed(2) };
}

/**
 * Validate transaction title/description
 */
export function validateTitle(title: string, maxLength: number = 100): ValidationResult {
  const sanitized = sanitizeString(title);
  
  if (!sanitized) {
    return { isValid: false, error: 'Title is required' };
  }
  
  if (sanitized.length < 2) {
    return { isValid: false, error: 'Title must be at least 2 characters' };
  }
  
  if (sanitized.length > maxLength) {
    return { isValid: false, error: `Title must be less than ${maxLength} characters` };
  }
  
  return { isValid: true, sanitizedValue: sanitized };
}

/**
 * Validate display name
 */
export function validateDisplayName(name: string): ValidationResult {
  const sanitized = sanitizeString(name);
  
  if (!sanitized) {
    return { isValid: true, sanitizedValue: '' }; // Display name is optional
  }
  
  if (sanitized.length < 2) {
    return { isValid: false, error: 'Name must be at least 2 characters' };
  }
  
  if (sanitized.length > 50) {
    return { isValid: false, error: 'Name must be less than 50 characters' };
  }
  
  // Only allow letters, numbers, spaces, and common punctuation
  if (!/^[\p{L}\p{N}\s\-'.]+$/u.test(sanitized)) {
    return { isValid: false, error: 'Name contains invalid characters' };
  }
  
  return { isValid: true, sanitizedValue: sanitized };
}

/**
 * Validate phone number
 */
export function validatePhone(phone: string): ValidationResult {
  const sanitized = phone.replace(/[\s\-()]/g, '');
  
  if (!sanitized) {
    return { isValid: true, sanitizedValue: '' }; // Phone is optional
  }
  
  if (!PHONE_REGEX.test(sanitized)) {
    return { isValid: false, error: 'Please enter a valid phone number' };
  }
  
  return { isValid: true, sanitizedValue: sanitized };
}

/**
 * Validate category ID
 */
export function validateCategory(category: string, validCategories: string[]): ValidationResult {
  const sanitized = sanitizeForDatabase(category);
  
  if (!sanitized) {
    return { isValid: false, error: 'Category is required' };
  }
  
  if (!validCategories.includes(sanitized)) {
    return { isValid: false, error: 'Invalid category selected' };
  }
  
  return { isValid: true, sanitizedValue: sanitized };
}

/**
 * Validate date string
 */
export function validateDate(dateStr: string): ValidationResult {
  if (!dateStr) {
    return { isValid: false, error: 'Date is required' };
  }
  
  const date = new Date(dateStr);
  
  if (isNaN(date.getTime())) {
    return { isValid: false, error: 'Invalid date format' };
  }
  
  // Don't allow dates more than 1 year in the past or future
  const now = new Date();
  const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
  const oneYearFromNow = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());
  
  if (date < oneYearAgo || date > oneYearFromNow) {
    return { isValid: false, error: 'Date must be within the last year' };
  }
  
  return { isValid: true, sanitizedValue: date.toISOString() };
}

/**
 * Validate AI prompt (for Gemini calls)
 */
export function validateAIPrompt(prompt: string): ValidationResult {
  const sanitized = sanitizeString(prompt);
  
  if (!sanitized) {
    return { isValid: false, error: 'Prompt is required' };
  }
  
  if (sanitized.length > 2000) {
    return { isValid: false, error: 'Prompt is too long (max 2000 characters)' };
  }
  
  // Remove potential prompt injection attempts
  const cleaned = sanitized
    .replace(/ignore\s+(previous|all)\s+instructions/gi, '')
    .replace(/system\s*:/gi, '')
    .replace(/assistant\s*:/gi, '');
  
  return { isValid: true, sanitizedValue: cleaned };
}

/**
 * Comprehensive transaction validation
 */
export function validateTransaction(data: {
  title: string;
  amount: string | number;
  category: string;
  type?: string;
  isRecurring?: boolean;
  frequency?: string;
}): { isValid: boolean; errors: string[]; sanitized?: any } {
  const errors: string[] = [];
  const sanitized: any = {};
  
  const validCategories = ['food', 'transport', 'shopping', 'tech', 'bills', 'fun', 'income'];
  const validTypes = ['expense', 'income'];
  const validFrequencies = ['weekly', 'monthly', 'yearly'];
  
  // Validate title
  const titleResult = validateTitle(data.title);
  if (!titleResult.isValid) {
    errors.push(titleResult.error!);
  } else {
    sanitized.title = titleResult.sanitizedValue;
  }
  
  // Validate amount
  const amountResult = validateAmount(data.amount);
  if (!amountResult.isValid) {
    errors.push(amountResult.error!);
  } else {
    sanitized.amount = parseFloat(amountResult.sanitizedValue!);
  }
  
  // Validate category
  const categoryResult = validateCategory(data.category, validCategories);
  if (!categoryResult.isValid) {
    errors.push(categoryResult.error!);
  } else {
    sanitized.category = categoryResult.sanitizedValue;
  }
  
  // Validate type
  if (data.type && !validTypes.includes(data.type)) {
    errors.push('Invalid transaction type');
  } else {
    sanitized.type = data.type || 'expense';
  }
  
  // Validate recurring settings
  sanitized.isRecurring = Boolean(data.isRecurring);
  if (data.isRecurring && data.frequency) {
    if (!validFrequencies.includes(data.frequency)) {
      errors.push('Invalid frequency');
    } else {
      sanitized.frequency = data.frequency;
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    sanitized: errors.length === 0 ? sanitized : undefined
  };
}

export default {
  sanitizeString,
  sanitizeForDatabase,
  validateEmail,
  validatePassword,
  validateAmount,
  validateTitle,
  validateDisplayName,
  validatePhone,
  validateCategory,
  validateDate,
  validateAIPrompt,
  validateTransaction,
};
