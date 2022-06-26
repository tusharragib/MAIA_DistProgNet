const mongoose = require('mongoose');

const recordSchema = mongoose.Schema({
    firstName:{
        type: String,
        required: true
    },
    lastName:{
        type: String,
        required: true
    },

    birthDate:{
        type: Date,
        required: false
    },

    gender: {
        type: String,
        required: false
    },

    nameFile:{
        type: String,
        required: false
    },

    emailAddress:{
        type: String,
        required: false
    },

    diagnosis:{
        type: String,
        required: false
    }
})

mongoose.model('Patient', recordSchema);
