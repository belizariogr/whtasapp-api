# WhatsApp API (Multi-tenant)

REST API for WhatsApp integration via [Baileys 7](https://github.com/WhiskeySockets/Baileys), built with **Bun** and **Hono**. Supports multiple tenants with isolated sessions in **MariaDB**.

## Features

- Login / logout / check WhatsApp connection status
- Send messages:
  - Text
  - Links (with preview)
  - Images (URL or base64)
  - Quick reply buttons
  - External link button (CTA URL)
  - Bulk send to multiple contacts
- Basic message receiving (for validation/testing)
- Multi-tenant JWT authentication (validation only — tokens issued externally)

## Stack

| Technology | Purpose |
|------------|---------|
| [Bun](https://bun.sh) | Runtime, tests, HTTP server |
| [Hono](https://hono.dev) | HTTP framework |
| [@whiskeysockets/baileys](https://www.npmjs.com/package/@whiskeysockets/baileys) 7.0.0-rc13 | WhatsApp Web client |
| MariaDB + Bun.SQL | Multi-tenant persistence |
| jsonwebtoken | JWT validation |

## Prerequisites

- [Bun](https://bun.sh) >= 1.2
- MariaDB 10.5+
- Valid JWT token (issued by the authentication microservice)

## Installation

```bash
git clone <repo-url>
cd whtasapp-api
bun install
cp .env.example .env
# Edit .env with your credentials
```

### Configuration (.env)

```env
PORT=6000

# Name shown in WhatsApp when pairing the device (Browsers.baileys)
WHATSAPP_BROWSER_NAME=wpapi

# JWT (validation only — tokens are issued by another microservice)
JWT_SECRET_KEY=your-secret-key

# MariaDB
DATABASE_HOST=127.0.0.1
DATABASE_PORT=3306
DATABASE_USER=user
DATABASE_PASSWORD=password
DATABASE_NAME=whatsapp_api

# Action tests (tenant with active WhatsApp connection)
TEST_TENANT_ID=1
TEST_JWT_TOKEN=eyJ...
TEST_RECIPIENT_PHONE=5511999999999
```

### Database

Create the database and run migrations:

```bash
# In MariaDB
CREATE DATABASE whatsapp_api CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

# Run migrations
bun run migrate
```

## Running

```bash
# Development (hot reload)
bun run dev

# Production
bun run start
```

Default server: `http://0.0.0.0:6000`

## Authentication

All API routes require:

```
Authorization: Bearer <JWT>
```

The JWT payload `id` field identifies the **tenant**. Validation uses `src/core/services/token.ts` — same secret key as the issuing microservice.

## API Reference

### Endpoints overview

| Method | Route | Description |
|--------|-------|-------------|
| POST | `/login` | Start login (`?type=img` PNG default, `?type=json` base64 in JSON) |
| POST | `/logout` | Full logout (deletes credentials) |
| GET | `/status` | Connection status (`?all=true` to verify against the database) |
| POST | `/messages/text` | Plain text |
| POST | `/messages/link` | Text with link (preview) |
| POST | `/messages/image` | Image (URL or base64) |
| POST | `/messages/buttons` | Quick reply buttons |
| POST | `/messages/link-button` | External link button |
| POST | `/messages/bulk` | Send to multiple numbers |
| GET | `/messages/last-received` | Last received message (tests) |

### Connection

#### `POST /login`

Starts WhatsApp login. If no saved session exists, returns a QR code for pairing.

Query parameter `type`:

- `img` (default) — returns a PNG image (`Content-Type: image/png`)
- `json` — returns JSON with base64-encoded QR code in `data.qrCode`

```bash
# PNG (default)
curl -X POST "http://localhost:6000/login" \
  -H "Authorization: Bearer $TOKEN" \
  --output qrcode.png

# JSON with base64
curl -X POST "http://localhost:6000/login?type=json" \
  -H "Authorization: Bearer $TOKEN"
```

JSON response (`?type=json`):

```json
{
  "success": true,
  "data": {
    "qrCode": "<base64-png>"
  }
}
```

If the tenant is already logged in, returns `409` with code `ALREADY_LOGGED_IN`.

#### `GET /status`

Returns the current connection status.

```bash
curl http://localhost:6000/status \
  -H "Authorization: Bearer $TOKEN"
```

Response:

```json
{
  "success": true,
  "data": {
    "status": "logged_out",
    "connectionStatus": "disconnected",
    "phoneNumber": null,
    "lastConnectedAt": null
  }
}
```

`status`: `logged_out` | `logged_in` | `qr_pending`

`connectionStatus`: `disconnected` | `connecting` | `connected`

Use `?all=true` to verify the session against the database and attempt reconnection when credentials exist.

#### `POST /logout`

Full logout — closes the socket and removes credentials from the database.

```bash
curl -X POST http://localhost:6000/logout \
  -H "Authorization: Bearer $TOKEN"
```

### Messages

#### Text — `POST /messages/text`

```json
{ "to": "5511999999999", "text": "Hello!" }
```

#### Link — `POST /messages/link`

```json
{ "to": "5511999999999", "text": "See https://example.com" }
```

#### Image — `POST /messages/image`

```json
{
  "to": "5511999999999",
  "imageUrl": "https://example.com/photo.jpg",
  "caption": "Optional caption"
}
```

Or with base64: `"imageBase64": "<base64>"`

#### Buttons — `POST /messages/buttons`

```json
{
  "to": "5511999999999",
  "text": "Choose:",
  "footer": "Optional",
  "buttons": [
    { "id": "yes", "text": "Yes" },
    { "id": "no", "text": "No" }
  ]
}
```

#### Link button — `POST /messages/link-button`

```json
{
  "to": "5511999999999",
  "text": "Visit our website",
  "footer": "Optional",
  "buttonText": "Open site",
  "url": "https://example.com"
}
```

#### Bulk send — `POST /messages/bulk`

```json
{
  "recipients": ["5511111111111", "5522222222222"],
  "message": {
    "type": "text",
    "text": "Message for everyone"
  }
}
```

Supported types in `message.type`: `text`, `link`, `image`, `buttons`, `link_button`.

#### Last received message — `GET /messages/last-received`

Returns the last received message for the tenant (for testing). Returns `data: null` when no message exists.

```json
{
  "success": true,
  "data": {
    "remoteJid": "5511999999999@s.whatsapp.net",
    "messageId": "ABC123",
    "messageType": "text",
    "content": "Hello",
    "receivedAt": "2026-06-19T12:00:00.000Z"
  }
}
```

### Response format

Success:

```json
{ "success": true, "data": { ... } }
```

Error:

```json
{ "success": false, "error": { "code": "CODE", "message": "..." } }
```

## Tests

```bash
# Unit tests (run during development)
bun test tests/unit
# or
bun run test:unit

# Integration tests (manual — requires MariaDB)
bun test tests/integration
# or
bun run test:integration

# Action tests (manual — requires running server + configured .env)
bun test tests/action
# or
bun run test:action

# All tests (manual only — do not use during development)
bun test
```

### Action tests

1. Configure `TEST_TENANT_ID`, `TEST_JWT_TOKEN`, and `TEST_RECIPIENT_PHONE` in `.env`
2. Start the server: `bun run dev`
3. Connect WhatsApp: `POST /login` and scan the QR code
4. Run: `bun test tests/action`

## Architecture

```
HTTP Client
    │
    ▼
Hono (app.ts)
    ├── middleware/auth.ts  → JWT → tenantId
    └── routes/index.ts
            ├── login.route.ts
            ├── logout.route.ts
            ├── status.route.ts
            └── messages-*.route.ts
                │
                ▼
        modules/
            connection-manager.ts  → Baileys socket per tenant
            message-sender.ts        → Message sending
            auth-state.ts            → Credentials in MariaDB
            session-repository.ts    → Status/sessions
```

Each tenant has:

- A record in `tenants`
- A session in `whatsapp_sessions`
- Baileys credentials in `whatsapp_auth_creds` + `whatsapp_auth_keys`
- Received messages in `received_messages`

## Project structure

```
src/
├── index.ts                 # Bootstrap (migrations + server)
├── app.ts                   # Hono app (middlewares + routes)
├── config/env.ts            # Environment variables
├── core/services/token.ts   # JWT validation (do not change contract)
├── db/
│   ├── client.ts
│   └── migrations/
├── middleware/auth.ts       # JWT → tenantId
├── modules/
│   ├── auth-state.ts
│   ├── connection-manager.ts
│   ├── login-status.ts
│   ├── message-sender.ts
│   ├── session-repository.ts
│   └── types.ts
├── routes/
│   ├── index.ts
│   ├── login.route.ts
│   ├── logout.route.ts
│   ├── status.route.ts
│   └── messages-*.route.ts
└── utils/
    ├── strings.ts
    ├── phone.ts
    ├── qrcode.ts
    └── response.ts
```

See [AGENTS.md](./AGENTS.md) for the full development guide and AI agent rules.

See [TODO.md](./TODO.md) for development tracking.

## License

MIT — see [LICENSE](./LICENSE)
