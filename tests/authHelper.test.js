const test = require('node:test');
const assert = require('node:assert/strict');
const {
  getJwtSecret,
  parseBearerToken,
  verifyUserRole,
  maskApiKey,
} = require('../src/utils/authHelper');

test('getJwtSecret - reads JWT_SECRET from environment variables', () => {
  const originalSecret = process.env.JWT_SECRET;
  try {
    process.env.JWT_SECRET = 'test-env-jwt-secret';
    assert.equal(getJwtSecret(), 'test-env-jwt-secret');

    delete process.env.JWT_SECRET;
    assert.equal(getJwtSecret(), undefined);
  } finally {
    if (originalSecret !== undefined) {
      process.env.JWT_SECRET = originalSecret;
    } else {
      delete process.env.JWT_SECRET;
    }
  }
});

test('parseBearerToken - correctly extracts token from valid Bearer header', () => {
  assert.equal(parseBearerToken('Bearer validToken123'), 'validToken123');
  assert.equal(parseBearerToken('Bearer eyJhbGciOi...'), 'eyJhbGciOi...');
  assert.equal(parseBearerToken('Bearer  spacedToken  '), 'spacedToken');
});

test('parseBearerToken - safely returns null for non-bearer or invalid header strings', () => {
  assert.equal(parseBearerToken('Basic dXNlcjpwYXNz'), null);
  assert.equal(parseBearerToken('Token 12345'), null);
  assert.equal(parseBearerToken('bearer lowercased'), null);
  assert.equal(parseBearerToken('Bearer '), null);
  assert.equal(parseBearerToken('Bearer    '), null);
  assert.equal(parseBearerToken(''), null);
});

test('parseBearerToken - safely returns null for non-string, null, and undefined inputs', () => {
  assert.equal(parseBearerToken(null), null);
  assert.equal(parseBearerToken(undefined), null);
  assert.equal(parseBearerToken(12345), null);
  assert.equal(parseBearerToken({}), null);
  assert.equal(parseBearerToken(['Bearer token']), null);
  assert.equal(parseBearerToken(true), null);
});

test('verifyUserRole - returns true when user has the required role', () => {
  const user = { id: 1, roles: ['user', 'admin'] };
  assert.equal(verifyUserRole(user, 'admin'), true);
  assert.equal(verifyUserRole(user, 'user'), true);
});

test('verifyUserRole - returns false when user lacks the required role', () => {
  const user = { id: 1, roles: ['user'] };
  assert.equal(verifyUserRole(user, 'admin'), false);
  assert.equal(verifyUserRole(user, 'superadmin'), false);
});

test('verifyUserRole - safely handles null, undefined, or malformed user objects', () => {
  assert.equal(verifyUserRole(null, 'admin'), false);
  assert.equal(verifyUserRole(undefined, 'admin'), false);
  assert.equal(verifyUserRole('invalid-user', 'admin'), false);
  assert.equal(verifyUserRole(12345, 'admin'), false);
  assert.equal(verifyUserRole({}, 'admin'), false);
  assert.equal(verifyUserRole({ roles: null }, 'admin'), false);
  assert.equal(verifyUserRole({ roles: 'admin' }, 'admin'), false);
  assert.equal(verifyUserRole({ roles: 123 }, 'admin'), false);
  assert.equal(verifyUserRole({ roles: {} }, 'admin'), false);
});

test('verifyUserRole - safely handles missing or non-string requiredRole', () => {
  const user = { id: 1, roles: ['admin'] };
  assert.equal(verifyUserRole(user, null), false);
  assert.equal(verifyUserRole(user, undefined), false);
  assert.equal(verifyUserRole(user, 123), false);
  assert.equal(verifyUserRole(user, {}), false);
});

test('maskApiKey - correctly masks valid API keys (8 or more characters)', () => {
  assert.equal(maskApiKey('12345678'), '1234...5678');
  assert.equal(maskApiKey('sk-live-abcdef123456'), 'sk-l...3456');
  assert.equal(maskApiKey('my-secret-token-value'), 'my-s...alue');
});

test('maskApiKey - safely masks keys shorter than 8 characters', () => {
  assert.equal(maskApiKey(''), '***');
  assert.equal(maskApiKey('abc'), '***');
  assert.equal(maskApiKey('1234567'), '***');
});

test('maskApiKey - safely handles non-string, null, or undefined inputs', () => {
  assert.equal(maskApiKey(null), '***');
  assert.equal(maskApiKey(undefined), '***');
  assert.equal(maskApiKey(123456789), '***');
  assert.equal(maskApiKey({}), '***');
  assert.equal(maskApiKey([]), '***');
  assert.equal(maskApiKey(true), '***');
});

test('module exports - does not leak hardcoded secrets or dead tracking variables', () => {
  const authModule = require('../src/utils/authHelper');
  assert.equal(authModule.JWT_SECRET, undefined);
  assert.equal(authModule.globalAuthAttemptCounter, undefined);
});
