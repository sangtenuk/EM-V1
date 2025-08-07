-- Add QR code fields to quiz_sessions
ALTER TABLE quiz_sessions ADD COLUMN IF NOT EXISTS qr_code TEXT;
ALTER TABLE quiz_sessions ADD COLUMN IF NOT EXISTS qr_code_url TEXT;

-- Create index for QR code lookups
CREATE INDEX IF NOT EXISTS idx_quiz_sessions_qr_code ON quiz_sessions(qr_code); 