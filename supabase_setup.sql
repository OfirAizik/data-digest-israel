CREATE TABLE public.user_permissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  display_name TEXT,
  role TEXT DEFAULT 'viewer',
  can_access_sources BOOLEAN DEFAULT true,
  can_access_settings BOOLEAN DEFAULT false,
  can_access_history BOOLEAN DEFAULT true,
  can_access_logs BOOLEAN DEFAULT false,
  daily_run_limit INTEGER DEFAULT 3,
  runs_today INTEGER DEFAULT 0,
  last_run_date DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.run_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  user_email TEXT,
  started_at TIMESTAMPTZ DEFAULT now(),
  finished_at TIMESTAMPTZ,
  status TEXT,
  sources_scanned INTEGER DEFAULT 0,
  input_tokens INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,
  total_tokens INTEGER DEFAULT 0,
  cost_usd NUMERIC(10,6) DEFAULT 0,
  error_message TEXT,
  report_summary TEXT
);

ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.run_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin full access permissions"
ON public.user_permissions FOR ALL
USING (auth.uid() IN (SELECT user_id FROM public.user_permissions WHERE role = 'admin'));

CREATE POLICY "user sees own permissions"
ON public.user_permissions FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "admin full access logs"
ON public.run_logs FOR ALL
USING (auth.uid() IN (SELECT user_id FROM public.user_permissions WHERE role = 'admin'));

CREATE POLICY "user sees own logs"
ON public.run_logs FOR SELECT
USING (auth.uid() = user_id);
