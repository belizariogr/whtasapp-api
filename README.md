# WhatsApp API (Multi-tenant)

REST API for WhatsApp integration via [Baileys 7](https://github.com/WhiskeySockets/Baileys), built with **Bun** and **Hono**. Supports multiple tenants with isolated sessions in **MariaDB**.

## Features

- Connect / disconnect / check WhatsApp connection status
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
PORT=3000
DATABASE_HOST=127.0.0.1
DATABASE_PORT=3306
DATABASE_USERNAME=user
DATABASE_PASSWORD=password
DATABASE_NAME=whatsapp_api
JWT_SECRET_KEY=your-secret-key
JWT_SECRET_KEY_PUBLIC=your-public-key

# Action tests
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

Default server: `http://0.0.0.0:3000`

## Authentication

All `/whatsapp/*` routes require:

```
Authorization: Bearer <JWT>
```

The JWT payload `id` field identifies the **tenant**. Validation uses `src/core/services/token.ts` — same secret key as the issuing microservice.

## API Reference

### Connection

#### `POST /whatsapp/connect`

Starts WhatsApp connection. If no saved session exists, returns QR code in `data.qrCode`.

```bash
curl -X POST http://localhost:3000/whatsapp/connect \
  -H "Authorization: Bearer $TOKEN"
```

Response:
```json
{
  "success": true,
  "data": {
    "status": "logged_out",
    "connectionStatus": "connecting",
    "phoneNumber": null,
    "lastConnectedAt": null
  }
}
```

#### `GET /whatsapp/status`

Checks connection status.

#### `POST /whatsapp/disconnect`

Closes the socket without removing credentials.

#### `POST /whatsapp/logout`

Full logout — removes credentials from the database.

### Messages

#### Text — `POST /whatsapp/messages/text`

```json
{ "to": "5511999999999", "text": "Hello!" }
```

#### Link — `POST /whatsapp/messages/link`

```json
{ "to": "5511999999999", "text": "See https://example.com" }
```

#### Image — `POST /whatsapp/messages/image`

```json
{
  "to": "5511999999999",
  "imageUrl": "https://example.com/photo.jpg",
  "caption": "Optional caption"
}
```

Or with base64: `"imageBase64": "<base64>"`

#### Buttons — `POST /whatsapp/messages/buttons`

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

#### Link button — `POST /whatsapp/messages/link-button`

```json
{
  "to": "5511999999999",
  "text": "Visit our website",
  "buttonText": "Open site",
  "url": "https://example.com"
}
```

#### Bulk send — `POST /whatsapp/messages/bulk`

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

#### Last received message — `GET /whatsapp/messages/last-received`

Returns the last received message (for testing).

### Health

#### `GET /health/health`

```json
{
  "success": true,
  "data": {
    "status": "ok",
    "database": "connected",
    "timestamp": "2026-06-19T12:00:00.000Z"
  }
}
```

## Tests

```bash
# All tests (unit + integration; action skipped if .env is incomplete)
bun test

# By category
bun test tests/unit
bun test tests/integration
bun test tests/action   # Requires running server + configured .env
```

### Action tests

1. Configure `TEST_TENANT_ID`, `TEST_JWT_TOKEN`, and `TEST_RECIPIENT_PHONE` in `.env`
2. Start the server: `bun run dev`
3. Connect WhatsApp: `POST /whatsapp/connect` and scan the QR code
4. Run: `bun test tests/action`

## Architecture

```
HTTP Client
    │
    ▼
Hono (app.ts)
    ├── middleware/auth.ts  → JWT → tenantId
    └── routes/
            whatsapp.routes.ts
                │
                ▼
        modules/whatsapp/
            connection-manager.ts  → Baileys socket per tenant
            message-sender.ts      → Message sending
            auth-state.ts          → Credentials in MariaDB
            session-repository.ts  → Status/sessions
```

Each tenant has:
- A record in `tenants`
- A session in `whatsapp_sessions`
- Baileys credentials in `whatsapp_auth_creds` + `whatsapp_auth_keys`
- Received messages in `received_messages`

## Project structure

See [AGENTS.md](./AGENTS.md) for the full development guide and AI agent rules.

See [TODO.md](./TODO.md) for development tracking.

## License

MIT — see [LICENSE](./LICENSE)
