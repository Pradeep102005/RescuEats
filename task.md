# Workplan: Surplus Food Sharing Marketplace (RescuEats)

- [x] **Project Scaffolding**
  - [x] Create folder structure: `src/config`, `src/models`, etc.
  - [x] Create Mongoose schemas for `User`, `VendorProfile`, `Listing`, `Reservation`, `Payment`, `Rating`, `Report`, and `Notification`
- [ ] **Role-Based Authentication (RBAC)**
  - [x] Setup MongoDB configuration in `src/config/database.js`
  - [x] Write registration and login controllers with JWT signing
  - [x] Build `userAuth` and `checkRole` middlewares
- [ ] **Frontend Auth Flow**
  - [x] Install React Router & Axios in frontend
  - [x] Build forms for login & registration (with role toggle)
  - [x] Setup Axios client with interceptor for JWT
  - [x] Implement Private Route wrapper and Role Dashboards

## Phase 2: S3 Media Pipeline & Listing CRUD
- [x] **AWS S3 Integration**
  - [x] Setup S3 bucket CORS
  - [x] Create S3 pre-signed URL backend route
  - [x] Build frontend image upload component (direct-to-S3)
- [x] **Listings Creation & Management**
  - [x] Write Listing CRUD endpoints (`POST /vendor/add-item`, `GET /vendor/my-listings`, `DELETE /vendor/listings/:id`)
  - [x] Implement expired listings cron purge job (`src/jobs/listingCleanup.js`)
  - [x] Build Vendor Profile CRUD routes (`GET /vendor/profile`, `PATCH /vendor/profile`)
  - [ ] Build Vendor Listings UI with image upload (frontend)


## Phase 3: Geospatial Search, Reservations, and Caching
- [x] **Geospatial & Feed**
  - [x] Write `GET /api/listings/nearby?lat=&lng=&radius=` endpoint (MongoDB $near on 2dsphere index)
  - [x] Write `GET /api/listings/:id` public listing detail
- [x] **Kafka-Driven Reservations**
  - [x] `POST /api/reservations/create` — Publishes reservation request to Kafka topic for async processing and inventory management
  - [x] `GET /api/reservations/:id` — reveals vendor address only to the reserver
  - [x] `GET /api/reservations` — customer order history
  - [x] `POST /api/reservations/:id/cancel` — Publishes cancellation event to Kafka to trigger inventory restoration
- [x] **Razorpay Payment Gateway**
  - [x] Razorpay SDK config (`src/config/razorpay.js`)
  - [x] `POST /api/payments/create-order` — creates Razorpay order + Payment doc with fee split
  - [x] `POST /api/payments/verify` — Confirm payment and publish payment success to Kafka
  - [x] `POST /api/payments/webhook` — server-to-server safety net for payment confirmation
  - [x] Reservation flow updated: `pending_payment` → pay via Razorpay → `confirmed`
- [ ] **Redis Feed Caching** (deferred — requires Docker setup)
- [ ] Build Customer Feed UI with location tracking (frontend)

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
