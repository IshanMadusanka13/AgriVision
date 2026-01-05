# Admin System Setup Guide

## Overview
This document explains the admin system implementation for AgriVision application.

## Database Changes

### 1. Add Role Column to Users Table

Run this SQL in your Supabase SQL editor:

```sql
-- Add role column to users table
ALTER TABLE users
ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'user';

-- Add check constraint to ensure role is either 'user' or 'admin'
ALTER TABLE users
ADD CONSTRAINT users_role_check
CHECK (role IN ('user', 'admin'));

-- Create index on role column for better performance
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- Make your first admin user (replace with your email)
UPDATE users SET role = 'admin' WHERE email = 'your-admin-email@example.com';
```

**Important:** Replace `'your-admin-email@example.com'` with your actual admin email address.

## Backend Changes

### Files Created/Modified:

1. **server/app/routes/admin_router.py** (NEW)
   - Admin authentication middleware
   - Dashboard statistics endpoint
   - Recommendations management endpoints
   - Growth stage configuration endpoints
   - User and session management endpoints

2. **server/app/main.py** (MODIFIED)
   - Added admin router to FastAPI app

3. **server/app/routes/auth_router.py** (MODIFIED)
   - Updated to return user role in login/signup responses

4. **server/app/services/supabase_service.py** (MODIFIED)
   - Updated `create_user()` to include role parameter

## Frontend Changes

### Files Created:

1. **client/app/admin/_layout.tsx**
   - Admin layout with access control
   - Redirects non-admin users

2. **client/app/admin/dashboard.tsx**
   - Main admin dashboard
   - Shows statistics (total users, total analyses)
   - Navigation to recommendations and settings pages
   - Recent analyses display

3. **client/app/admin/recommendations.tsx**
   - UI to edit warnings and tips
   - Add/remove warnings
   - Add/remove tips
   - Save changes to backend

4. **client/app/admin/settings.tsx**
   - Configure growth stage settings
   - Edit NPK optimal levels for each stage
   - Edit detection thresholds (leaves, flowers, fruits)
   - Save configuration to backend

### Files Modified:

1. **client/app/(auth)/login.tsx**
   - Added role-based redirect
   - Admin users → `/admin/dashboard`
   - Regular users → `/(tabs)`

## API Endpoints

### Admin Endpoints (All require admin authentication)

**Authentication Header:**
```
X-User-Email: admin@example.com
```

#### 1. Dashboard Statistics
```
GET /api/admin/dashboard/stats
```
Returns:
- Total users count
- Total analysis sessions count
- Recent 10 sessions

#### 2. Get Recommendations Metadata
```
GET /api/admin/recommendations/metadata
```
Returns all unique warnings and tips from database

#### 3. Update Recommendations Metadata
```
PUT /api/admin/recommendations/metadata
Content-Type: application/json

{
  "warnings": ["warning 1", "warning 2"],
  "tips": ["tip 1", "tip 2"]
}
```

#### 4. Get Growth Stage Configuration
```
GET /api/admin/growth-stage/config
```
Returns configuration for all growth stages

#### 5. Update Growth Stage Configuration
```
PUT /api/admin/growth-stage/config
Content-Type: application/json

{
  "configs": [
    {
      "stage": "early_vegetative",
      "min_leaves": 1,
      "max_leaves": 10,
      "nitrogen_min": 80,
      "nitrogen_max": 120,
      ...
    }
  ]
}
```

#### 6. Get All Users
```
GET /api/admin/users
```

#### 7. Get All Sessions
```
GET /api/admin/sessions?limit=50&offset=0
```

## How to Use

### Step 1: Setup Database
1. Open Supabase SQL Editor
2. Run the SQL migration from `server/migrations/add_role_to_users.sql`
3. Update at least one user to be admin using the UPDATE query

### Step 2: Start Backend Server
```bash
cd server
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Step 3: Start Frontend
```bash
cd client
npm start
```

### Step 4: Login as Admin
1. Open the app
2. Login with your admin email
3. You'll be redirected to Admin Dashboard automatically

### Step 5: Configure Settings
1. Go to "Growth Analysis Settings" from admin dashboard
2. Modify NPK optimal ranges for each growth stage
3. Modify detection thresholds
4. Save changes

### Step 6: Edit Recommendations
1. Go to "Edit Recommendations" from admin dashboard
2. Add/remove warnings that users see
3. Add/remove tips that users see
4. Save changes

## Admin Dashboard Features

### 📊 Dashboard Statistics
- View total users
- View total analyses
- See recent analyses

### 📝 Edit Recommendations
- Manage warnings shown to users
- Manage tips shown to users
- Add custom warnings/tips
- Remove unwanted warnings/tips

### ⚙️ Growth Analysis Settings
- Configure NPK optimal levels for each growth stage:
  - Early Vegetative
  - Vegetative
  - Flowering
  - Fruiting
  - Ripening
- Set detection thresholds for:
  - Minimum/Maximum leaves count
  - Minimum/Maximum flowers count
  - Minimum/Maximum fruits count
- Set NPK ranges (Nitrogen, Phosphorus, Potassium)

## Security

- All admin endpoints require `X-User-Email` header
- Backend verifies user role from database
- Returns 403 Forbidden for non-admin users
- Frontend checks admin status before showing admin screens
- Redirects non-admin users to home screen

## Configuration Files

The system creates configuration files in `server/app/config/`:
- `recommendations_config.json` - Stores warnings and tips
- `growth_stage_config.json` - Stores growth stage NPK levels and thresholds

## Troubleshooting

### Issue: "Access Denied" when accessing admin pages
**Solution:** Make sure your user role is set to 'admin' in the database:
```sql
UPDATE users SET role = 'admin' WHERE email = 'your-email@example.com';
```

### Issue: Admin endpoints return 403 Forbidden
**Solution:** Check that the `X-User-Email` header is being sent with the request

### Issue: Settings not saving
**Solution:** Check that the `server/app/config` directory exists and is writable

## Future Enhancements

Possible additions:
- User management (create/delete users, change roles)
- Analytics and reports
- Bulk edit fertilizer recommendations
- Export data to CSV
- Email notifications
- Activity logs

## Files Structure

```
server/
├── app/
│   ├── routes/
│   │   ├── admin_router.py (NEW)
│   │   ├── auth_router.py (MODIFIED)
│   │   └── ...
│   ├── services/
│   │   └── supabase_service.py (MODIFIED)
│   ├── config/ (AUTO-CREATED)
│   │   ├── recommendations_config.json
│   │   └── growth_stage_config.json
│   └── main.py (MODIFIED)
└── migrations/
    └── add_role_to_users.sql (NEW)

client/
├── app/
│   ├── admin/ (NEW)
│   │   ├── _layout.tsx
│   │   ├── dashboard.tsx
│   │   ├── recommendations.tsx
│   │   └── settings.tsx
│   └── (auth)/
│       └── login.tsx (MODIFIED)
```

---

**Note:** Make sure to run the database migration before using the admin features!
