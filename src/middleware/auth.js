import jwt from 'jsonwebtoken';
import { getDb } from '../models/db.js';

export const auth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: { message: 'Authentication required. No token provided.' }
    });
  }

  const token = authHeader.split(' ')[1];
  try {
    const secret = process.env.JWT_SECRET || 'supersecret_finance_tracker_jwt_key_2026';
    const decoded = jwt.verify(token, secret);
    const db = getDb();
    const user = db.users.find((u) => u.id === decoded.userId);

    if (!user) {
      return res.status(401).json({
        error: { message: 'Invalid session. User not found.' }
      });
    }

    req.user = { id: user.id, name: user.name, email: user.email };
    next();
  } catch (err) {
    return res.status(401).json({
      error: { message: 'Session expired or invalid token.' }
    });
  }
};
