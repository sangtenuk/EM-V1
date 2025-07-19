/*
  # Create company_users table

  1. New Tables
    - `company_users`
      - `id` (uuid, primary key)
      - `email` (text, unique)
      - `company_id` (uuid, foreign key to companies)
      - `created_at` (timestamp)
  2. Security
    - Enable RLS on `company_users` table
    - Add policy for authenticated users to manage company users
*/

CREATE TABLE IF NOT EXISTS company_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE company_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage company users"
  ON company_users
  FOR ALL
  TO authenticated
  USING (true);