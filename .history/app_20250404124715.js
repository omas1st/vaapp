require('dotenv').config();
const express = require('express');
const session = require('express-session');
const mongoose = require('mongoose');
const app = express();

// Database connection
mongoose.connect(process.env.MONGO_URI, { 
    useNewUrlParser: true, 
    useUnifiedTopology: true 
});

// Middleware
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));
app.use(session({
    secret: process.env.SECRET_KEY,
    resave: false,
    saveUninitialized: true
}));

// Set view engine
app.set('view engine', 'ejs');

// Routes
const visaRouter = require('./routes/visa');
app.use('/', visaRouter); // This is the correct way to use router

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));