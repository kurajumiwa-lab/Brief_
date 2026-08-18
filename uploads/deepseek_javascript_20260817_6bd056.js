import express from 'express';
import { store, newId } from './store.js';

const app = express();
app.use(express.json());

app.get('/api/health', (req, res) => res.json({ ok: true }));

// Economic endpoints – you'll connect these to the real backend later
app.get('/api/economic/wallet', (req, res) => {
  res.json({ balance: 4820, pending: 850, currency: 'KES' });
});

app.get('/api/transactions', (req, res) => {
  res.json([]);
});

app.get('/api/circles', (req, res) => {
  res.json([]);
});

app.get('/api/signals', (req, res) => {
  res.json([]);
});

const PORT = process.env.PORT || 8787;
app.listen(PORT, () => console.log(`Brief server on :${PORT}`));

export default app;