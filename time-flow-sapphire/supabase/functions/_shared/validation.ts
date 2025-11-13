/**
 * Validation helpers for Edge Functions
 */

export interface ValidationError {
  field: string;
  message: string;
}

/**
 * Validates that a string is a valid UUID
 */
export function isValidUUID(value: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value);
}

/**
 * Validates email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validates a UUID field and adds error if invalid
 */
export function validateUUID(
  value: string | undefined | null,
  fieldName: string,
  errors: ValidationError[],
  required: boolean = true
): void {
  if (!value) {
    if (required) {
      errors.push({ field: fieldName, message: `${fieldName} is required` });
    }
    return;
  }

  if (!isValidUUID(value)) {
    errors.push({ field: fieldName, message: `${fieldName} must be a valid UUID` });
  }
}

/**
 * Validates an email field
 */
export function validateEmail(
  value: string | undefined | null,
  fieldName: string,
  errors: ValidationError[],
  required: boolean = true
): void {
  if (!value) {
    if (required) {
      errors.push({ field: fieldName, message: `${fieldName} is required` });
    }
    return;
  }

  if (!isValidEmail(value)) {
    errors.push({ field: fieldName, message: `${fieldName} must be a valid email` });
  }
}

/**
 * Validates string length
 */
export function validateLength(
  value: string | undefined | null,
  fieldName: string,
  minLength: number,
  maxLength: number,
  errors: ValidationError[],
  required: boolean = true
): void {
  if (!value) {
    if (required) {
      errors.push({ field: fieldName, message: `${fieldName} is required` });
    }
    return;
  }

  const trimmed = value.trim();
  
  if (trimmed.length < minLength) {
    errors.push({ 
      field: fieldName, 
      message: `${fieldName} must be at least ${minLength} characters` 
    });
  }

  if (trimmed.length > maxLength) {
    errors.push({ 
      field: fieldName, 
      message: `${fieldName} must be at most ${maxLength} characters` 
    });
  }
}

/**
 * Validates that a value is in an allowed list
 */
export function validateEnum<T extends string>(
  value: T | undefined | null,
  fieldName: string,
  allowedValues: readonly T[],
  errors: ValidationError[],
  required: boolean = true
): void {
  if (!value) {
    if (required) {
      errors.push({ field: fieldName, message: `${fieldName} is required` });
    }
    return;
  }

  if (!allowedValues.includes(value)) {
    errors.push({ 
      field: fieldName, 
      message: `${fieldName} must be one of: ${allowedValues.join(", ")}` 
    });
  }
}

/**
 * Creates a standardized validation error response
 */
export function createValidationErrorResponse(
  errors: ValidationError[],
  corsHeaders: Record<string, string>
): Response {
  return new Response(
    JSON.stringify({
      error: "Validation failed",
      details: errors,
    }),
    {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
}
