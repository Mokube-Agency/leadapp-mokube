-- Add OAuth token fields to profiles table for Google and Microsoft integration
ALTER TABLE profiles 
  ADD COLUMN IF NOT EXISTS google_access_token TEXT,
  ADD COLUMN IF NOT EXISTS google_refresh_token TEXT,
  ADD COLUMN IF NOT EXISTS microsoft_access_token TEXT,
  ADD COLUMN IF NOT EXISTS microsoft_refresh_token TEXT;