# Contacts API Contract

## GET /v1/contacts

Returns a paginated list of contacts.

### Query Parameters
- `search`: string (optional)
- `status`: 'ACTIVE' | 'BLOCKED' (optional)
- `lifecycleStatus`: string | string[] (optional)
- `page`: number (default: 1)
- `pageSize`: number (default: 20)
- `shape`: 'array' | 'items_meta' (default: 'items_meta')

### Response (Default / items_meta)
```json
{
  "items": [ ... ],
  "meta": {
    "total": 100,
    "page": 1,
    "pageSize": 20,
    "totalPages": 5
  }
}
```

### Response (shape=array) - DEPRECATED
Returns a plain array of contacts: `[ ... ]`
Includes header `X-Deprecated: Shape=array is deprecated`.

## POST /v1/inbox/whatsapp/resolve-thread

Resolves or creates a thread for a contact.

### Request Body
- `contactId`: string (required)
- `channelId`: string (optional)

### Response
- `200 OK`: { "threadId": "...", "channelId": "..." }
- `400 Bad Request (CHANNEL_REQUIRED)`: If multiple channels are connected and none provided.
