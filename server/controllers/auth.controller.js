const bcrypt = require('bcryptjs');

const userModel = require('../models/user.model');
const { signToken } = require('../utils/jwt');
const { ALL_ROLES, ROLES, isValidRole } = require('../utils/roles');

const SALT_ROUNDS = 10;

// POST /api/auth/register
async function register(req, res) {
  try {
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    const role = typeof req.body?.role === 'string' ? req.body.role : ROLES.CONTRACTOR;

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email and password are required' });
    }
    if (!email.includes('@')) {
      return res.status(400).json({ message: 'Please provide a valid email address' });
    }
    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters long' });
    }
    if (!isValidRole(role)) {
      return res.status(400).json({ message: `Role must be one of: ${ALL_ROLES.join(', ')}` });
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    const user = await userModel.createUser({ name, email, passwordHash, role });
    return res.status(201).json({ message: 'User registered successfully', user });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ message: 'A user with this email already exists' });
    }
    console.error(`[auth/register] ${error.message}`);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

// POST /api/auth/login
async function login(req, res) {
  try {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const user = await userModel.findByEmail(email);
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const passwordMatches = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatches) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const token = signToken(user);
    return res.json({ message: 'Login successful', token, user: userModel.toSafeUser(user) });
  } catch (error) {
    console.error(`[auth/login] ${error.message}`);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

// GET /api/auth/me
async function me(req, res) {
  try {
    const user = await userModel.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    return res.json({ user });
  } catch (error) {
    console.error(`[auth/me] ${error.message}`);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

module.exports = { register, login, me };