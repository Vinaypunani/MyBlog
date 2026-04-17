# Authentication API Reference

This document provides a comprehensive, professional API specification for the Authentication module.

**Base URL**: `https://api.yourdomain.com` (or `http://localhost:5000` in local development)
**Current Version**: `/v1`

---

## Table of Contents
1. [Core Authentication](#1-core-authentication)
2. [Multi-Factor Authentication (MFA)](#2-multi-factor-authentication)
3. [Session & Device Management](#3-session-management)
4. [Account Recovery](#4-account-recovery)
5. [OAuth Providers](#5-oauth)

---

## 1. Core Authentication

### 1.1 Register
Create a new user account. Triggers an email verification generation process.

**Endpoint**: `POST /v1/auth/register`
**Auth Required**: No

#### Request
**Headers**: `Content-Type: application/json`

**Body**:
| Parameter | Type | Required | Description |
|---|---|---|---|
| `email` | `string` | Yes | Valid email address. |
| `username` | `string` | Yes | Unique handle for the user. |
| `password` | `string` | Yes | Must be >= 8 chars, 1 uppercase, 1 symbol, 1 number. |

#### Responses
* `201 Created`
  ```json
  {
    "success": true,
    "message": "User registered successfully. Please verify your email."
  }
  ```
* `409 Conflict` (Email or username already exists)
  ```json
  {
    "success": false,
    "message": "User already exists"
  }
  ```

---

### 1.2 Login
Authenticate an existing user. Optionally flags the frontend if MFA is required.

**Endpoint**: `POST /v1/auth/login`
**Auth Required**: No

#### Request
**Headers**: `Content-Type: application/json`

**Body**:
| Parameter | Type | Required | Description |
|---|---|---|---|
| `email` | `string` | Yes | Registered user email. |
| `password` | `string` | Yes | Raw string password. |

#### Responses
* `200 OK` (Standard Success)
  *Sets HTTP-Only Cookie: `refreshToken`*
  ```json
  {
    "success": true,
    "accessToken": "eyJhbG...",
    "user": {
      "id": "60d5ecb8b392...",
      "username": "johndoe",
      "role": "reader"
    }
  }
  ```
* `200 OK` (MFA Required)
  *No cookies set. Frontend must transition to `/mfa/challenge`.*
  ```json
  {
    "success": true,
    "mfaRequired": true,
    "userId": "60d5ecb8b392..."
  }
  ```
* `401 Unauthorized` (Invalid email/password)
* `429 Too Many Requests` (If brute-forcing attempted)

---

### 1.3 Refresh Token
Exchange a secure HTTP-Only cookie for a new JWT Access Token via Rotation.

**Endpoint**: `POST /v1/auth/refresh`
**Auth Required**: No (Depends on Cookie)

#### Request
**Headers**: Native Browser Request
**Cookies**: `refreshToken` (Required)

#### Responses
* `200 OK`
  *Sets HTTP-Only Cookie: NEW `refreshToken` (Rotation)*
  ```json
  {
    "success": true,
    "accessToken": "eyJhbG..."
  }
  ```
* `401 Unauthorized` (Token expired or missing entirely)
* `403 Forbidden` (Token Reuse Detected: Triggers cascade deletion of all user sessions)

---

### 1.4 Logout
Terminates the current token session actively and blacklists the payload.

**Endpoint**: `POST /v1/auth/logout`
**Auth Required**: Yes

#### Request
**Headers**: 
- `Authorization: Bearer <accessToken>` 
- **Cookies**: `refreshToken`

#### Responses
* `200 OK`
  *Clears `refreshToken` cookie by issuing an expired overwrite*
  ```json
  {
    "success": true,
    "message": "Logged out successfully"
  }
  ```

---

## 2. Multi-Factor Authentication

### 2.1 Setup MFA
Initializes a base64 QR code and AES-encrypted secret. Requires manual validation to activate.

**Endpoint**: `POST /v1/auth/mfa/setup`
**Auth Required**: Yes

#### Request
**Headers**: `Authorization: Bearer <accessToken>`

#### Responses
* `200 OK`
  ```json
  {
    "success": true,
    "qrCode": "data:image/png;base64,iVBORw0KGgoAAA...",
    "secret": "JBSWY3DPEHPK3PXP",
    "backupCodes": [
      "2f9a1b8c",
      "b39c04df",
      "..."
    ]
  }
  ```
* `400 Bad Request` (MFA is already enabled)

---

### 2.2 Verify MFA Configuration
Finalizes the setup mapping inside the system ensuring the Authenticator yields valid pairs.

**Endpoint**: `POST /v1/auth/mfa/verify`
**Auth Required**: Yes

#### Request
**Headers**: `Content-Type: application/json`, `Authorization: Bearer <accessToken>`

**Body**:
| Parameter | Type | Required | Description |
|---|---|---|---|
| `token` | `string` | Yes | 6-digit TOTP code currently active on the device. |

#### Responses
* `200 OK`
  ```json
  {
    "success": true,
    "message": "MFA enabled successfully"
  }
  ```
* `400 Bad Request` (Invalid TOTP token)

---

### 2.3 MFA Challenge (Login Completion)
Validates the secondary authentication step demanded after basic `/login`.

**Endpoint**: `POST /v1/auth/mfa/challenge`
**Auth Required**: No

#### Request
**Headers**: `Content-Type: application/json`

**Body**:
| Parameter | Type | Required | Description |
|---|---|---|---|
| `userId` | `string` | Yes | The Mongo `_id` supplied by the previous login payload. |
| `token` | `string` | Yes | 6-digit TOTP code OR 8-character Backup Code. |

#### Responses
* `200 OK` (Standard issue, identically mimicking normal login)
  *Sets HTTP-Only Cookie: `refreshToken`*
  ```json
  {
    "success": true,
    "accessToken": "eyJhbG...",
    "user": {
      "id": "60d5ecb8b392...",
      "username": "johndoe",
      "role": "reader"
    }
  }
  ```
* `401 Unauthorized` (Invalid MFA token)

---

## 3. Session Management

### 3.1 Fetch Active Sessions
Lists metadata of all devices/sessions currently connected to this account.

**Endpoint**: `GET /v1/auth/sessions`
**Auth Required**: Yes

#### Responses
* `200 OK`
  ```json
  {
    "success": true,
    "data": [
      {
        "sessionId": "4db6b7fb-12d4...",
        "ipHash": "a3b98c9...",
        "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)...",
        "location": "unknown",
        "lastActiveAt": "2026-04-17T12:00:00.000Z"
      }
    ]
  }
  ```

---

### 3.2 Terminate Specific Session
Forces a remote logout on a specific payload.

**Endpoint**: `DELETE /v1/auth/sessions/:id`
**Auth Required**: Yes

#### Request
**Params**: `:id` (The `sessionId` string matching the target).

#### Responses
* `200 OK`
  ```json
  {
    "success": true,
    "message": "Session terminated"
  }
  ```

---

### 3.3 Terminate All Other Sessions
Secures the account by killing every linked device/session except the current one executing the command.

**Endpoint**: `DELETE /v1/auth/sessions/all`
**Auth Required**: Yes

#### Responses
* `200 OK`
  ```json
  {
    "success": true,
    "message": "All other sessions terminated"
  }
  ```

---

## 4. Account Recovery

### 4.1 Forgot Password
Initiates the reset URL parameter drop.

**Endpoint**: `POST /v1/auth/forgot-password`
**Auth Required**: No

#### Request
**Body**:
| Parameter | Type | Required | Description |
|---|---|---|---|
| `email` | `string` | Yes | Associated account email. |

#### Responses
* `200 OK` (Defense against email scraping keeps response generic)
  ```json
  {
    "success": true,
    "message": "If registered, a reset link was sent"
  }
  ```

---

### 4.2 Reset Password
Closes the loop updating the actual password via email-driven validation.

**Endpoint**: `POST /v1/auth/reset-password`
**Auth Required**: No

#### Request
**Headers**: `Content-Type: application/json`

**Body**:
| Parameter | Type | Required | Description |
|---|---|---|---|
| `token` | `string` | Yes | Token securely retrieved from the URL. |
| `newPassword` | `string` | Yes | Secure password replacement. |

#### Responses
* `200 OK`
  ```json
  {
    "success": true,
    "message": "Password reset successful. Please log in."
  }
  ```
* `400 Bad Request` (Invalid/Expired token OR Weak Password Policy block)

---

## 5. OAuth

### 5.1 Redirection Gates
Direct standard HTTP `<a>` tags to these addresses.

**Google Setup**: `GET /v1/auth/oauth/google`
**GitHub Setup**: `GET /v1/auth/oauth/github`

### 5.2 Handlers (Internal Callbacks)
The API manages the callbacks dynamically. Upon success, the user is structurally redirected to the Frontend Client environment using the parameters attached to the URL.

**Success Route Targeting**:
`GET ${NEXT_PUBLIC_FRONTEND_URL}/auth/success?token=<ACCESS_TOKEN>`

*(Frontend implicitly catches the `token` parameter mapping it to local caching, while the backend `refreshToken` operates silently via cookies).*
