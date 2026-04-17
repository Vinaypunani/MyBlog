# Product Requirements Document (PRD)
## Modern Scalable Blog Platform

---

| Field | Details |
|---|---|
| **Document Version** | 1.0.0 |
| **Status** | Draft |
| **Last Updated** | April 2026 |
| **Owner** | Product Team |
| **Stakeholders** | Engineering, Design, DevOps, Marketing |

---

## Table of Contents

1. [Overview](#1-overview)
2. [Tech Stack](#2-tech-stack)
3. [Features & Functional Requirements](#3-features--functional-requirements)
4. [System Architecture](#4-system-architecture)
5. [Security Best Practices](#5-security-best-practices)
6. [SEO & Rendering Strategy](#6-seo--rendering-strategy)
7. [DevOps & Deployment](#7-devops--deployment)
8. [Non-Functional Requirements](#8-non-functional-requirements)
9. [Future Enhancements](#9-future-enhancements)
10. [Appendix](#10-appendix)

---

## 1. Overview

### 1.1 Purpose

This document defines the product requirements for a **modern, scalable blog platform** built on the MERN stack. It serves as the single source of truth for engineering, design, and product teams throughout the development lifecycle.

### 1.2 Vision

To build a best-in-class blogging platform that empowers creators to publish high-quality content, engage their audiences, and grow their readership — all within a performant, SEO-first, and developer-friendly environment.

### 1.3 Target Audience

| Segment | Description |
|---|---|
| **Individual Bloggers** | Writers, journalists, and creators seeking a powerful yet simple publishing tool |
| **Dev-Focused Publishers** | Technical bloggers needing Markdown support, code highlighting, and API access |
| **Small to Mid-Size Publications** | Editorial teams managing multi-author workflows with role-based access |
| **Businesses & Brands** | Organizations using content marketing for organic growth |

### 1.4 Key Objectives

- Deliver a seamless content creation and publishing experience
- Achieve best-in-class Core Web Vitals scores (LCP < 2.5s, FID < 100ms, CLS < 0.1)
- Support multi-role workflows: admin, editor, author, reader
- Ensure platform can scale horizontally to 1M+ monthly active users
- Provide robust SEO tooling out of the box

### 1.5 Success Metrics (KPIs)

| KPI | Target | Measurement Method |
|---|---|---|
| Page Load Time (LCP) | < 2.5 seconds | Google Lighthouse / CrUX |
| Time to First Byte (TTFB) | < 200ms | WebPageTest |
| Monthly Active Users (MAU) | 100K (6 months), 1M (18 months) | Analytics |
| Content Published per Month | 10K+ articles | Internal DB metrics |
| API Uptime | 99.9% SLA | Uptime monitoring |
| Search Ranking (Organic) | Top 3 for target keywords | Google Search Console |
| User Retention (30-day) | > 40% | Analytics |
| Avg. Session Duration | > 3 minutes | Analytics |

---

## 2. Tech Stack

### 2.1 Frontend — Next.js

| Concern | Choice | Rationale |
|---|---|---|
| Framework | Next.js 14+ (App Router) | SSR, SSG, ISR support; React Server Components; file-based routing |
| Language | TypeScript | Type safety, better DX, reduced runtime errors |
| Styling | ShadCN with Tailwind CSS + CSS Modules | Utility-first, purged CSS, zero-runtime overhead |
| State Management | Zustand + React Query | Lightweight global state; server-state caching and sync |
| Rich Text Editor | TipTap (ProseMirror-based) | Headless, extensible, Markdown + WYSIWYG support |
| Code Highlighting | Shiki | Server-side syntax highlighting; accurate token colors |
| Forms | React Hook Form + Zod | Performant validation; schema-first approach |
| Testing | Jest + React Testing Library + Playwright | Unit, integration, and E2E coverage |

### 2.2 Backend — Express.js

| Concern | Choice | Rationale |
|---|---|---|
| Runtime | Node.js 20 LTS | Long-term support, stable performance |
| Framework | Express.js 5 | Minimal, flexible, battle-tested |
| API Style | REST (primary) + optional GraphQL (Apollo Server) | REST for simplicity; GraphQL for complex data queries |
| Authentication | Passport.js + JWT + OAuth 2.0 | Flexible auth strategies |
| Validation | Zod (shared with frontend) | Schema reuse; consistent validation |
| ORM/ODM | Mongoose 8 | Schema-based modeling for MongoDB |
| File Uploads | Multer + Sharp | Multipart handling; server-side image optimization |
| Email | Nodemailer + SendGrid | Transactional emails (verify, reset, notify) |
| Testing | Jest + Supertest | API route testing |

### 2.3 Database — MongoDB

| Concern | Choice |
|---|---|
| Database | MongoDB atlases via URL |
| ODM | Mongoose |
| Search | MongoDB Atlas Search (Lucene-based) or optional Elasticsearch |
| Caching | Redis (sessions, rate limiting, hot-path cache) |
| File Storage | Cloudinary (media assets) |

**Indexing Strategy:**

```
Posts:          { slug: 1 }, { author: 1 }, { tags: 1 }, { publishedAt: -1 }, { status: 1 }
Users:          { email: 1 (unique) }, { username: 1 (unique) }
Comments:       { post: 1 }, { parent: 1 }, { createdAt: -1 }
Categories:     { slug: 1 (unique) }
Full-text:      posts.title + posts.excerpt + posts.content (Atlas Search index)
```

### 2.4 Containerization — Docker

- **Multi-stage builds** separate build-time dependencies from runtime image
- **Dev environment**: hot reload via bind mounts; separate MongoDB + Redis containers
- **Prod environment**: distroless/minimal base images; secrets via environment injection

```yaml
# docker-compose.yml (overview)
services:
  frontend:    # Next.js (port 3000)
  backend:     # Express.js (port 5000)
  mongo:       # MongoDB (port 27017)
  redis:       # Redis (port 6379)
  nginx:       # Reverse proxy + SSL termination (ports 80/443)
```

---

## 3. Features & Functional Requirements

### 3.1 User Authentication & Authorization

#### 3.1.1 Authentication Methods

- **Email/Password** — bcrypt-hashed passwords, email verification required
- **OAuth 2.0** — Sign in with Google, GitHub
- **JWT** — Access token (15 min TTL) + Refresh token (7 day TTL, HTTP-only cookie)
- **MFA** — Optional TOTP-based two-factor authentication (Google Authenticator, Authy)

#### 3.1.2 Role-Based Access Control (RBAC)

| Role | Permissions |
|---|---|
| **Super Admin** | Full platform access; manage all users, content, and settings |
| **Admin** | Manage users, moderate all content, access analytics dashboard |
| **Editor** | Create, edit, publish, and delete any post; manage categories/tags |
| **Author** | Create, edit, and publish own posts; upload media |
| **Reader** | View published content; comment (if verified); manage own profile |

#### 3.1.3 Auth Flows

- Password reset via time-limited email token (1 hour expiry)
- Account lockout after 5 failed login attempts (15-minute cooldown)
- Session revocation on password change
- Audit log for privileged actions (admin role changes, content deletion)

---

### 3.2 Blog Creation & Editing

#### 3.2.1 Editor Features

- **Dual-mode editing**: WYSIWYG (TipTap) and raw Markdown (with live preview)
- **Rich formatting**: headings (H1–H4), bold, italic, strikethrough, blockquote, divider
- **Code blocks**: syntax-highlighted, language-selectable, copy-to-clipboard
- **Embeds**: YouTube, Twitter/X, CodePen, and custom oEmbed support
- **Tables**: insert and edit tabular data inline
- **Autosave**: local draft saved every 30 seconds to `localStorage`; server draft saved every 2 minutes
- **Version history**: last 10 revisions stored per post, with diff view and restore

#### 3.2.2 Post Metadata

- Title, slug (auto-generated, editable), excerpt
- Cover image (upload or URL)
- Author(s) — single or multiple
- Category (single) and tags (up to 10)
- Publish date/time scheduling
- Canonical URL override
- Custom meta title and meta description
- Open Graph and Twitter Card image override

#### 3.2.3 Post Lifecycle

```
Draft → Review (optional) → Published → Archived
                                ↑
                           Scheduled
```

---

### 3.3 Comments System

- **Threaded/nested comments** — up to 3 levels deep
- **Anonymous vs. authenticated** — configurable per site; anonymous requires email
- **Moderation tools**:
  - Auto-hold comments containing flagged keywords
  - Manual approve/reject/delete by editors and admins
  - Bulk moderation actions in admin dashboard
  - Spam detection via Akismet API integration (optional)
- **Reactions** — like/upvote on comments
- **Notifications** — email notification to post author and parent commenter on reply
- **Reporting** — readers can flag comments for review

---

### 3.4 Categories, Tags & Search

#### 3.4.1 Taxonomy

- **Categories**: single-level hierarchy; each post assigned exactly one category; manage via admin
- **Tags**: flat, many-to-many; up to 10 per post; auto-suggest based on existing tags

#### 3.4.2 Search

- **Default**: MongoDB Atlas Search (full-text across title, excerpt, tags, author name)
- **Optional**: Elasticsearch for advanced relevancy tuning and faceted search
- **Features**:
  - Real-time typeahead suggestions (debounced, 300ms)
  - Filter by category, tag, author, and date range
  - Highlighted search term in results
  - Search analytics (top queries, zero-result queries) in admin dashboard

---

### 3.5 SEO Features

- Server-side rendered `<head>` meta tags via Next.js `generateMetadata`
- Automatic `sitemap.xml` generation (posts, categories, tags, static pages) — refreshed on publish
- `robots.txt` configurable from admin settings
- JSON-LD structured data: `Article`, `BreadcrumbList`, `Person`, `Organization`
- Canonical tags on all pages; support for cross-domain canonical
- Open Graph and Twitter Card tags on every post
- Automatic image `alt` text prompting in editor
- `hreflang` support (future multi-language preparation)

---

### 3.6 Performance Optimization

- **Lazy loading**: images (native `loading="lazy"`), below-fold components (dynamic imports)
- **Image optimization**: Next.js `<Image>` component; WebP/AVIF format negotiation; responsive srcsets
- **Caching strategy**:
  - CDN (Cloudflare): static assets, SSG pages — cache TTL 1 year with asset hashing
  - ISR pages: revalidate every 60 seconds for active posts
  - Redis: API responses for hot endpoints (trending posts, category listing) — TTL 5 minutes
  - HTTP cache headers: `Cache-Control: s-maxage=60, stale-while-revalidate=3600`
- **Bundle optimization**: tree-shaking, code-splitting per route, dynamic imports for editor
- **Font optimization**: `next/font` with `display: swap`; preload critical fonts
- **Prefetching**: `<Link prefetch>` for in-viewport navigation links

---

### 3.7 Admin Dashboard

#### 3.7.1 Content Management

- All posts table: filter by status, author, category, date; bulk actions (publish, archive, delete)
- Comments moderation queue with approve/reject/ban actions
- Media library: grid view, search, bulk delete, usage tracking

#### 3.7.2 User Management

- User list: search, filter by role, suspend/activate accounts
- Role assignment and permission management
- Login history and activity log per user

#### 3.7.3 Analytics (built-in)

| Metric | Detail |
|---|---|
| Page views & unique visitors | Daily/weekly/monthly breakdown |
| Top posts | By views, comments, shares |
| Traffic sources | Direct, organic, referral, social |
| Search queries | Internal search terms and click-through |
| Comments volume | Approved, pending, spam ratio |
| New registrations | Trend over time |

> **Note**: Integration with Google Analytics 4 and Plausible Analytics supported via script injection.

#### 3.7.4 Site Settings

- General: site name, tagline, logo, favicon
- SEO defaults: default meta title template, default OG image
- Comments: enable/disable, moderation policy, spam filter
- Email: SMTP configuration, email template customization
- Integrations: API keys management (Cloudinary, SendGrid, Akismet)

---

### 3.8 Media Management

- **Upload**: drag-and-drop + click-to-browse; supports JPEG, PNG, WebP, GIF, SVG
- **Processing pipeline** (server-side via Sharp):
  - Auto-resize to max 2000px width
  - Convert to WebP with 80% quality
  - Generate thumbnails: 400px, 800px, 1200px
  - Strip EXIF metadata for privacy
- **Storage**: Cloudinary; public read via CDN URL
- **Media library**: paginated grid, search by filename, filter by type/date
- **Alt text**: required field on upload for accessibility compliance
- **Storage quota**: configurable per user role (e.g., Author: 500MB, Editor: unlimited)

---

## 4. System Architecture

### 4.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                             │
│   Browser / Mobile                                              │
│   Next.js App (SSR / SSG / ISR)                                 │
└───────────────────────────────┬─────────────────────────────────┘
                                │ HTTPS
┌───────────────────────────────▼─────────────────────────────────┐
│                    CDN / EDGE LAYER                              │
│             Cloudflare (CDN, WAF, DDoS Protection)              │
└───────────────────────────────┬─────────────────────────────────┘
                                │
┌───────────────────────────────▼─────────────────────────────────┐
│                  LOAD BALANCER / REVERSE PROXY                  │
│                    Nginx / AWS ALB                               │
└─────────────────┬─────────────────────┬─────────────────────────┘
                  │                     │
┌─────────────────▼──────┐  ┌──────────▼──────────────────────────┐
│  Next.js Frontend       │  │  Express.js API Server              │
│  (Node.js cluster)      │  │  (Horizontally scalable)            │
│  Port 3000              │  │  Port 5000                          │
└─────────────────────────┘  └──────────┬──────────────────────────┘
                                        │
          ┌─────────────────────────────┼────────────────────┐
          │                             │                    │
┌─────────▼──────┐         ┌────────────▼────────┐  ┌───────▼────────┐
│  MongoDB Atlas  │         │  Redis (Cache +     │  │  S3 / R2       │
│  (Primary DB)   │         │  Sessions + Queue)  │  │  (Media Store) │
└─────────────────┘         └─────────────────────┘  └────────────────┘
```

### 4.2 API Structure & Routing Conventions

**Base URL**: `https://api.yourblog.com/v1`

**REST Conventions:**

| Method | Pattern | Action |
|---|---|---|
| `GET` | `/posts` | List posts (paginated) |
| `GET` | `/posts/:slug` | Get single post |
| `POST` | `/posts` | Create post |
| `PATCH` | `/posts/:id` | Update post (partial) |
| `DELETE` | `/posts/:id` | Delete post |

**Key Route Groups:**

```
/v1/auth          → register, login, logout, refresh, oauth/*
/v1/users         → profile, settings, avatar
/v1/posts         → CRUD, publish, schedule, revisions
/v1/comments      → CRUD, moderation
/v1/categories    → CRUD
/v1/tags          → CRUD, suggest
/v1/media         → upload, list, delete
/v1/search        → full-text search endpoint
/v1/admin         → dashboard stats, user management (admin only)
/v1/sitemap       → sitemap generation trigger
```

**Response Envelope:**

```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 340
  },
  "error": null
}
```

### 4.3 Database Schema Design

#### Collection: `users`

```
{
  _id:          ObjectId
  username:     String (unique, indexed)
  email:        String (unique, indexed)
  passwordHash: String
  role:         Enum [super_admin, admin, editor, author, reader]
  profile: {
    displayName:  String
    avatar:       String (URL)
    bio:          String
    website:      String
    socialLinks:  { twitter, github, linkedin }
  }
  authProviders: [{ provider, providerId }]
  mfaEnabled:   Boolean
  mfaSecret:    String (encrypted)
  isVerified:   Boolean
  isSuspended:  Boolean
  lastLoginAt:  Date
  createdAt:    Date
  updatedAt:    Date
}
```

#### Collection: `posts`

```
{
  _id:            ObjectId
  title:          String
  slug:           String (unique, indexed)
  excerpt:        String
  content:        String (HTML or Markdown)
  contentFormat:  Enum [html, markdown]
  coverImage:     { url, alt }
  author:         ObjectId → users (indexed)
  coAuthors:      [ObjectId → users]
  category:       ObjectId → categories (indexed)
  tags:           [ObjectId → tags] (indexed)
  status:         Enum [draft, review, scheduled, published, archived] (indexed)
  publishedAt:    Date (indexed, desc)
  scheduledAt:    Date
  seo: {
    metaTitle:    String
    metaDesc:     String
    canonicalUrl: String
    ogImage:      String
    noIndex:      Boolean
  }
  stats: {
    views:        Number
    readTime:     Number (minutes)
    commentsCount: Number
  }
  revisions:      [{ content, updatedAt, updatedBy }]
  createdAt:      Date
  updatedAt:      Date
}
```

#### Collection: `comments`

```
{
  _id:       ObjectId
  post:      ObjectId → posts (indexed)
  parent:    ObjectId → comments | null (indexed)
  author:    ObjectId → users | null
  guestName: String
  guestEmail: String
  content:   String
  status:    Enum [pending, approved, spam, deleted]
  likes:     Number
  reportCount: Number
  ipAddress: String (hashed)
  createdAt: Date (indexed, desc)
  updatedAt: Date
}
```

#### Collection: `categories` & `tags`

```
categories: { _id, name, slug (unique), description, coverImage, postCount }
tags:        { _id, name, slug (unique), postCount }
```

### 4.4 Scalability Considerations

- **Horizontal scaling**: All API servers are stateless; sessions stored in Redis — safe to run behind round-robin load balancer
- **Database scaling**: MongoDB Atlas supports automatic sharding; shard key on `posts` by `publishedAt` bucket
- **Read replicas**: MongoDB secondary nodes serve read-heavy analytics queries
- **Queue-based processing**: Media processing, email sending, and sitemap generation handled by BullMQ (Redis-backed) workers — decoupled from request lifecycle
- **CDN offloading**: All static assets and ISR pages cached at Cloudflare edge — reduces origin load by ~80%
- **Rate limiting**: Redis-backed sliding window rate limiter prevents hot-user abuse

---

## 5. Security Best Practices

### 5.1 Authentication & Authorization

- JWT signed with RS256 (asymmetric) — public key distributed; private key stored in secret vault
- Access tokens: short-lived (15 min); Refresh tokens: HTTP-only, Secure, SameSite=Strict cookies
- RBAC enforced at middleware layer for every protected route
- OAuth state parameter validated to prevent CSRF on OAuth flows
- Principle of least privilege: API keys scoped to minimum required permissions

### 5.2 Input Validation & Sanitization

- All incoming request bodies, query params, and path params validated with **Zod** before any business logic
- Rich text content sanitized with **DOMPurify** (server-side via jsdom) before storage and rendering
- File upload validation: MIME type checked via magic bytes (not just extension); max size enforced
- MongoDB queries use Mongoose schemas — no raw string interpolation; protection against NoSQL injection

### 5.3 Rate Limiting & DDoS Protection

| Endpoint Group | Limit | Window |
|---|---|---|
| Auth endpoints (login, register) | 10 requests | 15 minutes per IP |
| API (authenticated) | 300 requests | 1 minute per user |
| API (unauthenticated) | 60 requests | 1 minute per IP |
| Media upload | 20 requests | 1 hour per user |
| Search | 30 requests | 1 minute per IP |

- Cloudflare WAF at the edge for L7 DDoS protection and bot mitigation
- `express-rate-limit` + `rate-limit-redis` for application-level limiting

### 5.4 Secure Headers

```javascript
// Applied via Helmet.js
Content-Security-Policy: default-src 'self'; img-src * data:; script-src 'self' 'nonce-{random}'
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
```

- CORS: whitelist explicitly configured origins (no `*` in production)
- Cookie flags: `HttpOnly`, `Secure`, `SameSite=Strict`

### 5.5 Data Protection

- Passwords hashed with **bcrypt** (cost factor 12)
- Sensitive user fields (MFA secret) encrypted at rest with AES-256 (via Node.js `crypto`)
- MongoDB Atlas encryption at rest (AES-256) and in transit (TLS 1.2+)
- PII data handling compliant with GDPR: right to deletion, data export endpoint
- IP addresses stored as hashed values (SHA-256 + pepper)

### 5.6 Environment Variable Management

- Secrets stored in **AWS Secrets Manager** or **HashiCorp Vault** — never in version control
- `.env.example` committed to repo with placeholders; `.env` in `.gitignore`
- Environment-specific configs validated at startup via Zod schema — fail fast on misconfiguration
- Rotation policy: JWT signing keys rotated every 90 days; database credentials every 30 days

---

## 6. SEO & Rendering Strategy

### 6.1 Rendering Decision Matrix

| Page Type | Strategy | Rationale |
|---|---|---|
| Homepage | ISR (60s revalidation) | Fresh content; low latency |
| Post listing / Category / Tag | ISR (60s revalidation) | Frequently updated; SEO-critical |
| Individual post (published) | ISR (60s revalidation) | High SEO value; near-real-time |
| Individual post (draft preview) | SSR | Auth-gated; must be fresh |
| Author profile | SSG + on-demand revalidation | Infrequent changes |
| Search results | SSR | Dynamic query params |
| Admin dashboard | CSR (no indexing) | Private, real-time data |

### 6.2 Core Web Vitals Optimization

| Metric | Target | Strategy |
|---|---|---|
| **LCP** | < 2.5s | Preload hero image; use `priority` prop on above-fold images; SSR/ISR |
| **FID / INP** | < 100ms | Minimize main-thread blocking; defer non-critical JS; use React Server Components |
| **CLS** | < 0.1 | Set explicit width/height on all images; reserve space for dynamic content |
| **TTFB** | < 200ms | CDN edge caching; optimized DB queries; Redis caching |
| **FCP** | < 1.8s | Inline critical CSS; preload fonts; minimize render-blocking resources |

### 6.3 URL Structure

```
/                           → Homepage
/blog                       → All posts listing
/blog/[slug]                → Individual post
/category/[slug]            → Category listing
/tag/[slug]                 → Tag listing
/author/[username]          → Author profile
/search?q=[query]           → Search results
/sitemap.xml                → XML sitemap
/rss.xml                    → RSS feed
```

- All slugs: lowercase, hyphen-separated, ASCII-only, max 75 characters
- Redirect www → non-www (or vice versa) — consistent canonical domain
- Canonical tags on every page; avoid duplicate content from pagination (`?page=2` gets `rel="canonical"` pointing to page 1 or uses `rel="next"/"prev"`)

### 6.4 Structured Data (JSON-LD)

Every post page includes:

```json
{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "Post Title",
  "image": ["cover-image-url"],
  "author": { "@type": "Person", "name": "Author Name", "url": "author-profile-url" },
  "publisher": { "@type": "Organization", "name": "Blog Name", "logo": { ... } },
  "datePublished": "ISO-8601",
  "dateModified": "ISO-8601",
  "description": "Meta description"
}
```

### 6.5 Additional SEO Considerations

- RSS feed at `/rss.xml` (full content or excerpt, configurable)
- `rel="author"` link element on post pages
- Pagination: `rel="next"` / `rel="prev"` links
- Image sitemaps included in `sitemap.xml`
- 301 redirects managed via admin panel (stored in MongoDB, applied via Next.js middleware)

---

## 7. DevOps & Deployment

### 7.1 Docker Setup

#### Dockerfile — Backend (multi-stage)

```dockerfile
# Stage 1: Build
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

# Stage 2: Runtime
FROM node:20-alpine AS runtime
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY . .
EXPOSE 5000
USER node
CMD ["node", "src/server.js"]
```

#### Dockerfile — Frontend (multi-stage)

```dockerfile
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
EXPOSE 3000
CMD ["npm", "start"]
```

#### docker-compose.yml (Development)

```yaml
version: "3.9"
services:
  frontend:
    build: ./frontend
    ports: ["3000:3000"]
    volumes: ["./frontend:/app", "/app/node_modules"]
    environment:
      - NEXT_PUBLIC_API_URL=http://backend:5000
    depends_on: [backend]

  backend:
    build: ./backend
    ports: ["5000:5000"]
    volumes: ["./backend:/app", "/app/node_modules"]
    environment:
      - MONGO_URI=mongodb://mongo:27017/blogdb
      - REDIS_URL=redis://redis:6379
    depends_on: [mongo, redis]

  mongo:
    image: mongo:7
    ports: ["27017:27017"]
    volumes: ["mongo_data:/data/db"]

  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]

volumes:
  mongo_data:
```

### 7.2 CI/CD Pipeline

```
┌──────────────┐    ┌──────────────┐    ┌───────────────┐    ┌──────────────┐
│  Push / PR   │───▶│  CI Pipeline │───▶│  Build Image  │───▶│   Deploy     │
│  (GitHub)    │    │  (GitHub     │    │  (Docker /    │    │  (Staging /  │
│              │    │   Actions)   │    │   ECR / GHCR) │    │   Prod)      │
└──────────────┘    └──────────────┘    └───────────────┘    └──────────────┘
```

**Pipeline Stages:**

1. **Lint & Type Check** — ESLint, TypeScript compiler (`tsc --noEmit`)
2. **Unit & Integration Tests** — Jest; fail build on < 80% coverage
3. **E2E Tests** — Playwright against preview deployment
4. **Security Scan** — `npm audit`; Snyk or Trivy for image vulnerability scanning
5. **Build Docker Image** — multi-stage, tagged with commit SHA
6. **Push to Registry** — GitHub Container Registry or AWS ECR
7. **Deploy to Staging** — auto on merge to `develop` branch
8. **Smoke Tests** — automated health check and critical path validation
9. **Deploy to Production** — manual approval gate on merge to `main`; canary rollout (10% → 50% → 100%)
10. **Notify** — Slack notification on success/failure

### 7.3 Environment Configurations

| Variable Group | Dev | Staging | Prod |
|---|---|---|---|
| `NODE_ENV` | development | staging | production |
| MongoDB | Local container | Atlas M10 | Atlas M30+ |
| Redis | Local container | ElastiCache t3 | ElastiCache r6g |
| Email | Mailtrap (sandbox) | SendGrid test | SendGrid prod |
| CDN | Disabled | Cloudflare (paused) | Cloudflare (active) |
| Log Level | debug | info | warn |
| Rate Limits | Relaxed | Production | Production |

### 7.4 Hosting Recommendations

| Component | Recommended Option | Alternative |
|---|---|---|
| Frontend (Next.js) | Vercel (zero-config, edge network) | AWS ECS + CloudFront |
| Backend API | AWS ECS Fargate (auto-scaling) | DigitalOcean App Platform |
| Database | MongoDB Atlas (M10+ cluster) | AWS DocumentDB |
| Cache | AWS ElastiCache (Redis) | Upstash Redis |
| Media Storage | AWS S3 + CloudFront | Cloudflare R2 |
| CDN / WAF | Cloudflare (Pro plan) | AWS CloudFront + WAF |
| DNS | Cloudflare DNS | AWS Route 53 |
| Monitoring | Datadog / New Relic | Grafana + Prometheus |

---

## 8. Non-Functional Requirements

### 8.1 Performance Benchmarks

| Metric | Target |
|---|---|
| Homepage LCP | < 1.5s (SSG/CDN cached) |
| Post page LCP | < 2.0s (ISR cached) |
| API response (cached) | < 50ms |
| API response (uncached) | < 300ms |
| Image upload processing | < 5s for 10MB image |
| Search response | < 500ms |
| Time to Interactive (TTI) | < 3.5s |
| Lighthouse Performance Score | ≥ 90 |

### 8.2 Scalability Expectations

| Threshold | Supported Configuration |
|---|---|
| Concurrent users | 10,000 (initial), 100,000+ (scaled) |
| Monthly page views | 10M+ |
| Posts in database | 1M+ without degradation |
| Media storage | 1TB+ (S3/R2 virtually unlimited) |
| Comments per post | 10,000+ with paginated loading |
| API throughput | 1,000 req/s per API node; horizontal scaling via additional nodes |

### 8.3 Reliability & Uptime

| Requirement | Target |
|---|---|
| API Availability | 99.9% SLA (< 8.7 hours downtime/year) |
| Database Availability | 99.95% (MongoDB Atlas SLA) |
| Recovery Time Objective (RTO) | < 1 hour |
| Recovery Point Objective (RPO) | < 5 minutes (continuous oplog backup) |
| Daily database backups | Retained for 30 days |
| Disaster recovery region | Secondary region on standby |

### 8.4 Accessibility

- WCAG 2.1 Level AA compliance
- Keyboard navigation for all interactive elements
- Screen reader compatible (semantic HTML, ARIA labels)
- Minimum 4.5:1 color contrast ratio

### 8.5 Browser & Device Support

- **Browsers**: Latest 2 versions of Chrome, Firefox, Safari, Edge
- **Mobile**: iOS Safari 15+, Android Chrome 110+
- **Viewport**: Responsive design from 320px to 2560px
- **JavaScript disabled**: Core content readable (SSR); JS required only for interactive features

---

## 9. Future Enhancements

### 9.1 AI-Based Recommendations

| Feature | Description | Priority |
|---|---|---|
| Personalized feed | Recommend posts based on reading history using collaborative filtering | High |
| Related posts | Semantic similarity via embedding vectors (OpenAI / sentence-transformers) | High |
| AI writing assistant | In-editor suggestions, auto-complete, tone adjustment | Medium |
| Auto-tagging | Suggest tags and category from post content using NLP | Medium |
| Content summarization | AI-generated TL;DR for long-form articles | Low |
| SEO recommendations | Real-time SEO scoring and keyword suggestions in editor | Medium |

### 9.2 Multi-Language Support (i18n)

- `next-intl` for frontend internationalization
- Language selector in user profile and site header
- Right-to-left (RTL) layout support (Arabic, Hebrew)
- Separate URL paths per locale: `/en/blog/[slug]`, `/ar/blog/[slug]`
- Translated `hreflang` tags for international SEO
- Community-contributed translations via a managed translation dashboard

### 9.3 Progressive Web App (PWA)

- Service Worker via `next-pwa` for offline reading (cache-first for visited articles)
- Web App Manifest for installability (add to home screen)
- Push notifications for new post alerts (opt-in per reader)
- Background sync for offline comment drafts
- Responsive PWA shell with app-like navigation transitions

### 9.4 Additional Future Roadmap Items

| Feature | Notes |
|---|---|
| Newsletter integration | Embedded subscription form; integration with ConvertKit / Mailchimp |
| Membership / paywall | Paid subscriptions for premium content (Stripe integration) |
| Podcast hosting | Audio upload and embedded player per post |
| API-first headless mode | Public GraphQL API for third-party frontends |
| Mobile app | React Native app consuming public API |
| Collaboration | Real-time co-editing with Yjs (CRDT-based) |
| Analytics deep-dive | Heatmaps, scroll depth, reading completion rate |

---

## 10. Appendix

### 10.1 Glossary

| Term | Definition |
|---|---|
| **SSR** | Server-Side Rendering — HTML generated per request on the server |
| **SSG** | Static Site Generation — HTML pre-built at deploy time |
| **ISR** | Incremental Static Regeneration — SSG with periodic background revalidation |
| **RBAC** | Role-Based Access Control |
| **JWT** | JSON Web Token — compact, self-contained authentication token |
| **LCP** | Largest Contentful Paint — Core Web Vital measuring perceived load speed |
| **CLS** | Cumulative Layout Shift — Core Web Vital measuring visual stability |
| **TTL** | Time To Live — expiry duration for cached data or tokens |
| **oEmbed** | Open standard for embedded content (YouTube, Twitter, etc.) |
| **CRDT** | Conflict-free Replicated Data Type — enables real-time collaboration |

### 10.2 Dependencies & Versions (Baseline)

| Package | Version | Purpose |
|---|---|---|
| next | 14.x | Frontend framework |
| react | 18.x | UI library |
| typescript | 5.x | Type safety |
| express | 5.x | API framework |
| mongoose | 8.x | MongoDB ODM |
| redis (ioredis) | 5.x | Cache client |
| jsonwebtoken | 9.x | JWT handling |
| bcrypt | 5.x | Password hashing |
| zod | 3.x | Schema validation |
| tiptap | 2.x | Rich text editor |
| sharp | 0.33.x | Image processing |
| helmet | 7.x | Secure HTTP headers |
| bullmq | 4.x | Job queue |
| jest | 29.x | Testing framework |
| playwright | 1.x | E2E testing |
| docker | 25.x | Containerization |

### 10.3 References

- [Next.js Documentation](https://nextjs.org/docs)
- [MongoDB Schema Design Best Practices](https://www.mongodb.com/developer/products/mongodb/schema-design-anti-pattern-summary/)
- [Web Vitals](https://web.dev/vitals/)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [WCAG 2.1 Guidelines](https://www.w3.org/TR/WCAG21/)
- [JSON-LD for SEO — Google](https://developers.google.com/search/docs/appearance/structured-data/article)

---

*This document is a living artifact. All major changes must be version-tagged and reviewed by the Product, Engineering, and Design leads before implementation begins.*