PakSar Seller - Fullstack (Frontend + Express backend)

Included:
- public/: frontend files (index, admin)
- assets/: css + js for frontend and admin
- server.js : Express server with SQLite DB, JWT admin auth, product CRUD, tracking redirect endpoint (/r/:asin) and email notifications.
- package.json : npm dependencies

IMPORTANT QUICK START (local):
1. Install Node.js (18+ recommended).
2. Unzip project and in project root run:
   npm install
3. Create environment variables (optional) or edit defaults in server.js:
   - JWT_SECRET (strong secret)
   - ADMIN_EMAIL (default admin email)
   - ADMIN_PASS (initial admin password)
   - SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS (for email notifications)
   - AFFILIATE_TAG (default affiliate tag)
4. Start server:
   node server.js
5. Open http://localhost:3000 for the shop and http://localhost:3000/admin for admin panel.

SECURITY NOTES:
- Change ADMIN_PASS and JWT_SECRET after first run.
- When deploying, set env vars for SMTP and admin credentials; do NOT store secrets in repo.
- This project uses SQLite for simplicity — for production use a managed DB.
- File uploads are not enabled in this scaffold; images are stored as URLs. To allow uploads, connect to a cloud storage like S3 and secure endpoints.

Files generated on 2025-09-18T19:46:38.881042 UTC
