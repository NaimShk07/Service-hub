# Backend Engineering Q&A Notes

A simple, short-English reference of key backend concepts, interview questions, and real-world system designs learned during ServiceHub development.

---

## Day 6: Security and API Hardening

### 1. Rate Limiting (`@nestjs/throttler`)

**Q: Why do we need tight rate limits on `/auth/login`?**  
**A:**  
1. It stops hackers from brute-forcing passwords with automated bots.  
2. Password checking uses `bcrypt`, which is very slow on the CPU. Many requests at once will freeze the entire server.

**Q: Why do we need tight rate limits on `/payments/orders`?**  
**A:**  
It stops bots from spamming our payment gateway (Razorpay) and creating thousands of fake or orphan pending orders in our database.

**Q: Why MUST we put `@SkipThrottle()` on `/payments/webhook`?**  
**A:**  
Because Razorpay calls this webhook after the user pays. If our server returns `429 Too Many Requests`, Razorpay fails to confirm the payment. The customer loses money, but their booking never gets confirmed.

**Q: How does NestJS Throttler track users, and why does `trust proxy` matter?**  
**A:**  
By default, it tracks by IP address (`req.ip`). In production behind Nginx or Cloudflare, all requests look like they come from the proxy's IP. Setting `app.set('trust proxy', 1)` tells Express to read the real client IP from the `X-Forwarded-For` header.

---

### 2. DTO Validation & Mass Assignment

**Q: What does `whitelist: true` do?**  
**A:**  
It silently removes any extra fields from the incoming JSON that are not defined in the DTO class.

**Q: Why is `whitelist: true` not enough, and why do we need `forbidNonWhitelisted: true`?**  
**A:**  
1. **Security:** If code ever uses `req.body` directly, unwhitelisted fields (like `role: "ADMIN"`) could sneak into the database.  
2. **Bugs:** If the frontend makes a typo (like `fistName` instead of `firstName`), `whitelist: true` drops it silently with no error.  
3. `forbidNonWhitelisted: true` immediately rejects the request with a `400 Bad Request` saying `"property role should not exist"`.

---

### 3. Document Protection & IDOR

**Q: What is the risk of serving the entire `uploads/` folder with `ServeStaticModule`?**  
**A:**  
Static files bypass all authentication and guards. Anyone on the internet with a file URL can download private provider documents (like PAN cards or Aadhaar cards) without logging in.

**Q: What is IDOR (Insecure Direct Object Reference)?**  
**A:**  
When an authenticated user requests a resource using its ID (like `/documents/:id/file`), and the server forgets to check if that user actually owns the file.

**Q: How do we fix IDOR for provider documents?**  
**A:**  
In the service layer, check two things before sending the file:  
1. Is the user an `ADMIN`? (Allowed).  
2. Is the user the provider who owns the document? (`document.provider.userId === req.user.id`).  
If neither, reject with `403 Forbidden`.

---

### 4. Database Error Leaks & Timeouts

**Q: Why shouldn't we show raw database errors in production?**  
**A:**  
They reveal table names, column names, constraint names, and SQL fragments to attackers.

**Q: What is the clean way to handle errors in production?**  
**A:**  
Return a friendly generic message (e.g., `"A duplicate record already exists."`) together with a `requestId`. Log the full SQL error internally under that same `requestId` so developers can inspect it.

**Q: Why do we need a 30-second `TimeoutInterceptor`?**  
**A:**  
If an external API or database hangs, open connections hold onto server memory and socket descriptors. A timeout cuts off stuck requests and frees resources.

**Q: What does `app.enableShutdownHooks()` do?**  
**A:**  
When the app restarts or redeploys, it lets active requests finish, cleanly closes database connections, and disconnects Redis instead of crashing mid-request.

---

## Day 7: CI Pipeline & Release Readiness

### 1. CI Pipeline Architecture

**Q: What are GitHub Actions "Service Containers"?**  
**A:**  
They are real Docker containers (like PostgreSQL and Redis) spun up automatically inside the CI workflow runner. Node.js tests talk directly to them on `localhost:5432` and `localhost:6379` during the test run.

**Q: Why does a clean PostgreSQL database in CI need the `btree_gist` extension?**  
**A:**  
PostgreSQL cannot create GiST exclusion constraints on standard columns (like timestamp ranges and UUIDs) without `btree_gist`. Without it, the booking overlap prevention migration will crash.

**Q: Why MUST database integration tests run with `--runInBand` in CI?**  
**A:**  
By default, Jest runs test files in parallel. If two concurrency tests run at the same millisecond against the same database, they will truncate each other's tables or cause deadlocks. `--runInBand` forces Jest to run test suites sequentially, ensuring 100% reliable, deterministic test passes.
