-- Drop existing events table and all dependent objects
DROP TABLE IF EXISTS events CASCADE;

-- Create events table with TIMESTAMPTZ for event_date to support date and time
CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  event_date TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index on user_id for faster queries
CREATE INDEX idx_events_user_id ON events(user_id);

-- Create index on event_date for faster date-based queries
CREATE INDEX idx_events_event_date ON events(event_date);

-- Create index on user_id and event_date for combined queries
CREATE INDEX idx_events_user_date ON events(user_id, event_date);

-- Enable Row Level Security
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own events
CREATE POLICY "Users can view their own events"
  ON events
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Users can only insert their own events
CREATE POLICY "Users can insert their own events"
  ON events
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can only update their own events
CREATE POLICY "Users can update their own events"
  ON events
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can only delete their own events
CREATE POLICY "Users can delete their own events"
  ON events
  FOR DELETE
  USING (auth.uid() = user_id);

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at on row update
CREATE TRIGGER update_events_updated_at
  BEFORE UPDATE ON events
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
