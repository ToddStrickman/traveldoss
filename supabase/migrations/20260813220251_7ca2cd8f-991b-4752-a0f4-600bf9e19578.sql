CREATE TABLE public.contact_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  email TEXT NOT NULL,
  name TEXT,
  category TEXT NOT NULL,
  message TEXT NOT NULL,
  CONSTRAINT contact_messages_message_len CHECK (char_length(message) <= 5000),
  CONSTRAINT contact_messages_email_len CHECK (char_length(email) <= 320),
  CONSTRAINT contact_messages_category_valid CHECK (category IN ('general','support','legal_notice','arbitration_opt_out'))
);

GRANT ALL ON public.contact_messages TO service_role;

ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;

-- No policies for anon/authenticated: submissions are written only by the
-- server function using the service-role client, and nobody can read them
-- through the Data API.