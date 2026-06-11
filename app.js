const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');

const app = express();

const allowedOrigins = [
  process.env.CLIENT_URL,
  'http://localhost:5173',
  'http://localhost:3000'
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin) || process.env.NODE_ENV !== 'production') {
      callback(null, true);
    } else {
      callback(null, allowedOrigins[0] || true);
    }
  },
  credentials: true
}));

app.use(express.json());

app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    console.error('DB connection error:', err.message);
    res.status(500).json({ msg: 'Database connection failed' });
  }
});

app.get('/', (req, res) => res.json({ status: 'ok', message: 'Tasfiq Property Rental API' }));
app.get('/api', (req, res) => res.json({ status: 'ok', message: 'Tasfiq Property Rental API' }));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/properties', require('./routes/properties'));
app.use('/api/tenants', require('./routes/tenants'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/documents', require('./routes/documents'));

app.use((err, req, res, next) => {
  if (err.message?.includes('PDF') || err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ msg: err.message || 'Invalid file upload' });
  }
  console.error(err);
  res.status(500).json({ msg: err.message || 'Server error' });
});

module.exports = app;
