# API Permissions & Access Control

This document outlines the permission requirements for all API endpoints.

## Public Endpoints (No Authentication Required)

- `GET /` - Welcome message
- `GET /health` - Health check

## Authentication Required

All other endpoints require a valid JWT token in the Authorization header:
```
Authorization: Bearer <your-jwt-token>
```

---

## API Endpoints by Permission

### Scan Endpoints

#### `GET /api/scan/results`
- **Permission Required:** `scan:read`
- **Roles:** All users (free_user, basic_user, premium_user, moderator, admin, super_admin)
- **Description:** Get latest scan results

#### `POST /api/scan/run`
- **Permission Required:** `scan:run`
- **Roles:** basic_user, premium_user, moderator, admin, super_admin
- **Description:** Trigger a manual scan

#### `GET /api/scan/config`
- **Permission Required:** `scan:config:read`
- **Roles:** basic_user, premium_user, moderator, admin, super_admin
- **Description:** Get current scan configuration

#### `POST /api/scan/config`
- **Permission Required:** `scan:config:write`
- **Roles:** premium_user, moderator, admin, super_admin
- **Description:** Update scan configuration

#### `POST /api/scan/start`
- **Permission Required:** `scan:control`
- **Roles:** moderator, admin, super_admin
- **Description:** Start auto-refresh scanning

#### `POST /api/scan/stop`
- **Permission Required:** `scan:control`
- **Roles:** moderator, admin, super_admin
- **Description:** Stop auto-refresh scanning

---

### Discord Endpoints

#### `POST /api/discord/send-results`
- **Permission Required:** `discord:send`
- **Roles:** premium_user, moderator, admin, super_admin
- **Description:** Send scan results to Discord channel

---

### BallDontLie Proxy Endpoints

#### `GET /api/bdl/:version/*`
- **Permission Required:** `scan:read`
- **Roles:** All users (free_user, basic_user, premium_user, moderator, admin, super_admin)
- **Description:** Proxy requests to BallDontLie API

---

### Authentication Endpoints

#### `POST /api/auth/register`
- **Permission Required:** None (public)
- **Description:** Register a new user account

#### `POST /api/auth/login`
- **Permission Required:** None (public)
- **Description:** Login and receive JWT token

#### `GET /api/auth/me`
- **Permission Required:** Valid JWT token (any authenticated user)
- **Description:** Get current user info

#### `GET /api/auth/users`
- **Permission Required:** `user:view`
- **Roles:** moderator, admin, super_admin
- **Description:** Get all users (admin only)

#### `PATCH /api/auth/users/:userId/role`
- **Permission Required:** `user:manage`
- **Roles:** admin, super_admin
- **Description:** Update user role

#### `DELETE /api/auth/users/:userId`
- **Permission Required:** `user:manage`
- **Roles:** admin, super_admin
- **Description:** Delete a user

---

## Permission Matrix

| Permission | free_user | basic_user | premium_user | moderator | admin | super_admin |
|------------|-----------|------------|--------------|-----------|-------|-------------|
| `scan:read` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `scan:run` | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `scan:config:read` | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `scan:config:write` | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| `scan:control` | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| `discord:send` | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| `user:view` | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| `user:manage` | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| `system:config` | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |

---

## Error Responses

### 401 Unauthorized
Returned when:
- No authentication token provided
- Invalid or expired token

```json
{
  "error": "Access token required"
}
```

or

```json
{
  "error": "Token expired"
}
```

### 403 Forbidden
Returned when:
- User doesn't have required permission for the endpoint

```json
{
  "error": "Insufficient permissions",
  "required": "scan:control",
  "role": "premium_user"
}
```

---

## Testing with Different Roles

### Example: Testing as free_user

```bash
# Login as free_user
TOKEN=$(curl -X POST http://localhost:3002/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"free@example.com","password":"password"}' \
  | jq -r '.token')

# ✅ This will work (scan:read)
curl http://localhost:3002/api/scan/results \
  -H "Authorization: Bearer $TOKEN"

# ❌ This will fail (scan:run - requires basic_user+)
curl -X POST http://localhost:3002/api/scan/run \
  -H "Authorization: Bearer $TOKEN"
# Response: {"error":"Insufficient permissions","required":"scan:run","role":"free_user"}
```

### Example: Testing as premium_user

```bash
# Login as premium_user
TOKEN=$(curl -X POST http://localhost:3002/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"premium@example.com","password":"password"}' \
  | jq -r '.token')

# ✅ All these will work
curl http://localhost:3002/api/scan/results -H "Authorization: Bearer $TOKEN"
curl -X POST http://localhost:3002/api/scan/run -H "Authorization: Bearer $TOKEN"
curl -X POST http://localhost:3002/api/scan/config -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" -d '{"minEdge":0.0030}'

# ❌ This will fail (scan:control - requires moderator+)
curl -X POST http://localhost:3002/api/scan/start \
  -H "Authorization: Bearer $TOKEN"
# Response: {"error":"Insufficient permissions","required":"scan:control","role":"premium_user"}
```

---

## Notes

- All protected endpoints require a valid JWT token
- Permissions are checked after authentication
- Users with `super_admin` role have all permissions (`*`)
- The admin user created during initialization has `super_admin` role
- Role hierarchy: free_user < basic_user < premium_user < moderator < admin < super_admin

