# ServiceHub — Concepts Explained (Simple Hinglish Guide) 🚀

Ye guide ServiceHub project ke saare core concepts aur architecture ko **ekdam simple Hinglish aur real-life analogies** ke saath samjhane ke liye banayi gayi hai.

---

## 📌 Table of Contents

1. [BullMQ + Redis: Background Processing (Queues, Jobs, Workers)](#1-bullmq--redis-background-processing)
2. [Dual-Token Authentication (Access Token vs Refresh Cookie)](#2-dual-token-authentication)
3. [Interceptors & Exception Filters: Clean Request-Response Lifecycle](#3-interceptors--exception-filters)
4. [Prisma ORM v7 & PostgreSQL Connection Pooling](#4-prisma-orm-v7--postgresql-pooling)
5. [Guards & Decorators (RBAC & CurrentUser)](#5-guards--decorators-rbac)
6. [Booking Engine: Slot Booking & Delayed Expiration](#6-booking-engine--delayed-expiration)

---

## 1. BullMQ + Redis: Background Processing

### 💡 Asli Problem Kya Thi?

Maan lijiye customer ne booking ki ya payment kiya:

- Agar hum API ke andar hi email/SMS bhejte hain aur external SMS gateway ne 4 second liye, toh user ka app "Loading..." me atka rahega.
- Agar email server down hua, toh poori booking API 500 error de degi, jabki booking database me ho chuki thi!

### 🍽️ Real-Life Analogy (Restaurant)

- **Customer**: App user.
- **Counter/Cashier (API/Controller)**: Order leta hai, token print karke board par laga deta hai, aur customer ko turant bill/token pakda deta hai (50ms me free).
- **Order Board (Redis Queue)**: Jahan saari order slips ek ke baad ek lagi hain.
- **Order Slip (Job)**: Jo kaam karna hai uska chhota data packet (e.g., `{ userId: '123', template: 'BOOKING_CONFIRMED' }`).
- **Kitchen Chef (Processor / Worker)**: Parde ke peeche chupchap slips uthata hai aur ek-ek karke khana banata hai (notification send karta hai).

### 📂 Hamare Project me Code:

- **Redis Connection**: [JobsModule](file:///Users/nayemuddinshaikh/Desktop/Coding/New_goals/2026/ServiceHub/src/jobs/jobs.module.ts) — `BullModule.forRootAsync` Redis se connect karta hai.
- **Producer (Queue)**: [NotificationQueueService](file:///Users/nayemuddinshaikh/Desktop/Coding/New_goals/2026/ServiceHub/src/jobs/queues/notification.queue.ts) — `notificationQueue.add()` call karke kaam Redis me daalta hai.
- **Consumer (Processor)**: [NotificationProcessor](file:///Users/nayemuddinshaikh/Desktop/Coding/New_goals/2026/ServiceHub/src/jobs/processors/notification.processor.ts) — `process(job)` background me run hota hai.
  - `concurrency: 5`: Ek time par 5 notifications parallel bhej sakta hai.
  - [BookingProcessor](file:///Users/nayemuddinshaikh/Desktop/Coding/New_goals/2026/ServiceHub/src/jobs/processors/booking.processor.ts): `concurrency: 2` rakha hai taaki database state change ke time conflict na ho.

---

TODO add and format below later:
ServiceHub me humne **BullMQ + Redis** ko background jobs, automated timers, aur heavy tasks handle karne ke liye use kiya hai taaki main API kabhi slow na ho aur sabhi actions automatically aur reliably chalein.

Yahan short aur simple summary hai:

---

### 1. Redis aur BullMQ ka role kya hai?
* **Redis:** Ek super-fast in-memory database hai jo hamari **job queue** aur **timers** ko memory me store karke rakhta hai.
* **BullMQ:** Ek job queue library hai jo Redis ke upar chalti hai. Ye schedule karti hai ki kaun sa task kab chalna hai, kitni baar retry hona hai, aur kitne background workers ek saath kaam karenge.

---

### 2. Humne kya-kya automate kiya?

#### A. 15-Minute Payment Expiration (Auto-Slot Release)
* **Problem:** Agar user slot book karke payment page par chhod de, toh slot lock reh jayega aur koi dusra book nahi kar payega.
* **BullMQ Solution:** Booking bante hi 15-minute ka delayed job lag jata hai (`expire-payment_${id}`). 
  * Agar 15 minute me payment **nahi aayi** $\rightarrow$ Worker booking ko `EXPIRED` kar deta hai aur time-slot automatically free ho jata hai.
  * Agar user ne **pay kar diya** $\rightarrow$ Hum Redis se is expiry job ko turant `cancel` kar dete hain.

#### B. Smart Notifications & Reminders (Life-cycle)
* Booking `CONFIRMED` hote hi 4 jobs schedule hote hain:
  1. **Instant Confirmation Email:** Turant user ko email jata hai.
  2. **24-Hour Reminder:** Service start hone se theek 24 ghante pehle.
  3. **2-Hour Reminder:** Provider aane se 2 ghante pehle.
  4. **Post-Service Review Request:** Service khatam hone ke 1 ghante baad feedback maangne ke liye.
* **Edge Case Safety:** Agar kisi ne 30 minute baad ke liye booking ki hai, toh 24-hr aur 2-hr wale reminder jobs **skip** ho jate hain (negative delay kabhi Redis me nahi jata).
* **Cancel Protection:** Agar booking cancel hoti hai, toh pending reminders Redis se delete ho jaate hain.

#### C. Background Emails & Auto-Retry
* Email bhejna slow hota hai (1-2 seconds le sakta hai). Isliye user ko wait karwaye bina email background worker ko de diya jata hai.
* Agar mail server down ho, toh BullMQ **Exponential Backoff** ke saath automatically retry karta hai (5s $\rightarrow$ 10s $\rightarrow$ 20s). Agar 3 baar fail ho jaye, toh DB me `FAILED` record hota hai.

#### D. Overdue & No-Show Review Flagging
* Appointment khatam hone ke 2 ghante baad (Grace Period) ka ek overdue check job lagta hai.
* Agar Provider service khatam karke **Complete** mark kar deta hai, toh ye job cancel ho jata hai.
* Agar provider complete mark karna bhool jaye, toh system bina kisi ko penalize kiye booking ko **`needsReview = true`** mark kar deta hai taaki Admin dashboard par dekh kar verify kar sake.

---

### 3. Production-Level Safety (Portfolio Highlight)
* **Concurrency Guard:** Agar 2 background workers ek hi millisecond par same booking ko expire ya overdue karne aate hain, toh humne atomic conditional queries use ki hain (`updateMany`). Exactly **ek hi worker** update karega, doosra safely skip ho jayega.
* **Job Idempotency:** Job ID unique rakhi hai (e.g. `overdue-check_${bookingId}`, `expire-payment_${bookingId}`) taaki duplicate jobs kabhi create na ho sakein.

## 2. Dual-Token Authentication

### 💡 Single Token me Problem Kya Hoti Hai?

Agar hum 30 din ka ek hi JWT token bana kar localStorage me daal denge:

- **XSS Attack**: Agar kisi malicious JavaScript script ne `localStorage.getItem('token')` padh liya, toh hacker 30 din tak account chala sakta hai aur hum use rok nahi sakte (JWT stateless hota hai).

### 🛡️ Solution: 2 Tokens (Access Token + Refresh Token)

| Token             | Validity                      | Kahan Rehta Hai?                             | Kaam                                                                             |
| ----------------- | ----------------------------- | -------------------------------------------- | -------------------------------------------------------------------------------- |
| **Access Token**  | Chhote time ke liye (15 min)  | Memory / Authorization Header (`Bearer ...`) | Har API call ko allow karne ke liye. Agar leak bhi ho jaye toh 15 min me expire! |
| **Refresh Token** | Lambe time ke liye (7-30 din) | **HTTP-Only Cookie**                         | Naya Access Token mangwane ke liye. JavaScript is cookie ko padh hi nahi sakti!  |

### 🏨 Real-Life Analogy (Hotel Room Key)

- **Access Token**: Aapke room ka plastic keycard. Ye 1 din baad expire ho jata hai. Agar kho bhi gaya toh thodi der me bekar ho jayega.
- **Refresh Token**: Aapka passport/Aadhar card jo hotel manager ke pass secure locker (HTTP-Only Cookie) me hai. Jab keycard expire hota hai, manager chupchap use verify karke naya keycard bana deta hai.

### 📂 Hamare Project me Code:

- [auth.service.ts](file:///Users/nayemuddinshaikh/Desktop/Coding/New_goals/2026/ServiceHub/src/modules/auth/services/auth.service.ts):
  - Login par Access Token JSON me return hota hai.
  - Refresh Token hash hokar database me save hota hai (`refreshTokenHash`) aur response me HTTP-Only cookie ban kar browser me chala jata hai.

---

## 3. Interceptors & Exception Filters

### 💡 Problem: Inconsistent API Responses

Kabhi backend `{ data: { user } }` bhej raha hai, kabhi direct `{ id, name }`, aur error aane par kabhi HTML page ya default `{ statusCode: 500 }`. Frontend developer pareshan ho jata hai.

### 🎯 Solution: Universal Wrapper Pattern

Har request aur error ek standard structure me bahar niklega:

**Success Response (Hamesha):**

```json
{
  "statusCode": 200,
  "success": true,
  "data": { ... },
  "timestamp": "2026-09-06T12:00:00.000Z"
}
```

**Error Response (Hamesha):**

```json
{
  "statusCode": 404,
  "success": false,
  "message": "Provider not found",
  "error": "Not Found",
  "timestamp": "2026-09-06T12:00:00.000Z",
  "path": "/api/v1/providers/123"
}
```

### 📂 Hamare Project me Code:

- **Response Interceptor**: [response.interceptor.ts](file:///Users/nayemuddinshaikh/Desktop/Coding/New_goals/2026/ServiceHub/src/common/interceptors/response.interceptor.ts) — Controller jo bhi return kare, ye usko pakad kar `{ success: true, data }` ke box me pack kar deta hai.
- **Exception Filter**: [all-exceptions.filter.ts](file:///Users/nayemuddinshaikh/Desktop/Coding/New_goals/2026/ServiceHub/src/common/filters/all-exceptions.filter.ts) — Chahe Prisma ka error ho, validation error ho ya syntax crash, sabko pakad kar clean error JSON banata hai.

---

## 4. Prisma ORM v7 & PostgreSQL Pooling

### 💡 Problem: Database Connection Exhaustion

Har baar user API hit kare aur backend naya database connection banaye, toh 100 users aate hi PostgreSQL crash ho jayega ("Too many connections").

### 🏊 Solution: Connection Pool (`pg.Pool`)

- Ek common "swimming pool" hai jisme 10-20 connections pehle se khule baithe hain.
- Jo query aati hai, wo khali connection use karti hai aur kaam khatam hote hi wapas pool me chhod deti hai.
- Prisma v7 me hum `@prisma/adapter-pg` driver adapter use karte hain jo direct node-pg ke pool ko Prisma se jod deta hai.

### 📂 Hamare Project me Code:

- [prisma.service.ts](file:///Users/nayemuddinshaikh/Desktop/Coding/New_goals/2026/ServiceHub/src/database/prisma.service.ts)
- `PrismaClient` initialization with driver adapter for zero-overhead query execution.

---

## 5. Guards & Decorators (RBAC)

### 👮 Real-Life Analogy (Club Security)

- **`JwtAuthGuard`**: Club ke darwaze ka bouncer. Check karta hai: _"Kya tumhare paas valid wristband (JWT) hai?"_
- **`RolesGuard`**: VIP lounge ka bouncer. Check karta hai: _"Wristband toh hai, lekin kya tum ADMIN ya VIP ho?"_

### 📂 Hamare Project me Code:

Controller me hum bas simple decorators lagate hain:

```typescript
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Get('admin/dashboard')
getAdminDashboard(@CurrentUser() user: User) {
  // Yahan sirf verified ADMIN hi pahunch sakta hai!
}
```

- `@CurrentUser()`: Request object se user nikal kar seedha controller argument me de deta hai, baar-baar `req.user` likhne ki zaroorat nahi.

---

## 6. Booking Engine: Slot Booking & Delayed Expiration

### 💡 Problem: Unpaid Bookings Blocking Slots

Kisi user ne sham 5 baje ka plumber book kiya lekin payment page par jakar baith gaya aur payment nahi ki.

- Agar slot locked raha toh koi dusra book nahi kar payega (business loss!).
- Agar slot open raha toh do log ek saath payment kar denge (double booking!).

### ⏱️ Solution: 15-Minute Expiry Job with BullMQ

1. User ne booking initiate ki -> Status = `PENDING`.
2. Slot temporarily lock ho gaya.
3. **BullMQ me ek delayed job daali gayi** (Delay = 15 minutes / 900,000 ms):
   ```typescript
   await bookingQueue.add(
     "EXPIRE_BOOKING",
     { bookingId },
     { delay: 15 * 60 * 1000 },
   );
   ```
4. Agar 15 minute ke andar payment webhook aa gaya -> Status = `CONFIRMED`.
5. Agar 15 minute tak payment nahi aayi -> Background me [BookingProcessor](file:///Users/nayemuddinshaikh/Desktop/Coding/New_goals/2026/ServiceHub/src/jobs/processors/booking.processor.ts) chalega, booking ko `CANCELLED` karega aur slot wapas free kar dega!

---

_(Jab bhi naya complex topic aayega jaise Razorpay Webhooks, PostgreSQL Exclusion Constraints, ya Multer Storage Pipeline — hum usko yahan isi simple format me add karte rahenge!)_
