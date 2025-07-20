-- Drop existing RLS policies that use JWT claims
DROP POLICY IF EXISTS "Users can view contacts in their organization" ON contacts;
DROP POLICY IF EXISTS "Users can insert contacts in their organization" ON contacts;
DROP POLICY IF EXISTS "Users can update contacts in their organization" ON contacts;

-- Create new RLS policies using profiles table
CREATE POLICY "Users can view contacts in their organization" 
  ON contacts FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert contacts in their organization" 
  ON contacts FOR INSERT
  WITH CHECK (
    organization_id = (
      SELECT organization_id FROM profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update contacts in their organization" 
  ON contacts FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE user_id = auth.uid()
    )
  );

-- Remove the DEFAULT constraint since we'll set it in the application
ALTER TABLE contacts 
  ALTER COLUMN organization_id 
  DROP DEFAULT;