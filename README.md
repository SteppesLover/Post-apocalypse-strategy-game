# Post-apocalypse strategy game
Post-apocalypse strategy game:
- Backend: Node.js + Express + MongoDB
- Frontend: React + Vite

## Instructions to install:
## 1) Install node modules
From project root:
```
npm install
cd client
npm install
cd ..
```
## 2) Configure environment variables
### Backend `.env` (project root)
Create `./.env`:
```env
MONGO_URI=mongodb+srv://<user>:<password>@<cluster>/<db>?retryWrites=true&w=majority
SESSION_SECRET=change_me_session_secret
JWT_SECRET=change_me_jwt_secret
JWT_LIFETIME=30d
PORT=3000
CORS_ORIGIN=http://localhost:5173
```
### Frontend `.env` (client)
Create `./client/.env`:
```env
VITE_API_BASE=http://localhost:3000
```
## 3) Run in development
Open 2 terminals.
Terminal A (backend):
```
npm run dev
```
Terminal B (frontend):
```
cd client
npm run dev
```
Open: `http://localhost:5173`

## How this project satisfies the assignment rubric

### Models & Controllers

- Uses Node/Express with MongoDB (`mongoose`).
- Includes at least two Mongoose models:
  - `User` (`models/User.js`)
  - `GameSave` (`models/GameSave.js`)
- User registration and logon are implemented:
  - `POST /sessions/register`
  - `POST /sessions/logon`
- Passwords are hashed with `bcryptjs` (`UserSchema.pre("save")`).
- JWT authentication is implemented for full-stack API access:
  - token created in `User.createJWT()`
  - token parsed in `middleware/attachUserFromJwt.js`
  - protected API middleware in `middleware/authApi.js`
- Model attributes use multiple data types:
  - string, number, boolean, date, array, objectId, mixed (`GameSave`).
- Model validation is implemented in schemas (`required`, `min/max`, `minlength/maxlength`, regex, custom validators).
- Full CRUD is implemented for non-User model (`GameSave`):
  - `GET /api/saves`
  - `POST /api/saves`
  - `GET /api/saves/:id`
  - `PATCH /api/saves/:id`
  - `DELETE /api/saves/:id`
- Non-CRUD features are included:
  - pagination (`page`, `limit`)
  - sorting (`sort`)
  - search (`q`) in `listSaves`.
- Access control is enforced:
  - auth middleware required for saves routes
  - owner checks in controller methods (`assertOwner`) to prevent cross-user data access.
- API returns user-facing errors/messages (JSON responses + status codes).
- Global error handling middleware is configured in `app.js`.

### User Interface

- Supports registration, logon, and logoff.
- Supports CRUD for `GameSave` from UI:
  - create (Save to cloud)
  - read (Cloud saves list)
  - update (Edit save title)
  - delete (Delete save)
- Includes navigation/actions via buttons and tabs.
- Styled UI with custom CSS (`client/src/styles.css`).

### Deployment & Security

- Security middleware is enabled in backend:
  - `helmet`
  - `xss-clean`
  - `express-rate-limit`
- CORS is configured via `CORS_ORIGIN`.
- Session security settings are configured for production (`secure`, `sameSite`).
- Project is ready for Render deployment (set environment variables from this README in Render).

### Optional rubric items

- Swagger and automated tests (Mocha/Chai/Puppeteer) are not included in the current version.

## API notes

- Auth endpoints:
  - `POST /sessions/register`
  - `POST /sessions/logon`
  - `POST /sessions/logoff`
  - `GET /me`
- Cloud saves CRUD:
  - `GET /api/saves`
  - `POST /api/saves`
  - `GET /api/saves/:id`
  - `PATCH /api/saves/:id`
  - `DELETE /api/saves/:id`

JWT is returned on logon/register and sent as `Authorization: Bearer <token>`.

