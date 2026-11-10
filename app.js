const express = require('express');
const cors = require('cors');
const path = require('path');
const authRoutes = require('./routes/authRoutes');
const studentRoutes = require('./routes/studentRoutes');
const errorHandler = require('./middleware/errorMiddleware');

const app = express();

app.use(cors());
app.use(express.json({ limit: '10kb' }));
app.use((req, res, next) => {
  req.body = req.body || {};
  next();
});

app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});
app.use('/api/auth', authRoutes);
app.use('/api/students', studentRoutes);
app.use(express.static(path.join(__dirname, 'public')));
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found.' });
});
app.use(errorHandler);

module.exports = app;
