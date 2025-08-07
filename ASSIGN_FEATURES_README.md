# AssignFeatures - Company Feature Management System

## Overview

The AssignFeatures system allows super admins to assign specific features to each company based on their package. This provides granular control over which functionality is available to different companies.

## Features

### Available Features
1. **Registration & Attendees** - Event registration and attendee management
2. **Check-in System** - QR code scanning and check-in functionality
3. **Voting & Monitoring** - Voting sessions with real-time monitoring
4. **Welcoming & Monitoring** - Welcome screen and attendee monitoring
5. **Quiz & Monitoring** - Interactive quiz system with monitoring
6. **Lucky Draw & Monitoring** - Lucky draw system with winner management
7. **Gallery** - Photo gallery and upload management

## Database Schema

### Companies Table Enhancement
```sql
ALTER TABLE companies ADD COLUMN features_enabled jsonb DEFAULT '{
  "registration": true,
  "checkin": true,
  "voting": true,
  "welcoming": true,
  "quiz": true,
  "lucky_draw": true,
  "gallery": true
}'::jsonb;
```

## Components

### 1. AssignFeatures Component (`src/components/admin/AssignFeatures.tsx`)
- **Purpose**: Main interface for super admins to configure company features
- **Features**:
  - Company selection with feature count display
  - Toggle switches for each feature
  - Real-time preview of changes
  - Save/Reset functionality
  - Feature summary with enabled count

### 2. Updated CompanyManagement Component
- **New Features**:
  - "Assign Features" button in header
  - Feature summary in company cards
  - Visual indicators for enabled features

### 3. Updated Layout Component
- **Navigation Filtering**: Automatically hides features not assigned to the company
- **Feature Mapping**: Maps navigation items to specific features

## Usage

### For Super Admins
1. Navigate to Company Management
2. Click "Assign Features" button
3. Select a company from the list
4. Toggle features on/off based on package
5. Save changes

### For Company Users
- Navigation automatically filters based on assigned features
- Only enabled features appear in the sidebar
- Seamless experience with no access to disabled features

## Implementation Details

### Feature Mapping
```javascript
const featureMap = {
  '/admin/attendees': 'registration',
  '/admin/checkin': 'checkin',
  '/admin/voting': 'voting',
  '/admin/voting-monitor': 'voting',
  '/admin/welcome-monitor': 'welcoming',
  '/admin/welcome-monitor-scanner': 'welcoming',
  '/admin/quiz': 'quiz',
  '/admin/quiz-monitor': 'quiz',
  '/admin/lucky-draw': 'lucky_draw',
  '/admin/gallery': 'gallery'
}
```

### Database Migration
Run the following SQL in Supabase SQL Editor:
```sql
-- See manual_migration_features.sql for complete migration
ALTER TABLE companies ADD COLUMN IF NOT EXISTS features_enabled jsonb DEFAULT '{
  "registration": true,
  "checkin": true,
  "voting": true,
  "welcoming": true,
  "quiz": true,
  "lucky_draw": true,
  "gallery": true
}'::jsonb;
```

## Routes

### New Route
- `/admin/assign-features` - AssignFeatures component

### Updated Routes
- `/admin/companies` - Now includes "Assign Features" button

## Security

- Only super admins can access AssignFeatures
- Company users cannot modify their own features
- Navigation automatically filters based on assigned features
- RLS policies ensure proper access control

## Benefits

1. **Package Flexibility**: Different companies can have different feature sets
2. **Revenue Optimization**: Enable premium features for higher-tier packages
3. **User Experience**: Clean interface showing only available features
4. **Scalability**: Easy to add new features in the future
5. **Management**: Centralized feature control for super admins

## Future Enhancements

1. **Feature Packages**: Pre-defined packages (Basic, Pro, Enterprise)
2. **Usage Analytics**: Track feature usage per company
3. **Feature Dependencies**: Ensure required features are enabled together
4. **Bulk Operations**: Assign features to multiple companies at once
5. **Feature History**: Track changes to feature assignments

## Troubleshooting

### Common Issues
1. **Features not showing**: Check if features_enabled column exists in database
2. **Navigation not filtering**: Verify userCompany.features_enabled is populated
3. **Save not working**: Check network connection and database permissions

### Manual Database Check
```javascript
// Test if features_enabled column exists
const { data, error } = await supabase
  .from('companies')
  .select('features_enabled')
  .limit(1)
```

## Revert Functionality

To revert all changes:
1. Remove the features_enabled column from companies table
2. Remove the AssignFeatures component
3. Remove the route from App.tsx
4. Remove the navigation filtering from Layout.tsx
5. Remove the feature summary from CompanyManagement.tsx

The system is designed to be easily reversible if needed. 