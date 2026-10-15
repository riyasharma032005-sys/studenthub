# StudentHub — Three-Tier Cloud Student Information Management System

Implements the assignment architecture:
- Presentation tier: HTML/CSS/JavaScript on Netlify
- Application tier: Node.js/Express REST API on Render
- Database tier: MongoDB Atlas

## Features
- Create, list, search, update and delete student records
- REST endpoints: `GET /api/students`, `GET /api/students/:id`, `POST /api/students`, `PUT /api/students/:id`, `DELETE /api/students/:id`
- MongoDB validation, duplicate Student ID handling, JSON error responses
- CORS allowlist, environment-based database credentials, health endpoint

## 1. Create MongoDB Atlas database
1. Create a free MongoDB Atlas account and a free cluster.
2. Create a database user with a strong password.
3. In Network Access, allow your current IP for local development. For a temporary student demo, `0.0.0.0/0` may be needed for Render connectivity; use a strong database password and remove broad access after the demo if possible.
4. Choose Connect > Drivers and copy the Node.js connection string.
5. Replace the username/password placeholders and use database name `studentDB` in the URI.

## 2. Run backend locally
Open a terminal in `backend`:

```bash
npm install
```

Copy `.env.example` to `.env`, then set `MONGODB_URI` to your real Atlas connection string. Keep `.env` private; never commit it.

```bash
npm start
```

Open `http://localhost:5000/health`; expect `database: connected`.

## 3. Run frontend locally
Open `frontend/config.js`. Keep `API_BASE_URL = 'http://localhost:5000'` for local backend testing. Serve the `frontend` folder with VS Code Live Server, or run a simple static server. Example if Python is available:

```bash
python -m http.server 5500
```

Then open `http://localhost:5500`. Add a test student and verify the record appears in Atlas.

## 4. Deploy backend to Render
1. Push the project to GitHub (do not include `.env` or `node_modules`).
2. In Render, create a new **Web Service** from the repository.
3. Set **Root Directory** to `backend`, **Build Command** to `npm install`, and **Start Command** to `npm start`.
4. Add environment variables `MONGODB_URI` (Atlas connection string) and `FRONTEND_URL` (your Netlify site URL; initially it can be set after frontend deployment). Render supplies `PORT` automatically.
5. Deploy and test `https://YOUR-SERVICE.onrender.com/health`.

## 5. Deploy frontend to Netlify
1. In `frontend/config.js`, change `API_BASE_URL` to the exact Render service URL, e.g. `https://your-service.onrender.com` (no trailing slash).
2. In Netlify, import the same GitHub repository and set the **Publish directory** to `frontend`. No build command is required for this static HTML site.
3. Deploy and copy the Netlify URL.
4. Return to Render environment variables and set `FRONTEND_URL` to the exact Netlify URL, save and redeploy/restart the service.
5. Test add/view/search/update/delete from the public Netlify site.

## 6. Git commands
Run from the project root:

```bash
git init
git add .
git commit -m "Build three-tier student management system"
```
Create an empty GitHub repository, then follow GitHub's instructions to add the remote and push. Never commit `backend/.env`.

## Test checklist
- [ ] `GET /health` reports connected database
- [ ] Add student (`POST`)
- [ ] List/search students (`GET`)
- [ ] Get student by MongoDB ID or Student ID (`GET /:id`)
- [ ] Update student (`PUT`)
- [ ] Delete student (`DELETE`)
- [ ] Duplicate Student ID produces a helpful error
- [ ] Netlify frontend communicates with Render API
- [ ] Render CORS allowlist contains exact Netlify URL
- [ ] MongoDB Atlas confirms records persisted
- [ ] Screenshots of frontend, deployed URL, API health and Atlas records saved for submission

## API examples
Create a student:

```http
POST /api/students
Content-Type: application/json
```

```json
{
  "studentId": "ST101",
  "name": "Demo Student",
  "email": "demo@example.com",
  "department": "Computer Engineering",
  "semester": 7,
  "contact": "9876543210"
}
```

Use `GET /api/students`, `GET /api/students/ST101`, `PUT /api/students/ST101`, and `DELETE /api/students/ST101` for the other operations.
