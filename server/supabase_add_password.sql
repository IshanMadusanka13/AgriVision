-- Add password field to users table
-- Run this in Supabase SQL Editor

-- Add password_hash column to users table
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS password_hash TEXT;

-- Create index on email for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
