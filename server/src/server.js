const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const dotenv = require('dotenv');
const mongoose = require('mongoose');

dotenv.config();

const app = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Routes Placeholder
app.get('/v1/health', (req, res) => {
  res.json({
    success: true,
    data: { status: 'Server is running', version: '1.0.0' },
    meta: {},
    error: null
  });
});

// Example route groups according to PRD
app.use('/v1/auth', express.Router());
app.use('/v1/users', express.Router());
app.use('/v1/posts', express.Router());
app.use('/v1/comments', express.Router());
app.use('/v1/categories', express.Router());
app.use('/v1/tags', express.Router());
app.use('/v1/search', express.Router());

const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/blogdb';

// Connect to MongoDB
mongoose
  .connect(MONGO_URI)
  .then(() => {
    console.log('Connected to MongoDB');
    app.listen(PORT, () => {
      console.log(`Server listening on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Failed to connect to MongoDB', err);
  });
