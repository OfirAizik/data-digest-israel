-- Create table
CREATE TABLE public.telegram_channels (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    name        TEXT NOT NULL,
    username    TEXT NOT NULL UNIQUE,
    platform    TEXT NOT NULL DEFAULT 'telegram',
    category    TEXT,
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    is_member   BOOLEAN NOT NULL DEFAULT FALSE,
    notes       TEXT
);

-- Enable Row Level Security
ALTER TABLE public.telegram_channels ENABLE ROW LEVEL SECURITY;

-- Public can SELECT
CREATE POLICY "Public can select telegram_channels"
    ON public.telegram_channels
    FOR SELECT
    TO PUBLIC
    USING (TRUE);

-- Authenticated users can do ALL
CREATE POLICY "Authenticated users have full access to telegram_channels"
    ON public.telegram_channels
    FOR ALL
    TO authenticated
    USING (TRUE)
    WITH CHECK (TRUE);

-- Seed first channel
INSERT INTO public.telegram_channels (name, username, category, is_active, is_member)
VALUES ('Machine & Deep Learning Israel', 'MDLI1', 'ML/DL/AI', TRUE, TRUE);
