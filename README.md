# Student Management System

A beginner-friendly REST API for registering users, signing in, and managing student records. It uses MongoDB to store data and JSON Web Tokens (JWTs) to protect student endpoints.

## Objective

The project demonstrates authentication, password hashing, role-based access, MongoDB CRUD operations, search, filtering, sorting, and pagination in a Node.js backend.

## Technology

- Node.js and JavaScript (CommonJS)
- Express
- MongoDB and Mongoose
- bcryptjs and jsonwebtoken
- dotenv and cors
- nodemon for development
- Node's built-in test runner, Supertest, and mongodb-memory-server for API integration tests

## Project structure

```text
student-management-system/
├── config/
│   └── db.js
├── controllers/
│   ├── authController.js
│   └── studentController.js
├── middleware/
│   ├── authMiddleware.js
│   ├── errorMiddleware.js
│   └── roleMiddleware.js
├── models/
│   ├── Student.js
│   └── User.js
├── routes/
│   ├── authRoutes.js
│   └── studentRoutes.js
├── scripts/
│   └── createAdmin.js
├── test/
│   └── api.test.js
├── .env.example
├── .gitignore
├── app.js
├── package.json
├── README.md
└── server.js
```

## Requirements and installation

Install Node.js 20 or newer and have access to a MongoDB server, either locally or through MongoDB Atlas.

1. Install the project packages:

   ```bash
   npm install
   ```

2. Make a private `.env` file by copying `.env.example`. For example, on Windows PowerShell:

   ```powershell
   Copy-Item .env.example .env
   ```

3. Set the values in `.env`:

   ```dotenv
   PORT=3000
   MONGODB_URI=mongodb://127.0.0.1:27017/student_management_system
   JWT_SECRET=put-a-private-random-secret-of-at-least-32-characters-here
   JWT_EXPIRES_IN=1d

   ADMIN_NAME=System Administrator
   ADMIN_EMAIL=admin@example.com
   ADMIN_PASSWORD=use-a-unique-password-of-at-least-12-characters
   ```

   Generate a private random JWT secret; do not use the example value in a real deployment or share your `.env` file. `.env` is excluded from Git.

4. Start MongoDB. For a local MongoDB installation, make sure the MongoDB service is running. For MongoDB Atlas, create a database user, allow your client IP address, and put the Atlas connection string in `MONGODB_URI`. URL-encode special characters in the connection-string password.

5. Create the first Admin account:

   ```bash
   npm run seed:admin
   ```

   The command requires `ADMIN_NAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, and `JWT_SECRET` in `.env`. Admin passwords must be at least 12 characters. The script refuses to change an existing account's role.

   The provided local MongoDB URI selects the `student_management_system` database. MongoDB creates it automatically when the Admin account or the first API record is saved. You can open that database in MongoDB Compass by connecting to `mongodb://127.0.0.1:27017` and selecting `student_management_system`.

## Run the server

Start normally:

```bash
npm start
```

Or start with automatic restart during development:

```bash
npm run dev
```

The API listens on port 3000 by default (or the `PORT` in `.env`). It only starts after connecting to MongoDB. Visit `http://localhost:3000/` for the API welcome page, or `GET /api/health` for a JSON health check.

## Authentication and roles

Register a normal account at `POST /api/auth/register`; public registration always assigns the `Student` role and ignores any requested role. Passwords are hashed with bcrypt before storage. Sign in at `POST /api/auth/login` to receive a JWT.

For student endpoints, include this HTTP header:

```text
Authorization: Bearer YOUR_JWT_TOKEN
```

- **Admin:** Can create, view, update, and delete student records.
- **Student:** Can view the list and individual records, but cannot create, update, or delete them. Admin-only actions return HTTP `403`.

The Admin account is created through the private seed script rather than public registration. Keep the JWT secret and Admin password private.

## API endpoints

| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/` | Public | Show the API welcome page |
| `POST` | `/api/auth/register` | Public | Register a Student |
| `POST` | `/api/auth/login` | Public | Log in and receive a JWT |
| `GET` | `/api/health` | Public | Check that the API is running |
| `POST` | `/api/students` | Admin | Add a student |
| `GET` | `/api/students` | Admin or Student | List, search, filter, sort, and paginate students |
| `GET` | `/api/students/:id` | Admin or Student | Get one student |
| `PUT` | `/api/students/:id` | Admin | Update student fields |
| `DELETE` | `/api/students/:id` | Admin | Delete a student |

A student record requires `name`, `email`, `age`, `marks`, `city`, and `department`. Student email addresses must be unique. Ages must be whole numbers from 0 to 120; marks must be non-negative numbers.

### Example requests

Register:

```http
POST /api/auth/register
Content-Type: application/json

{
  "name": "Asha Kumar",
  "email": "asha@example.com",
  "password": "a-private-password"
}
```

Log in and copy the returned `token`:

```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "admin@example.com",
  "password": "the-admin-password-from-your-env-file"
}
```

Add a student (Admin token required):

```http
POST /api/students
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "name": "Asha Kumar",
  "email": "asha.student@example.com",
  "age": 20,
  "marks": 88,
  "city": "Patna",
  "department": "CSE"
}
```

Update a student by replacing `STUDENT_ID` with its MongoDB `_id`:

```http
PUT /api/students/STUDENT_ID
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "city": "Delhi"
}
```

Delete or fetch one student using `DELETE /api/students/STUDENT_ID` or `GET /api/students/STUDENT_ID`; both require authentication, and deletion requires an Admin token.

### Search, filtering, and sorting

`GET /api/students` supports these query parameters. Filters can be combined.

| Parameter | Example | Meaning |
|---|---|---|
| `city` | `?city=Patna` | Match a city (case-insensitive) |
| `department` | `?department=CSE` | Match a department (case-insensitive) |
| `minMarks` | `?minMarks=70` | Marks greater than or equal to this value |
| `minAge`, `maxAge` | `?minAge=18&maxAge=25` | Inclusive age range |
| `sortBy`, `order` | `?sortBy=marks&order=asc` | Sort marks ascending or descending |

Examples:

```text
GET /api/students?city=Patna
GET /api/students?department=CSE
GET /api/students?minMarks=70
GET /api/students?minAge=18&maxAge=25
GET /api/students?sortBy=marks&order=desc
GET /api/students?city=Patna&department=CSE&sortBy=marks&order=asc
```

### Pagination

Use `page` (starting at 1) and `limit` (from 1 through 100). The default page is 1 and the default limit is 10.

```text
GET /api/students?page=1&limit=5
GET /api/students?city=Patna&sortBy=marks&order=desc&page=2&limit=5
```

List responses include `currentPage`, `totalStudents` (after filters), `totalPages`, `pageLimit`, and the `students` array. The list is ordered by MongoDB ID unless a sort is requested.

## Test with Postman

1. Start the server and connect it to MongoDB.
2. Send `POST http://localhost:3000/api/auth/register` with a name, email, and password. Registration creates a Student account.
3. Send `POST http://localhost:3000/api/auth/login` for the Admin account or the new Student account. Copy the `token` from the response.
4. For requests to `/api/students`, add an `Authorization` header with value `Bearer YOUR_JWT_TOKEN`.
5. Use the endpoints above to test listing, creating, reading by ID, updating, deleting, and combining query parameters. Try write requests with a Student token to verify they return `403`.
6. To test missing and invalid credentials, omit the header or change the token. These requests should return `401`.

## Automated API tests

Run the integration tests with:

```bash
npm test
```

The test suite starts a temporary MongoDB instance, exercises the authentication and student API (including role checks, invalid requests, filtering, sorting, and pagination), and stops the temporary database afterward. It does not need your production MongoDB URI or use production records.

## Project workflow

1. Express receives a request and sends it to the matching route.
2. For student routes, authentication middleware verifies the signed JWT. Admin-only routes also check the role in the verified token.
3. Controllers validate inputs, call the Mongoose models, and return suitable HTTP status codes and JSON responses.
4. Mongoose validates and stores users and students in MongoDB. User passwords are hashed before they are saved.
5. The shared error middleware handles database conflicts and validation errors.

## Important files

- `server.js`: loads environment variables, checks the JWT secret, connects MongoDB, and starts the server.
- `config/db.js`: connects to MongoDB and reports missing connection configuration.
- `models/User.js`: defines user roles and hashes passwords before storing them.
- `models/Student.js`: defines and validates student records.
- `controllers/authController.js`: registers Students and checks passwords to issue login tokens.
- `controllers/studentController.js`: implements student CRUD, filters, sorting, and pagination.
- `middleware/authMiddleware.js`: verifies JWTs; `middleware/roleMiddleware.js` restricts Admin-only actions.
- `scripts/createAdmin.js`: securely creates the initial Admin from private environment variables.
- `test/api.test.js`: exercises the API against a temporary MongoDB database.

## Configuration needed before starting

Copy `.env.example` to `.env`, set a real MongoDB connection string and a private JWT secret of at least 32 characters, and ensure MongoDB is reachable. Set a strong Admin password before running `npm run seed:admin`. Do not commit `.env` or share its secrets.
