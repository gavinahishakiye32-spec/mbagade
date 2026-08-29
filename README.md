# BuyBuy

The global business social network — consumers discover local and worldwide businesses through short videos, photos, products, live streams and messaging. Businesses get profiles, commerce tools, analytics, ads and verification.

Built with **Next.js 15 (App Router) · TypeScript · Tailwind CSS v4 · MongoDB / Mongoose**.

---

## Quick start

```bash
# 1. Requirements: Node 20+, a running MongoDB (local or Atlas)
cp .env.example .env.local        # then fill in what you need (MONGODB_URI is enough for dev)

# 2. Install & seed demo data
npm install
npm run seed                      # creates demo accounts + content (idempotent)

# 3. Run
npm run dev                       # http://localhost:3000
```

### Demo logins (after seeding) — password: `password123`

| Role     | Email                 |
| -------- | --------------------- |
| Buyer    | `demo@buybuy.demo`    |
| Business | `amara@buybuy.demo`   |
| Admin    | `admin@buybuy.demo`   |

### Run with Docker (whole stack incl. MongoDB)

```bash
cp .env.example .env.local     # add an AUTH_SECRET (e.g. openssl rand -hex 32)
docker compose up -d --build   # app on :3000 + MongoDB + persistent uploads volume
docker compose exec app npm run seed   # seed demo data
```

The image is a slim, non-root, standalone Next.js server. Secrets are provided
at runtime via compose and are never baked into image layers.

### Scripts

| Command              | What it does                                  |
| -------------------- | --------------------------------------------- |
| `npm run dev`        | Dev server                                    |
| `npm run build`      | Production build (standalone output for Docker)|
| `npm start`          | Serve the production build                    |
| `npm test`           | Unit tests (feed scoring, permissions, …)     |
| `npm run test:watch` | Unit tests in watch mode                      |
| `npm run test:coverage` | Unit tests with coverage report            |
| `npm run seed`       | Reset + reseed demo data                      |

> **Production note:** `AUTH_SECRET` is **required** when `NODE_ENV=production`. The server refuses to sign sessions without it.
>
> **No fake users:** the demo seeder refuses to run in production (`NODE_ENV=production`) — synthetic accounts violate the platform's authenticity policy. Override only deliberately with `SEED_DEMO_DATA=1`.

---

## Feature map

- **Auth** — email/password (bcrypt), JWT session cookies (`jose`), Google & Facebook OAuth, email verification + password reset flows, server-side sessions list, rate limiting.
- **Feed** — fair viral ranking (`scoreCache`, recency half-life, engagement-weighted, new-business discovery boost — follower count never dominates). Tabs: For you / Following / Trending / Nearby / Saved. Sponsored injection on first page.
- **Business profiles** — categories, verification badge flow, reviews & ratings, team roles (owner/manager/editor), follow system.
- **Content** — video/image/text posts, hashtags, product tagging, comments (one level of replies), likes, saves, shares, reporting + AI-assisted moderation queue.
- **Commerce** — products with variants/stock, cart-less checkout, Stripe Checkout **or** built-in dev payment provider, order lifecycle (pending → paid → processing → shipped → delivered / refunded / cancelled), platform fee.
- **Messaging** — 1:1 user↔business conversations, read receipts, archive, block enforcement. Polling-based realtime (swap-ready for WebSockets).
- **Live** — embed-based streams (YouTube/Facebook/Twitch/Vimeo/Rumble) with live chat and viewer heartbeats.
- **Calls** — WebRTC P2P audio/video between users and businesses, DB-poll signaling, optional TURN.
- **Ads** — boost post / sponsored business / product promo campaigns with CPM budgeting, admin approval workflow.
- **Analytics** — per-business dashboard: views, followers, profile visits, contact/WhatsApp/website clicks, revenue, per-post stats, time series.
- **Growth (launch toolkit)** — configurable access modes (public / early access / invite-only / private), public offers & promotions feed, customer referral invites with tracked codes, city waitlist, founding business/customer badges, assisted business onboarding + secure profile claiming — all runtime-configurable from the admin panel.
- **Admin** — stats overview, user management (suspend/ban/promote), business verification review, report resolution, ad approval, platform configuration (access mode, launch cities, founding program), claims review, waitlist, audit log.
- **PWA** — installable manifest, offline fallback page, service worker (static cache-first, network-first navigations).

## Architecture

```
src/
├── app/
│   ├── (auth)/            # login/register/reset/verify pages
│   ├── (main)/            # app shell pages (feed, discover, profiles, messages,
│   │                      # orders, saved, live, calls, create, dashboard, admin)
│   ├── api/               # ~55 REST route handlers
│   ├── layout.tsx         # theme bootstrap, SW registration, metadata
│   └── manifest.ts        # PWA manifest
├── components/            # client UI (ui.tsx primitives, feed, dashboard tabs, …)
├── config/                # categories, constants (limits, fees, statuses)
├── lib/                   # env, db, auth/session, api envelope, validation (zod),
│                          # storage abstraction, media validation, rate limiting
├── server/models/         # mongoose schemas + indexes
├── services/              # business logic (feed scoring is pure & unit-tested)
├── scripts/seed.ts        # demo data seeder
└── types/                 # shared domain types
```

**Conventions**

- Every API returns `{ success: true, data }` or `{ success: false, error: { code, message } }`.
- All external input validated with zod (`src/lib/validation.ts`); authorization happens server-side in every handler.
- UI components never touch the DB directly — they call REST endpoints; handlers delegate to `src/services/*`.
- Media uploads pass magic-byte validation and are served through `/api/media/[...key]` (local driver) or your S3/CDN URL.

## Integration boundaries

Everything works out-of-the-box with graceful dev fallbacks; add keys to `.env.local` to activate real services:

| Integration      | Fallback when unset                        | Activate                                    |
| ---------------- | ------------------------------------------ | ------------------------------------------- |
| OAuth            | Login page shows “not configured” error    | `GOOGLE_*` / `FACEBOOK_*` keys              |
| Payments         | Built-in dev provider (instant confirm)    | `STRIPE_SECRET_KEY` (+ webhook secret)      |
| Email            | Emails printed to server console           | `SMTP_*` variables                          |
| AI               | Caption/description buttons hidden/off     | Any OpenAI-compatible `AI_API_KEY`          |
| Media storage    | Local disk (`.data/uploads`)               | `MEDIA_STORAGE_DRIVER=s3` + S3 vars         |
| TURN for calls   | P2P only (fails behind strict NATs)        | `TURN_URLS/USERNAME/CREDENTIAL`             |

See `.env.example` for every variable and setup pointers (redirect URIs, webhook path).

## Testing

```bash
npm test
```

Covers the pure core: feed score computation (decay, boosts, penalties), rescore TTL logic, hashtag extraction, offer availability windows, referral code generation, business access control, rate limiter behavior, and utility helpers.

## Deployment notes

- Set `MONGODB_URI`, `AUTH_SECRET`, `APP_URL` at minimum; put the app behind HTTPS (HSTS headers are already sent).
- `ACCESS_MODE` sets the initial launch phase (`public | early_access | invite_only | private`) — change it anytime from **Admin → Platform** without a redeploy.
- The in-memory rate limiter suits single-instance deployments — back it with Redis for multi-instance scale.
- Register the Stripe webhook at `{APP_URL}/api/payments/webhook/stripe`.
- The service worker never caches `/api/*`; bump its `VERSION` constant when shipping new static assets.
