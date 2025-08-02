-- Add default_calendar_id column to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS default_calendar_id text;

-- Add nylas_grant_id column to profiles table if it doesn't exist
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS nylas_grant_id text;