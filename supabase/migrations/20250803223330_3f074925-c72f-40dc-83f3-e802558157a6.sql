-- Create OAuth states table for temporary state management
CREATE TABLE IF NOT EXISTS oauth_states (
  state text PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id),
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS on oauth_states table
ALTER TABLE oauth_states ENABLE ROW LEVEL SECURITY;

-- Create policy to allow users to manage their own OAuth states
CREATE POLICY "Users can manage their own OAuth states" 
ON oauth_states 
FOR ALL 
USING (user_id = auth.uid());

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_oauth_states_user_id ON oauth_states(user_id);
CREATE INDEX IF NOT EXISTS idx_oauth_states_created_at ON oauth_states(created_at);