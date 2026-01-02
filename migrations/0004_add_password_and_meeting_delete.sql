-- Add password column to users table for authentication
-- Use simple password hash (in production, use proper bcrypt/argon2)
ALTER TABLE users ADD COLUMN password_hash TEXT;

-- Create index for faster login queries
CREATE INDEX IF NOT EXISTS idx_users_email_password ON users(email);
