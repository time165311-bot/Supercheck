# Security Specification - Anesthesia Care

## Data Invariants
1. Shared Ward Workspaces under `/wards/{wardId}` (default `ANES-MASTER`) enforce strict `isValidWardId(wardId)` (`^[a-zA-Z0-9_-]{2,48}$`), forbid `list` enumeration on `/wards`, enforce Master Gate `wardExists(wardId)` + `wardId` scope matching on subcollections, and allow real-time device sync without requiring Google login.
2. Personal profiles (`/users/{uid}`), admin allowlists (`/admins/{uid}`), global config (`/settings/config`), and legacy collections require `request.auth != null && request.auth.token.email_verified == true`.
3. A `User` document contains only profile metadata (`id`, `uid`, `email`, `username`, `name`, `role`, `position`, `signature`, `active`, `must`, `created`, `last`, `avatar`, `ringColor`) and NEVER stores `salt` or `hash`. Optional ward edit PINs store only SHA-256 salted digests (`pinHash`, `pinSalt`), never plaintext PINs.
4. Users can only create or update their own `/users/{uid}` profile with immutable `role: 'user'` unless they are verified `isAdmin()`.
5. `isAdmin()` is true ONLY for bootstrapped verified admin (`time165311@gmail.com` with `email_verified == true`) or UIDs present in `/admins/{uid}`.
6. `RestockRequisition` documents enforce terminal-state locking once `status == 'received'`.
7. Global `/audit_logs/{logId}` documents are strictly append-only (`update` and `delete` forbidden). Ward-scoped `/wards/{wardId}/audit_logs/{logId}` allow `create` for ward audit trail, and allow `update` (`restoredAt`, `restoredBy` only) or `delete` strictly for verified `isAdmin()`.
8. `/wards/{wardId}/admin_config/{configId}` (ward permission locks) allows read access within valid `wardId` and restricts writes (`create`, `update`, `delete`) strictly to verified `isAdmin()`.
9. `/wards/{wardId}/trash/{trashId}` stores restorable snapshots of deleted items; only verified `isAdmin()` can update (`restoredAt`, `restoredBy`) or delete trash entries.

## The "Dirty Dozen" Payloads

### 1. Unauthenticated Read/Write
Attempt any read or write while `request.auth == null`.
**Expected**: PERMISSION_DENIED.

### 2. Identity Spoofing (User Collection)
Attempt to create `/users/victim_uid` as another UID.
**Expected**: PERMISSION_DENIED (`request.auth.uid == userId || isAdmin()`).

### 3. Privilege Escalation
A regular user tries to set `role: "admin"` on `/users/{myUid}` or write to `/admins/{myUid}`.
**Expected**: PERMISSION_DENIED.

### 4. Resource Poisoning (Equipment)
Injecting a massive string (>300 chars in `name` or >500,000 chars in `img`).
**Expected**: PERMISSION_DENIED (Length checks).

### 5. Orphaned Record (Inspection)
Creating an inspection record with a fake ID (`invalid!!id`).
**Expected**: PERMISSION_DENIED (`isValidId` check).

### 6. Ghost Field Injection / Legacy Auth Fields
Sending unknown fields (e.g., `salt`, `hash`, `isVerifiedByGod: true`).
**Expected**: PERMISSION_DENIED (`hasOnly` check).

### 7. Unauthorized Catalog Deletion
Regular user tries to delete a drug or equipment item.
**Expected**: PERMISSION_DENIED (`isAdmin()` required for delete).

### 8. Unauthorized Settings Modification
Regular user tries to change `/settings/config` (`sheetUrl` / `apiUrl`).
**Expected**: PERMISSION_DENIED (`isAdmin()` required).

### 9. PII Leak (User Signature / Profile)
Regular user tries to `get` or `list` another user's `/users/{otherUid}` document.
**Expected**: PERMISSION_DENIED.

### 10. Email Spoofing Attack
Email matches bootstrapped admin but `request.auth.token.email_verified == false`.
**Expected**: PERMISSION_DENIED.

### 11. Requisition Terminal State Tampering
Attempting to modify or delete a `restock_requisitions` document after `status == 'received'`, or non-admin approving a requisition.
**Expected**: PERMISSION_DENIED.

### 12. Audit Trail Tampering
Attempting to `update` or `delete` an entry in `/audit_logs/{logId}` or scrape another user's audit logs.
**Expected**: PERMISSION_DENIED.
