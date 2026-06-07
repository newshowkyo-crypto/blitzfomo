# Blitz Finale - World Cup 2026 Edition

Pure centralized purchase game with real-time experience.

## Production Launch

Use `PRODUCTION_LAUNCH_CHECKLIST.md` as the source of truth for production deployment.
The default credentials below are for local demo only and must never be used online.

## Quick Start (Windows)

**Easiest way:**

1. Make sure **Docker Desktop** is running.
2. Open PowerShell in this folder.
3. Run:

```powershell
.\start-demo.ps1
```

4. Wait for it to finish (first time can take 3-8 minutes).
5. Open browser: **http://localhost:8081**

**Default Admin login:**
- URL: http://localhost:8081/admin
- Username: `super_admin`
- Password: `Admin@2026!`

## What you will see

- A clean demo landing page at http://localhost:8081
- Main game page with live prize pool, countdown, real-time purchases
- Full demo login (no wallet needed)
- Working recharge (Mock) → purchase → real-time updates → withdraw flow
- Admin panel with rich management features

## Stop the demo

```powershell
docker compose down
```

## Project Highlights (Already Implemented)

- Double ledger system (applyLedger as single source of truth)
- Redis Lua atomic purchase + countdown reset
- Redlock-based settlement (no duplicate payouts)
- Complete robot system (BullMQ)
- Real-time Socket.IO updates
- Full-featured Admin backend with RBAC + audit logs
- Product-grade injected frontend (app.js)

For development details, see the MEMORY/ folder.

Enjoy the demo!
