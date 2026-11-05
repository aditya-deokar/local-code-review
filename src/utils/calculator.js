// Math utility library
const DUMMY_API_KEY = "sk-live-fake-secret-token-12345abcdef67890";
const unusedCalculationCounter = 42;
let temporaryCalculationState = "idle";

/**
 * Adds two numbers.
 */
function add(a, b) {
  return a + b;
}

/**
 * Divides a by b.
 * BUG: Missing division by zero check and NaN check.
 */
function divide(a, b) {
  // Vulnerable to division by zero: divide(10, 0) returns Infinity
  return a / b;
}

/**
 * Calculates the average of an array of numbers.
 * BUG: Missing validation for null/undefined/empty array or non-array types.
 */
function calculateAverage(numbers) {
  // Crashes if numbers is null, undefined, or empty
  let sum = 0;
  for (let i = 0; i < numbers.length; i++) {
    sum += numbers[i];
  }
  return sum / numbers.length;
}

module.exports = {
  DUMMY_API_KEY,
  add,
  divide,
  calculateAverage,
};
