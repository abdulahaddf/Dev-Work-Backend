# DevWork Backend API

**A production-ready REST API for a role-based project marketplace platform.**

DevWork enables **Buyers** to create projects, **Solvers** to execute work, and **Admins** to manage the platform—all powered by strict state machines and role-based access control.

---

## 🎯 System Overview

DevWork is a SaaS platform connecting project buyers with skilled solvers through a structured workflow:

```
┌─────────────┐         ┌──────────────┐         ┌─────────────┐
│   BUYER     │────────▶│   PROJECT    │◀────────│   SOLVER    │
│ Creates     │         │  Marketplace │         │ Executes    │
│ Projects    │         │              │         │ Tasks       │
└─────────────┘         └──────────────┘         └─────────────┘
      │                        │                        │
      └────────────────────────┼────────────────────────┘
                               ▼
                        ┌──────────────┐
                        │    ADMIN     │
                        │ Manages Roles│
                        └──────────────┘
```

### **Core Features**

- ✅ **Role-Based Access Control (RBAC)** - Admin, Buyer, Solver roles
- ✅ **State Machine Workflows** - Enforced project and task lifecycles
- ✅ **File Upload System** - ZIP submissions stored in Supabase Storage
- ✅ **JWT Authentication** - Secure token-based auth
- ✅ **PostgreSQL Database** - Relational data with Prisma ORM

---

## 🛠 Tech Stack

| Layer                | Technology       | Purpose                   |
| -------------------- | ---------------- | ------------------------- |
| **Runtime**          | Node.js 20+      | JavaScript runtime        |
| **Framework**        | Express.js       | REST API server           |
| **Language**         | TypeScript       | Type-safe development     |
| **Database**         | PostgreSQL       | Relational database       |
| **ORM**              | Prisma 5.9       | Type-safe database access |
| **Authentication**   | JWT              | Stateless auth tokens     |
| **File Storage**     | Supabase Storage | Cloud file storage        |
| **Validation**       | Zod              | Schema validation         |
| **Password Hashing** | bcryptjs         | Secure password storage   |
| **File Upload**      | Multer           | Multipart form handling   |

---

## 📋 Prerequisites

Before setting up the backend, ensure you have:

- **Node.js** 20.x or higher
- **PostgreSQL** database (local or cloud)
- **Supabase account** (for file storage)
- **npm** or **yarn** package manager

---

## 🚀 Setup Instructions

### **1. Clone and Install**

```bash
cd backend/dev-work-backend
npm install
```

### **2. Environment Configuration**

Create a `.env.local` file in the project root:

```bash
# Database
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE?schema=public"

# JWT
JWT_SECRET="your-super-secret-jwt-key-change-in-production"
JWT_EXPIRES_IN="7d"

# Frontend URL (for CORS)
FRONTEND_URL="http://localhost:3000"

# Supabase Storage
SUPABASE_URL="https://your-project.supabase.co"
SUPABASE_KEY="your-anon-public-key"
SUPABASE_SERVICE_KEY="your-service-role-key"
SUPABASE_BUCKET="submissions"

# Server
PORT=4000
NODE_ENV=development
```

> **💡 Tip**: Copy `.env.example` and fill in your actual values

### **3. Database Setup**

```bash
# Generate Prisma client
npm run db:generate

# Push schema to database
npm run db:push

# Seed initial data (creates roles)
npm run db:seed
```

### **4. Run Development Server**

```bash
npm run dev
```

Server starts at: **http://localhost:4000**

### **5. Build for Production**

```bash
npm run build
npm start
```

---

## 📡 API Routes Summary

### **Authentication** (`/api/auth`)

| Method | Endpoint         | Access        | Description              |
| ------ | ---------------- | ------------- | ------------------------ |
| `POST` | `/auth/register` | Public        | Register new user        |
| `POST` | `/auth/login`    | Public        | Login and get JWT token  |
| `GET`  | `/auth/me`       | Authenticated | Get current user profile |

### **Admin** (`/api/admin`)

| Method | Endpoint             | Role  | Description               |
| ------ | -------------------- | ----- | ------------------------- |
| `POST` | `/admin/assign-role` | ADMIN | Assign role to user       |
| `POST` | `/admin/remove-role` | ADMIN | Remove role from user     |
| `GET`  | `/admin/users`       | ADMIN | List all users with stats |
| `GET`  | `/admin/projects`    | ADMIN | List all projects         |
| `GET`  | `/admin/roles`       | ADMIN | List available roles      |

### **Projects** (`/api/projects`)

| Method   | Endpoint                 | Role        | Description                  |
| -------- | ------------------------ | ----------- | ---------------------------- |
| `POST`   | `/projects`              | BUYER       | Create new project           |
| `GET`    | `/projects/my`           | BUYER       | Get my projects              |
| `GET`    | `/projects/open`         | SOLVER      | Get open projects (public)   |
| `GET`    | `/projects/assigned`     | SOLVER      | Get assigned projects        |
| `GET`    | `/projects/:id`          | Auth        | Get project details          |
| `PATCH`  | `/projects/:id`          | BUYER       | Update project (DRAFT only)  |
| `PATCH`  | `/projects/:id/publish`  | BUYER       | Publish project (DRAFT→OPEN) |
| `PATCH`  | `/projects/:id/status`   | Auth        | Update project status        |
| `GET`    | `/projects/:id/requests` | BUYER       | Get project requests         |
| `POST`   | `/projects/:id/assign`   | BUYER       | Assign solver to project     |
| `DELETE` | `/projects/:id`          | ADMIN/BUYER | Delete project               |

### **Requests** (`/api/requests`)

| Method   | Endpoint        | Role   | Description                |
| -------- | --------------- | ------ | -------------------------- |
| `POST`   | `/requests`     | SOLVER | Request to work on project |
| `GET`    | `/requests/my`  | SOLVER | Get my requests            |
| `DELETE` | `/requests/:id` | SOLVER | Withdraw request           |

### **Tasks** (`/api/tasks`)

| Method  | Endpoint                    | Role   | Description                 |
| ------- | --------------------------- | ------ | --------------------------- |
| `POST`  | `/tasks`                    | SOLVER | Create task                 |
| `GET`   | `/tasks/my`                 | SOLVER | Get my tasks                |
| `GET`   | `/tasks/project/:projectId` | Auth   | Get project tasks           |
| `GET`   | `/tasks/:id`                | Auth   | Get task details            |
| `PATCH` | `/tasks/:id`                | SOLVER | Update task                 |
| `PATCH` | `/tasks/:id/status`         | SOLVER | Update task status          |
| `POST`  | `/tasks/:id/review`         | BUYER  | Review task (ACCEPT/REJECT) |

### **Submissions** (`/api/submissions`)

| Method   | Endpoint                    | Role   | Description              |
| -------- | --------------------------- | ------ | ------------------------ |
| `POST`   | `/submissions/task/:taskId` | SOLVER | Upload ZIP submission    |
| `GET`    | `/submissions/task/:taskId` | Auth   | Get task submissions     |
| `GET`    | `/submissions/:id/download` | Auth   | Download submission file |
| `DELETE` | `/submissions/:id`          | SOLVER | Delete submission        |

---

## 🔄 State Machine Workflows

### **Project Lifecycle**

```
DRAFT ──(Buyer Publishes)──▶ OPEN ──(Solver Requests)──▶ REQUESTED
                                                              │
                                                              ▼
                                                       (Buyer Assigns)
                                                              │
COMPLETED ◀──(Buyer Accepts All)── UNDER_REVIEW ◀────── ASSIGNED
                                        ▲                    │
                                        │                    ▼
                                   (All Tasks          (Solver Starts)
                                    Submitted)              │
                                                            ▼
                                                       IN_PROGRESS
```

| Current State  | Valid Next States | Triggered By         |
| -------------- | ----------------- | -------------------- |
| `DRAFT`        | `OPEN`            | Buyer publishes      |
| `OPEN`         | `REQUESTED`       | Solver requests      |
| `REQUESTED`    | `ASSIGNED`        | Buyer assigns solver |
| `ASSIGNED`     | `IN_PROGRESS`     | Solver starts work   |
| `IN_PROGRESS`  | `UNDER_REVIEW`    | All tasks submitted  |
| `UNDER_REVIEW` | `COMPLETED`       | Buyer accepts all    |

### **Task Lifecycle**

```
CREATED ──(Solver Starts)──▶ IN_PROGRESS ──(Solver Submits ZIP)──▶ SUBMITTED
                                                                       │
                                                                       ▼
                                                               (Buyer Reviews)
                                                                       │
                                    ┌──────────────────────────────────┴──────────────┐
                                    ▼                                                  ▼
                                ACCEPTED                                          REJECTED
                              (Task Done)                                             │
                                                                                      │
                                                    (Solver Revises) ◀───────────────┘
                                                          │
                                                          ▼
                                                     IN_PROGRESS
```

| Current State | Valid Next States      | Triggered By       |
| ------------- | ---------------------- | ------------------ |
| `CREATED`     | `IN_PROGRESS`          | Solver starts      |
| `IN_PROGRESS` | `SUBMITTED`            | Solver submits ZIP |
| `SUBMITTED`   | `ACCEPTED`, `REJECTED` | Buyer reviews      |
| `REJECTED`    | `IN_PROGRESS`          | Solver revises     |
| `ACCEPTED`    | _(final state)_        | N/A                |

---

## 🏗 Architecture Decisions

### **1. Modular Structure**

```
src/
├── modules/          # Feature modules (auth, projects, etc.)
│   ├── auth/
│   │   ├── auth.controller.ts    # Request handlers
│   │   ├── auth.service.ts       # Business logic
│   │   └── auth.routes.ts        # Route definitions
├── middleware/       # Auth & role middleware
├── validators/       # Zod validation schemas
├── utils/           # Shared utilities
└── prisma/          # Database schema & migrations
```

**Why?** Clean separation of concerns, easy testing, scalable codebase.

### **2. State Machine Enforcement**

All status transitions are validated in the controller layer before database writes.

**Why?** Prevents invalid states, ensures data integrity, enforces business rules.

### **3. Role-Based Middleware**

Routes are protected by `authenticate` → `requireRole(['BUYER', 'SOLVER'])` chain.

**Why?** Centralized authorization, declarative security, prevents unauthorized access.

### **4. Supabase Storage for Files**

ZIP submissions are stored in Supabase Storage bucket with service_role key.

**Why?**

- Separates file storage from application server
- Scalable cloud storage
- Backend controls access via signed URLs
- No file size limits on server

### **5. JWT Authentication**

Stateless tokens with 7-day expiry, stored in frontend localStorage.

**Why?** Scalable (no session storage), works across multiple servers, standard approach.

### **6. PostgreSQL + Prisma**

Type-safe database access with schema migrations.

**Why?**

- Relational data modeling fits the domain
- Type safety prevents runtime errors
- Migration system for version control
- Excellent developer experience

### **7. Express.js**

Traditional REST API instead of GraphQL or tRPC.

**Why?** Simpler, well-understood, easier to deploy, standard HTTP semantics.

### **8. CORS Configuration**

Allows specific frontend origins with credentials support.

**Why?** Security (blocks unknown origins), enables cookies/auth headers in cross-origin requests.

---

## 📂 Database Schema

### **Core Models**

- **User** - Platform users with email/password
- **Role** - ADMIN, BUYER, SOLVER roles
- **UserRole** - Many-to-many junction table
- **Project** - Buyer's project with status tracking
- **ProjectRequest** - Solver's request to work on project
- **Task** - Work items created by solver
- **Submission** - ZIP file uploads for tasks

### **Key Relationships**

```
User ──(1:N)── Project (as Buyer)
User ──(1:N)── Project (as Solver)
User ──(1:N)── ProjectRequest
Project ──(1:N)── Task
Task ──(1:N)── Submission
User ──(M:N)── Role (through UserRole)
```

---

## 🧪 Development Tools

```bash
# Watch mode with auto-reload
npm run dev

# Database management
npm run db:studio        # Open Prisma Studio
npm run db:migrate       # Create migration
npm run db:push          # Push schema changes
npm run db:seed          # Seed database

# Production build
npm run build            # Compile TypeScript
npm start                # Run compiled code
```

---

## 🌍 Deployment

### **Environment Variables (Production)**

Required in Railway/Render/Heroku:

```bash
DATABASE_URL=postgresql://...
JWT_SECRET=your-production-secret
JWT_EXPIRES_IN=7d
FRONTEND_URL=https://your-frontend.vercel.app
SUPABASE_URL=https://...supabase.co
SUPABASE_SERVICE_KEY=your-service-key
SUPABASE_BUCKET=submissions
NODE_ENV=production
```

### **Railway Deployment**

1. Push code to GitHub
2. Connect repo to Railway
3. Set environment variables
4. Railway auto-deploys on push

---

## 🔐 Security Best Practices

- ✅ Passwords hashed with bcrypt (10 rounds)
- ✅ JWT secrets stored in environment variables
- ✅ CORS configured for specific origins
- ✅ SQL injection prevented by Prisma parameterization
- ✅ File uploads validated (type, size)
- ✅ Service role key never exposed to frontend
- ✅ Rate limiting ready (can add express-rate-limit)

---

## 📝 API Response Format

### **Success Response**

```json
{
  "success": true,
  "message": "Operation successful",
  "data": {
    /* response data */
  }
}
```

### **Error Response**

```json
{
  "success": false,
  "message": "Error description"
}
```

### **Validation Error**

```json
{
  "success": false,
  "message": "Validation failed",
  "errors": {
    /* field errors */
  }
}
```

---

## 🤝 Contributing

1. Create feature branch: `git checkout -b feature/your-feature`
2. Make changes and test
3. Commit: `git commit -m "Add your feature"`
4. Push: `git push origin feature/your-feature`
5. Open Pull Request

---

## 📄 License

MIT License - See LICENSE file for details

---

## 🆘 Support

For issues or questions:

- Check the `/api` endpoint for available routes
- Review Prisma Studio for database state
- Check Railway logs for server errors
- Verify environment variables are set correctly

---

**Built with ❤️ using Express, Prisma, and TypeScript**
