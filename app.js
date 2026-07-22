const express = require('express');
const mysql = require('mysql2');
const session = require('express-session');
const flash = require('connect-flash');
const app = express();

// ==================== CHANGE 1: Dropped file uploads, using image links instead ====================
// OLD CODE (removed): multer.diskStorage() with a "city" key instead of
// "destination" (a bug that meant multer never actually knew where to
// save files), plus the multer package import itself.
//
// NEW APPROACH: no file upload at all. The "Add Experience" and
// "Edit Experience" forms now have a plain text input where the user
// pastes a URL to an image already hosted somewhere (Imgur, Google
// Drive shareable link, Unsplash, etc). That URL is stored as a normal
// string in the "image" column, so every teammate's browser loads the
// same image straight from that external link. No file storage, no
// shared disk, no database blobs to keep in sync.
// ==========================================================================================================

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

// ==================== Member 1 - Wei Loke: Authentication ====================
// Shared login check used by routes that require a user session.
const checkAuthenticated = (req, res, next) => {
    if (req.session.user) {
        return next();
    }

    req.flash('error', 'Please log in first.');
    res.redirect('/login');
};

const checkNotAuthenticated = (req, res, next) => {
    if (req.session.user) return res.redirect('/experiences');
    next();
};

// Home route
app.get('/', (req, res) => {
    res.render('index', { title: 'Travel Experience Planner' });
});

// Member 1 - Registration page and registration processing
app.get('/register', (req, res) => {
    res.render('register', {
        title: 'Register',
        formData: req.flash('formData')[0] || {}
    });
});

app.post('/register', (req, res) => {
    const { username, email, password, confirmPassword } = req.body;
    const formData = {
        username: username ? username.trim() : '',
        email: email ? email.trim().toLowerCase() : ''
    };

    if (!formData.username || !formData.email || !password || !confirmPassword) {
        req.flash('error', 'All fields are required.');
        req.flash('formData', formData);
        return res.redirect('/register');
    }

    if (password.length < 6) {
        req.flash('error', 'Password must contain at least 6 characters.');
        req.flash('formData', formData);
        return res.redirect('/register');
    }

    if (password !== confirmPassword) {
        req.flash('error', 'Passwords do not match.');
        req.flash('formData', formData);
        return res.redirect('/register');
    }

    const checkEmailSql = 'SELECT userId FROM users WHERE email = ?';
    db.query(checkEmailSql, [formData.email], (checkError, existingUsers) => {
        if (checkError) {
            console.error('Error checking email:', checkError);
            req.flash('error', 'Registration failed. Please try again.');
            return res.redirect('/register');
        }

        if (existingUsers.length > 0) {
            req.flash('error', 'An account with that email already exists.');
            req.flash('formData', formData);
            return res.redirect('/register');
        }

        const insertSql = `
            INSERT INTO users (username, email, password, role)
            VALUES (?, ?, SHA1(?), 'user')
        `;
        db.query(insertSql, [formData.username, formData.email, password], (insertError) => {
            if (insertError) {
                console.error('Error registering user:', insertError);
                req.flash('error', 'Registration failed. Please try again.');
                return res.redirect('/register');
            }

            req.flash('success', 'Registration successful. Please log in.');
            res.redirect('/login');
        });
    });
});

// Member 1 - Login page
app.get('/login', (req, res) => {
    res.render('login', {
        title: 'Login'
    });
});

// Member 1 - login processing
app.post('/login', (req, res) => {
    const login = req.body.login ? req.body.login.trim() : '';
    const password = req.body.password;

    if (!login || !password) {
        req.flash('error', 'Username or email and password are required.');
        return res.redirect('/login');
    }

    const sql = `
        SELECT userId, username, email, role
        FROM users
        WHERE (username = ? OR email = ?)
        AND password = SHA1(?)
    `;

    db.query(sql, [login, login.toLowerCase(), password], (error, results) => {
        if (error) {
            console.error('Error logging in:', error);
            req.flash('error', 'Login failed. Please try again.');
            return res.redirect('/login');
        }

        if (results.length === 0) {
            req.flash('error', 'Invalid username, email, or password.');
            return res.redirect('/login');
        }

        req.session.user = results[0];
        req.flash('success', 'Login successful.');

        return res.redirect('/');
    });
});

// Member 1 - Logout and clear the session
app.get('/logout', checkAuthenticated, (req, res) => {
    req.session.destroy(() => {
        res.redirect('/login');
    });
});

// ==================== Member 2 - Ashton: Add Experience ====================
// Member 2 - Display the Add Experience form
app.get('/addExperience', checkAuthenticated, (req, res) => {
    res.render('addExperience', {
        title: 'Add Experience'
    });
});

// Member 2 - Validate and insert a new experience
// ==================== CHANGE 2: multer middleware removed ====================
// OLD CODE (removed): app.post('/addExperience', checkAuthenticated, upload.single('image'), ...)
// upload.single('image') is gone since there is no file to parse anymore.
app.post('/addExperience', checkAuthenticated, (req, res) => {

    // Extract experience data from the request body
    const {
        title,
        city,
        country,
        category,
        itinerary,
        experienceDate,
        price,
        rating,
        status,
        image
    } = req.body;

    const allowedCategories = ['Adventure', 'Culture', 'Food', 'Nature', 'Relaxation', 'Shopping'];
    const allowedStatuses = ['planned', 'completed', 'cancelled'];
    const numericPrice = Number(price);
    const numericRating = rating ? Number(rating) : null;

    const requiredText = [title, city, country, itinerary];
    const validDate = /^\d{4}-\d{2}-\d{2}$/.test(experienceDate || '');

    if (requiredText.some((value) => !value || !value.trim()) ||
        !category || !validDate || price === undefined || price === '' || !status) {
        req.flash('error', 'Please complete all required fields.');
        return res.redirect('/addExperience');
    }

    if (!allowedCategories.includes(category) || !allowedStatuses.includes(status)) {
        req.flash('error', 'Invalid category or status selected.');
        return res.redirect('/addExperience');
    }

    if (!Number.isFinite(numericPrice) || numericPrice < 0 ||
        (numericRating !== null && (!Number.isInteger(numericRating) || numericRating < 1 || numericRating > 5))) {
        req.flash('error', 'Please enter a valid price and rating.');
        return res.redirect('/addExperience');
    }

    // Get the logged-in user's ID from the session
    const userId = req.session.user.userId;

    // ==================== CHANGE 3: Image is now just a link ====================
    // OLD CODE (removed):
    //   let image;
    //   if (req.file) { image = req.file.filename; } else { image = null; }
    // NEW CODE: "image" comes straight from req.body as a URL string typed
    // or pasted by the user. Empty input becomes null so the template can
    // show a placeholder instead of a broken link.
    const imageLink = image && image.trim() ? image.trim() : null;
    // ====================================================================================

    const sql = `
        INSERT INTO experiences
        (userId, title, city, country, category, itinerary,
        experienceDate, price, rating, status, image)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    // Insert the new experience into the database
    const values = [
        userId,
        title.trim(),
        city.trim(),
        country.trim(),
        category,
        itinerary.trim(),
        experienceDate,
        numericPrice,
        numericRating,
        status,
        imageLink
    ];

    db.query(sql, values, (error) => {
        if (error) {
            console.error('Error adding experience:', error);
            return res.status(500).send('Error adding experience');
        }

        req.flash('success', 'Experience added successfully!');
        res.redirect('/experiences');
    });
});
// ==================== Members 3 and 5: Experience Listing ====================
// Member 3 - Mithulen: display all experiences
// Member 5 - Cruz: search, filter and sort the displayed experiences

// ==================== Member 5 - Cruz: Private Experience Listing ====================
app.get('/experiences', checkAuthenticated, (req, res) => {
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

    // STRICT PRIVACY CHECK: Only grab rows belonging to the logged-in user
    const conditions = ['experiences.userId = ?'];
    const values = [req.session.user.userId];

    if (search) {
        conditions.push('(experiences.title LIKE ? OR experiences.city LIKE ? OR experiences.country LIKE ?)');
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

    // Apply conditions to SQL
    sql += ` WHERE ${conditions.join(' AND ')}`;

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
            title: 'My Experiences',
            experiences: results,
            filters: { search, category, status, rating, sort }
        });
    });
});

// Member 2 - Keep the original Add Experience link working
app.get('/experiences/add', checkAuthenticated, (req, res) => {
    res.redirect('/addExperience');
});

// ==================== Member 3 - Mithulen: View One Experience ====================
app.get('/experiences/:id', checkAuthenticated, (req, res) => {
    const experienceId = req.params.id;
    const currentUser = req.session.user;

    const sql = `
        SELECT experiences.*, users.username
        FROM experiences
        JOIN users ON experiences.userId = users.userId
        WHERE experiences.experienceId = ?
    `;

    db.query(sql, [experienceId], (error, results) => {
        if (error) {
            console.error('Error retrieving single experience:', error);
            req.flash('error', 'Could not load the experience details.');
            return res.redirect('/experiences');
        }

        if (results.length === 0) {
            req.flash('error', 'Experience not found.');
            return res.redirect('/experiences');
        }

        const experience = results[0];

        // Only the owner or an admin can view the full experience.
        if (currentUser.role !== 'admin' && experience.userId !== currentUser.userId) {
            req.flash('error', 'You do not have permission to view this experience.');
            return res.redirect('/experiences');
        }

        res.render('experience', {
            title: experience.title,
            experience: experience
        });
    });
});

// ==================== Member 5 - Cruz: Admin Management ====================
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

// Member 5 - Delete a user and their related experiences
app.post('/admin/users/:id/delete', checkAdminAccess, (req, res) => {
    const userId = Number(req.params.id);

    if (!Number.isInteger(userId) || userId <= 0) {
        req.flash('error', 'Invalid user selected');
        return res.redirect('/admin');
    }

    if (userId === Number(req.session.user.userId)) {
        req.flash('error', 'You cannot delete your own admin account');
        return res.redirect('/admin');
    }

    const sql = 'DELETE FROM users WHERE userId = ?';
    db.query(sql, [userId], (error, result) => {
        if (error) {
            console.error('Error deleting user:', error);
            return res.status(500).send('Error deleting user');
        }

        if (result.affectedRows === 0) {
            req.flash('error', 'User not found');
        } else {
            req.flash('success', 'User deleted successfully');
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

// Member 5 - Delete an experience from the admin page
app.post('/admin/experiences/:id/delete', checkAdminAccess, (req, res) => {
    const experienceId = Number(req.params.id);

    if (!Number.isInteger(experienceId) || experienceId <= 0) {
        req.flash('error', 'Invalid experience selected');
        return res.redirect('/admin');
    }

    const sql = 'DELETE FROM experiences WHERE experienceId = ?';
    db.query(sql, [experienceId], (error, result) => {
        if (error) {
            console.error('Error deleting experience:', error);
            return res.status(500).send('Error deleting experience');
        }

        if (result.affectedRows === 0) {
            req.flash('error', 'Experience not found');
        } else {
            req.flash('success', 'Experience deleted successfully');
        }
        res.redirect('/admin');
    });
});

// ==================== Member 4 - Jerome: Edit and Delete ====================
// Member 4 - Edit, update, delete and ownership checks

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
// ==================== CHANGE 4: multer middleware removed ====================
// OLD CODE (removed): app.post('/experiences/:id/edit', checkAuthenticated, upload.single('image'), ...)
app.post('/experiences/:id/edit', checkAuthenticated, (req, res) => {
    const experienceId = req.params.id;
    const user = req.session.user;
    const { title, city, country, category, itinerary, experienceDate, price, rating, status, image } = req.body;

    if (!user) {
        req.flash('error', 'Please log in first.');
        return res.redirect('/login');
    }

    const allowedCategories = ['Adventure', 'Culture', 'Food', 'Nature', 'Relaxation', 'Shopping'];
    const allowedStatuses = ['planned', 'completed', 'cancelled'];
    const numericPrice = Number(price);
    const numericRating = rating ? Number(rating) : null;
    const requiredText = [title, city, country, itinerary];
    const validDate = /^\d{4}-\d{2}-\d{2}$/.test(experienceDate || '');

    if (requiredText.some((value) => !value || !value.trim()) ||
        !allowedCategories.includes(category) || !validDate || price === undefined || price === '' ||
        !Number.isFinite(numericPrice) || numericPrice < 0 ||
        (numericRating !== null && (!Number.isInteger(numericRating) || numericRating < 1 || numericRating > 5)) ||
        !allowedStatuses.includes(status)) {
        req.flash('error', 'Please enter valid experience details.');
        return res.redirect(`/experiences/${experienceId}/edit`);
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

        // ==================== CHANGE 5: Image update is now a plain link ====================
        // OLD CODE (removed):
        //   let image = req.body.currentImage;
        //   if (req.file) { image = req.file.filename; }
        // NEW CODE: "image" is destructured directly from req.body above as
        // a URL string. The edit form should pre-fill this text input with
        // the experience's current image link, so if the user leaves it
        // unchanged, the same URL gets written back.
        const imageLink = image && image.trim() ? image.trim() : null;
        // ====================================================================================

        const sql = `
            UPDATE experiences
            SET title = ?, city = ?, country = ?, category = ?, itinerary = ?,
                experienceDate = ?, price = ?, rating = ?, status = ?, image = ?
            WHERE experienceId = ?
        `;
        const values = [
            title.trim(), city.trim(), country.trim(), category, itinerary.trim(),
            experienceDate, numericPrice, numericRating, status, imageLink, experienceId
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
// Member 1 - Wei Loke: DONE - Registration, login, logout, sessions and role checks
// Member 2 - Ashton: DONE - Add experience, INSERT query and validation
// Member 3 - Mithulen: DONE - View all and view one experience using SELECT queries
// Member 4 - Jerome: DONE - Edit, update, delete and ownership checks
// Member 5 - Cruz: DONE - Search, filter, sorting and admin management

// ==================== Member 3 - Mithulen: Popular Destinations ====================
app.get('/popular', (req, res) => {
    const generalizedData = {
        'Japan': {
            image: 'general-japan.jpg',
            description: 'Experience the perfect blend of ancient traditions and futuristic technology, from serene temples to bustling neon streets and world-class cuisine.'
        },
        'South Korea': {
            image: 'general-korea.jpg',
            description: 'Discover a vibrant culture famous for its dynamic K-pop scene, mouth-watering BBQ, historic palaces, and cutting-edge fashion.'
        },
        'Thailand': {
            image: 'general-thailand.jpg',
            description: 'Enjoy golden temples, tropical islands, lively markets, and a food culture known for its bold and balanced flavours.'
        },
        'Vietnam': {
            image: 'general-vietnam.jpg',
            description: 'A country of breathtaking landscapes, rich history, and vibrant street life. From the bustling streets of Hanoi to the serene waters of Ha Long Bay.'
        },
        'Malaysia': {
            image: 'general-malaysia.jpg',
            description: 'A melting pot of cultures, Malaysia offers a unique blend of modernity and tradition, from the iconic Petronas Towers to the lush rainforests of Borneo.'
        },
        'Default': {
            image: null,
            description: 'A fantastic destination highly rated by our community of travelers. Discover what makes this place so special!'
        }
    };

    const sql = `
        SELECT
            country,
            COUNT(*) as visitCount,
            AVG(rating) as avgRating
        FROM experiences
        GROUP BY country
        ORDER BY visitCount DESC
        LIMIT 5
    `;

    db.query(sql, (error, results) => {
        if (error) {
            console.error('Error retrieving popular destinations:', error);
            req.flash('error', 'Could not load popular destinations.');
            return res.redirect('/');
        }

        const mappedDestinations = results.map(place => {
            const countryInfo = generalizedData[place.country] || generalizedData['Default'];

            return {
                ...place,
                countryImage: countryInfo.image,
                countryDesc: countryInfo.description
            };
        });

        res.render('popular', {
            title: 'Trending Destinations',
            destinations: mappedDestinations
        });
    });
});

app.use((req, res) => {
    res.status(404).render('notFound', { title: 'Page Not Found' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server started on port http://localhost:${PORT}`);
});