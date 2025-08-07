-- Drop all quiz-related tables
-- Drop in reverse order due to foreign key constraints

-- Drop quiz_responses table
DROP TABLE IF EXISTS quiz_responses CASCADE;

-- Drop quiz_participants table
DROP TABLE IF EXISTS quiz_participants CASCADE;

-- Drop quiz_answers table
DROP TABLE IF EXISTS quiz_answers CASCADE;

-- Drop quiz_questions table
DROP TABLE IF EXISTS quiz_questions CASCADE;

-- Drop quiz_sessions table
DROP TABLE IF EXISTS quiz_sessions CASCADE;

-- Drop quizzes table
DROP TABLE IF EXISTS quizzes CASCADE;

-- Drop any quiz-related enums if they exist
DROP TYPE IF EXISTS quiz_session_status CASCADE; 