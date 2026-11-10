require('dotenv').config();

const mongoose = require('mongoose');
const connectDatabase = require('../config/db');
const Student = require('../models/Student');

const sampleStudents = [
  { name: 'Aarav Kumar', email: 'aarav.kumar@example.com', age: 20, marks: 86, city: 'Patna', department: 'CSE' },
  { name: 'Ananya Sharma', email: 'ananya.sharma@example.com', age: 19, marks: 93, city: 'Delhi', department: 'IT' },
  { name: 'Rohan Singh', email: 'rohan.singh@example.com', age: 21, marks: 72, city: 'Lucknow', department: 'ECE' },
  { name: 'Priya Verma', email: 'priya.verma@example.com', age: 22, marks: 89, city: 'Patna', department: 'CSE' },
  { name: 'Aditya Das', email: 'aditya.das@example.com', age: 20, marks: 78, city: 'Kolkata', department: 'ME' },
  { name: 'Isha Gupta', email: 'isha.gupta@example.com', age: 18, marks: 95, city: 'Delhi', department: 'CSE' },
  { name: 'Kabir Roy', email: 'kabir.roy@example.com', age: 23, marks: 67, city: 'Kolkata', department: 'ECE' },
  { name: 'Meera Patel', email: 'meera.patel@example.com', age: 21, marks: 84, city: 'Ahmedabad', department: 'IT' },
  { name: 'Arjun Yadav', email: 'arjun.yadav@example.com', age: 24, marks: 76, city: 'Patna', department: 'ME' },
  { name: 'Sana Khan', email: 'sana.khan@example.com', age: 19, marks: 91, city: 'Lucknow', department: 'CSE' },
  { name: 'Dev Malhotra', email: 'dev.malhotra@example.com', age: 22, marks: 81, city: 'Jaipur', department: 'IT' },
  { name: 'Nisha Roy', email: 'nisha.roy@example.com', age: 20, marks: 88, city: 'Kolkata', department: 'ECE' }
];

async function seedStudents() {
  await connectDatabase();

  const result = await Student.bulkWrite(
    sampleStudents.map((student) => ({
      updateOne: {
        filter: { email: student.email },
        update: { $setOnInsert: student },
        upsert: true
      }
    })),
    { ordered: true }
  );

  console.log(
    `Sample student setup complete: ${result.upsertedCount} added, ` +
    `${sampleStudents.length - result.upsertedCount} already existed.`
  );
}

if (require.main === module) {
  seedStudents()
    .catch((error) => {
      console.error(`Could not add sample students: ${error.message}`);
      process.exitCode = 1;
    })
    .finally(async () => {
      await mongoose.disconnect();
    });
}

module.exports = { sampleStudents, seedStudents };
