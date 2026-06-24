# Workplan: Surplus Food Sharing Marketplace (RescuEats)

## Phase 1: Foundation & Authentication
- [ ] **Project Scaffolding**
  - [ ] Initialize Express backend in `/backend`
  - [ ] Create folder structure: `src/config`, `src/controllers`, `src/models`, `src/routes`, `src/middlewares`, `src/utils`, `src/database/migrations`
  - [ ] Initialize React frontend in `/frontend` using Vite
  - [ ] Create root `.gitignore` file and configure it
- [ ] **Role-Based Authentication (RBAC)**
  - [ ] Setup Knex.js and PostGIS configuration
  - [ ] Create Knex migrations for `users` table (with role and `isVerified`)
  - [ ] Add bcrypt password hashing on register
  - [ ] Write registration and login controllers with JWT signing
  - [ ] Build `userAuth` and `checkRole` middlewares
- [ ] **Frontend Auth Flow**
  - [ ] Install React Router & Axios in frontend
  - [ ] Build forms for login & registration (with role toggle)
  - [ ] Setup Axios client with interceptor for JWT
  - [ ] Implement Private Route wrapper and Role Dashboards

## Phase 2: S3 Media Pipeline & Listing CRUD
- [ ] **AWS S3 Integration**
  - [ ] Setup S3 bucket CORS
  - [ ] Create S3 pre-signed URL backend route
  - [ ] Build frontend image upload component (direct-to-S3)
- [ ] **Listings Creation & Management**
  - [ ] Create Knex migration for `listings` table (PostGIS spatial geometry, foreign keys)
  - [ ] Implement expired listings cron purge query
  - [ ] Write Listing CRUD endpoints (`POST`, `GET`, `DELETE`)
  - [ ] Build Vendor Listings UI with image upload

## Phase 3: Geospatial Search, Reservations, and Caching
- [ ] **Geospatial & Feed**
  - [ ] Write `GET /api/listings/nearby` endpoint
  - [ ] Build Redis grid-caching middleware
  - [ ] Implement atomic reservation logic with PostgreSQL Transactions
  - [ ] Build Customer Feed UI with location tracking

## Phase 4: Async Jobs & Rollbacks
- [ ] **Queues, Events & Stats**
  - [ ] Set up BullMQ for nodemailer email sends
  - [ ] Set up local Kafka & Zookeeper via Docker
  - [ ] Implement Kafka producer and consumer using `kafkajs`
  - [ ] Publish events for listing creation and reservations
  - [ ] Build reservation cancellation rollback endpoint
  - [ ] Add vendor stats aggregation pipeline

## Phase 5: Containerization & Cloud Deployment
- [ ] **Docker & Deployment**
  - [ ] Create backend Dockerfile
  - [ ] Write `docker-compose.yml` for Node, Postgres, Redis, Kafka
  - [ ] Deploy and configure Nginx proxy on EC2

## Phase 6: Safety, Trust & Fraud Prevention
- [ ] **Moderation & Security**
  - [ ] Restrict listing creation to verified vendors
  - [ ] Integrate AWS Rekognition for food image checks
  - [ ] Implement user flagging/reporting backend and auto-suspension
