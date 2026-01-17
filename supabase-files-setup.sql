-- ============================================
-- Supabase Files Setup SQL
-- Run this in your Supabase SQL Editor
-- ============================================

-- 1. Create the files table (if it doesn't exist)
CREATE TABLE IF NOT EXISTS public.files (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  mime_type TEXT NOT NULL,
  extension TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Enable Row Level Security on the files table
ALTER TABLE public.files ENABLE ROW LEVEL SECURITY;

-- 3. Create RLS policies for the files table

-- Policy: Users can view their own files
CREATE POLICY "Users can view own files"
  ON public.files
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Users can insert their own files
CREATE POLICY "Users can insert own files"
  ON public.files
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own files
CREATE POLICY "Users can update own files"
  ON public.files
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own files
CREATE POLICY "Users can delete own files"
  ON public.files
  FOR DELETE
  USING (auth.uid() = user_id);

-- 4. Create a function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- 5. Create trigger to automatically update updated_at
DROP TRIGGER IF EXISTS update_files_updated_at ON public.files;
CREATE TRIGGER update_files_updated_at
  BEFORE UPDATE ON public.files
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 6. Create storage bucket (if it doesn't exist)
-- IMPORTANT: The bucket must be created before the policies can be applied
-- This SQL will attempt to create it, but you may need to create it manually in the Dashboard
-- Go to Storage > New bucket > Name: "files" > Private (not public)

-- Try to create the bucket (may fail if you don't have permission, create manually if needed)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('files', 'files', false, 52428800, NULL) -- 50MB limit, all file types allowed
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 52428800;

-- 7. Storage bucket policies (run these after creating the bucket)
-- These policies allow authenticated users to upload/download/delete their own files
-- Note: Since the bucket is private, we use signed URLs for downloads (handled in code)

-- Policy: Users can upload files to their own folder
-- The path structure is: user_id/filename.ext
-- We check if the path starts with the user's UUID followed by a slash
CREATE POLICY "Users can upload own files"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'files' AND
    (name ~ ('^' || auth.uid()::text || '/'))
  );

-- Policy: Users can view their own files
CREATE POLICY "Users can view own files"
  ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'files' AND
    (name ~ ('^' || auth.uid()::text || '/'))
  );

-- Policy: Users can delete their own files
CREATE POLICY "Users can delete own files"
  ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'files' AND
    (name ~ ('^' || auth.uid()::text || '/'))
  );

-- Policy: Users can update their own files
CREATE POLICY "Users can update own files"
  ON storage.objects
  FOR UPDATE
  USING (
    bucket_id = 'files' AND
    (name ~ ('^' || auth.uid()::text || '/'))
  )
  WITH CHECK (
    bucket_id = 'files' AND
    (name ~ ('^' || auth.uid()::text || '/'))
  );
