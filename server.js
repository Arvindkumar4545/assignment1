require('dotenv').config();

const app = require('./app');
const connectDatabase = require('./config/db');

async function startServer() {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    throw new Error('JWT_SECRET is required and must be at least 32 characters long.');
  }

  await connectDatabase();

  const port = Number(process.env.PORT) || 3000;
  app.listen(port, () => {
    console.log(`Student Management System API is running on port ${port}.`);
  });
}

if (require.main === module) {
  startServer().catch((error) => {
    console.error(`Server failed to start: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = startServer;
