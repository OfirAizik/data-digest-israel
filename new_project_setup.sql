-- =============================================================
-- new_project_setup.sql
-- Full schema for data-digest-israel Supabase project
-- Tables: channels, user_permissions, run_logs, digest_reports, app_config
-- =============================================================

-- ---------------------------------------------------------------
-- 1. channels  (telegram / other sources)
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.channels (
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

ALTER TABLE public.channels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can select channels"
    ON public.channels FOR SELECT
    TO PUBLIC USING (TRUE);

CREATE POLICY "Authenticated users have full access to channels"
    ON public.channels FOR ALL
    TO authenticated
    USING (TRUE) WITH CHECK (TRUE);

-- Seed data
INSERT INTO public.channels (name, username, category, is_active, is_member)
VALUES
    ('Machine & Deep Learning Israel', 'MDLI1',           'ML/DL/AI', TRUE, TRUE),
    ('Data Science Israel',            'DataScienceIL',   'Data',     TRUE, FALSE),
    ('Israeli Tech News',              'IsraeliTechNews', 'Tech',     TRUE, FALSE)
ON CONFLICT (username) DO NOTHING;


-- ---------------------------------------------------------------
-- 2. user_permissions
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_permissions (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                 UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    email                   TEXT NOT NULL,
    display_name            TEXT,
    role                    TEXT DEFAULT 'viewer',
    can_access_sources      BOOLEAN DEFAULT TRUE,
    can_access_settings     BOOLEAN DEFAULT FALSE,
    can_access_history      BOOLEAN DEFAULT TRUE,
    can_access_logs         BOOLEAN DEFAULT FALSE,
    daily_run_limit         INTEGER DEFAULT 3,
    runs_today              INTEGER DEFAULT 0,
    last_run_date           DATE,
    created_at              TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin full access permissions"
    ON public.user_permissions FOR ALL
    USING (auth.uid() IN (
        SELECT user_id FROM public.user_permissions WHERE role = 'admin'
    ));

CREATE POLICY "user sees own permissions"
    ON public.user_permissions FOR SELECT
    USING (auth.uid() = user_id);


-- ---------------------------------------------------------------
-- 3. run_logs
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.run_logs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID REFERENCES auth.users(id),
    user_email      TEXT,
    started_at      TIMESTAMPTZ DEFAULT now(),
    finished_at     TIMESTAMPTZ,
    status          TEXT,
    sources_scanned INTEGER DEFAULT 0,
    input_tokens    INTEGER DEFAULT 0,
    output_tokens   INTEGER DEFAULT 0,
    total_tokens    INTEGER DEFAULT 0,
    cost_usd        NUMERIC(10,6) DEFAULT 0,
    error_message   TEXT,
    report_summary  TEXT
);

ALTER TABLE public.run_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin full access logs"
    ON public.run_logs FOR ALL
    USING (auth.uid() IN (
        SELECT user_id FROM public.user_permissions WHERE role = 'admin'
    ));

CREATE POLICY "user sees own logs"
    ON public.run_logs FOR SELECT
    USING (auth.uid() = user_id);


-- ---------------------------------------------------------------
-- 4. digest_reports
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.digest_reports (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    report_date          DATE,
    source               TEXT,
    total_posts          INTEGER,
    topics               JSONB,
    active_sources_count INTEGER
);

CREATE INDEX IF NOT EXISTS digest_reports_created_at_idx
    ON public.digest_reports (created_at DESC);

ALTER TABLE public.digest_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read digest_reports"
    ON public.digest_reports FOR SELECT
    TO authenticated USING (TRUE);

CREATE POLICY "Authenticated users can insert digest_reports"
    ON public.digest_reports FOR INSERT
    TO authenticated WITH CHECK (TRUE);


-- ---------------------------------------------------------------
-- 5. app_config
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.app_config (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key         TEXT NOT NULL UNIQUE,
    value       TEXT,
    description TEXT,
    updated_at  TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read app_config"
    ON public.app_config FOR SELECT
    TO authenticated USING (TRUE);

CREATE POLICY "admin full access app_config"
    ON public.app_config FOR ALL
    USING (auth.uid() IN (
        SELECT user_id FROM public.user_permissions WHERE role = 'admin'
    ));

-- Seed default config values
INSERT INTO public.app_config (key, value, description)
VALUES
    ('digest_lookback_hours', '24',    'How many hours back to scan for messages'),
    ('max_topics_per_report', '10',    'Maximum number of topics to include in a digest'),
    ('min_posts_per_topic',   '2',     'Minimum posts required to form a topic'),
    ('digest_language',       'he',    'Output language for digests (he=Hebrew, en=English)')
ON CONFLICT (key) DO NOTHING;
