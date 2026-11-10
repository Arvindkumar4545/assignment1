require('dotenv').config();

const User = require('../models/User');
const connectDatabase = require('../config/db');

async function createAdmin() {
  const { ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD, JWT_SECRET } = process.env;

  if (!JWT_SECRET || JWT_SECRET.length < 32) {
    throw new Error('Set a JWT_SECRET of at least 32 characters in your .env file.');
  }
  if (!ADMIN_NAME || !ADMIN_EMAIL || !ADMIN_PASSWORD) {
    throw new Error('Set ADMIN_NAME, ADMIN_EMAIL, and ADMIN_PASSWORD in your .env file.');
  }
  if (ADMIN_PASSWORD.length < 12 || ADMIN_PASSWORD.length > 128) {
    throw new Error('ADMIN_PASSWORD must be between 12 and 128 characters.');
  }

  await connectDatabase();

  const existingUser = await User.findOne({ email: ADMIN_EMAIL.trim().toLowerCase() });
  if (existingUser) {
    throw new Error('That email already belongs to an account; no role was changed.');
  }

  const admin = await User.create({
    name: ADMIN_NAME,
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
    role: 'Admin'
  });

  console.log(`Admin account created for ${admin.email}.`);
}

if (require.main === module) {
  createAdmin()
    .catch((error) => {
      console.error(`Could not create admin: ${error.message}`);
      process.exitCode = 1;
    })
    .finally(async () => {
      const mongoose = require('mongoose');
      await mongoose.disconnect();
    });
}

module.exports = createAdmin;
