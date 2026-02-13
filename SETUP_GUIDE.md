# Quick Setup Guide

## Issue: Cannot Create Game Session

If you're getting errors when trying to create a session, it's likely because the database isn't set up yet.

## Setup Steps

### 1. Install PostgreSQL (if not already installed)

**Check if installed:**
```bash
psql --version
```

**If not installed, choose one:**

**Option A: Homebrew (recommended for developers)**
```bash
brew install postgresql@14
brew services start postgresql@14
echo 'export PATH="/opt/homebrew/opt/postgresql@14/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

**Option B: Postgres.app (easiest, has GUI)**
- Download from https://postgresapp.com/
- Move to Applications and open
- Click "Initialize"
- Add to PATH: `echo 'export PATH="/Applications/Postgres.app/Contents/Versions/latest/bin:$PATH"' >> ~/.zshrc`

### 2. Create Database

```bash
# Create the database
createdb future_headlines

# Or if you need to specify a user:
createdb -U postgres future_headlines
```

### 3. Configure Backend Environment

Create `backend/.env`:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/future_headlines
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
```

**Important:** Adjust the username and password in DATABASE_URL:
- Default username is often `postgres` or your Mac username
- Default password is often empty or `postgres`
- If using Postgres.app, username is your Mac username with no password

### 4. Run Database Migrations

```bash
cd backend
npm run migrate
```

You should see:
```
⚙️  Running 001_init.sql...
✅ Applied 001_init.sql
✅ All migrations completed successfully!
```

### 5. Start the Servers

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
```

Should show:
```
🚀 Server running on port 3001
📡 Socket.IO server ready
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```

Should show:
```
VITE v5.x.x  ready in xxx ms
➜  Local:   http://localhost:5173/
```

### 6. Test Session Creation

1. Open http://localhost:5173
2. Enter a nickname
3. Click "Create New Session"
4. Should see a 6-character join code

## Troubleshooting

### Error: "Cannot connect to database"

**Check PostgreSQL is running:**
```bash
# For Homebrew installation:
brew services list | grep postgresql

# For Postgres.app:
# Check if the app shows a green light/running status
```

**Test connection manually:**
```bash
psql -U postgres -d future_headlines
# Or if using Postgres.app:
psql -d future_headlines
```

### Error: "Database does not exist"

```bash
createdb future_headlines
```

### Error: "Authentication failed"

Update your `backend/.env` with correct credentials:
- For Postgres.app: use your Mac username, no password
- For Homebrew: often `postgres/postgres` or check your setup

Example for Postgres.app:
```env
DATABASE_URL=postgresql://ayman@localhost:5432/future_headlines
```

### Error: "Role does not exist"

Create the PostgreSQL user:
```bash
createuser -s postgres
```

### Backend Shows Errors in Console

Check the backend terminal for specific error messages. Common ones:
- "ECONNREFUSED" = PostgreSQL not running
- "database ... does not exist" = Need to create database
- "authentication failed" = Wrong credentials in .env

### Frontend Shows "Failed to create session"

1. Open browser DevTools (F12)
2. Check Console tab for errors
3. Check Network tab - is the request to `localhost:3001` failing?
4. If yes, backend isn't running or isn't accessible

### Still Having Issues?

1. **Check backend is running:** Should see "Server running on port 3001"
2. **Check database connection:** Run `psql -d future_headlines` to verify you can connect
3. **Check migrations:** Run `npm run migrate` again, should show migrations applied
4. **Check browser console:** Look for specific error messages
5. **Check backend logs:** Terminal running `npm run dev` will show errors

## Quick Debug Commands

```bash
# Is PostgreSQL running?
psql -d postgres -c "SELECT version();"

# Does the database exist?
psql -d postgres -c "\l" | grep future_headlines

# Have migrations run?
psql -d future_headlines -c "SELECT * FROM schema_migrations;"

# Can backend connect?
cd backend && npm run dev
# Look for errors in the output
```

