-- Create email_messages table for Nylas email synchronization
CREATE TABLE public.email_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  organization_id UUID NOT NULL,
  nylas_message_id TEXT NOT NULL,
  from_address TEXT NOT NULL,
  to_address TEXT NOT NULL,
  subject TEXT,
  body TEXT,
  received_at TIMESTAMP WITH TIME ZONE NOT NULL,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.email_messages ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view their own email messages" 
ON public.email_messages 
FOR SELECT 
USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own email messages" 
ON public.email_messages 
FOR INSERT 
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own email messages" 
ON public.email_messages 
FOR UPDATE 
USING (user_id = auth.uid());

-- Create index for better performance
CREATE INDEX idx_email_messages_user_received ON public.email_messages(user_id, received_at DESC);
CREATE INDEX idx_email_messages_nylas_id ON public.email_messages(nylas_message_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_email_messages_updated_at
BEFORE UPDATE ON public.email_messages
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();