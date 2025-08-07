-- Data Export Script for EM-V1 Migration
-- Run this on your CURRENT Supabase project to export data

-- =====================================================
-- EXPORT ALL DATA (Run this on OLD project)
-- =====================================================

-- Export companies
SELECT 
    id,
    name,
    person_in_charge,
    contact_number,
    email,
    logo,
    features_enabled,
    created_at,
    syncStatus,
    lastSynced,
    isLocal
FROM companies
ORDER BY created_at;

-- Export company users
SELECT 
    id,
    email,
    company_id,
    created_at,
    syncStatus,
    lastSynced,
    isLocal
FROM company_users
ORDER BY created_at;

-- Export events
SELECT 
    id,
    company_id,
    name,
    description,
    date,
    location,
    max_attendees,
    registration_qr,
    offline_qr,
    custom_background,
    custom_logo,
    max_gallery_uploads,
    created_at,
    mode,
    syncStatus,
    lastSynced,
    isLocal
FROM events
ORDER BY created_at;

-- Export attendees
SELECT 
    id,
    event_id,
    name,
    email,
    phone,
    company,
    identification_number,
    staff_id,
    table_assignment,
    table_type,
    checked_in,
    check_in_time,
    table_number,
    seat_number,
    face_photo_url,
    created_at,
    syncStatus,
    lastSynced,
    isLocal
FROM attendees
ORDER BY created_at;

-- Export lucky draw winners
SELECT 
    id,
    event_id,
    attendee_id,
    winner_name,
    winner_company,
    table_number,
    is_table_winner,
    table_type,
    prize_id,
    prize_title,
    prize_description,
    prize_position,
    draw_type,
    draw_session_id,
    created_at,
    syncStatus,
    lastSynced,
    isLocal
FROM lucky_draw_winners
ORDER BY created_at;

-- Export voting sessions
SELECT 
    id,
    event_id,
    title,
    description,
    start_time,
    end_time,
    is_active,
    created_at
FROM voting_sessions
ORDER BY created_at;

-- Export voting options
SELECT 
    id,
    session_id,
    option_text,
    created_at
FROM voting_options
ORDER BY created_at;

-- Export voting votes
SELECT 
    id,
    session_id,
    option_id,
    attendee_id,
    voted_at
FROM voting_votes
ORDER BY voted_at;

-- Export quiz sessions
SELECT 
    id,
    event_id,
    title,
    description,
    start_time,
    end_time,
    is_active,
    is_paused,
    created_at
FROM quiz_sessions
ORDER BY created_at;

-- Export quiz questions
SELECT 
    id,
    session_id,
    question_text,
    question_type,
    options,
    correct_answer,
    points,
    time_limit,
    order_index,
    created_at
FROM quiz_questions
ORDER BY order_index, created_at;

-- Export quiz participants
SELECT 
    id,
    session_id,
    attendee_id,
    staff_id,
    score,
    answers,
    started_at,
    completed_at,
    created_at
FROM quiz_participants
ORDER BY created_at;

-- Export quiz winners
SELECT 
    id,
    session_id,
    attendee_id,
    winner_name,
    score,
    rank,
    created_at
FROM quiz_winners
ORDER BY rank, created_at;

-- Export gallery uploads
SELECT 
    id,
    event_id,
    file_name,
    file_url,
    file_type,
    file_size,
    uploaded_by,
    created_at
FROM gallery_uploads
ORDER BY created_at;

-- =====================================================
-- DATA IMPORT TEMPLATE (Use this on NEW project)
-- =====================================================

-- After running the migration script on your new project,
-- you can import the data using these INSERT statements:

/*
-- Example: Import companies
INSERT INTO companies (id, name, person_in_charge, contact_number, email, logo, features_enabled, created_at, syncStatus, lastSynced, isLocal)
VALUES 
    ('uuid-here', 'Company Name', 'Person', '123456789', 'email@example.com', 'logo-url', '{"registration": true}', '2024-01-01', 'synced', '2024-01-01', false);

-- Example: Import company users
INSERT INTO company_users (id, email, company_id, created_at, syncStatus, lastSynced, isLocal)
VALUES 
    ('uuid-here', 'user@example.com', 'company-uuid', '2024-01-01', 'synced', '2024-01-01', false);

-- Continue with other tables...
*/ 