ALTER TABLE public.service_suggestions ADD COLUMN IF NOT EXISTS is_visible BOOLEAN NOT NULL DEFAULT true;
