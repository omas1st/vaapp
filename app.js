require('dotenv').config();
const express = require('express');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const mongoose = require('mongoose');
const path = require('path');
const app = express();

// Trust Vercel's proxy
app.set('trust proxy', 1);

// Database connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// Enhanced session middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(session({
    secret: process.env.SECRET_KEY,
    resave: false,
    saveUninitialized: false,
    proxy: true,
    store: MongoStore.create({
        mongoUrl: process.env.MONGO_URI,
        ttl: 14 * 24 * 60 * 60, // 14 days
        autoRemove: 'native',
        touchAfter: 24 * 3600 // 24 hours
    }),
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        maxAge: 14 * 24 * 60 * 60 * 1000, // 14 days
        httpOnly: true,
        domain: process.env.NODE_ENV === 'production' ? '.yourdomain.com' : undefined
    }
}));

// Session debug middleware
app.use((req, res, next) => {
    console.log('Session Info:', {
        id: req.sessionID,
        data: req.session,
        cookies: req.headers.cookie
    });
    next();
});

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Routes
const visaRouter = require('./routes/visa');
app.use('/', visaRouter);

// Error handling
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).render('error', {
        title: 'Application Error',
        message: 'Something went wrong! Please try again later.'
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
