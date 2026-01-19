const mongoose = require('mongoose');

const vaccineSchema = new mongoose.Schema({
    name: { type: String, required: true },
    degree: { type: Number, required: true },
    recommendedDays: { type: Number, required: true }, // '일수' 기준
    description: String
});

module.exports = mongoose.model('Vaccine', vaccineSchema);