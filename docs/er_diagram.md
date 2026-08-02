# Entity Relationship (ER) Diagram & Database Specification

> **ServiceHub Platform** — Production-Grade Relational Database Architecture & Module Specifications

---

## 📐 Design Philosophy & Pipeline

Before implementing ORM models in Prisma, defining a clear Entity Relationship (ER) Diagram establishes model contracts, explicit relationship cardinalities, transaction boundaries, and domain boundaries.

```mermaid
graph TD
    PRD["📋 PRD & Requirements"] --> UF["👤 User Flows"]
    UF --> DM["🧠 Domain Model"]
    DM --> DS["⚙️ Database Specification"]
    DS --> ER["📐 ER Diagram"]
    ER --> PS["💎 Prisma Schema"]
    PS --> API["🔌 API Design"]
    API --> MOD["🏗️ NestJS Modules"]

    classDef primary fill:#2563eb,stroke:#1d4ed8,color:#ffffff,font-weight:bold;
    classDef secondary fill:#0f172a,stroke:#334155,color:#f8fafc;
    class PRD,UF,DM,DS,ER primary;
    class PS,API,MOD secondary;
```

---

## 🗂️ Complete ER Diagram

```mermaid
erDiagram
    users {
        uuid id PK
        string email UK
        string password_hash
        string first_name
        string last_name
        string phone UK
        enum role "USER | ADMIN"
        enum status "ACTIVE | INACTIVE | BLOCKED"
        boolean is_email_verified
        string refresh_token_hash
        datetime last_login_at
        datetime created_at
        datetime updated_at
        datetime deleted_at
    }

    provider_profiles {
        uuid id PK
        uuid user_id FK, UK
        string business_name
        string description
        int experience_years
        string profile_image_url
        enum verification_status "PENDING | VERIFIED | REJECTED | SUSPENDED"
        decimal average_rating
        int total_reviews
        datetime created_at
        datetime updated_at
        datetime deleted_at
    }

    provider_locations {
        uuid id PK
        uuid provider_id FK
        string address_line1
        string address_line2
        string city
        string state
        string postal_code
        decimal latitude
        decimal longitude
        boolean is_primary
        datetime created_at
        datetime updated_at
    }

    provider_documents {
        uuid id PK
        uuid provider_id FK
        enum document_type "AADHAAR | PAN | BUSINESS_LICENSE | GST"
        string file_url
        enum verification_status "PENDING | VERIFIED | REJECTED | SUSPENDED"
        string rejection_reason
        datetime uploaded_at
        datetime verified_at
        uuid verified_by_id FK
    }

    categories {
        uuid id PK
        string name UK
        string slug UK
        string icon
        string description
        int display_order
        boolean is_active
        datetime created_at
        datetime updated_at
    }

    services {
        uuid id PK
        uuid category_id FK
        string name
        string slug
        string description
        enum service_mode "AT_CUSTOMER_LOCATION | AT_PROVIDER_LOCATION | ONLINE"
        int default_duration
        boolean is_active
        datetime created_at
        datetime updated_at
    }

    provider_services {
        uuid id PK
        uuid provider_id FK
        uuid service_id FK
        decimal price
        string currency
        int duration_minutes
        int buffer_minutes
        string description
        boolean is_active
        datetime created_at
        datetime updated_at
    }

    availability {
        uuid id PK
        uuid provider_id FK
        int weekday
        time start_time
        time end_time
        time break_start
        time break_end
        boolean is_available
        datetime created_at
        datetime updated_at
    }

    bookings {
        uuid id PK
        uuid customer_id FK
        uuid provider_id FK
        uuid provider_service_id FK
        date booking_date
        time start_time
        time end_time
        enum booking_status "PENDING_PAYMENT | PAYMENT_FAILED | CONFIRMED | COMPLETED | CANCELLED | EXPIRED"
        decimal booked_price
        int booked_duration
        enum booked_service_mode
        string service_name
        string provider_business_name
        string customer_notes
        string cancellation_reason
        datetime cancelled_at
        datetime created_at
        datetime updated_at
    }

    payments {
        uuid id PK
        uuid booking_id FK
        enum gateway "RAZORPAY"
        string gateway_order_id UK
        string gateway_payment_id UK
        string gateway_signature
        decimal amount
        string currency
        enum status "CREATED | PENDING | SUCCESS | FAILED | REFUNDED"
        datetime paid_at
        datetime refunded_at
        datetime created_at
        datetime updated_at
    }

    reviews {
        uuid id PK
        uuid booking_id FK, UK
        uuid customer_id FK
        uuid provider_id FK
        int rating
        string comment
        datetime created_at
        datetime updated_at
    }

    notifications {
        uuid id PK
        uuid user_id FK
        uuid booking_id FK
        enum type "BOOKING_CONFIRMED | BOOKING_CANCELLED | PAYMENT_SUCCESS | PAYMENT_FAILED | REMINDER | REVIEW_REQUEST"
        enum channel "EMAIL | SMS | PUSH"
        enum status "PENDING | SENT | FAILED"
        string title
        string body
        datetime scheduled_for
        datetime sent_at
        datetime failed_at
        string failure_reason
        int attempt_count
        datetime created_at
    }

    audit_logs {
        uuid id PK
        uuid actor_user_id FK
        string entity_type
        uuid entity_id
        enum action "BOOKING_CREATED | BOOKING_CONFIRMED | BOOKING_CANCELLED | PROVIDER_VERIFIED | PAYMENT_SUCCESS | PAYMENT_FAILED"
        json old_value
        json new_value
        string ip_address
        string user_agent
        datetime created_at
    }

    %% Relationships
    users ||--o| provider_profiles : "1:0..1 (has profile)"
    users ||--o{ provider_documents : "1:N (verifies)"
    users ||--o{ bookings : "1:N (places)"
    users ||--o{ reviews : "1:N (writes)"
    users ||--o{ notifications : "1:N (receives)"
    users ||--o{ audit_logs : "1:N (triggers)"

    provider_profiles ||--o{ provider_locations : "1:N (has locations)"
    provider_profiles ||--o{ provider_documents : "1:N (submits docs)"
    provider_profiles ||--o{ provider_services : "1:N (offers services)"
    provider_profiles ||--o{ availability : "1:N (configures schedule)"
    provider_profiles ||--o{ bookings : "1:N (receives bookings)"
    provider_profiles ||--o{ reviews : "1:N (receives ratings)"

    categories ||--o{ services : "1:N (groups services)"
    services ||--o{ provider_services : "1:N (instantiated by)"

    provider_services ||--o{ bookings : "1:N (referenced in)"

    bookings ||--o{ payments : "1:N (has payments)"
    bookings ||--o| reviews : "1:0..1 (reviewed in)"
    bookings ||--o{ notifications : "1:N (triggers alerts)"
```

---

## 📊 Cardinality & Relationship Matrix

| Primary Entity | Target Entity | Relationship | Cardinality | FK Location | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **User** | **ProviderProfile** | One-to-Optional-One | `1 : 0..1` | `provider_profiles.user_id` | A user can optionally register as a service provider. |
| **User** | **ProviderDocument** | One-to-Many | `1 : N` | `provider_documents.verified_by_id` | An admin user verifies provider verification documents. |
| **User** | **Booking** | One-to-Many | `1 : N` | `bookings.customer_id` | A customer user places bookings. |
| **User** | **Review** | One-to-Many | `1 : N` | `reviews.customer_id` | A customer writes reviews for completed bookings. |
| **User** | **Notification** | One-to-Many | `1 : N` | `notifications.user_id` | A user receives account and transaction notifications. |
| **User** | **AuditLog** | One-to-Many | `1 : N` | `audit_logs.actor_user_id` | User actions recorded for audit history. |
| **ProviderProfile** | **ProviderLocation** | One-to-Many | `1 : N` | `provider_locations.provider_id` | A provider profile can register multiple operating locations. |
| **ProviderProfile** | **ProviderDocument** | One-to-Many | `1 : N` | `provider_documents.provider_id` | A provider uploads documents for platform verification. |
| **ProviderProfile** | **ProviderService** | One-to-Many | `1 : N` | `provider_services.provider_id` | A provider configures customized pricing/duration for catalog services. |
| **ProviderProfile** | **Availability** | One-to-Many | `1 : N` | `availability.provider_id` | Weekly schedule & break slots configured by provider. |
| **ProviderProfile** | **Booking** | One-to-Many | `1 : N` | `bookings.provider_id` | Bookings assigned to the service provider. |
| **ProviderProfile** | **Review** | One-to-Many | `1 : N` | `reviews.provider_id` | Overall rating & reviews accumulated by provider. |
| **Category** | **Service** | One-to-Many | `1 : N` | `services.category_id` | Category groups standardized service templates. |
| **Service** | **ProviderService** | One-to-Many | `1 : N` | `provider_services.service_id` | Catalog service implemented by multiple providers. |
| **ProviderService** | **Booking** | One-to-Many | `1 : N` | `bookings.provider_service_id` | Customer books a specific provider service offer. |
| **Booking** | **Payment** | One-to-Many | `1 : N` | `payments.booking_id` | Booking can have payment attempts (1 success, multiple attempts). |
| **Booking** | **Review** | One-to-Optional-One | `1 : 0..1` | `reviews.booking_id` | A completed booking can receive at most 1 review. |
| **Booking** | **Notification** | One-to-Many | `1 : N` | `notifications.booking_id` | Triggered notification events linked to a booking lifecycle. |

---

## 🏗️ Domain Bounded Contexts & Module Ownership

Each table belongs strictly to a domain boundary. NestJS modules encapsulate access to their respective database entities to avoid cross-domain coupling.

```mermaid
graph TB
    subgraph AuthModule ["🔐 Auth & User Domain"]
        users[users]
        audit_logs[audit_logs]
    end

    subgraph ProviderModule ["🛠️ Provider Domain"]
        provider_profiles[provider_profiles]
        provider_locations[provider_locations]
        provider_documents[provider_documents]
        provider_services[provider_services]
        availability[availability]
    end

    subgraph CatalogModule ["🗂️ Catalog Domain"]
        categories[categories]
        services[services]
    end

    subgraph BookingModule ["📅 Booking Domain"]
        bookings[bookings]
    end

    subgraph PaymentModule ["💳 Payment Domain"]
        payments[payments]
    end

    subgraph ReviewModule ["⭐ Review Domain"]
        reviews[reviews]
    end

    subgraph NotificationModule ["🔔 Notification Domain"]
        notifications[notifications]
    end

    AuthModule --> ProviderModule
    CatalogModule --> ProviderModule
    ProviderModule --> BookingModule
    BookingModule --> PaymentModule
    BookingModule --> ReviewModule
    BookingModule --> NotificationModule

    classDef auth fill:#1e293b,stroke:#3b82f6,color:#fff;
    classDef provider fill:#1e293b,stroke:#10b981,color:#fff;
    classDef catalog fill:#1e293b,stroke:#8b5cf6,color:#fff;
    classDef booking fill:#1e293b,stroke:#f59e0b,color:#fff;
    classDef payment fill:#1e293b,stroke:#ec4899,color:#fff;
    classDef review fill:#1e293b,stroke:#eab308,color:#fff;
    classDef notification fill:#1e293b,stroke:#06b6d4,color:#fff;

    class users,audit_logs auth;
    class provider_profiles,provider_locations,provider_documents,provider_services,availability provider;
    class categories,services catalog;
    class bookings booking;
    class payments payment;
    class reviews review;
    class notifications notification;
```

---

## 🔄 Transaction Boundaries & Data Workflows

Design transactions with explicit boundaries to prevent deadlocks and maintain consistency.

### 1. Booking Creation Transaction Boundary

```mermaid
sequenceDiagram
    autonumber
    actor Customer
    participant API as Booking Controller
    participant Tx as DB Transaction ($transaction)
    participant Payment as Razorpay Gateway

    Customer->>API: POST /bookings (provider_service_id, slot)
    API->>Tx: Begin Transaction
    Tx->>Tx: Validate Provider Verification Status (VERIFIED)
    Tx->>Tx: Check Provider Service Active & Slot Availability
    Tx->>Tx: Create Booking (PENDING_PAYMENT)
    Tx->>Tx: Create Payment Record (CREATED)
    Tx->>API: Commit Transaction
    API->>Payment: Initialize Payment Order
    Payment-->>Customer: Return Razorpay Checkout Order
```

### 2. Payment Webhook Confirmation Boundary

```mermaid
sequenceDiagram
    autonumber
    actor Gateway as Razorpay Webhook
    participant API as Payment Controller
    participant Tx as DB Transaction ($transaction)
    participant Queue as BullMQ Notification Queue

    Gateway->>API: POST /payments/webhook (payment.captured)
    API->>API: Verify Webhook Signature
    API->>Tx: Begin Transaction
    Tx->>Tx: Update Payment Status (SUCCESS) & set paidAt
    Tx->>Tx: Update Booking Status (CONFIRMED)
    Tx->>Tx: Insert Audit Log (PAYMENT_SUCCESS)
    Tx->>API: Commit Transaction
    API->>Queue: Enqueue BOOKING_CONFIRMED & PAYMENT_SUCCESS Notifications
    API-->>Gateway: 200 OK
```
