/**
 * Input validation utilities for numeric inputs
 * Ensures data quality and prevents invalid entries
 */

/**
 * Validates and sanitizes numeric input for weight (allows decimals)
 * @param value - The input string
 * @returns Sanitized string that only contains valid numeric characters
 */
export const validateWeightInput = (value: string): string => {
  // Remove any non-numeric characters except decimal point
  let sanitized = value.replace(/[^0-9.]/g, '');
  
  // Ensure only one decimal point
  const parts = sanitized.split('.');
  if (parts.length > 2) {
    sanitized = parts[0] + '.' + parts.slice(1).join('');
  }
  
  // Prevent negative numbers (remove minus sign if present)
  if (sanitized.startsWith('-')) {
    sanitized = sanitized.substring(1);
  }
  
  return sanitized;
};

/**
 * Validates and sanitizes numeric input for reps (integers only, no decimals)
 * @param value - The input string
 * @returns Sanitized string that only contains valid integer characters
 */
export const validateRepsInput = (value: string): string => {
  // Remove any non-numeric characters (no decimals for reps)
  let sanitized = value.replace(/[^0-9]/g, '');
  
  // Prevent negative numbers
  if (sanitized.startsWith('-')) {
    sanitized = sanitized.substring(1);
  }
  
  return sanitized;
};

/**
 * Validates and sanitizes numeric input for 1RM (allows decimals)
 * @param value - The input string
 * @returns Sanitized string that only contains valid numeric characters
 */
export const validate1RMInput = (value: string): string => {
  // Same as weight - allows decimals
  return validateWeightInput(value);
};

/**
 * Validates readiness score input (1-10, integers only)
 * @param value - The input string
 * @returns Sanitized string that only contains valid digits 1-10
 */
export const validateReadinessInput = (value: string): string => {
  // Remove any non-numeric characters
  let sanitized = value.replace(/[^0-9]/g, '');
  
  // Prevent negative numbers
  if (sanitized.startsWith('-')) {
    sanitized = sanitized.substring(1);
  }
  
  // Limit to 2 digits max (for 10)
  if (sanitized.length > 2) {
    sanitized = sanitized.substring(0, 2);
  }
  
  // If value is > 10, cap at 10
  const num = parseInt(sanitized, 10);
  if (!isNaN(num) && num > 10) {
    sanitized = '10';
  }
  
  return sanitized;
};

/**
 * Checks if a weight value is valid (positive number)
 * @param value - The string value to check
 * @returns true if valid, false otherwise
 */
export const isValidWeight = (value: string): boolean => {
  if (!value || value.trim() === '') return true; // Empty is valid (user can clear)
  const num = parseFloat(value);
  return !isNaN(num) && num > 0;
};

/**
 * Checks if a reps value is valid (positive integer)
 * @param value - The string value to check
 * @returns true if valid, false otherwise
 */
export const isValidReps = (value: string): boolean => {
  if (!value || value.trim() === '') return true; // Empty is valid
  const num = parseInt(value, 10);
  return !isNaN(num) && num > 0 && Number.isInteger(num);
};

/**
 * Checks if a 1RM value is valid (positive number)
 * @param value - The string value to check
 * @returns true if valid, false otherwise
 */
export const isValid1RM = (value: string): boolean => {
  if (!value || value.trim() === '') return true; // Empty is valid
  const num = parseFloat(value);
  return !isNaN(num) && num > 0;
};

/**
 * Checks if a readiness score is valid (1-10)
 * @param value - The string value to check
 * @returns true if valid, false otherwise
 */
export const isValidReadiness = (value: string): boolean => {
  if (!value || value.trim() === '') return false; // Readiness must have a value
  const num = parseInt(value, 10);
  return !isNaN(num) && num >= 1 && num <= 10;
};

