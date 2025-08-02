-- Create organization_users table for membership tracking
CREATE TABLE IF NOT EXISTS public.organization_users (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'member',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(organization_id, user_id)
);

-- Enable RLS
ALTER TABLE public.organization_users ENABLE ROW LEVEL SECURITY;

-- Create policies for organization_users
CREATE POLICY "Users can view their own organization memberships" 
ON public.organization_users 
FOR SELECT 
USING (user_id = auth.uid());

CREATE POLICY "Users can view members of their organization" 
ON public.organization_users 
FOR SELECT 
USING (organization_id IN (
  SELECT organization_id 
  FROM public.profiles 
  WHERE user_id = auth.uid()
));

CREATE POLICY "Users can insert organization memberships through invites" 
ON public.organization_users 
FOR INSERT 
WITH CHECK (user_id = auth.uid());

-- Create trigger for updated_at
CREATE TRIGGER update_organization_users_updated_at
BEFORE UPDATE ON public.organization_users
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();