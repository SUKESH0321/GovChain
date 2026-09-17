const jwt = require('jsonwebtoken');

const JWT_EXPIRES_IN = '7d';

// Sign a token containing the user id, email and role, so routes can identify
// the authenticated user (and their role) without a database lookup.
function signToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
    },
    process.env.JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

function verifyToken(token) {
  return jwt.verify(token, process.env.JWT_SECRET);
}

module.exports = { signToken, verifyToken };