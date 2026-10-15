const express = require('express');
const mongoose = require('mongoose');
const Student = require('../models/Student');
const router = express.Router();

const validId = (id) => mongoose.isValidObjectId(id);

// GET /api/students — list students, optionally search by text
router.get('/', async (req, res, next) => {
  try {
    const search = String(req.query.search || '').trim();
    const filter = search ? {
      $or: [
        { studentId: { $regex: search, $options: 'i' } },
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { department: { $regex: search, $options: 'i' } }
      ]
    } : {};
    const students = await Student.find(filter).sort({ createdAt: -1 }).limit(500);
    res.json({ success: true, count: students.length, data: students });
  } catch (err) { next(err); }
});

// GET /api/students/:id — id may be MongoDB _id or studentId
router.get('/:id', async (req, res, next) => {
  try {
    const student = validId(req.params.id)
      ? await Student.findById(req.params.id)
      : await Student.findOne({ studentId: req.params.id });
    if (!student) return res.status(404).json({ success: false, message: 'Student not found.' });
    res.json({ success: true, data: student });
  } catch (err) { next(err); }
});

// POST /api/students — create
router.post('/', async (req, res, next) => {
  try {
    const { studentId, name, email, department, semester, contact = '' } = req.body;
    if (![studentId, name, email, department, semester].every(v => v !== undefined && String(v).trim() !== '')) {
      return res.status(400).json({ success: false, message: 'studentId, name, email, department and semester are required.' });
    }
    const student = await Student.create({ studentId, name, email, department, semester: Number(semester), contact });
    res.status(201).json({ success: true, message: 'Student added successfully.', data: student });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ success: false, message: 'That Student ID already exists.' });
    next(err);
  }
});

// PUT /api/students/:id — update by MongoDB _id or studentId
router.put('/:id', async (req, res, next) => {
  try {
    const allowed = ['studentId', 'name', 'email', 'department', 'semester', 'contact'];
    const updates = {};
    for (const key of allowed) if (req.body[key] !== undefined) updates[key] = key === 'semester' ? Number(req.body[key]) : req.body[key];
    if (Object.keys(updates).length === 0) return res.status(400).json({ success: false, message: 'Provide at least one field to update.' });
    const student = validId(req.params.id)
      ? await Student.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true })
      : await Student.findOneAndUpdate({ studentId: req.params.id }, updates, { new: true, runValidators: true });
    if (!student) return res.status(404).json({ success: false, message: 'Student not found.' });
    res.json({ success: true, message: 'Student updated successfully.', data: student });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ success: false, message: 'That Student ID already exists.' });
    next(err);
  }
});

// DELETE /api/students/:id — delete by MongoDB _id or studentId
router.delete('/:id', async (req, res, next) => {
  try {
    const student = validId(req.params.id)
      ? await Student.findByIdAndDelete(req.params.id)
      : await Student.findOneAndDelete({ studentId: req.params.id });
    if (!student) return res.status(404).json({ success: false, message: 'Student not found.' });
    res.json({ success: true, message: 'Student deleted successfully.' });
  } catch (err) { next(err); }
});

module.exports = router;
