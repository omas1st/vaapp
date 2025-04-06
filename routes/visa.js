const express = require('express');
const router = express.Router();
const { countries } = require('countries-list');
const mongoose = require('mongoose');
const multer = require('multer');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const Application = require('../model/Application');

// Country data setup
const countryNames = Object.values(countries).map(c => c.name).sort();

// File upload configuration
const upload = multer({
    dest: path.join(__dirname, '../uploads'),
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB
});

// Session validation middleware
const checkSessionData = (req, res, next) => {
    console.log('Session Check:', {
        path: req.path,
        sessionId: req.sessionID,
        applicationId: req.session.applicationId
    });

    if (!req.session.applicationId && req.path !== '/') {
        console.error('Session validation failed - missing applicationId');
        return res.redirect('/?error=session_expired');
    }
    next();
};

// Page 1: Initial Application
router.get('/', (req, res) => {
    res.render('page1', {
        countries: countryNames,
        title: 'Step 1: Application Details'
    });
});

router.post('/page1', async (req, res) => {
    try {
        // Create new application
        const application = new Application({
            destination: req.body.destination,
            visaType: req.body.visaType,
            citizenship: req.body.citizenship,
            status: 'incomplete'
        });

        const savedApplication = await application.save();
        console.log('Page1: Created application:', savedApplication._id);

        // Store application ID in session
        req.session.applicationId = savedApplication._id;
        
        // Save session before redirect
        await new Promise((resolve, reject) => {
            req.session.save(err => {
                if (err) {
                    console.error('Session save error:', err);
                    return reject(err);
                }
                console.log('Session saved successfully');
                resolve();
            });
        });

        // Redirect with 303 status code
        return res.redirect(303, '/page2');

    } catch (err) {
        console.error("Page1 error:", err);
        return res.status(500).render('error', {
            title: 'Application Error',
            message: 'Failed to save initial application'
        });
    }
});

// Page 2: Personal Details
router.get('/page2', checkSessionData, async (req, res) => {
    try {
        const application = await Application.findById(req.session.applicationId);
        
        if (!application) {
            console.error('Application not found:', req.session.applicationId);
            return res.redirect('/?error=invalid_application');
        }

        res.render('page2', {
            data: application,
            countries: countryNames,
            title: 'Step 2: Personal Details'
        });

    } catch (error) {
        console.error('Page2 load error:', error);
        res.redirect('/?error=db_error');
    }
});

router.post('/page2', checkSessionData, async (req, res) => {
    try {
        const update = {
            email: req.body.email,
            phone: req.body.phone,
            passportCitizenship: req.body.passportCitizenship,
            firstName: req.body.firstName,
            lastName: req.body.lastName,
            updatedAt: new Date()
        };

        await Application.findByIdAndUpdate(
            req.session.applicationId,
            { $set: update },
            { new: true, runValidators: true }
        );

        console.log('Page2: Updated application:', req.session.applicationId);
        res.redirect('/payment');

    } catch (error) {
        console.error('Page2 update error:', error);
        res.status(500).render('error', {
            title: 'Update Error',
            message: 'Failed to save personal details'
        });
    }
});

// Payment Page
router.get('/payment', checkSessionData, async (req, res) => {
    try {
        const application = await Application.findById(req.session.applicationId);
        
        if (!application) {
            return res.redirect('/?error=application_not_found');
        }

        res.render('payment', {
            title: 'Step 3: Payment Details',
            application: application
        });

    } catch (error) {
        console.error(error);
        res.redirect('/?error=db_error');
    }
});

// Final Submission
router.post('/submit', checkSessionData, upload.single('receipt'), async (req, res) => {
    try {
        if (!req.file) throw new Error('No receipt uploaded');

        // Update application with payment details
        const update = {
            paymentMethod: req.body.paymentMethod,
            receiptPath: req.file.path,
            submittedAt: new Date(),
            status: 'submitted'
        };

        await Application.findByIdAndUpdate(req.session.applicationId, update);
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

        // Clear session
        req.session.destroy(err => {
            if (err) console.error('Session destruction error:', err);
        });

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
