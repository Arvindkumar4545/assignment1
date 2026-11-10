const mongoose = require('mongoose');
const Student = require('../models/Student');

const studentFields = ['name', 'email', 'age', 'marks', 'city', 'department'];

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function readStudentData(body, partial = false) {
  const data = {};
  const suppliedFields = Object.keys(body);
  const unknownFields = suppliedFields.filter((field) => !studentFields.includes(field));

  if (unknownFields.length > 0) {
    return { error: `Unsupported student field: ${unknownFields[0]}.` };
  }

  for (const field of studentFields) {
    if (Object.prototype.hasOwnProperty.call(body, field)) {
      data[field] = typeof body[field] === 'string' ? body[field].trim() : body[field];
    }
  }

  if (!partial) {
    const missingField = studentFields.find(
      (field) => data[field] === undefined || data[field] === ''
    );
    if (missingField) {
      return { error: `${missingField} is required.` };
    }
  } else if (Object.keys(data).length === 0) {
    return { error: 'Provide at least one student field to update.' };
  }

  if (data.email !== undefined && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    return { error: 'Enter a valid email address.' };
  }

  return { data };
}

function buildStudentFilter(query) {
  const filter = {};

  if (query.search !== undefined) {
    if (typeof query.search !== 'string' || query.search.trim().length > 100) {
      return { error: 'search must be text no longer than 100 characters.' };
    }

    const search = query.search.trim();
    if (search) {
      const searchPattern = new RegExp(escapeRegex(search), 'i');
      filter.$or = ['name', 'email', 'city', 'department'].map((field) => ({
        [field]: searchPattern
      }));
    }
  }

  for (const field of ['city', 'department']) {
    if (query[field] !== undefined) {
      if (typeof query[field] !== 'string' || !query[field].trim()) {
        return { error: `${field} must be a non-empty value.` };
      }
      filter[field] = new RegExp(`^${escapeRegex(query[field].trim())}$`, 'i');
    }
  }

  if (query.minMarks !== undefined) {
    const minMarks = Number(query.minMarks);
    if (!Number.isFinite(minMarks) || minMarks < 0) {
      return { error: 'minMarks must be a non-negative number.' };
    }
    filter.marks = { $gte: minMarks };
  }

  const ageRange = {};
  for (const field of ['minAge', 'maxAge']) {
    if (query[field] !== undefined) {
      const age = Number(query[field]);
      if (!Number.isInteger(age) || age < 0 || age > 120) {
        return { error: `${field} must be a whole number between 0 and 120.` };
      }
      ageRange[field === 'minAge' ? '$gte' : '$lte'] = age;
    }
  }

  if (
    ageRange.$gte !== undefined &&
    ageRange.$lte !== undefined &&
    ageRange.$gte > ageRange.$lte
  ) {
    return { error: 'minAge cannot be greater than maxAge.' };
  }
  if (Object.keys(ageRange).length > 0) {
    filter.age = ageRange;
  }

  return { filter };
}

function parsePageNumber(value, field, fallback, maximum = Number.MAX_SAFE_INTEGER) {
  if (value === undefined) {
    return { value: fallback };
  }

  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 1 || number > maximum) {
    return { error: `${field} must be a whole number between 1 and ${maximum}.` };
  }
  return { value: number };
}

async function createStudent(req, res, next) {
  try {
    const result = readStudentData(req.body);
    if (result.error) {
      return res.status(400).json({ message: result.error });
    }

    const student = await Student.create(result.data);
    return res.status(201).json({ message: 'Student created.', student });
  } catch (error) {
    return next(error);
  }
}

async function getStudents(req, res, next) {
  try {
    const filterResult = buildStudentFilter(req.query);
    if (filterResult.error) {
      return res.status(400).json({ message: filterResult.error });
    }

    const pageResult = parsePageNumber(req.query.page, 'page', 1);
    const limitResult = parsePageNumber(req.query.limit, 'limit', 10, 100);
    if (pageResult.error) {
      return res.status(400).json({ message: pageResult.error });
    }
    if (limitResult.error) {
      return res.status(400).json({ message: limitResult.error });
    }

    if (req.query.sortBy !== undefined && req.query.sortBy !== 'marks') {
      return res.status(400).json({ message: 'sortBy must be marks.' });
    }
    const order = req.query.order === undefined ? 'asc' : req.query.order;
    if (order !== 'asc' && order !== 'desc') {
      return res.status(400).json({ message: 'order must be asc or desc.' });
    }

    const { page: currentPage, limit: pageLimit } = {
      page: pageResult.value,
      limit: limitResult.value
    };
    const filter = filterResult.filter;
    const sort = req.query.sortBy === 'marks' ? { marks: order === 'asc' ? 1 : -1 } : { _id: 1 };
    const totalStudents = await Student.countDocuments(filter);
    const students = await Student.find(filter)
      .sort(sort)
      .skip((currentPage - 1) * pageLimit)
      .limit(pageLimit)
      .lean();

    return res.status(200).json({
      currentPage,
      totalStudents,
      totalPages: Math.ceil(totalStudents / pageLimit),
      pageLimit,
      students
    });
  } catch (error) {
    return next(error);
  }
}

async function getStudentStats(req, res, next) {
  try {
    const [totalStudents, marksSummary, cities, departments] = await Promise.all([
      Student.countDocuments(),
      Student.aggregate([{ $group: { _id: null, average: { $avg: '$marks' } } }]),
      Student.distinct('city'),
      Student.distinct('department')
    ]);

    return res.status(200).json({
      totalStudents,
      averageMarks: marksSummary.length ? Math.round(marksSummary[0].average * 10) / 10 : 0,
      cities: cities.sort((first, second) => first.localeCompare(second)),
      departments: departments.sort((first, second) => first.localeCompare(second)),
      citiesCount: cities.length,
      departmentsCount: departments.length
    });
  } catch (error) {
    return next(error);
  }
}

async function getStudentById(req, res, next) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Student ID is not a valid MongoDB ID.' });
    }

    const student = await Student.findById(req.params.id);
    if (!student) {
      return res.status(404).json({ message: 'Student not found.' });
    }

    return res.status(200).json({ student });
  } catch (error) {
    return next(error);
  }
}

async function updateStudent(req, res, next) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Student ID is not a valid MongoDB ID.' });
    }

    const result = readStudentData(req.body, true);
    if (result.error) {
      return res.status(400).json({ message: result.error });
    }

    const student = await Student.findByIdAndUpdate(req.params.id, result.data, {
      new: true,
      runValidators: true
    });
    if (!student) {
      return res.status(404).json({ message: 'Student not found.' });
    }

    return res.status(200).json({ message: 'Student updated.', student });
  } catch (error) {
    return next(error);
  }
}

async function deleteStudent(req, res, next) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Student ID is not a valid MongoDB ID.' });
    }

    const student = await Student.findByIdAndDelete(req.params.id);
    if (!student) {
      return res.status(404).json({ message: 'Student not found.' });
    }

    return res.status(200).json({ message: 'Student deleted.' });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  createStudent,
  getStudents,
  getStudentStats,
  getStudentById,
  updateStudent,
  deleteStudent
};
