const express = require('express');
const cors = require('cors');
const { pool } = require('./db');
const { router: authRouter } = require('./auth');
const restRouter = require('./rest');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.get('/health', (req, res) => {
  res.json({ ok: true, service: 'ots-backend', time: new Date().toISOString() });
});

app.get('/health/db', async (req, res) => {
  try {
    const r = await pool.query('SELECT current_database(), current_user, now()');
    res.json({ ok: true, ...r.rows[0] });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.use('/auth/v1', authRouter);
app.use('/rest/v1', restRouter);

app.use((req, res) => res.status(404).json({ error: 'Not found' }));

module.exports = app;
