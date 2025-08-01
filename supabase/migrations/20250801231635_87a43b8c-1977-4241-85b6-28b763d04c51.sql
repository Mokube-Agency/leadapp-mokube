-- Create table for storing Nylas OAuth connections
CREATE TABLE public.nylas_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  organization_id UUID NOT NULL,
  nylas_grant_id TEXT,
  access_token TEXT,
  refresh_token TEXT,
  email_address TEXT,
  provider TEXT, -- gmail, outlook, etc.
  provider_email_address TEXT,
  connected_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.nylas_accounts ENABLE ROW LEVEL SECURITY;

-- Create policies for nylas_accounts
CREATE POLICY "Users can view their own nylas accounts" 
ON public.nylas_accounts 
FOR SELECT 
USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own nylas accounts" 
ON public.nylas_accounts 
FOR INSERT 
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own nylas accounts" 
ON public.nylas_accounts 
FOR UPDATE 
USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own nylas accounts" 
ON public.nylas_accounts 
FOR DELETE 
USING (user_id = auth.uid());

-- Add trigger for automatic timestamp updates
CREATE TRIGGER update_nylas_accounts_updated_at
BEFORE UPDATE ON public.nylas_accounts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster lookups
CREATE INDEX idx_nylas_accounts_user_id ON public.nylas_accounts(user_id);
CREATE INDEX idx_nylas_accounts_organization_id ON public.nylas_accounts(organization_id);