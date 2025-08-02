-- Create organization invites table
CREATE TABLE IF NOT EXISTS public.organization_invites (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  email text NOT NULL,
  invited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired')),
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE public.organization_invites ENABLE ROW LEVEL SECURITY;

-- Create policies for organization invites
CREATE POLICY "Users can view invites for their organization" 
ON public.organization_invites 
FOR SELECT 
USING (organization_id IN (
  SELECT profiles.organization_id 
  FROM profiles 
  WHERE profiles.user_id = auth.uid()
));

CREATE POLICY "Users can insert invites for their organization" 
ON public.organization_invites 
FOR INSERT 
WITH CHECK (organization_id IN (
  SELECT profiles.organization_id 
  FROM profiles 
  WHERE profiles.user_id = auth.uid()
));

CREATE POLICY "Users can update invites for their organization" 
ON public.organization_invites 
FOR UPDATE 
USING (organization_id IN (
  SELECT profiles.organization_id 
  FROM profiles 
  WHERE profiles.user_id = auth.uid()
));

-- Add trigger for updated_at
CREATE TRIGGER update_organization_invites_updated_at
BEFORE UPDATE ON public.organization_invites
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();