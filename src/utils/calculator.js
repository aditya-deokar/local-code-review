// Math utility library

/**
 * Adds two numbers.
 * @param {number} a
 * @param {number} b
 * @returns {number}
 */
function add(a, b) {
  if (typeof a !== "number" || Number.isNaN(a) || typeof b !== "number" || Number.isNaN(b)) {
    throw new TypeError("Both arguments must be valid numbers");
  }
  return a + b;
}

/**
 * Divides a by b.
 * @param {number} a
 * @param {number} b
 * @returns {number}
 */
function divide(a, b) {
  if (typeof a !== "number" || Number.isNaN(a) || typeof b !== "number" || Number.isNaN(b)) {
    throw new TypeError("Both arguments must be valid numbers");
  }
  if (b === 0) {
    throw new Error("Division by zero");
  }
  return a / b;
}

/**
 * Calculates the average of an array of numbers.
 * @param {number[]} numbers
 * @returns {number}
 */
function calculateAverage(numbers) {
  if (!Array.isArray(numbers)) {
    throw new TypeError("Input must be an array of numbers");
  }
  if (numbers.length === 0) {
    throw new RangeError("Array must not be empty");
  }

  let sum = 0;
  for (let i = 0; i < numbers.length; i++) {
    const num = numbers[i];
    if (typeof num !== "number" || Number.isNaN(num)) {
      throw new TypeError(`Element at index ${i} is not a valid number`);
    }
    sum += num;
  }
  return sum / numbers.length;
}

module.exports = {
  add,
  divide,
  calculateAverage,
};
