const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { add, divide, calculateAverage } = require("../src/utils/calculator");

describe("add", () => {
  it("should correctly add two positive numbers", () => {
    assert.strictEqual(add(2, 3), 5);
  });

  it("should correctly add negative numbers", () => {
    assert.strictEqual(add(-2, -3), -5);
    assert.strictEqual(add(5, -3), 2);
  });

  it("should correctly add floating point numbers", () => {
    assert.strictEqual(add(0.1, 0.2), 0.1 + 0.2);
  });

  it("should throw TypeError when arguments are not numbers", () => {
    assert.throws(() => add("2", 3), { name: "TypeError", message: "Both arguments must be valid numbers" });
    assert.throws(() => add(2, null), { name: "TypeError", message: "Both arguments must be valid numbers" });
    assert.throws(() => add(undefined, 3), { name: "TypeError", message: "Both arguments must be valid numbers" });
    assert.throws(() => add(NaN, 3), { name: "TypeError", message: "Both arguments must be valid numbers" });
  });
});

describe("divide", () => {
  it("should correctly divide two numbers", () => {
    assert.strictEqual(divide(10, 2), 5);
    assert.strictEqual(divide(7, 2), 3.5);
  });

  it("should correctly handle division with negative numbers", () => {
    assert.strictEqual(divide(-10, 2), -5);
    assert.strictEqual(divide(10, -2), -5);
    assert.strictEqual(divide(-10, -2), 5);
  });

  it("should throw Error on division by zero", () => {
    assert.throws(() => divide(10, 0), { name: "Error", message: "Division by zero" });
    assert.throws(() => divide(0, 0), { name: "Error", message: "Division by zero" });
  });

  it("should throw TypeError when arguments are not numbers", () => {
    assert.throws(() => divide("10", 2), { name: "TypeError", message: "Both arguments must be valid numbers" });
    assert.throws(() => divide(10, "2"), { name: "TypeError", message: "Both arguments must be valid numbers" });
    assert.throws(() => divide(null, 2), { name: "TypeError", message: "Both arguments must be valid numbers" });
    assert.throws(() => divide(10, undefined), { name: "TypeError", message: "Both arguments must be valid numbers" });
    assert.throws(() => divide(NaN, 2), { name: "TypeError", message: "Both arguments must be valid numbers" });
  });
});

describe("calculateAverage", () => {
  it("should correctly calculate average of numbers", () => {
    assert.strictEqual(calculateAverage([1, 2, 3, 4, 5]), 3);
    assert.strictEqual(calculateAverage([10]), 10);
    assert.strictEqual(calculateAverage([-10, 10]), 0);
  });

  it("should throw RangeError for empty array", () => {
    assert.throws(() => calculateAverage([]), { name: "RangeError", message: "Array must not be empty" });
  });

  it("should throw TypeError for null or undefined", () => {
    assert.throws(() => calculateAverage(null), { name: "TypeError", message: "Input must be an array of numbers" });
    assert.throws(() => calculateAverage(undefined), { name: "TypeError", message: "Input must be an array of numbers" });
  });

  it("should throw TypeError for non-array inputs", () => {
    assert.throws(() => calculateAverage("1,2,3"), { name: "TypeError", message: "Input must be an array of numbers" });
    assert.throws(() => calculateAverage(42), { name: "TypeError", message: "Input must be an array of numbers" });
    assert.throws(() => calculateAverage({}), { name: "TypeError", message: "Input must be an array of numbers" });
  });

  it("should throw TypeError if array contains non-number elements", () => {
    assert.throws(() => calculateAverage([1, "2", 3]), { name: "TypeError", message: "Element at index 1 is not a valid number" });
    assert.throws(() => calculateAverage([1, null, 3]), { name: "TypeError", message: "Element at index 1 is not a valid number" });
    assert.throws(() => calculateAverage([1, NaN, 3]), { name: "TypeError", message: "Element at index 1 is not a valid number" });
  });
});
