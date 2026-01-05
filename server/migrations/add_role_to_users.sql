-- Add role column to users table
-- Run this in your Supabase SQL editor

ALTER TABLE users
ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'user';

-- Add check constraint to ensure role is either 'user' or 'admin'
ALTER TABLE users
ADD CONSTRAINT users_role_check
CHECK (role IN ('user', 'admin'));

-- Create index on role column for better performance
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- Optional: Make the first user an admin (replace with your email)
-- UPDATE users SET role = 'admin' WHERE email = 'your-admin-email@example.com';
