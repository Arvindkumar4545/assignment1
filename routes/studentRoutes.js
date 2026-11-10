const express = require('express');
const {
  createStudent,
  getStudents,
  getStudentById,
  updateStudent,
  deleteStudent
} = require('../controllers/studentController');
const authenticateToken = require('../middleware/authMiddleware');
const authorizeRoles = require('../middleware/roleMiddleware');

const router = express.Router();

router.use(authenticateToken);
router.get('/', getStudents);
router.get('/:id', getStudentById);
router.post('/', authorizeRoles('Admin'), createStudent);
router.put('/:id', authorizeRoles('Admin'), updateStudent);
router.delete('/:id', authorizeRoles('Admin'), deleteStudent);

module.exports = router;
