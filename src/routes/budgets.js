import express from 'express';
import crypto from 'crypto';
import { getDb, saveDb } from '../models/db.js';
import { auth } from '../middleware/auth.js';

const router = express.Router();
router.use(auth);

const calculateBudgetStats = (budget, transactions, userId) => {
  const monthTx = transactions.filter(
    (tx) =>
      tx.userId === userId &&
      tx.type === 'expense' &&
      tx.date &&
      tx.date.slice(0, 7) === budget.month
  );

  let spent = 0;
  if (budget.category === 'ALL') {
    spent = monthTx.reduce((sum, tx) => sum + (tx.amount || 0), 0);
  } else {
    spent = monthTx
      .filter((tx) => tx.category.toLowerCase() === budget.category.toLowerCase())
      .reduce((sum, tx) => sum + (tx.amount || 0), 0);
  }

  spent = Math.round(spent * 100) / 100;
  const percentUsed = budget.limit > 0 ? Math.round((spent / budget.limit) * 100) : 0;
  const remaining = Math.round((budget.limit - spent) * 100) / 100;

  return {
    ...budget,
    spent,
    percentUsed,
    remaining
  };
};

router.get('/', (req, res) => {
  const db = getDb();
  const userId = req.user.id;
  const month = req.query.month || new Date().toISOString().slice(0, 7);

  const userBudgets = (db.budgets || []).filter(
    (b) => b.userId === userId && b.month === month
  );

  const transactions = db.transactions || [];
  const results = userBudgets.map((b) => calculateBudgetStats(b, transactions, userId));

  return res.json({ data: results });
});

router.put('/', async (req, res) => {
  try {
    const { month, category, limit } = req.body;
    const userId = req.user.id;

    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json({ error: { message: 'Valid month (YYYY-MM) is required' } });
    }

    if (!category) {
      return res.status(400).json({ error: { message: 'Category is required' } });
    }

    const parsedLimit = parseFloat(limit);
    if (isNaN(parsedLimit) || parsedLimit <= 0) {
      return res.status(400).json({ error: { message: 'Limit must be a positive number' } });
    }

    const db = getDb();
    if (!db.budgets) db.budgets = [];

    let budget = db.budgets.find(
      (b) => b.userId === userId && b.month === month && b.category.toLowerCase() === category.toLowerCase()
    );

    if (budget) {
      budget.limit = Math.round(parsedLimit * 100) / 100;
      budget.updatedAt = new Date().toISOString();
    } else {
      budget = {
        id: crypto.randomUUID(),
        userId,
        month,
        category,
        limit: Math.round(parsedLimit * 100) / 100,
        createdAt: new Date().toISOString()
      };
      db.budgets.push(budget);
    }

    await saveDb();

    const result = calculateBudgetStats(budget, db.transactions || [], userId);
    return res.json({ data: result });
  } catch (err) {
    console.error('Save budget error:', err);
    return res.status(500).json({ error: { message: 'Failed to save budget' } });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const db = getDb();
    const index = (db.budgets || []).findIndex(
      (b) => b.id === id && b.userId === req.user.id
    );

    if (index === -1) {
      return res.status(404).json({ error: { message: 'Budget not found' } });
    }

    db.budgets.splice(index, 1);
    await saveDb();

    return res.json({ data: { success: true } });
  } catch (err) {
    console.error('Delete budget error:', err);
    return res.status(500).json({ error: { message: 'Failed to delete budget' } });
  }
});

export default router;
