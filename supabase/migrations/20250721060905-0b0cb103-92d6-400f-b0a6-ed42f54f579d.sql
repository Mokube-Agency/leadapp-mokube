-- Create index for fast message queries by contact and creation time
CREATE INDEX IF NOT EXISTS idx_messages_contact_created 
ON messages (contact_id, created_at DESC);