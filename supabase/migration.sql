-- SyncSlide Database Schema
-- Run this SQL in your Supabase SQL Editor
-- Refresh page after running

-- Grant anon role access to the public schema tables
GRANT USAGE ON SCHEMA public TO anon;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon;

-- Sessions table
CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(6) UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sessions_code ON sessions(code);

-- Slides table
CREATE TABLE IF NOT EXISTS slides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  name TEXT DEFAULT '',
  slide_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_slides_session ON slides(session_id);

-- Drawings table
CREATE TABLE IF NOT EXISTS drawings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  slide_index INT DEFAULT 0,
  stroke_data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_drawings_session_slide ON drawings(session_id, slide_index);

-- Enable Row Level Security
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE slides ENABLE ROW LEVEL SECURITY;
ALTER TABLE drawings ENABLE ROW LEVEL SECURITY;

-- Drop all existing policies first so this script is idempotent
DROP POLICY IF EXISTS "Public access for sessions" ON sessions;
DROP POLICY IF EXISTS "Public access for slides" ON slides;
DROP POLICY IF EXISTS "Public access for drawings" ON drawings;
DROP POLICY IF EXISTS "Public select sessions" ON sessions;
DROP POLICY IF EXISTS "Public insert sessions" ON sessions;
DROP POLICY IF EXISTS "Public delete sessions" ON sessions;
DROP POLICY IF EXISTS "Public select slides" ON slides;
DROP POLICY IF EXISTS "Public insert slides" ON slides;
DROP POLICY IF EXISTS "Public delete slides" ON slides;
DROP POLICY IF EXISTS "Public update slides" ON slides;
DROP POLICY IF EXISTS "Public select drawings" ON drawings;
DROP POLICY IF EXISTS "Public insert drawings" ON drawings;
DROP POLICY IF EXISTS "Public delete drawings" ON drawings;
DROP POLICY IF EXISTS "Public update drawings" ON drawings;

-- Public access policies (FOR INSERT requires WITH CHECK, not USING)
CREATE POLICY "Public select sessions" ON sessions FOR SELECT USING (true);
CREATE POLICY "Public insert sessions" ON sessions FOR INSERT WITH CHECK (true);
CREATE POLICY "Public delete sessions" ON sessions FOR DELETE USING (true);

CREATE POLICY "Public select slides" ON slides FOR SELECT USING (true);
CREATE POLICY "Public insert slides" ON slides FOR INSERT WITH CHECK (true);
CREATE POLICY "Public delete slides" ON slides FOR DELETE USING (true);
CREATE POLICY "Public update slides" ON slides FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "Public select drawings" ON drawings FOR SELECT USING (true);
CREATE POLICY "Public insert drawings" ON drawings FOR INSERT WITH CHECK (true);
CREATE POLICY "Public delete drawings" ON drawings FOR DELETE USING (true);
CREATE POLICY "Public update drawings" ON drawings FOR UPDATE USING (true) WITH CHECK (true);

-- Enable Realtime for tables (skip if already added)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'sessions') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE sessions;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'slides') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE slides;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'drawings') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE drawings;
  END IF;
END $$;

-- Create storage bucket for slides — MUST DO THIS MANUALLY:
-- 1. Go to Supabase Dashboard → Storage
-- 2. Click "Create bucket"
-- 3. Name: "slides"  (all lowercase, exactly this)
-- 4. Check "Public bucket"
-- 5. Click "Create"
-- Then run the rest of this script.

-- Allow public access to the slides bucket via storage RLS
DROP POLICY IF EXISTS "Public upload slides" ON storage.objects;
DROP POLICY IF EXISTS "Public read slides" ON storage.objects;
DROP POLICY IF EXISTS "Public delete slides" ON storage.objects;

CREATE POLICY "Public upload slides" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'slides');
CREATE POLICY "Public read slides" ON storage.objects FOR SELECT USING (bucket_id = 'slides');
CREATE POLICY "Public delete slides" ON storage.objects FOR DELETE USING (bucket_id = 'slides');

-- Give anon usage on storage schema
GRANT USAGE ON SCHEMA storage TO anon;
GRANT ALL ON ALL TABLES IN SCHEMA storage TO anon;

-- SECURITY DEFINER function to insert slides (bypasses RLS for postgREST)
CREATE OR REPLACE FUNCTION insert_slide(
  p_session_id UUID, p_url TEXT, p_name TEXT, p_slide_order INT
) RETURNS SETOF slides
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN QUERY INSERT INTO slides (session_id, url, name, slide_order)
  VALUES (p_session_id, p_url, p_name, p_slide_order)
  RETURNING *;
END;
$$;

-- Grant execute on the function to anon role
GRANT EXECUTE ON FUNCTION insert_slide TO anon;
