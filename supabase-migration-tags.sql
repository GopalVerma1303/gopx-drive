-- Migration script for tags system
-- Run this in your Supabase SQL editor

-- 1. Create tags table
CREATE TABLE IF NOT EXISTS tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, name) -- Ensure unique tag names per user
);

-- 2. Create note_tags junction table (many-to-many relationship)
CREATE TABLE IF NOT EXISTS note_tags (
  note_id UUID NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (note_id, tag_id)
);

-- 3. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_tags_user_id ON tags(user_id);
CREATE INDEX IF NOT EXISTS idx_note_tags_note_id ON note_tags(note_id);
CREATE INDEX IF NOT EXISTS idx_note_tags_tag_id ON note_tags(tag_id);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE note_tags ENABLE ROW LEVEL SECURITY;

-- 5. Create RLS policies for tags table
-- Users can only see their own tags
CREATE POLICY "Users can view their own tags"
  ON tags FOR SELECT
  USING (auth.uid() = user_id);

-- Users can create their own tags
CREATE POLICY "Users can create their own tags"
  ON tags FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own tags
CREATE POLICY "Users can update their own tags"
  ON tags FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own tags
CREATE POLICY "Users can delete their own tags"
  ON tags FOR DELETE
  USING (auth.uid() = user_id);

-- 6. Create RLS policies for note_tags table
-- Users can view note_tags for their notes
CREATE POLICY "Users can view note_tags for their notes"
  ON note_tags FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM notes
      WHERE notes.id = note_tags.note_id
      AND notes.user_id = auth.uid()
    )
  );

-- Users can create note_tags for their notes
CREATE POLICY "Users can create note_tags for their notes"
  ON note_tags FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM notes
      WHERE notes.id = note_tags.note_id
      AND notes.user_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM tags
      WHERE tags.id = note_tags.tag_id
      AND tags.user_id = auth.uid()
    )
  );

-- Users can delete note_tags for their notes
CREATE POLICY "Users can delete note_tags for their notes"
  ON note_tags FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM notes
      WHERE notes.id = note_tags.note_id
      AND notes.user_id = auth.uid()
    )
  );

-- 7. Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 8. Create trigger for tags updated_at
CREATE TRIGGER update_tags_updated_at
  BEFORE UPDATE ON tags
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 9. Function to create default tag for existing users
-- This will be called when a user first accesses tags
-- You can also run this manually for existing users:
-- INSERT INTO tags (user_id, name) 
-- SELECT DISTINCT user_id, 'Default' FROM notes 
-- WHERE NOT EXISTS (
--   SELECT 1 FROM tags WHERE tags.user_id = notes.user_id AND tags.name = 'Default'
-- )
-- ON CONFLICT (user_id, name) DO NOTHING;
