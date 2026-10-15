require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const dns = require('dns');

dns.setServers(['8.8.8.8']);
const studentRoutes = require('./routes/studentRoutes');

const app = express();

app.use(cors({
  origin: [
    'http://localhost:5500',
    'http://127.0.0.1:5500',
    'https://dreamy-elf-3087af.netlify.app'
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type']
}));

app.use(express.json());


app.use(express.json());
const PORT = process.env.PORT || 5000;
const allowedOrigins = (process.env.FRONTEND_URL || 'http://127.0.0.1:5500,http://localhost:5500')
  .split(',').map(s => s.trim()).filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    // Allow non-browser tools such as curl/Postman; restrict browser origins when configured.
    if (!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('CORS blocked this origin. Add your frontend URL to FRONTEND_URL.'));
  }
}));
app.use(express.json({ limit: '100kb' }));

app.get('/', (_req, res) => res.json({ success: true, message: 'Student Management API is running.', endpoints: '/api/students' }));
app.get('/health', (_req, res) => res.json({ success: true, database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected' }));
app.use('/api/students', studentRoutes);

app.use((req, res) => res.status(404).json({ success: false, message: 'Endpoint not found.' }));
app.use((err, _req, res, _next) => {
  console.error(err.message);
  if (err.name === 'ValidationError' || err.name === 'CastError') {
    return res.status(400).json({ success: false, message: err.message });
  }
  if (err.message && err.message.startsWith('CORS blocked')) {
    return res.status(403).json({ success: false, message: err.message });
  }
  res.status(500).json({ success: false, message: 'Server error. Check the backend logs.' });
});

async function start() {
  if (!process.env.MONGODB_URI) {
    console.error('Missing MONGODB_URI. Create backend/.env from .env.example and add your Atlas URI.');
    process.exit(1);
  }
  try {
    await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
    console.log('Connected to MongoDB Atlas');
    app.listen(PORT, '0.0.0.0', () => console.log(`Student API listening on port ${PORT}`));
  } catch (err) {
    console.error('Could not connect to MongoDB:', err.message);
    process.exit(1);
  }
}
start();
