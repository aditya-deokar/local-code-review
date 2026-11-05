// Math utility library

/**
 * Adds two numbers.
 * @param {number} a
 * @param {number} b
 * @returns {number}
 */
function add(a, b) {
  if (typeof a !== 'number' || typeof b !== 'number' || !Number.isFinite(a) || !Number.isFinite(b)) {
    throw new TypeError('Both arguments must be finite numbers');
  }
  return a + b;
}

/**
 * Divides a by b.
 * Throws an Error if b is 0 or if inputs are not finite numbers.
 * @param {number} a
 * @param {number} b
 * @returns {number}
 */
function divide(a, b) {
  if (typeof a !== 'number' || typeof b !== 'number' || !Number.isFinite(a) || !Number.isFinite(b)) {
    throw new TypeError('Both arguments must be finite numbers');
  }
  if (b === 0) {
    throw new Error('Division by zero is not allowed');
  }
  return a / b;
}

/**
 * Calculates the average of an array of numbers.
 * Throws an Error if numbers is not a non-empty array or contains non-numeric values.
 * @param {number[]} numbers
 * @returns {number}
 */
function calculateAverage(numbers) {
  if (!Array.isArray(numbers) || numbers.length === 0) {
    throw new Error('Input must be a non-empty array of numbers');
  }

  let sum = 0;
  for (let i = 0; i < numbers.length; i++) {
    const val = numbers[i];
    if (typeof val !== 'number' || !Number.isFinite(val)) {
      throw new TypeError(`Array element at index ${i} must be a finite number`);
    }
    sum += val;
  }
  return sum / numbers.length;
}

module.exports = {
  add,
  divide,
  calculateAverage,
};
