-- Organisaties (multi-tenant)
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  ai_paused BOOLEAN DEFAULT false,
  stripe_customer_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Contactpersonen
CREATE TABLE contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  whatsapp_number TEXT NOT NULL,
  full_name TEXT,
  last_message_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Berichten
CREATE TYPE role_enum AS ENUM ('user', 'agent', 'human', 'system');

CREATE TABLE messages (
  id BIGSERIAL PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  role role_enum NOT NULL,
  body TEXT,
  twilio_sid TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Profiles table for additional user information
CREATE TABLE profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  display_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Row Level Security
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policies for organizations
CREATE POLICY "Users can view their own organization" 
ON organizations 
FOR SELECT 
USING (
  id IN (
    SELECT organization_id 
    FROM profiles 
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can update their own organization" 
ON organizations 
FOR UPDATE 
USING (
  id IN (
    SELECT organization_id 
    FROM profiles 
    WHERE user_id = auth.uid()
  )
);

-- RLS Policies for contacts
CREATE POLICY "Users can view contacts in their organization" 
ON contacts 
FOR SELECT 
USING (
  organization_id IN (
    SELECT organization_id 
    FROM profiles 
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert contacts in their organization" 
ON contacts 
FOR INSERT 
WITH CHECK (
  organization_id IN (
    SELECT organization_id 
    FROM profiles 
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can update contacts in their organization" 
ON contacts 
FOR UPDATE 
USING (
  organization_id IN (
    SELECT organization_id 
    FROM profiles 
    WHERE user_id = auth.uid()
  )
);

-- RLS Policies for messages
CREATE POLICY "Users can view messages in their organization" 
ON messages 
FOR SELECT 
USING (
  organization_id IN (
    SELECT organization_id 
    FROM profiles 
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert messages in their organization" 
ON messages 
FOR INSERT 
WITH CHECK (
  organization_id IN (
    SELECT organization_id 
    FROM profiles 
    WHERE user_id = auth.uid()
  )
);

-- RLS Policies for profiles
CREATE POLICY "Users can view their own profile" 
ON profiles 
FOR SELECT 
USING (user_id = auth.uid());

CREATE POLICY "Users can update their own profile" 
ON profiles 
FOR UPDATE 
USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own profile" 
ON profiles 
FOR INSERT 
WITH CHECK (user_id = auth.uid());

-- Function to update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for automatic timestamp updates
CREATE TRIGGER update_organizations_updated_at
  BEFORE UPDATE ON organizations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_contacts_updated_at
  BEFORE UPDATE ON contacts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Indexes for better performance
CREATE INDEX idx_contacts_organization_id ON contacts(organization_id);
CREATE INDEX idx_contacts_whatsapp_number ON contacts(whatsapp_number);
CREATE INDEX idx_messages_contact_id ON messages(contact_id);
CREATE INDEX idx_messages_organization_id ON messages(organization_id);
CREATE INDEX idx_messages_created_at ON messages(created_at);
CREATE INDEX idx_profiles_user_id ON profiles(user_id);
CREATE INDEX idx_profiles_organization_id ON profiles(organization_id);

-- Enable realtime for tables
ALTER PUBLICATION supabase_realtime ADD TABLE contacts;
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE organizations;