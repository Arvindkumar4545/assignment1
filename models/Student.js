const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 100
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    },
    age: {
      type: Number,
      required: true,
      min: 0,
      max: 120,
      validate: Number.isInteger
    },
    marks: {
      type: Number,
      required: true,
      min: 0
    },
    city: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 100
    },
    department: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 100
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Student', studentSchema);
