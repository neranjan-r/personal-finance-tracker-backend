import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { getDb, saveDb } from '../models/db.js';
import { auth } from '../middleware/auth.js';

const router = express.Router();
const getSecret = () => process.env.JWT_SECRET || 'supersecret_finance_tracker_jwt_key_2026';

router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: { message: 'Name is required' } });
    }
    if (!email || !email.trim()) {
      return res.status(400).json({ error: { message: 'Email is required' } });
    }
    if (!password || password.length < 6) {
      return res.status(400).json({ error: { message: 'Password must be at least 6 characters' } });
    }

    const db = getDb();
    const normalizedEmail = email.trim().toLowerCase();
    const existing = db.users.find((u) => u.email.toLowerCase() === normalizedEmail);

    if (existing) {
      return res.status(400).json({ error: { message: 'User with this email already exists' } });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = {
      id: crypto.randomUUID(),
      name: name.trim(),
      email: normalizedEmail,
      password: hashedPassword,
      createdAt: new Date().toISOString()
    };

    db.users.push(newUser);
    await saveDb();

    const token = jwt.sign({ userId: newUser.id }, getSecret(), { expiresIn: '7d' });

    return res.status(201).json({
      data: {
        token,
        user: {
          id: newUser.id,
          name: newUser.name,
          email: newUser.email
        }
      }
    });
  } catch (err) {
    console.error('Register error:', err);
    return res.status(500).json({ error: { message: 'Internal server error' } });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: { message: 'Please provide both email and password' } });
    }

    const db = getDb();
    const normalizedEmail = email.trim().toLowerCase();
    const user = db.users.find((u) => u.email.toLowerCase() === normalizedEmail);

    if (!user) {
      return res.status(401).json({ error: { message: 'Invalid email or password' } });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: { message: 'Invalid email or password' } });
    }

    const token = jwt.sign({ userId: user.id }, getSecret(), { expiresIn: '7d' });

    return res.json({
      data: {
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email
        }
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: { message: 'Internal server error' } });
  }
});

router.get('/me', auth, (req, res) => {
  return res.json({
    data: {
      user: req.user
    }
  });
});

export default router;
