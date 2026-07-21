USE c237_020_ca2team1;

DROP TABLE IF EXISTS experiences;
DROP TABLE IF EXISTS users;

CREATE TABLE users (
    userId INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    password CHAR(40) NOT NULL,
    role ENUM('user', 'admin') NOT NULL DEFAULT 'user',
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE experiences (
    experienceId INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(150) NOT NULL,
    destination VARCHAR(150) NOT NULL,
    country VARCHAR(100) NOT NULL,
    category VARCHAR(80) NOT NULL,
    description TEXT NOT NULL,
    experienceDate DATE NOT NULL,
    price DECIMAL(10, 2) NOT NULL DEFAULT 0,
    rating TINYINT UNSIGNED NULL,
    status ENUM('planned', 'completed', 'cancelled') NOT NULL DEFAULT 'planned',
    image VARCHAR(255) NULL,
    userId INT NOT NULL,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_experience_user
        FOREIGN KEY (userId) REFERENCES users(userId)
        ON DELETE CASCADE,
    CONSTRAINT chk_rating CHECK (rating IS NULL OR rating BETWEEN 1 AND 5),
    CONSTRAINT chk_price CHECK (price >= 0)
);

-- Starter admin account: admin@travelplanner.com / admin123
-- Change this password after the team confirms the application works.
INSERT INTO users (username, email, password, role)
VALUES ('Travel Admin', 'admin@travelplanner.com', SHA1('admin123'), 'admin');
