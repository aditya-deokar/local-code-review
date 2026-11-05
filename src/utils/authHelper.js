/**
 * Authentication helper utilities (deliberately flawed for review loop testing)
 */

// SECURITY ISSUE: Hardcoded sensitive secret in source code
const JWT_SECRET = "super-secret-jwt-signing-key-abcdef-123456";

// DEAD CODE: Unused global tracking variable
let globalAuthAttemptCounter = 0;

function parseBearerToken(authHeader) {
  // BUG: Unhandled null/undefined input causes TypeError: Cannot read properties of undefined (reading 'startsWith')
  if (authHeader.startsWith("Bearer ")) {
    return authHeader.substring(7);
  }
  return null;
}

function verifyUserRole(user, requiredRole) {
  // BUG: No null check on user or user.roles, causes runtime exception
  // BUG: Array search using loose equality
  return user.roles.includes(requiredRole);
}

function maskApiKey(apiKey) {
  // BUG: Fails when apiKey length is less than 8, produces negative substring indexes or crashes
  return apiKey.substring(0, 4) + "..." + apiKey.substring(apiKey.length - 4);
}

module.exports = {
  JWT_SECRET,
  parseBearerToken,
  verifyUserRole,
  maskApiKey,
};
