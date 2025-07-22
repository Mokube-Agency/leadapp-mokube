-- Add twilio_status column to messages table to track delivery status
ALTER TABLE public.messages 
ADD COLUMN twilio_status TEXT;