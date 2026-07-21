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

//post route
app.get('/addExperience', (req, res) => {
    res.render('addExperience', {
        title: 'Add Experience'
    });
});

app.post('/addExperience', upload.single('image'), (req, res) => {
    // Extract experience data from the request body
    const { title, destination, country, category, description, experienceDate, price, rating, status } = req.body;

    let image;
    if (req.file) {
        image = req.file.filename; // Save only the filename
    } else {
        image = null;
    }

    const sql = 'INSERT INTO experiences (title, destination, country, category, description, experienceDate, price, rating, status, image) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';

    // Insert the new experience into the database
    connection.query(sql, [title, destination, country, category, description, experienceDate, price, rating, status, image], (error, results) => {
        if (error) {
            // Handle any error that occurs during the database operation
            console.error("Error adding experience:", error);
            res.send('Error adding experience');
        } else {
            // Send a success response
            res.redirect('/');
        }
    });
});
// Member 5 - Search, filter and sort experiences
app.get('/experiences', (req, res) => {
    const search = req.query.search || '';
    const category = req.query.category || '';
    const status = req.query.status || '';
    const rating = req.query.rating || '';
    const sort = req.query.sort || 'date_asc';

    let sql = `
        SELECT experiences.*, users.username
        FROM experiences
        JOIN users ON experiences.userId = users.userId
    `;
    const conditions = [];
    const values = [];

    if (search) {
        conditions.push('(experiences.title LIKE ? OR experiences.destination LIKE ? OR experiences.country LIKE ?)');
        const searchValue = `%${search}%`;
        values.push(searchValue, searchValue, searchValue);
    }

    if (category) {
        conditions.push('experiences.category = ?');
        values.push(category);
    }

    if (status) {
        conditions.push('experiences.status = ?');
        values.push(status);
    }

    if (rating) {
        conditions.push('experiences.rating = ?');
        values.push(rating);
    }

    if (conditions.length > 0) {
        sql += ` WHERE ${conditions.join(' AND ')}`;
    }

    const sortOptions = {
        date_asc: 'experiences.experienceDate ASC',
        date_desc: 'experiences.experienceDate DESC',
        rating_desc: 'experiences.rating DESC',
        title_asc: 'experiences.title ASC'
    };
    sql += ` ORDER BY ${sortOptions[sort] || sortOptions.date_asc}`;

    db.query(sql, values, (error, results) => {
        if (error) {
            console.error('Error searching experiences:', error);
            return res.status(500).send('Error retrieving experiences');
        }

        res.render('experiences', {
            title: 'Experiences',
            experiences: results,
            filters: { search, category, status, rating, sort }
        });
    });
});

app.get('/experiences/add', (req, res) => {
    res.render('addExperience', { title: 'Add Experience' });
});

// Member 5 - Check that the user is an admin
const checkAdminAccess = (req, res, next) => {
    if (req.session.user && req.session.user.role === 'admin') {
        return next();
    }

    req.flash('error', 'Admin access only');
    res.redirect('/login');
};

// Member 5 - Admin page
app.get('/admin', checkAdminAccess, (req, res) => {
    const usersSql = 'SELECT userId, username, email, role, createdAt FROM users ORDER BY userId';
    const experiencesSql = `
        SELECT experiences.*, users.username
        FROM experiences
        JOIN users ON experiences.userId = users.userId
        ORDER BY experiences.experienceDate ASC
    `;

    db.query(usersSql, (usersError, users) => {
        if (usersError) {
            console.error('Error retrieving users:', usersError);
            return res.status(500).send('Error retrieving users');
        }

        db.query(experiencesSql, (experiencesError, experiences) => {
            if (experiencesError) {
                console.error('Error retrieving experiences:', experiencesError);
                return res.status(500).send('Error retrieving experiences');
            }

            res.render('admin', {
                title: 'Admin',
                users: users,
                experiences: experiences
            });
        });
    });
});

// Member 5 - Update a user's role
app.post('/admin/users/:id/role', checkAdminAccess, (req, res) => {
    const userId = req.params.id;
    const role = req.body.role;

    if (role !== 'user' && role !== 'admin') {
        req.flash('error', 'Invalid role selected');
        return res.redirect('/admin');
    }

    const sql = 'UPDATE users SET role = ? WHERE userId = ?';
    db.query(sql, [role, userId], (error, result) => {
        if (error) {
            console.error('Error updating user role:', error);
            return res.status(500).send('Error updating user role');
        }

        if (result.affectedRows === 0) {
            req.flash('error', 'User not found');
        } else {
            req.flash('success', 'User role updated successfully');
        }
        res.redirect('/admin');
    });
});

// Member 5 - Update an experience status from the admin page
app.post('/admin/experiences/:id/status', checkAdminAccess, (req, res) => {
    const experienceId = req.params.id;
    const status = req.body.status;
    const allowedStatuses = ['planned', 'completed', 'cancelled'];

    if (!allowedStatuses.includes(status)) {
        req.flash('error', 'Invalid status selected');
        return res.redirect('/admin');
    }

    const sql = 'UPDATE experiences SET status = ? WHERE experienceId = ?';
    db.query(sql, [status, experienceId], (error, result) => {
        if (error) {
            console.error('Error updating experience status:', error);
            return res.status(500).send('Error updating experience status');
        }

        if (result.affectedRows === 0) {
            req.flash('error', 'Experience not found');
        } else {
            req.flash('success', 'Experience status updated successfully');
        }
        res.redirect('/admin');
    });
});

// Member 4 routes: edit, update, delete and ownership checks

// GET: show the edit form, pre-filled with the existing experience
app.get('/experiences/:id/edit', (req, res) => {
    const experienceId = req.params.id;
    const user = req.session.user;

    if (!user) {
        req.flash('error', 'Please log in first.');
        return res.redirect('/login');
    }

    const sql = 'SELECT * FROM experiences WHERE experienceId = ?';
    db.query(sql, [experienceId], (error, results) => {
        if (error) {
            console.error('Database query error:', error.message);
            return res.send('Error retrieving experience by ID');
        }
        if (results.length === 0) {
            return res.send('Experience not found');
        }

        const experience = results[0];

        // Ownership check: only the owner or an admin can edit
        if (user.role !== 'admin' && experience.userId !== user.userId) {
            req.flash('error', 'You do not have permission to edit that experience.');
            return res.redirect('/experiences');
        }

        res.render('editExperience', { title: 'Edit Experience', experience: experience });
    });
});

// POST: apply the update
app.post('/experiences/:id/edit', upload.single('image'), (req, res) => {
    const experienceId = req.params.id;
    const user = req.session.user;
    const { title, destination, country, category, description, experienceDate, price, rating, status } = req.body;
    let image = req.body.currentImage;

    if (!user) {
        req.flash('error', 'Please log in first.');
        return res.redirect('/login');
    }

    if (req.file) {
        image = req.file.filename;
    }

    // Re-check ownership before writing, in case the session or record changed
    const checkSql = 'SELECT userId FROM experiences WHERE experienceId = ?';
    db.query(checkSql, [experienceId], (err, rows) => {
        if (err || rows.length === 0) {
            req.flash('error', 'Experience not found.');
            return res.redirect('/experiences');
        }

        if (user.role !== 'admin' && rows[0].userId !== user.userId) {
            req.flash('error', 'You do not have permission to edit that experience.');
            return res.redirect('/experiences');
        }

        const sql = `
            UPDATE experiences
            SET title = ?, destination = ?, country = ?, category = ?, description = ?,
                experienceDate = ?, price = ?, rating = ?, status = ?, image = ?
            WHERE experienceId = ?
        `;
        const values = [
            title, destination, country, category, description,
            experienceDate, price, rating || null, status, image, experienceId
        ];

        db.query(sql, values, (error) => {
            if (error) {
                console.error('Error updating experience:', error);
                return res.send('Error updating experience');
            }
            req.flash('success', 'Experience updated!');
            res.redirect('/experiences');
        });
    });
});

// POST: delete an experience (with ownership check)
app.post('/experiences/:id/delete', (req, res) => {
    const experienceId = req.params.id;
    const user = req.session.user;

    if (!user) {
        req.flash('error', 'Please log in first.');
        return res.redirect('/login');
    }

    const checkSql = 'SELECT userId FROM experiences WHERE experienceId = ?';
    db.query(checkSql, [experienceId], (err, rows) => {
        if (err || rows.length === 0) {
            req.flash('error', 'Experience not found.');
            return res.redirect('/experiences');
        }

        if (user.role !== 'admin' && rows[0].userId !== user.userId) {
            req.flash('error', 'You do not have permission to delete that experience.');
            return res.redirect('/experiences');
        }

        const sql = 'DELETE FROM experiences WHERE experienceId = ?';
        db.query(sql, [experienceId], (error) => {
            if (error) {
                console.error('Error deleting experience:', error);
                return res.send('Error deleting experience');
            }
            req.flash('success', 'Experience deleted.');
            res.redirect('/experiences');
        });
    });
});
// Team member progress
// Member 1 - Wei Ioke: NOT DONE - Registration, login, logout, sessions and role checks
// Member 2 - Ashton: NOT DONE - Add experience, INSERT query and validation
// Member 3 - Mithulen: NOT DONE - View all and view one experience using SELECT queries
// Member 4 - Jerome: DONE - Edit, update, delete and ownership checks
// Member 5 - Cruz: DONE - Search, filter, sorting and admin management

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
