/**
 * Password validation utilities
 */

export interface PasswordValidationResult {
  isValid: boolean;
  errors: string[];
  requirements: {
    minLength: boolean;
    uppercase: boolean;
    lowercase: boolean;
    digit: boolean;
    special: boolean;
  };
}

/**
 * Validate password strength according to requirements
 *
 * Requirements:
 * - At least 8 characters
 * - Contains uppercase letter
 * - Contains lowercase letter
 * - Contains digit
 * - Contains special character
 *
 * @param password - Plain text password to validate
 * @returns PasswordValidationResult with validation status and details
 */
export function validatePasswordStrength(
  password: string,
): PasswordValidationResult {
  const errors: string[] = [];
  const requirements = {
    minLength: false,
    uppercase: false,
    lowercase: false,
    digit: false,
    special: false,
  };

  // Check minimum length
  if (password.length >= 8) {
    requirements.minLength = true;
  } else {
    errors.push("Password must be at least 8 characters long");
  }

  // Check for uppercase letter
  if (/[A-Z]/.test(password)) {
    requirements.uppercase = true;
  } else {
    errors.push("Password must contain at least one uppercase letter");
  }

  // Check for lowercase letter
  if (/[a-z]/.test(password)) {
    requirements.lowercase = true;
  } else {
    errors.push("Password must contain at least one lowercase letter");
  }

  // Check for digit
  if (/\d/.test(password)) {
    requirements.digit = true;
  } else {
    errors.push("Password must contain at least one digit");
  }

  // Check for special character
  if (/[!@#$%^&*()_+\-=[\]{}|;:,.<>?]/.test(password)) {
    requirements.special = true;
  } else {
    errors.push("Password must contain at least one special character");
  }

  const isValid = Object.values(requirements).every(Boolean);

  return {
    isValid,
    errors,
    requirements,
  };
}
