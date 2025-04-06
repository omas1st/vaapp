require('dotenv').config();
const express = require('express');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const mongoose = require('mongoose');
const path = require('path');
const app = express();

// Trust Vercel's reverse proxy
app.set('trust proxy', 1);

// Database connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// Middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));

// CORS configuration for Vercel
app.use((req, res, next) => {
  if(process.env.NODE_ENV === 'production') {
    res.setHeader('Access-Control-Allow-Origin', 'https://your-vercel-app.vercel.app');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
  next();
});

// Session configuration
app.use(session({
    secret: process.env.SECRET_KEY,
    resave: false,
    saveUninitialized: false,
    proxy: true,
    store: MongoStore.create({
        mongoUrl: process.env.MONGO_URI,
        ttl: 14 * 24 * 60 * 60 // 14 days
    }),
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        maxAge: 14 * 24 * 60 * 60 * 1000,
        httpOnly: true
    }
}));

// Session debug middleware
app.use((req, res, next) => {
    console.log('Session Status:', {
        id: req.sessionID,
        exists: !!req.session,
        applicationId: req.session?.applicationId
    });
    next();
});

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Routes
const visaRouter = require('./routes/visa');
app.use('/', visaRouter);

// Error handling
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).render('error', {
        title: 'Error',
        message: 'Something went wrong!'
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
