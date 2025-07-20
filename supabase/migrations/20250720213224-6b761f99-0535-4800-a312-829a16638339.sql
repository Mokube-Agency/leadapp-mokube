-- Add DEFAULT organization_id from JWT claims
ALTER TABLE contacts 
  ALTER COLUMN organization_id 
  SET DEFAULT (
    (current_setting('request.jwt.claims', true)::json->>'organization_id')::uuid
  );

-- Ensure organization_id is still NOT NULL
ALTER TABLE contacts 
  ALTER COLUMN organization_id 
  SET NOT NULL;

-- Drop existing RLS policies
DROP POLICY IF EXISTS "Users can view contacts in their organization" ON contacts;
DROP POLICY IF EXISTS "Users can insert contacts in their organization" ON contacts;
DROP POLICY IF EXISTS "Users can update contacts in their organization" ON contacts;

-- Create new RLS policies using JWT claims
CREATE POLICY "Users can view contacts in their organization" 
  ON contacts FOR SELECT
  USING (
    organization_id = 
    (current_setting('request.jwt.claims', true)::json->>'organization_id')::uuid
  );

CREATE POLICY "Users can insert contacts in their organization" 
  ON contacts FOR INSERT
  WITH CHECK (
    organization_id = 
    (current_setting('request.jwt.claims', true)::json->>'organization_id')::uuid
  );

CREATE POLICY "Users can update contacts in their organization" 
  ON contacts FOR UPDATE
  USING (
    organization_id = 
    (current_setting('request.jwt.claims', true)::json->>'organization_id')::uuid
  );