import express from 'express';
import crypto from 'crypto';
import { getDb, saveDb } from '../models/db.js';
import { auth } from '../middleware/auth.js';

const router = express.Router();
router.use(auth);

router.get('/', (req, res) => {
  const db = getDb();
  const userId = req.user.id;

  let page = parseInt(req.query.page, 10) || 1;
  let limit = parseInt(req.query.limit, 10) || 10;
  if (page < 1) page = 1;
  if (limit < 1) limit = 10;

  const { type, category, from, to, search } = req.query;

  let userTx = (db.transactions || []).filter((tx) => tx.userId === userId);

  if (type && type !== 'all') {
    userTx = userTx.filter((tx) => tx.type === type);
  }

  if (category && category !== 'all') {
    userTx = userTx.filter((tx) => tx.category.toLowerCase() === category.toLowerCase());
  }

  if (from) {
    const fromDate = from.slice(0, 10);
    userTx = userTx.filter((tx) => tx.date.slice(0, 10) >= fromDate);
  }

  if (to) {
    const toDate = to.slice(0, 10);
    userTx = userTx.filter((tx) => tx.date.slice(0, 10) <= toDate);
  }

  if (search && search.trim()) {
    const query = search.trim().toLowerCase();
    userTx = userTx.filter(
      (tx) =>
        (tx.note && tx.note.toLowerCase().includes(query)) ||
        (tx.category && tx.category.toLowerCase().includes(query))
    );
  }

  // Sort descending by date, then createdAt
  userTx.sort((a, b) => {
    const dateComp = b.date.localeCompare(a.date);
    if (dateComp !== 0) return dateComp;
    return (b.createdAt || '').localeCompare(a.createdAt || '');
  });

  const total = userTx.length;
  const totalPages = Math.ceil(total / limit) || 1;
  const startIndex = (page - 1) * limit;
  const items = userTx.slice(startIndex, startIndex + limit);

  return res.json({
    data: {
      items,
      page,
      limit,
      total,
      totalPages
    }
  });
});

router.post('/', async (req, res) => {
  try {
    const { type, category, amount, date, note } = req.body;

    if (!type || !['income', 'expense'].includes(type)) {
      return res.status(400).json({ error: { message: 'Type must be either "income" or "expense"' } });
    }

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({ error: { message: 'Amount must be a positive number' } });
    }

    if (!category || !category.trim()) {
      return res.status(400).json({ error: { message: 'Category is required' } });
    }

    if (!date) {
      return res.status(400).json({ error: { message: 'Date is required' } });
    }

    const db = getDb();
    const newTx = {
      id: crypto.randomUUID(),
      userId: req.user.id,
      type,
      category: category.trim(),
      amount: Math.round(parsedAmount * 100) / 100,
      date: date.slice(0, 10),
      note: (note || '').trim(),
      createdAt: new Date().toISOString()
    };

    if (!db.transactions) db.transactions = [];
    db.transactions.push(newTx);
    await saveDb();

    return res.status(201).json({ data: newTx });
  } catch (err) {
    console.error('Create transaction error:', err);
    return res.status(500).json({ error: { message: 'Failed to create transaction' } });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const db = getDb();
    const index = (db.transactions || []).findIndex(
      (tx) => tx.id === id && tx.userId === req.user.id
    );

    if (index === -1) {
      return res.status(404).json({ error: { message: 'Transaction not found' } });
    }

    const tx = db.transactions[index];
    const { type, category, amount, date, note } = req.body;

    if (type !== undefined) {
      if (!['income', 'expense'].includes(type)) {
        return res.status(400).json({ error: { message: 'Type must be "income" or "expense"' } });
      }
      tx.type = type;
    }

    if (amount !== undefined) {
      const parsedAmount = parseFloat(amount);
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        return res.status(400).json({ error: { message: 'Amount must be a positive number' } });
      }
      tx.amount = Math.round(parsedAmount * 100) / 100;
    }

    if (category !== undefined) {
      tx.category = category.trim();
    }

    if (date !== undefined) {
      tx.date = date.slice(0, 10);
    }

    if (note !== undefined) {
      tx.note = note.trim();
    }

    tx.updatedAt = new Date().toISOString();
    await saveDb();

    return res.json({ data: tx });
  } catch (err) {
    console.error('Update transaction error:', err);
    return res.status(500).json({ error: { message: 'Failed to update transaction' } });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const db = getDb();
    const index = (db.transactions || []).findIndex(
      (tx) => tx.id === id && tx.userId === req.user.id
    );

    if (index === -1) {
      return res.status(404).json({ error: { message: 'Transaction not found' } });
    }

    db.transactions.splice(index, 1);
    await saveDb();

    return res.json({ data: { success: true } });
  } catch (err) {
    console.error('Delete transaction error:', err);
    return res.status(500).json({ error: { message: 'Failed to delete transaction' } });
  }
});

export default router;
