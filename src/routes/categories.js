import express from 'express';
import { getDb } from '../models/db.js';

const router = express.Router();

router.get('/', (req, res) => {
  const db = getDb();
  return res.json({
    data: db.categories || {
      income: ['Salary', 'Freelance', 'Investments', 'Gifts', 'Other'],
      expense: ['Food', 'Rent', 'Utilities', 'Transportation', 'Entertainment', 'Healthcare', 'Shopping', 'Other']
    }
  });
});

export default router;
