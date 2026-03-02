# Bitespeed Identity Reconciliation Service

A backend web service for identity reconciliation that links different contact information (email and phone number) to the same customer across multiple purchases.

## Tech Stack

- **Runtime:** Node.js with TypeScript
- **Framework:** Express.js
- **ORM:** Prisma
- **Database:** SQLite (easily swappable to PostgreSQL/MySQL)

## Hosted Endpoint

> **Base URL:** `https://bitespeed-identity-reconciliation-2c9l.onrender.com`
>
> **POST** `https://bitespeed-identity-reconciliation-2c9l.onrender.com/identify`

## API

### POST `/identify`

Receives contact information and returns a consolidated contact with all linked emails and phone numbers.

**Request Body:**
```json
{
  "email": "string (optional)",
  "phoneNumber": "string (optional)"
}
```
> At least one of `email` or `phoneNumber` must be provided.

**Response (200 OK):**
```json
{
  "contact": {
    "primaryContatctId": 1,
    "emails": ["primary@example.com", "secondary@example.com"],
    "phoneNumbers": ["123456", "789012"],
    "secondaryContactIds": [2, 3]
  }
}
```

### Behavior

1. **New customer:** If no existing contact matches the incoming email or phone, a new `primary` contact is created.
2. **Existing customer with new info:** If an existing contact matches on email or phone but the request has new information, a `secondary` contact is created and linked to the primary.
3. **Merging two primaries:** If the request links two previously unrelated primary contacts (e.g., email matches one, phone matches another), the older contact remains `primary` and the newer one is converted to `secondary`.

## Database Schema

```
Contact {
  id             Int        @id @autoincrement
  phoneNumber    String?
  email          String?
  linkedId       Int?       // ID of the primary Contact
  linkPrecedence "primary" | "secondary"
  createdAt      DateTime
  updatedAt      DateTime
  deletedAt      DateTime?
}
```

## Getting Started

### Prerequisites
- Node.js (v18+)
- npm

### Setup

```bash
# Clone the repository
git clone <repo-url>
cd bitespeed-identity-reconciliation

# Install dependencies
npm install

# Generate Prisma client and run migrations
npx prisma generate
npx prisma migrate dev --name init

# Build
npm run build

# Start the server
npm start
```

The server starts on port `3000` by default. Set the `PORT` environment variable to change it.

### Development

```bash
npm run dev
```

### Environment Variables

Create a `.env` file:
```
DATABASE_URL="file:./dev.db"
PORT=3000
```

## Project Structure

```
├── prisma/
│   ├── schema.prisma          # Database schema
│   └── migrations/            # Database migrations
├── src/
│   ├── index.ts               # Express server entry point
│   ├── controllers/
│   │   └── identify.ts        # /identify route handler
│   └── services/
│       └── contactService.ts  # Core reconciliation logic
├── package.json
├── tsconfig.json
└── README.md
```

## Example Usage

```bash
# Create a new contact
curl -X POST http://localhost:3000/identify \
  -H "Content-Type: application/json" \
  -d '{"email": "lorraine@hillvalley.edu", "phoneNumber": "123456"}'

# Link with shared phone
curl -X POST http://localhost:3000/identify \
  -H "Content-Type: application/json" \
  -d '{"email": "mcfly@hillvalley.edu", "phoneNumber": "123456"}'
```
