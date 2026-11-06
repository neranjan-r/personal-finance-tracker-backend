import express from 'express';
import { getDb } from '../models/db.js';
import { auth } from '../middleware/auth.js';

const router = express.Router();
router.use(auth);

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

router.get('/summary', (req, res) => {
  const db = getDb();
  const userId = req.user.id;
  const { from, to } = req.query;

  let txs = (db.transactions || []).filter((tx) => tx.userId === userId);

  if (from) {
    const fromDate = from.slice(0, 10);
    txs = txs.filter((tx) => tx.date.slice(0, 10) >= fromDate);
  }

  if (to) {
    const toDate = to.slice(0, 10);
    txs = txs.filter((tx) => tx.date.slice(0, 10) <= toDate);
  }

  let totalIncome = 0;
  let totalExpense = 0;

  for (const tx of txs) {
    if (tx.type === 'income') {
      totalIncome += tx.amount || 0;
    } else if (tx.type === 'expense') {
      totalExpense += tx.amount || 0;
    }
  }

  totalIncome = Math.round(totalIncome * 100) / 100;
  totalExpense = Math.round(totalExpense * 100) / 100;
  const balance = Math.round((totalIncome - totalExpense) * 100) / 100;

  return res.json({
    data: {
      totalIncome,
      totalExpense,
      balance
    }
  });
});

router.get('/by-category', (req, res) => {
  const db = getDb();
  const userId = req.user.id;
  const { from, to, type = 'expense' } = req.query;

  let txs = (db.transactions || []).filter(
    (tx) => tx.userId === userId && tx.type === type
  );

  if (from) {
    const fromDate = from.slice(0, 10);
    txs = txs.filter((tx) => tx.date.slice(0, 10) >= fromDate);
  }

  if (to) {
    const toDate = to.slice(0, 10);
    txs = txs.filter((tx) => tx.date.slice(0, 10) <= toDate);
  }

  const categoryMap = {};
  let totalAmount = 0;

  for (const tx of txs) {
    const cat = tx.category || 'Other';
    const amt = tx.amount || 0;
    categoryMap[cat] = (categoryMap[cat] || 0) + amt;
    totalAmount += amt;
  }

  const data = Object.entries(categoryMap).map(([category, sum]) => {
    const roundedTotal = Math.round(sum * 100) / 100;
    const percent = totalAmount > 0 ? Math.round((sum / totalAmount) * 100) : 0;
    return {
      category,
      total: roundedTotal,
      percent
    };
  });

  // Sort descending by total
  data.sort((a, b) => b.total - a.total);

  return res.json({ data });
});

router.get('/monthly', (req, res) => {
  const db = getDb();
  const userId = req.user.id;
  const year = req.query.year || new Date().getUTCFullYear().toString();

  const userTxs = (db.transactions || []).filter(
    (tx) => tx.userId === userId && tx.date && tx.date.startsWith(`${year}-`)
  );

  const monthsData = MONTH_NAMES.map((name, index) => {
    const monthNumStr = String(index + 1).padStart(2, '0');
    const monthPrefix = `${year}-${monthNumStr}`;

    const monthTxs = userTxs.filter((tx) => tx.date.startsWith(monthPrefix));
    let income = 0;
    let expense = 0;

    for (const tx of monthTxs) {
      if (tx.type === 'income') {
        income += tx.amount || 0;
      } else if (tx.type === 'expense') {
        expense += tx.amount || 0;
      }
    }

    return {
      month: name,
      income: Math.round(income * 100) / 100,
      expense: Math.round(expense * 100) / 100
    };
  });

  return res.json({ data: monthsData });
});

export default router;
