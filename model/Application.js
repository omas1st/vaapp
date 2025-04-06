const mongoose = require('mongoose');

const applicationSchema = new mongoose.Schema({
    destination: { type: String, required: true },
    visaType: { type: String, required: true },
    citizenship: { type: String, required: true },
    email: { type: String, validate: /^\S+@\S+\.\S+$/ },
    phone: String,
    passportCitizenship: String,
    firstName: String,
    lastName: String,
    paymentMethod: String,
    receiptPath: String,
    status: { type: String, default: 'incomplete' },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

applicationSchema.pre('save', function(next) {
    this.updatedAt = new Date();
    next();
});

module.exports = mongoose.model('Application', applicationSchema);
