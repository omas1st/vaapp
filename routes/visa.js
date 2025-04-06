const express = require('express');
const router = express.Router();
const { countries } = require('countries-list');
const mongoose = require('mongoose');
const multer = require('multer');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

// Models
const Application = require('../model/Application');

// Country data
const countryNames = Object.values(countries).map(c => c.name).sort();

// File upload setup
const upload = multer({ 
    dest: path.join(__dirname, '../uploads'),
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB
});

// routes/visa.js
// routes/visa.js
const checkSessionData = (req, res, next) => {
    console.log('checkSessionData - req.path:', req.path);
    console.log('Session data:', req.session);
    // Update condition to check for applicationId instead of page1
    if (!req.session.applicationId && req.path !== '/') {
        console.error('No applicationId found in session, redirecting to /');
        return res.redirect('/');
    }
    next();
};



// Page 1 - Initial application
router.get('/', (req, res) => {
    res.render('page1', { 
        countries: countryNames,
        title: 'Step 1: Application Details' 
    });
});

// Save page1 data into DB and store document id in session
router.post('/page1', async (req, res) => {
    try {
        const application = new Application({
            destination: req.body.destination,
            visaType: req.body.visaType,
            citizenship: req.body.citizenship,
            status: 'incomplete'
        });
        const savedApplication = await application.save();
        console.log('Page1: Application saved with id:', savedApplication._id);
        
        req.session.applicationId = savedApplication._id;
        req.session.save((err) => {
            if (err) {
                console.error('Session save error on page1:', err);
                return res.status(500).send("Error saving session: " + err.message);
            }
            console.log("Session saved successfully; redirecting to /page2");
            res.redirect('/page2');
        });
    } catch (err) {
        console.error("Error in /page1 route:", err);
        return res.status(500).send("Error in page1: " + err.message);
    }
});


// Page 2 - Save personal details into DB
// GET /page2 Route
router.get('/page2', checkSessionData, async (req, res) => {
    try {
        console.log("GET /page2: applicationId from session:", req.session.applicationId);
        const application = await Application.findById(req.session.applicationId);
        if (!application) {
            console.error('GET /page2: Application not found for id:', req.session.applicationId);
            return res.redirect('/?error=application_not_found');
        }
        console.log("GET /page2: Retrieved application data:", application);
        res.render('page2', {
            data: application,
            countries: countryNames,
            title: 'Step 2: Personal Details'
        });
    } catch (error) {
        console.error('GET /page2: Error loading application:', error);
        res.redirect('/?error=db_error');
    }
});

// POST /page2 Route
router.post('/page2', checkSessionData, async (req, res) => {
    try {
        const update = {
            email: req.body.email,
            phone: req.body.phone,
            passportCitizenship: req.body.passportCitizenship,
            firstName: req.body.firstName,
            lastName: req.body.lastName
        };
        await Application.findByIdAndUpdate(req.session.applicationId, update);
        console.log('Page2: Application updated for id:', req.session.applicationId);
        res.redirect('/payment');
    } catch (error) {
        console.error('Page2 update error:', error);
        res.status(500).send("Error updating page2: " + error.message);
    }
});




// Payment Page (GET) - load application from DB
router.get('/payment', checkSessionData, async (req, res) => {
    try {
        const application = await Application.findById(req.session.applicationId);
        if (!application) return res.redirect('/?error=not_found');
        res.render('payment', {
            title: 'Step 3: Payment Details',
            application: application
        });
    } catch (error) {
        console.error(error);
        res.redirect('/?error=db_error');
    }
});

// Final Submission - update payment details and complete application
router.post('/submit', checkSessionData, upload.single('receipt'), async (req, res) => {
    try {
        if (!req.file) throw new Error('No receipt uploaded');
        
        // Final update with payment details and receipt
        const update = {
            paymentMethod: req.body.paymentMethod,
            receiptPath: req.file.path,
            submittedAt: new Date(),
            status: 'submitted'
        };

        await Application.findByIdAndUpdate(req.session.applicationId, update);
        
        // Retrieve updated application to generate PDF
        const application = await Application.findById(req.session.applicationId);

        // Generate PDF
        const doc = new PDFDocument();
        const pdfPath = path.join(__dirname, `../receipts/visa-application-${Date.now()}.pdf`);
        const writeStream = fs.createWriteStream(pdfPath);
        
        doc.pipe(writeStream);
        doc.fontSize(18).text('Visa Application Summary', { align: 'center' });
        doc.moveDown();
        
        // Add application data
        Object.entries(application.toObject()).forEach(([key, value]) => {
            doc.fontSize(12).text(`${key}: ${value}`);
        });
        
        doc.end();

        // Cleanup session
        req.session.destroy();

        res.render('success', {
            title: 'Application Submitted',
            pdfPath: `/receipts/${path.basename(pdfPath)}`
        });

    } catch (error) {
        console.error('Submission error:', error);
        res.status(500).redirect('/payment?error=submission_failed');
    }
});

module.exports = router;
