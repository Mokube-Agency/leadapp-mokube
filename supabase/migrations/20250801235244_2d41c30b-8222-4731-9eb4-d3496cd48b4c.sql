-- Add nylas_connected column to profiles table to track calendar connection state
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS nylas_connected boolean DEFAULT false;