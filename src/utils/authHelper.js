/**
 * Authentication helper utilities.
 */

/**
 * Retrieves the JWT secret from environment variables.
 * @returns {string|undefined}
 */
function getJwtSecret() {
  return process.env.JWT_SECRET;
}

/**
 * Parses and extracts a Bearer token from an Authorization header.
 * Safely handles null, undefined, or malformed inputs without throwing.
 * @param {string} authHeader
 * @returns {string|null}
 */
function parseBearerToken(authHeader) {
  if (typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  const token = authHeader.substring(7).trim();
  return token.length > 0 ? token : null;
}

/**
 * Verifies whether a user has the required role.
 * Safely handles null/undefined user or non-array roles.
 * @param {object} user
 * @param {string} requiredRole
 * @returns {boolean}
 */
function verifyUserRole(user, requiredRole) {
  if (!user || typeof user !== 'object' || !Array.isArray(user.roles) || typeof requiredRole !== 'string') {
    return false;
  }
  return user.roles.includes(requiredRole);
}

/**
 * Masks an API key for safe logging, exposing only the first and last 4 characters.
 * Returns '***' if the key is not a string or has fewer than 8 characters.
 * @param {string} apiKey
 * @returns {string}
 */
function maskApiKey(apiKey) {
  if (typeof apiKey !== 'string' || apiKey.length < 8) {
    return '***';
  }
  return apiKey.substring(0, 4) + '...' + apiKey.substring(apiKey.length - 4);
}

module.exports = {
  getJwtSecret,
  parseBearerToken,
  verifyUserRole,
  maskApiKey,
};
