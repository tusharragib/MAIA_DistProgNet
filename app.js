//To plug used packages
const express = require('express');
const expbars  = require('express-handlebars');
const handlebars  = require('handlebars');
const bodyParser = require('body-parser');
const flash= require('connect-flash');
const session = require('express-session');
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');

const app = express();
app.engine('handlebars', expbars());
app.set('view engine', 'handlebars');

//Helper for the list of 'Male'/'Female', because it is not possible to implement without helper
handlebars.registerHelper('ifEquals', function(arg1, arg2, options) {
    return (arg1 == arg2) ? options.fn(this) : options.inverse(this);
});
app.listen(3000, ()=>{
    console.log('Server is listening on port 3000');
})

//FOLDER FOR STATIC RESOURCES
app.use('/css' , express.static(__dirname + '/assets/css'));
app.use('/img' , express.static(__dirname + '/assets/img'));
app.use('/js' , express.static(__dirname + '/assets/js'));
app.use('/plugins' , express.static(__dirname + '/assets/plugins'));
app.use('/patient_files' , express.static(__dirname + '/patient_files'));

//MONGOOSE CONNECTION
mongoose.connect("mongodb://localhost:27017/usersdb", {
    keepAlive: 1,
    useUnifiedTopology: true,
    useNewUrlParser: true
});

//SCHEMA AND MODEL
//It is used two models, they are 'Patient' and 'User'
require('./models/patient');
const Patient = mongoose.model('Patient');

require('./models/user');
const User = mongoose.model('User');

//const emailAddress = "sys";
//const password = "admin";


app.use(session({
    secret:'Keep it secret',
    name:'uniqueSessionID',
    resave: true,
    saveUninitialized:false
}))

//MIDDLEWARE FOR FLASH MESSAGGES
app.use(flash());

//GLOBAL VARIABLES FOR  FLASH MESSAGGES
app.use((req , res, next)=>{
    res.locals.msg_successo = req.flash('msg_successo');
    res.locals.msg_errore = req.flash('msg_errore');
    res.locals.errore = req.flash('errore');
    res.locals.session = req.session;
    next();
});

//The API for the log in form, with encryption SHA265 algorithm.
// The function of db findOne is looking for the user by emailAddress

app.post('/authenticate', bodyParser.urlencoded({ extended: true }) ,(req,res,next)=> {
    User.findOne({emailAddress: req.body.emailAddress,
            password: crypto.createHash('sha256').update(req.body.password).digest('hex')},
        function(err, user){
                    if(err) return console.log(err);
                    if(user) {
                        req.session.loggedIn = true;
                        req.session.emailAddress = req.body.emailAddress;
                        req.session.role = user._doc.role;
                        console.log(req.session);
                        res.redirect('/login');
                    } else {
                        res.render('login', {
                            layout: 'login',
                            errors: [{text:'Invalid EmailAddress or password'}],
                            user: req.body,
                        });
                    }
    });
})


//ROUTE for the index page with title and layout
app.get('/', (req, res) => {
    res.render('index', {title: 'Online platform to consult with Optometrists', layout: 'main'});
})


//ROUTE FOR LOGIN PAGE with verification of the role, if it is a doctor, so it is redirected to the view 'patentList',
// otherwise to the  'cabinetPersonal'
app.get('/login', function(req, res) {
    if(req.session.loggedIn){
        if(req.session.role === "doctor") {
            res.redirect("/patientsList");
        } else {
            res.redirect("/cabinetPersonal");
        }
    } else {
        res.render('login', {layout: 'login'});
    }
});

//API for logout
app.get('/logout',(req,res)=> {
    req.session.destroy((err)=>{});
    res.redirect('/')
})

//Route for registration
app.get('/registration', function(req, res) {
    res.render('registration', {layout: 'login'});
});

//API for the registration. Fields 'emailAddress' and 'password' are mandatory. Minimum password length is 6.
// Password is encrypted in SHA256. The role can be 'Doctor' or 'Patient'
app.post('/registration', bodyParser.urlencoded({ extended: true }), function(req, res) {
    let errors = [ ];
    if(!req.body.emailAddress){
        errors.push({text:'EmailAddress is mandatory'});
    }
    if(!req.body.password){
        errors.push({text:'Password is mandatory'});
    }
    if(req.body.password.length < 6){
        errors.push({text:'Minimum password length 6'});
    }
    if(req.body.password !== req.body.confirm_password){
        errors.push({text:'Password and confirm password should be same'});
    }
    if(errors.length > 0){
        res.render('registration', {
            layout: 'login',
            errors: errors,
            user: req.body,
        });
    } else {
        req.body.password = crypto.createHash('sha256').update(req.body.password).digest('hex');
        new User(req.body).save(function(err){
            if(err) return console.log(err);
        });
        req.flash('msg_successo',  'User registration correctly');
        res.redirect('/login');
    }
});


//Route for a patient cabinet
app.get('/cabinetPersonal', function(req, res) {
    if(!req.session.loggedIn || req.session.role !== "patient"){
        return res.redirect("/login");
    }
    Patient.findOne({emailAddress: req.session.emailAddress}, function(err, patient){
        res.render('patientRecord', {layout: 'cabinetPatient', patient: patient});
    });
});


//Route for patientsList of a doctor
app.get('/patientsList', function(req, res) {
    if(!req.session.loggedIn || req.session.role !== "doctor"){
        return res.redirect("/login");
    }
    Patient.find({}, function(err, patientsList){
        if(err) return console.log(err);
        res.render('patientsList', {layout: 'cabinet', patientsList: patientsList});
    });
});

//Route for createRecord for the patient by doctor
app.get('/createRecord', function(req, res) {
    if(!req.session.loggedIn || req.session.role !== "doctor"){
        return res.redirect("/login");
    }
    res.render('createRecord', {layout: 'cabinet'});
});


//Route for editRecord
app.get('/editRecord/:id', function(req, res, next) {
    if(!req.session.loggedIn || req.session.role !== "doctor"){
        return res.redirect("/login");
    }
    Patient.findOne({_id: req.params.id}, function(err, patient){
        if(err) return console.log(err);
        res.render('createRecord', {layout: 'cabinet', patient: patient._doc});
    });
});

//FORM MANAGEMENT: ADD PATIENT'S RECORD AND MODIFICATE IT.
// Three fields are mandatory, they are 'emailAddress', 'firstName' and 'lastName'.
// If the parameter 'id' is empty, so the record will be created, otherwise, call the function updateOne
app.post('/createRecord', bodyParser.urlencoded({ extended: true }), (req, res) => {
    if(!req.session.loggedIn || req.session.role !== "doctor"){
        return res.redirect("/login");
    }
    let errors = [ ];
    if(!req.body.emailAddress){
        errors.push({text:'Email is mandatory'});
    }
    if(!req.body.firstName){
        errors.push({text:'First Name is mandatory'});
    }
    if(!req.body.lastName){
        errors.push({text:'Last name is mandatory'});
    }
    /*Patient.findOne({emailAddress: req.body.emailAddress},function(err, patient){
        if(patient && patient._doc._id !== req.body.id) {
            errors.push({text: 'EmailAddress ' + req.body.emailAddress + ' is taken to other patient'});
        }
    });*/
    if(errors.length > 0){
        res.render('createRecord', {
            layout: 'cabinet',
            errors: errors,
            patient: req.body,
        });
    } else {
        if(!req.body.id) {
            new Patient(req.body).save(function(err){
                if(err) return console.log(err);
            });
            req.flash('msg_successo' ,  'Patient record created correctly');
        } else {
            Patient.updateOne({_id: req.body.id}, req.body, function(err, result){
                if(err) return console.log(err);
                console.log(result);
            });
            req.flash('msg_successo' ,  'Patient record modified correctly');
        }

        res.redirect('/patientsList');
    }
});


//MANAGEMENT: REMOVE RECORD

app.delete('/api/deletePatient/:id', (req , res) =>{
    if(!req.session.loggedIn || req.session.role !== "doctor"){
        return res.redirect("/login");
    }
    Patient.deleteOne({_id: req.params.id}, function(err, result){
        if(err) return console.log(err);
        req.flash('msg_successo' ,  'Patient deleted correctly');
        res.json({ result : 'success' })
    });
});

// Function for the uploading a file to the folder 'patient_files/'
const storage = multer.diskStorage({
    destination: function(req, file, cb) {
        cb(null, 'patient_files/');
    },
    // By default, multer removes file extensions so let's add them back
    filename: function(req, file, cb) {
        cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname));
    }
});

//Helper for uploading the file.
const helpers = require('./helpers');
app.post('/api/upload-patient-file', (req, res) => {
    if(!req.session.loggedIn || req.session.role !== "doctor"){
        return res.redirect("/login");
    }
    let upload = multer({ storage: storage, fileFilter: helpers.imageFilter }).single('file');

    upload(req, res, function(err) {
        if (req.fileValidationError) {
            return res.json({error: req.fileValidationError});
        }
        else if (!req.file) {
            return res.json({error: 'Please select an image to upload'});
        }
        else if (err instanceof multer.MulterError) {
            return res.json({error: err});
        }
        else if (err) {
            return res.json({error: err});
        }
        res.json({filename: req.file.filename, file_path: req.file.path});
    });
});
