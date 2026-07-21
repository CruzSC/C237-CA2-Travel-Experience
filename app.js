const express = require('express');
const mysql = require('mysql2');
const session = require('express-session');
const flash = require('connect-flash');
const multer = require('multer');
const app = express();

// Set up multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'public/images');
    },
    filename: (req, file, cb) => {
        cb(null, file.originalname);
    }
});

const upload = multer({ storage: storage });

// [C237-020] Database connection to Azure MySQL Database
const db = mysql.createConnection({
    host: 'c237-annie-mysql.mysql.database.azure.com',
    user: 'c237_020',
    password: 'c237020@2026!',
    database: 'c237_020_ca2team1',
    ssl: {
        rejectUnauthorized: false
    }
});

db.connect((err) => {
    if (err) {
        console.error('Error connecting to MySQL:', err);
        return;
    }
    console.log('Connected to MySQL database');
});

// Set up view engine and middleware
app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(express.urlencoded({ extended: false }));

app.use(session({
    secret: 'secret',
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 1000 * 60 * 60 * 24 * 7 }
}));

app.use(flash());

app.use((req, res, next) => {
    res.locals.user = req.session.user || null;
    res.locals.successMessages = req.flash('success');
    res.locals.errorMessages = req.flash('error');
    next();
});

// Home route
app.get('/', (req, res) => {
    res.render('index', { title: 'Travel Experience Planner' });
});

// Simple page routes so each member has a page to start from
app.get('/register', (req, res) => {
    res.render('register', { title: 'Register', formData: {} });
});

app.get('/login', (req, res) => {
    res.render('login', { title: 'Login' });
});

app.get('/experiences', (req, res) => {
    res.render('experiences', {
        title: 'Experiences',
        experiences: [],
        filters: { search: '', category: '', status: '', sort: 'date_asc' }
    });
});

app.get('/experiences/add', (req, res) => {
    res.render('addExperience', { title: 'Add Experience' });
});

app.get('/admin', (req, res) => {
    res.render('admin', { title: 'Admin', users: [], experiences: [] });
});

// Member 1 - Wei Ioke
// TODO: Registration, login, logout, sessions and role checks

// Member 2 - Ashton
// TODO: Add experience route, INSERT query and validation

// Member 3 - Mithulen
// TODO: View all and view one experience using SELECT queries

// Member 4 - Jerome
// TODO: Edit, update, delete and ownership checks

// Member 5 - Cruz
// TODO: Search, filter, sorting and admin management

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
