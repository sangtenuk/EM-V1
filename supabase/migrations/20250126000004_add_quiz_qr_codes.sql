-- Add QR code fields to quizzes table
ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS qr_code TEXT;
ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS qr_code_url TEXT;

-- Create index for QR code lookups
CREATE INDEX IF NOT EXISTS idx_quizzes_qr_code ON quizzes(qr_code); 