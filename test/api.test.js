const { after, before, test } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../app');
const connectDatabase = require('../config/db');
const Student = require('../models/Student');
const User = require('../models/User');

process.env.JWT_SECRET = 'test-secret-with-more-than-thirty-two-characters';

let mongoServer;
let adminToken;
let studentToken;
let firstStudentId;
let protectedStudentId;

const studentsToCreate = [
  { name: 'Asha Kumar', email: 'asha@example.com', age: 20, marks: 81, city: 'Patna', department: 'CSE' },
  { name: 'Ravi Singh', email: 'ravi@example.com', age: 22, marks: 65, city: 'Patna', department: 'ECE' },
  { name: 'Mina Das', email: 'mina@example.com', age: 19, marks: 92, city: 'Delhi', department: 'CSE' },
  { name: 'Kabir Roy', email: 'kabir@example.com', age: 25, marks: 74, city: 'Patna', department: 'CSE' }
];

before(async () => {
  mongoServer = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongoServer.getUri();
  await connectDatabase(mongoServer.getUri());
});

after(async () => {
  const mongoose = require('mongoose');
  await mongoose.disconnect();
  if (mongoServer) {
    await mongoServer.stop();
  }
});

test('serves the dashboard at the root and all direct frontend routes', async (t) => {
  await t.test('shows the dashboard from the root', async () => {
    const response = await request(app).get('/');
    assert.equal(response.status, 200);
    assert.match(response.headers['content-type'], /text\/html/);
    assert.match(response.text, /CampusFlow/);
    assert.match(response.text, /\/styles\.css/);
    assert.match(response.text, /\/app\.js/);
  });

  for (const route of [
    '/auth/register',
    '/auth/login',
    '/students',
    '/students/507f1f77bcf86cd799439011'
  ]) {
    await t.test(`serves the frontend at ${route}`, async () => {
      const response = await request(app).get(route);
      assert.equal(response.status, 200);
      assert.match(response.headers['content-type'], /text\/html/);
      assert.match(response.text, /CampusFlow/);
    });
  }
});

test('keeps API registration and login routes separate from browser pages', async () => {
  const registrationPage = await request(app).get('/auth/register');
  assert.equal(registrationPage.status, 200);
  assert.match(registrationPage.text, /id="auth-form"/);
  assert.match(registrationPage.text, /id="auth-name"/);
  assert.match(registrationPage.text, /src="\/app\.js"/);

  const apiRegistration = await request(app).post('/api/auth/register').send({
    name: 'Route Check Student',
    email: 'route-check@example.com',
    password: 'route-check-password'
  });
  assert.equal(apiRegistration.status, 201);

  const apiLogin = await request(app).post('/api/auth/login').send({
    email: 'route-check@example.com',
    password: 'route-check-password'
  });
  assert.equal(apiLogin.status, 200);
  assert.equal(typeof apiLogin.body.token, 'string');
});

test('serves the frontend JavaScript and stylesheet', async () => {
  const script = await request(app).get('/app.js');
  assert.equal(script.status, 200);
  assert.match(script.headers['content-type'], /javascript/);
  assert.match(script.text, /\/api\/students/);

  const stylesheet = await request(app).get('/styles.css');
  assert.equal(stylesheet.status, 200);
  assert.match(stylesheet.headers['content-type'], /text\/css/);
});

test('authentication registration, duplicate email, and login', async (t) => {
  await t.test('registers a student even when the request asks for Admin', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Test Student',
        email: 'student@example.com',
        password: 'student-pass-123',
        role: 'Admin'
      });

    assert.equal(response.status, 201);
    assert.equal(response.body.user.role, 'Student');
    assert.equal(Object.hasOwn(response.body.user, 'password'), false);
    const storedUser = await User.findOne({ email: 'student@example.com' }).select('+password');
    assert.notEqual(storedUser.password, 'student-pass-123');
    assert.equal(await require('bcryptjs').compare('student-pass-123', storedUser.password), true);
  });

  await t.test('rejects duplicate email and invalid registration data', async () => {
    const duplicate = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Another Student', email: 'STUDENT@example.com', password: 'student-pass-123' });
    assert.equal(duplicate.status, 409);

    const invalid = await request(app)
      .post('/api/auth/register')
      .send({ name: 'A', email: 'not-an-email', password: 'short' });
    assert.equal(invalid.status, 400);

    const invalidJson = await request(app)
      .post('/api/auth/register')
      .set('Content-Type', 'application/json')
      .send('{"name":');
    assert.equal(invalidJson.status, 400);
  });

  await t.test('creates the first Admin securely and does not change an existing role', async () => {
    process.env.ADMIN_NAME = 'Test Administrator';
    process.env.ADMIN_EMAIL = 'admin@example.com';
    process.env.ADMIN_PASSWORD = 'admin-pass-12345';

    const createAdmin = require('../scripts/createAdmin');
    await createAdmin();

    const admin = await User.findOne({ email: process.env.ADMIN_EMAIL }).select('+password');
    assert.equal(admin.role, 'Admin');
    assert.notEqual(admin.password, process.env.ADMIN_PASSWORD);
    await assert.rejects(createAdmin(), /already belongs to an account/);
    assert.equal((await User.findById(admin._id)).role, 'Admin');
  });

  await t.test('logs in with correct credentials and rejects an incorrect password', async () => {
    const studentLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'student@example.com', password: 'student-pass-123' });
    assert.equal(studentLogin.status, 200);
    assert.equal(studentLogin.body.user.role, 'Student');
    assert.equal(typeof studentLogin.body.token, 'string');
    studentToken = studentLogin.body.token;

    const adminLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@example.com', password: 'admin-pass-12345' });
    assert.equal(adminLogin.status, 200);
    adminToken = adminLogin.body.token;

    const wrongPassword = await request(app)
      .post('/api/auth/login')
      .send({ email: 'student@example.com', password: 'incorrect-password' });
    assert.equal(wrongPassword.status, 401);
  });
});

test('student endpoints require authentication and enforce roles', async (t) => {
  await t.test('rejects missing and invalid tokens', async () => {
    const missing = await request(app).get('/api/students');
    assert.equal(missing.status, 401);

    const invalid = await request(app)
      .get('/api/students')
      .set('Authorization', 'Bearer not-a-valid-token');
    assert.equal(invalid.status, 401);

    const expiredToken = jwt.sign(
      { role: 'Student' },
      process.env.JWT_SECRET,
      { subject: '000000000000000000000000', expiresIn: -1 }
    );
    const expired = await request(app)
      .get('/api/students')
      .set('Authorization', `Bearer ${expiredToken}`);
    assert.equal(expired.status, 401);
  });

  await t.test('allows an Admin to create student records and rejects invalid IDs/data', async () => {
    const response = await request(app)
      .post('/api/students')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(studentsToCreate[0]);
    assert.equal(response.status, 201);
    firstStudentId = response.body.student._id;

    const invalid = await request(app)
      .post('/api/students')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'No Email' });
    assert.equal(invalid.status, 400);

    const duplicate = await request(app)
      .post('/api/students')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(studentsToCreate[0]);
    assert.equal(duplicate.status, 409);
  });

  await t.test('allows Students to view records but not create, update, or delete', async () => {
    const created = await Student.create(studentsToCreate.slice(1));
    protectedStudentId = created[0]._id.toString();

    const list = await request(app)
      .get('/api/students')
      .set('Authorization', `Bearer ${studentToken}`);
    assert.equal(list.status, 200);
    assert.equal(list.body.totalStudents, 4);

    const detail = await request(app)
      .get(`/api/students/${firstStudentId}`)
      .set('Authorization', `Bearer ${studentToken}`);
    assert.equal(detail.status, 200);

    const create = await request(app)
      .post('/api/students')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ ...studentsToCreate[0], email: 'another@example.com' });
    assert.equal(create.status, 403);

    const update = await request(app)
      .put(`/api/students/${protectedStudentId}`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ city: 'Mumbai' });
    assert.equal(update.status, 403);

    const remove = await request(app)
      .delete(`/api/students/${protectedStudentId}`)
      .set('Authorization', `Bearer ${studentToken}`);
    assert.equal(remove.status, 403);
    assert.ok(await Student.findById(protectedStudentId));
  });
});

test('Admin can read, update, and delete student records', async (t) => {
  await t.test('reads a student by ID and reports invalid or missing IDs', async () => {
    const detail = await request(app)
      .get(`/api/students/${firstStudentId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    assert.equal(detail.status, 200);
    assert.equal(detail.body.student.email, studentsToCreate[0].email);

    const invalidId = await request(app)
      .get('/api/students/not-an-object-id')
      .set('Authorization', `Bearer ${adminToken}`);
    assert.equal(invalidId.status, 400);

    const missing = await request(app)
      .get('/api/students/000000000000000000000000')
      .set('Authorization', `Bearer ${adminToken}`);
    assert.equal(missing.status, 404);
  });

  await t.test('updates a student and rejects empty or invalid updates', async () => {
    const updated = await request(app)
      .put(`/api/students/${firstStudentId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ city: 'Mumbai', marks: 88 });
    assert.equal(updated.status, 200);
    assert.equal(updated.body.student.city, 'Mumbai');
    assert.equal(updated.body.student.marks, 88);

    const empty = await request(app)
      .put(`/api/students/${firstStudentId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});
    assert.equal(empty.status, 400);

    const invalid = await request(app)
      .put(`/api/students/${firstStudentId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ age: -1 });
    assert.equal(invalid.status, 400);
  });

  await t.test('deletes a student and reports a missing record', async () => {
    const deleted = await request(app)
      .delete(`/api/students/${firstStudentId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    assert.equal(deleted.status, 200);

    const missing = await request(app)
      .delete(`/api/students/${firstStudentId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    assert.equal(missing.status, 404);
  });
});

test('student search, filtering, sorting, and pagination work together', async (t) => {
  const getStudents = (query) => request(app)
    .get(`/api/students${query}`)
    .set('Authorization', `Bearer ${adminToken}`);

  await t.test('filters by city, department, minimum marks, and age range', async () => {
    assert.equal((await getStudents('?city=Patna')).body.totalStudents, 2);
    assert.equal((await getStudents('?department=CSE')).body.totalStudents, 2);
    assert.equal((await getStudents('?minMarks=70')).body.totalStudents, 2);
    assert.equal((await getStudents('?minAge=20&maxAge=25')).body.totalStudents, 2);
    assert.equal((await getStudents('?search=Kabir')).body.totalStudents, 1);
    assert.equal(
      (await getStudents('?search=Patna&department=CSE')).body.totalStudents,
      1
    );
  });

  await t.test('sorts marks in ascending and descending order', async () => {
    const ascending = await getStudents('?sortBy=marks&order=asc');
    assert.deepEqual(ascending.body.students.map((student) => student.marks), [65, 74, 92]);

    const descending = await getStudents('?sortBy=marks&order=desc');
    assert.deepEqual(descending.body.students.map((student) => student.marks), [92, 74, 65]);
  });

  await t.test('paginates results and combines filters, sorting, and pagination', async () => {
    const page = await getStudents('?page=2&limit=2&sortBy=marks&order=asc');
    assert.equal(page.status, 200);
    assert.equal(page.body.currentPage, 2);
    assert.equal(page.body.totalStudents, 3);
    assert.equal(page.body.totalPages, 2);
    assert.equal(page.body.pageLimit, 2);
    assert.deepEqual(page.body.students.map((student) => student.marks), [92]);

    const combined = await getStudents(
      '?city=Patna&department=CSE&minMarks=70&minAge=20&maxAge=25&sortBy=marks&order=desc&page=1&limit=1'
    );
    assert.equal(combined.body.totalStudents, 1);
    assert.equal(combined.body.totalPages, 1);
    assert.equal(combined.body.students[0].email, 'kabir@example.com');
  });

  await t.test('rejects invalid filters and pagination', async () => {
    assert.equal((await getStudents('?page=0')).status, 400);
    assert.equal((await getStudents('?limit=101')).status, 400);
    assert.equal((await getStudents('?minAge=30&maxAge=20')).status, 400);
    assert.equal((await getStudents('?sortBy=email')).status, 400);
    assert.equal((await getStudents(`?search=${'a'.repeat(101)}`)).status, 400);
  });
});

test('returns student summary statistics from MongoDB', async () => {
  const response = await request(app)
    .get('/api/students/stats')
    .set('Authorization', `Bearer ${adminToken}`);

  assert.equal(response.status, 200);
  assert.equal(response.body.totalStudents, 3);
  assert.equal(response.body.averageMarks, 77);
  assert.equal(response.body.citiesCount, 2);
  assert.equal(response.body.departmentsCount, 2);
  assert.deepEqual(response.body.cities, ['Delhi', 'Patna']);
  assert.deepEqual(response.body.departments, ['CSE', 'ECE']);
});
