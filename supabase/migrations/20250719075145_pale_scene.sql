/*
  # Add Voting System

  1. New Tables
    - `voting_sessions`
      - `id` (uuid, primary key)
      - `event_id` (uuid, foreign key to events)
      - `title` (text)
      - `description` (text, optional)
      - `is_active` (boolean, default false)
      - `created_at` (timestamp)
    - `voting_photos`
      - `id` (uuid, primary key)
      - `voting_session_id` (uuid, foreign key to voting_sessions)
      - `title` (text)
      - `photo_url` (text)
      - `created_at` (timestamp)
    - `votes`
      - `id` (uuid, primary key)
      - `voting_photo_id` (uuid, foreign key to voting_photos)
      - `attendee_id` (uuid, foreign key to attendees)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users to manage voting
    - Add policies for public voting access
*/

-- Create voting_sessions table
CREATE TABLE IF NOT EXISTS voting_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid REFERENCES events(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  is_active boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Create voting_photos table
CREATE TABLE IF NOT EXISTS voting_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  voting_session_id uuid REFERENCES voting_sessions(id) ON DELETE CASCADE,
  title text NOT NULL,
  photo_url text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create votes table
CREATE TABLE IF NOT EXISTS votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  voting_photo_id uuid REFERENCES voting_photos(id) ON DELETE CASCADE,
  attendee_id uuid REFERENCES attendees(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(voting_photo_id, attendee_id)
);

-- Enable RLS
ALTER TABLE voting_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE voting_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE votes ENABLE ROW LEVEL SECURITY;

-- Policies for voting_sessions
CREATE POLICY "Authenticated users can manage voting sessions"
  ON voting_sessions
  FOR ALL
  TO authenticated
  USING (true);

CREATE POLICY "Public can read active voting sessions"
  ON voting_sessions
  FOR SELECT
  TO anon
  USING (is_active = true);

-- Policies for voting_photos
CREATE POLICY "Authenticated users can manage voting photos"
  ON voting_photos
  FOR ALL
  TO authenticated
  USING (true);

CREATE POLICY "Public can read voting photos"
  ON voting_photos
  FOR SELECT
  TO anon
  USING (true);

-- Policies for votes
CREATE POLICY "Authenticated users can manage votes"
  ON votes
  FOR ALL
  TO authenticated
  USING (true);

CREATE POLICY "Public can insert votes"
  ON votes
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Public can read votes"
  ON votes
  FOR SELECT
  TO anon
  USING (true);