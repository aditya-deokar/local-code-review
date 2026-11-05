const test = require('node:test');
const assert = require('node:assert/strict');
const { add, divide, calculateAverage } = require('../src/utils/calculator');

test('add - correctly sums valid finite numbers', () => {
  assert.equal(add(2, 3), 5);
  assert.equal(add(-1, 1), 0);
  assert.equal(add(0.1, 0.2).toFixed(1), '0.3');
});

test('add - throws on non-numeric or non-finite inputs', () => {
  assert.throws(() => add('2', 3), /Both arguments must be finite numbers/);
  assert.throws(() => add(2, null), /Both arguments must be finite numbers/);
  assert.throws(() => add(undefined, 5), /Both arguments must be finite numbers/);
  assert.throws(() => add(NaN, 5), /Both arguments must be finite numbers/);
  assert.throws(() => add(Infinity, 5), /Both arguments must be finite numbers/);
});

test('divide - correctly divides numbers', () => {
  assert.equal(divide(10, 2), 5);
  assert.equal(divide(-6, 3), -2);
  assert.equal(divide(7, 2), 3.5);
});

test('divide - throws error on division by zero', () => {
  assert.throws(() => divide(10, 0), /Division by zero is not allowed/);
  assert.throws(() => divide(0, 0), /Division by zero is not allowed/);
});

test('divide - throws on non-numeric or non-finite inputs', () => {
  assert.throws(() => divide('10', 2), /Both arguments must be finite numbers/);
  assert.throws(() => divide(10, '2'), /Both arguments must be finite numbers/);
  assert.throws(() => divide(NaN, 2), /Both arguments must be finite numbers/);
  assert.throws(() => divide(10, Infinity), /Both arguments must be finite numbers/);
});

test('calculateAverage - correctly calculates average of numbers array', () => {
  assert.equal(calculateAverage([1, 2, 3, 4, 5]), 3);
  assert.equal(calculateAverage([10]), 10);
  assert.equal(calculateAverage([-10, 10]), 0);
});

test('calculateAverage - throws error on null, undefined, or non-array inputs', () => {
  assert.throws(() => calculateAverage(null), /Input must be a non-empty array/);
  assert.throws(() => calculateAverage(undefined), /Input must be a non-empty array/);
  assert.throws(() => calculateAverage('not an array'), /Input must be a non-empty array/);
  assert.throws(() => calculateAverage({}), /Input must be a non-empty array/);
});

test('calculateAverage - throws error on empty array', () => {
  assert.throws(() => calculateAverage([]), /Input must be a non-empty array/);
});

test('calculateAverage - throws error if array contains non-finite numbers', () => {
  assert.throws(() => calculateAverage([1, '2', 3]), /must be a finite number/);
  assert.throws(() => calculateAverage([1, null, 3]), /must be a finite number/);
  assert.throws(() => calculateAverage([1, NaN, 3]), /must be a finite number/);
});

test('module exports - does not leak API keys or secrets', () => {
  const calculatorModule = require('../src/utils/calculator');
  assert.equal(calculatorModule.DUMMY_API_KEY, undefined);
  assert.equal(calculatorModule.unusedCalculationCounter, undefined);
  assert.equal(calculatorModule.temporaryCalculationState, undefined);
});
