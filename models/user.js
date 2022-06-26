
const mongoose= require('mongoose');
const crypto= require('crypto');

const userSchema= new mongoose.Schema({

    emailAddress:{
        type: String,
        required: true
    },
    password:{
        type: String,
        required: true
    },
    role:{
        type: String,
        required: true
    }
})

const User = mongoose.model('User', userSchema);

const defaultPassword = crypto.createHash('sha256').update('123456').digest('hex')



//API for the default users:
//doctor@maia.com with the role 'doctor'
// patient@maia.com = for a patient
//Default password is 123456
//Insert default users
User.findOne({emailAddress: 'doctor@maia.com'},
function(err, user){
        if(!err && !user) {
            new User({emailAddress: 'doctor@maia.com', password: defaultPassword, role: 'doctor'}).save(function(err){
                if(err) return console.log(err);
            });
        }
});

User.findOne({emailAddress: 'patient@maia.com'},
function(err, user){
    if(!err && !user) {
        new User({emailAddress: 'patient@maia.com', password: defaultPassword, role: 'patient'}).save(function(err){
            if(err) return console.log(err);
        });
    }
});