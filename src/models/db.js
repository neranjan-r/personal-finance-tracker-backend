import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../../data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

const DEFAULT_DATA = {
  users: [],
  transactions: [],
  budgets: [],
  categories: {
    income: ['Salary', 'Freelance', 'Investments', 'Gifts', 'Other'],
    expense: ['Food', 'Rent', 'Utilities', 'Transportation', 'Entertainment', 'Healthcare', 'Shopping', 'Other']
  }
};

let db = { ...DEFAULT_DATA };
let isLoaded = false;

export const initDb = async () => {
  if (isLoaded) return;
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      db = { ...DEFAULT_DATA, ...JSON.parse(raw) };
    } else {
      fs.writeFileSync(DB_FILE, JSON.stringify(DEFAULT_DATA, null, 2), 'utf-8');
    }
    isLoaded = true;
  } catch (err) {
    console.error('Error initializing database:', err);
    db = { ...DEFAULT_DATA };
    isLoaded = true;
  }
};

export const saveDb = async () => {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    await fs.promises.writeFile(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to persist database:', err);
  }
};

export const getDb = () => db;
