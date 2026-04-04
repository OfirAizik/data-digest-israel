-- Run this in the Supabase SQL editor to create the digest_reports table.
-- The table stores each generated report with its topics as JSONB.

create table if not exists digest_reports (
  id                  uuid        primary key default gen_random_uuid(),
  created_at          timestamptz not null    default now(),
  report_date         date,
  source              text,
  total_posts         integer,
  topics              jsonb,
  active_sources_count integer
);

-- Index for fast reverse-chronological listing
create index if not exists digest_reports_created_at_idx
  on digest_reports (created_at desc);

-- Optional: enable Row Level Security (RLS) and allow authenticated reads
-- alter table digest_reports enable row level security;
-- create policy "authenticated users can read reports"
--   on digest_reports for select using (auth.role() = 'authenticated');
