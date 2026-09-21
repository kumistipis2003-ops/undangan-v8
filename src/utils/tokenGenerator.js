const crypto = require('node:crypto');

function generateManagementToken() {
  // Generate random 16 bytes base64url token, e.g. "AbC82xP92LmK7xyz"
  return crypto.randomBytes(12).toString('base64url').replace(/[-_]/g, 'x');
}

function generateGuestToken() {
  // Generate short unguessable 6 bytes base64url token, e.g. "X7mQa9"
  return crypto.randomBytes(6).toString('base64url').replace(/[-_]/g, 'z').slice(0, 8);
}

function hashPassword(password, salt = 'undangan-platform-salt') {
  return crypto.createHmac('sha256', salt).update(password).digest('hex');
}

function verifyPassword(password, hash, salt = 'undangan-platform-salt') {
  const computed = hashPassword(password, salt);
  return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(hash));
}

module.exports = {
  generateManagementToken,
  generateGuestToken,
  hashPassword,
  verifyPassword
};
