-- Personal Blog Service Database Initialization
-- This script runs when the MySQL container starts for the first time

-- Create database if not exists
CREATE DATABASE IF NOT EXISTS personal_blog;

-- Use the database
USE personal_blog;

-- Grant privileges to alex user
GRANT ALL PRIVILEGES ON personal_blog.* TO 'alex'@'%';
FLUSH PRIVILEGES;

-- Create initial tables can be added here if needed
-- Example:
-- CREATE TABLE IF NOT EXISTS test_connection (
--     id INT AUTO_INCREMENT PRIMARY KEY,
--     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
-- );