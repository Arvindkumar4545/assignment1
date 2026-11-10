const express = require('express');
const cors = require('cors');
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

app.get('/', (req, res) => {
  res.type('html').status(200).send(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Student Management System API</title>
    <style>
      body { margin: 0; padding: 48px 20px; background: #f3f6fb; color: #172033; font: 16px/1.6 system-ui, sans-serif; }
      main { max-width: 720px; margin: 0 auto; padding: 32px; border: 1px solid #e0e6ef; border-radius: 12px; background: white; }
      h1 { margin-top: 0; }
      code { padding: 2px 6px; border-radius: 4px; background: #eef2f8; }
      li { margin: 8px 0; }
      a { color: #185abd; }
    </style>
  </head>
  <body>
    <main>
      <h1>Student Management System</h1>
      <p>The backend API is running and connected to its MongoDB database.</p>
      <p>Use an API client such as Postman to register, sign in, and manage student records.</p>
      <h2>API endpoints</h2>
      <ul>
        <li><code>POST /api/auth/register</code> — register a Student account</li>
        <li><code>POST /api/auth/login</code> — sign in and get an access token</li>
        <li><code>/api/students</code> — view, search, and manage student records</li>
        <li><a href="/api/health">GET /api/health</a> — check API health</li>
      </ul>
      <p>Student record changes and Admin-only actions require an access token.</p>
    </main>
  </body>
</html>`);
});

app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});
app.use('/api/auth', authRoutes);
app.use('/api/students', studentRoutes);
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found.' });
});
app.use(errorHandler);

module.exports = app;
