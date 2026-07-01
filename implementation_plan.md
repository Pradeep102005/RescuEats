# Implementation Plan: Surplus Food Sharing Marketplace (surplass)

This plan outlines the step-by-step checklist to build the Surplus Food Sharing Marketplace, incorporating production-grade features like PostgreSQL relational database, PostGIS spatial indexing, Knex.js query builder, Redis caching, BullMQ async tasks, Apache Kafka event streams, AWS S3 image uploads, and Dockerization.

---

## Phase 1: Foundation & Authentication (Days 1–3)

- [ ] **Project Scaffolding**
  - [ ] Initialize Express backend in `/backend` (`npm init -y`, install `express`, `pg`, `knex`, `cors`, `dotenv`, `jsonwebtoken`, `bcrypt`).
  - [ ] Setup folder structure: `src/config`, `src/controllers`, `src/models`, `src/routes`, `src/middlewares`, `src/utils`, `src/database/migrations`.
  - [ ] Initialize React frontend in `/frontend` using Vite (`npm create vite@latest frontend -- --template react`).
  - [ ] Set up basic git repository and `.gitignore` (ignoring `.env` and 
- [ ] **Role-Based Authentication (RBAC) & Database Migration**
  - [ ] Configure Knex database connection setup in `src/config/db.js`.
  - [ ] Create Knex migration for `users` table: `id` (UUID/Serial), `firstName`, `lastName`, `email` (unique), `password`, `role` (enum: `['customer', 'vendor']`), `isVerified` (Boolean, default false), `verificationDocUrl` (String), timestamps.
  - [ ] Implement password hashing using `bcrypt` during registration.
  - [ ] Write `/api/auth/register` and `/api/auth/login` endpoints returning a JWT with the user's ID and role.
  - [ ] Implement `userAuth` middleware to verify the JWT.
  - [ ] Implement `checkRole(role)` middleware to restrict routes (e.g., only vendors can add listings).

- [ ] **Frontend Auth Flow**
  - [ ] Install React Router and Axios in the frontend.
  - [ ] Create login/register forms with a role selector (vendor/customer toggle).
  - [ ] Set up Axios interceptors to automatically attach the JWT header from `localStorage`.
  - [ ] Create Protected Route wrapper and set up dashboard layout redirects based on role.

---

## Phase 2: S3 Media Pipeline & Listing CRUD (Days 4–6)

- [ ] **S3 Pre-signed Upload Pipeline**
  - [ ] Create an AWS S3 bucket. Configure CORS to allow PUT requests from `http://localhost:5173`.
  - [ ] Install `@aws-sdk/client-s3` and `@aws-sdk/s3-request-presigner` on the backend.
  - [ ] Write endpoint `GET /api/upload/pre-signed-url` (vendor authorized) generating a pre-signed URL.
  - [ ] Build React camera/photo input that grabs the pre-signed URL from backend and uploads the file directly to S3.

- [ ] **Geospatial Listings Schema & Purging**
  - [ ] Enable PostGIS extension in database migration.
  - [ ] Create Knex migration for `listings` table:
    - `id` (UUID/Serial)
    - `vendor_id` (foreign key references `users.id` ON DELETE CASCADE)
    - `name`, `image_url`, `original_price`, `discounted_price`
    - `quantity` (integer)
    - `closing_time` (timestamp)
    - `geom` (PostGIS geometry point format)
    - `address` (varchar)
  - [ ] Implement an automatic cron/worker query to delete/archive expired listings where `closing_time < NOW()`.
  - [ ] Hide listing address from default search feeds.

- [ ] **Vendor Listings Dashboard**
  - [ ] Write backend routes: `POST /api/listings`, `GET /api/listings/my-listings`, `DELETE /api/listings/:id`.
  - [ ] Build Vendor UI: Create "Add Listing" 5-field form, upload photo directly to S3, and post listing metadata (including geolocation).
  - [ ] Create "My Listings" screen listing active items, active reservations count, and a delete button.

---

## Phase 3: Geospatial Search, Reservations, and Caching (Days 7–9)

- [ ] **Geospatial Query Feed**
  - [ ] Implement `GET /api/listings/nearby?lat=&lng=&radius=` on backend using PostGIS spatial functions (e.g. `ST_DWithin` or `ST_Distance`).
  - [ ] Ensure search query filters out documents where `quantity` <= 0 and excludes the `address` field.

- [ ] **Redis Feed Caching**
  - [ ] Set up local Redis running via Docker (`docker run -p 6379:6379 -d redis`).
  - [ ] Implement Redis caching on the backend: Cache the listings for a lat/lng grid cell (e.g. rounded coordinates to 2 decimal places).
  - [ ] Implement cache invalidation: Clear cache grid cells whenever a new listing is added or when listing quantity becomes 0.

- [ ] **Atomic Reservations with PostgreSQL Transactions**
  - [ ] Create `reservations` table: `id`, `customer_id` (fk `users`), `listing_id` (fk `listings`), `quantity`, `status` (enum: `['pending', 'collected', 'cancelled']`), timestamps.
  - [ ] Write `POST /api/reservations/create` using a **PostgreSQL Transaction with Pessimistic Locking (`SELECT FOR UPDATE`)** on the listing row. Atomically decrement listing quantity if `quantity > 0`. If unavailable, rollback and respond with `409 Sold Out`.
  - [ ] Write `GET /api/reservations/:id` which reveals the `address` and `closing_time` of the listing ONLY to the user who reserved it.

- [ ] **Customer UI**
  - [ ] Integrate HTML Geolocation API to fetch customer's lat/lng coordinates.
  - [ ] Display nearby listings on a clean, responsive feed.
  - [ ] Implement Reservation button. On successful reservation, display collection countdown, address, and verification status.

---

## Phase 4: Async Jobs, Kafka Events & Rollbacks (Days 10–11)

- [ ] **BullMQ Email Queues**
  - [ ] Install `bullmq` and `ioredis`.
  - [ ] Set up an email background queue and worker.
  - [ ] On successful reservation, push a job to the queue. The worker sends a confirmation email containing pickup details asynchronously via `nodemailer`.

- [ ] **Apache Kafka Event Pipeline**
  - [ ] Set up a local Kafka broker using Docker (alongside Zookeeper).
  - [ ] Install `kafkajs` in the backend.
  - [ ] Create a Kafka producer utility to publish events on topics like `listing-events` (when new food is posted) and `reservation-events` (when food is claimed).
  - [ ] Implement a lightweight consumer that logs these events for audit trailing / future analytics.

- [ ] **Cancellation & Atomic Rollback**
  - [ ] Write `POST /api/reservations/:id/cancel` which marks reservation status as cancelled and atomically increments listing quantity inside a Postgres transaction.
  - [ ] Add vendor stats aggregation query (aggregating total revenue, items remaining, active reservation stats) and display in Vendor UI.

---

## Phase 5: Containerization & Cloud Deployment (Days 12–15)

- [ ] **Dockerization**
  - [ ] Write a production-grade `Dockerfile` for the Node.js backend.
  - [ ] Write a `docker-compose.yml` defining services: `backend`, `postgres` (with PostGIS installed), `redis`, `zookeeper`, `kafka`. Set up bridge networking and storage volumes.
  - [ ] Test the entire stack locally with `docker-compose up`.

- [ ] **AWS EC2 & Nginx Deployment**
  - [ ] Provision a free-tier AWS EC2 Ubuntu instance.
  - [ ] Install Docker and git on the instance. Clone the project and run it via `docker-compose`.
  - [ ] Install Nginx. Configure Nginx to proxy `/api/*` to the backend container port, serve the production React frontend build as static files, and bind everything to public HTTP ports.

---

## Phase 6: Safety, Trust & Fraud Prevention (Days 16–17)

- [ ] **Vendor Verification (KYC)**
  - [ ] Add `isVerified` (Boolean, default `false`) and `verificationDocUrl` (String) fields to the `User` schema.
  - [ ] Implement admin route `PATCH /api/admin/verify-vendor/:id` to manually review and approve vendors.
  - [ ] Restrict listing posting (`POST /api/listings`) only to verified vendors.

- [ ] **AI-Assisted Listing & Image Moderation**
  - [ ] Integrate **AWS Rekognition** (using the AWS SDK) to analyze vendor-uploaded images.
  - [ ] Automatically block uploads of images containing explicit, inappropriate, or non-food content (e.g., using Rekognition's DetectLabels API to verify if "Food" or "Groceries" is present with high confidence).
  - [ ] Use a lightweight natural language toxicity API or regex/spam blacklist for listing title/description validation.

- [ ] **Listing Flagging & Reporting System**
  - [ ] Add a `reports` field to `Listing` schema: `reports: [{ reporterId: ref User, reason: String, timestamp: Date }]`.
  - [ ] Create `POST /api/listings/:id/report` allowing customers to flag suspicious, fake, or offensive listings.
  - [ ] Set up an automatic trigger: If a listing accumulates >= 3 reports, its status is marked as `suspended` and it is automatically hidden from the active feed, triggering an email notification to the system administrator.


  