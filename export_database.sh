#!/bin/bash

# Database Export Script for EM-V1
# This script exports the database schema and data to local files

echo "🚀 Starting database export..."

# Create export directory
EXPORT_DIR="database_export_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$EXPORT_DIR"

echo "📁 Created export directory: $EXPORT_DIR"

# Export schema only
echo "📋 Exporting database schema..."
psql -d postgres -c "
\copy (
    SELECT 
        'CREATE TABLE IF NOT EXISTS ' || table_name || ' (' ||
        string_agg(
            column_name || ' ' || data_type || 
            CASE 
                WHEN is_nullable = 'NO' THEN ' NOT NULL'
                ELSE ''
            END ||
            CASE 
                WHEN column_default IS NOT NULL THEN ' DEFAULT ' || column_default
                ELSE ''
            END,
            ', '
            ORDER BY ordinal_position
        ) ||
        ');' as schema_definition
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name IN ('companies', 'company_users', 'events', 'attendees', 'lucky_draw_winners', 'voting_sessions', 'voting_options', 'voting_votes', 'quiz_sessions', 'quiz_questions', 'quiz_participants', 'quiz_winners', 'gallery_uploads', 'tables', 'custom_backgrounds')
    GROUP BY table_name
    ORDER BY table_name
) TO '$EXPORT_DIR/schema.sql' WITH CSV HEADER;
"

# Export data for each table
echo "📊 Exporting data..."

# Companies
echo "  📦 Exporting companies..."
psql -d postgres -c "\copy companies TO '$EXPORT_DIR/companies.csv' WITH CSV HEADER;"

# Company users
echo "  📦 Exporting company_users..."
psql -d postgres -c "\copy company_users TO '$EXPORT_DIR/company_users.csv' WITH CSV HEADER;"

# Events
echo "  📦 Exporting events..."
psql -d postgres -c "\copy events TO '$EXPORT_DIR/events.csv' WITH CSV HEADER;"

# Attendees
echo "  📦 Exporting attendees..."
psql -d postgres -c "\copy attendees TO '$EXPORT_DIR/attendees.csv' WITH CSV HEADER;"

# Lucky draw winners
echo "  📦 Exporting lucky_draw_winners..."
psql -d postgres -c "\copy lucky_draw_winners TO '$EXPORT_DIR/lucky_draw_winners.csv' WITH CSV HEADER;"

# Voting sessions
echo "  📦 Exporting voting_sessions..."
psql -d postgres -c "\copy voting_sessions TO '$EXPORT_DIR/voting_sessions.csv' WITH CSV HEADER;"

# Voting options
echo "  📦 Exporting voting_options..."
psql -d postgres -c "\copy voting_options TO '$EXPORT_DIR/voting_options.csv' WITH CSV HEADER;"

# Voting votes
echo "  📦 Exporting voting_votes..."
psql -d postgres -c "\copy voting_votes TO '$EXPORT_DIR/voting_votes.csv' WITH CSV HEADER;"

# Quiz sessions
echo "  📦 Exporting quiz_sessions..."
psql -d postgres -c "\copy quiz_sessions TO '$EXPORT_DIR/quiz_sessions.csv' WITH CSV HEADER;"

# Quiz questions
echo "  📦 Exporting quiz_questions..."
psql -d postgres -c "\copy quiz_questions TO '$EXPORT_DIR/quiz_questions.csv' WITH CSV HEADER;"

# Quiz participants
echo "  📦 Exporting quiz_participants..."
psql -d postgres -c "\copy quiz_participants TO '$EXPORT_DIR/quiz_participants.csv' WITH CSV HEADER;"

# Quiz winners
echo "  📦 Exporting quiz_winners..."
psql -d postgres -c "\copy quiz_winners TO '$EXPORT_DIR/quiz_winners.csv' WITH CSV HEADER;"

# Gallery uploads
echo "  📦 Exporting gallery_uploads..."
psql -d postgres -c "\copy gallery_uploads TO '$EXPORT_DIR/gallery_uploads.csv' WITH CSV HEADER;"

# Tables
echo "  📦 Exporting tables..."
psql -d postgres -c "\copy tables TO '$EXPORT_DIR/tables.csv' WITH CSV HEADER;"

# Custom backgrounds
echo "  📦 Exporting custom_backgrounds..."
psql -d postgres -c "\copy custom_backgrounds TO '$EXPORT_DIR/custom_backgrounds.csv' WITH CSV HEADER;"

# Export indexes
echo "🔍 Exporting indexes..."
psql -d postgres -c "
\copy (
    SELECT 
        'CREATE INDEX IF NOT EXISTS ' || indexname || ' ON ' || tablename || '(' || 
        string_agg(attname, ', ' ORDER BY attnum) || ');' as index_definition
    FROM pg_indexes 
    WHERE schemaname = 'public' 
    AND tablename IN ('companies', 'company_users', 'events', 'attendees', 'lucky_draw_winners', 'voting_sessions', 'voting_options', 'voting_votes', 'quiz_sessions', 'quiz_questions', 'quiz_participants', 'quiz_winners', 'gallery_uploads', 'tables', 'custom_backgrounds')
    GROUP BY indexname, tablename
    ORDER BY tablename, indexname
) TO '$EXPORT_DIR/indexes.sql' WITH CSV HEADER;
"

# Export RLS policies
echo "🔒 Exporting RLS policies..."
psql -d postgres -c "
\copy (
    SELECT 
        'ALTER TABLE ' || tablename || ' ENABLE ROW LEVEL SECURITY;' as rls_enable
    FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename IN ('companies', 'company_users', 'events', 'attendees', 'lucky_draw_winners', 'voting_sessions', 'voting_options', 'voting_votes', 'quiz_sessions', 'quiz_questions', 'quiz_participants', 'quiz_winners', 'gallery_uploads', 'tables', 'custom_backgrounds')
    ORDER BY tablename
) TO '$EXPORT_DIR/rls_enable.sql' WITH CSV HEADER;
"

psql -d postgres -c "
\copy (
    SELECT 
        'CREATE POLICY \"' || policyname || '\" ON ' || tablename || ' ' || 
        cmd || ' USING (' || qual || ') WITH CHECK (' || with_check || ');' as policy_definition
    FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename IN ('companies', 'company_users', 'events', 'attendees', 'lucky_draw_winners', 'voting_sessions', 'voting_options', 'voting_votes', 'quiz_sessions', 'quiz_questions', 'quiz_participants', 'quiz_winners', 'gallery_uploads', 'tables', 'custom_backgrounds')
    ORDER BY tablename, policyname
) TO '$EXPORT_DIR/policies.sql' WITH CSV HEADER;
"

# Create import script
echo "📝 Creating import script..."
cat > "$EXPORT_DIR/import_database.sql" << 'EOF'
-- Database Import Script for EM-V1
-- Generated on: $(date)

-- =====================================================
-- 1. CREATE TABLES
-- =====================================================

-- Run the complete database setup script
\i complete_database_setup.sql

-- =====================================================
-- 2. IMPORT DATA
-- =====================================================

-- Import companies data
\copy companies FROM 'companies.csv' WITH CSV HEADER;

-- Import company_users data
\copy company_users FROM 'company_users.csv' WITH CSV HEADER;

-- Import events data
\copy events FROM 'events.csv' WITH CSV HEADER;

-- Import attendees data
\copy attendees FROM 'attendees.csv' WITH CSV HEADER;

-- Import lucky_draw_winners data
\copy lucky_draw_winners FROM 'lucky_draw_winners.csv' WITH CSV HEADER;

-- Import voting_sessions data
\copy voting_sessions FROM 'voting_sessions.csv' WITH CSV HEADER;

-- Import voting_options data
\copy voting_options FROM 'voting_options.csv' WITH CSV HEADER;

-- Import voting_votes data
\copy voting_votes FROM 'voting_votes.csv' WITH CSV HEADER;

-- Import quiz_sessions data
\copy quiz_sessions FROM 'quiz_sessions.csv' WITH CSV HEADER;

-- Import quiz_questions data
\copy quiz_questions FROM 'quiz_questions.csv' WITH CSV HEADER;

-- Import quiz_participants data
\copy quiz_participants FROM 'quiz_participants.csv' WITH CSV HEADER;

-- Import quiz_winners data
\copy quiz_winners FROM 'quiz_winners.csv' WITH CSV HEADER;

-- Import gallery_uploads data
\copy gallery_uploads FROM 'gallery_uploads.csv' WITH CSV HEADER;

-- Import tables data
\copy tables FROM 'tables.csv' WITH CSV HEADER;

-- Import custom_backgrounds data
\copy custom_backgrounds FROM 'custom_backgrounds.csv' WITH CSV HEADER;

-- =====================================================
-- 3. VERIFICATION
-- =====================================================

SELECT 'Database import completed successfully!' as status;
SELECT COUNT(*) as companies_count FROM companies;
SELECT COUNT(*) as events_count FROM events;
SELECT COUNT(*) as attendees_count FROM attendees;
EOF

# Create README
echo "📖 Creating README..."
cat > "$EXPORT_DIR/README.md" << EOF
# Database Export for EM-V1

This directory contains a complete export of the EM-V1 database.

## 📁 Files Included

### Schema Files
- \`schema.sql\` - Complete table definitions
- \`indexes.sql\` - Database indexes
- \`rls_enable.sql\` - Row Level Security enablement
- \`policies.sql\` - RLS policies

### Data Files (CSV)
- \`companies.csv\` - Companies data
- \`company_users.csv\` - Company users data
- \`events.csv\` - Events data
- \`attendees.csv\` - Attendees data
- \`lucky_draw_winners.csv\` - Lucky draw winners data
- \`voting_sessions.csv\` - Voting sessions data
- \`voting_options.csv\` - Voting options data
- \`voting_votes.csv\` - Voting votes data
- \`quiz_sessions.csv\` - Quiz sessions data
- \`quiz_questions.csv\` - Quiz questions data
- \`quiz_participants.csv\` - Quiz participants data
- \`quiz_winners.csv\` - Quiz winners data
- \`gallery_uploads.csv\` - Gallery uploads data
- \`tables.csv\` - Tables data
- \`custom_backgrounds.csv\` - Custom backgrounds data

### Import Script
- \`import_database.sql\` - Complete import script

## 🚀 How to Import

1. Copy the \`complete_database_setup.sql\` file to this directory
2. Run the import script:
   \`\`\`bash
   psql -d your_database -f import_database.sql
   \`\`\`

## 📊 Export Summary

Generated on: $(date)
Export Directory: $EXPORT_DIR

## 🔧 Notes

- All CSV files include headers
- The import script will create tables and import data
- Make sure to have the complete_database_setup.sql file in the same directory
EOF

# Create summary
echo "📊 Creating export summary..."
psql -d postgres -c "
SELECT 
    'Export Summary:' as summary_header,
    'Tables exported: ' || COUNT(*) as table_count,
    'Total records: ' || SUM(record_count) as total_records
FROM (
    SELECT 'companies' as table_name, COUNT(*) as record_count FROM companies
    UNION ALL
    SELECT 'company_users', COUNT(*) FROM company_users
    UNION ALL
    SELECT 'events', COUNT(*) FROM events
    UNION ALL
    SELECT 'attendees', COUNT(*) FROM attendees
    UNION ALL
    SELECT 'lucky_draw_winners', COUNT(*) FROM lucky_draw_winners
    UNION ALL
    SELECT 'voting_sessions', COUNT(*) FROM voting_sessions
    UNION ALL
    SELECT 'voting_options', COUNT(*) FROM voting_options
    UNION ALL
    SELECT 'voting_votes', COUNT(*) FROM voting_votes
    UNION ALL
    SELECT 'quiz_sessions', COUNT(*) FROM quiz_sessions
    UNION ALL
    SELECT 'quiz_questions', COUNT(*) FROM quiz_questions
    UNION ALL
    SELECT 'quiz_participants', COUNT(*) FROM quiz_participants
    UNION ALL
    SELECT 'quiz_winners', COUNT(*) FROM quiz_winners
    UNION ALL
    SELECT 'gallery_uploads', COUNT(*) FROM gallery_uploads
    UNION ALL
    SELECT 'tables', COUNT(*) FROM tables
    UNION ALL
    SELECT 'custom_backgrounds', COUNT(*) FROM custom_backgrounds
) as table_counts;
" > "$EXPORT_DIR/export_summary.txt"

echo "✅ Database export completed successfully!"
echo "📁 Export directory: $EXPORT_DIR"
echo "📊 Summary saved to: $EXPORT_DIR/export_summary.txt"
echo "📖 Readme created: $EXPORT_DIR/README.md"
echo "🚀 Import script created: $EXPORT_DIR/import_database.sql"

# List exported files
echo ""
echo "📋 Exported files:"
ls -la "$EXPORT_DIR" 