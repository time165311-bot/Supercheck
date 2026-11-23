# Security Specification - Anesthesia Care

## Data Invariants
1. Every Firestore read and write requires an authenticated Firebase Auth user (`request.auth != null && request.auth.token.email_verified == true`).
2. A `User` document contains only profile metadata (`id`, `uid`, `email`, `username`, `name`, `role`, `position`, `signature`, `active`, `must`, `created`, `last`, `avatar`, `ringColor`) and NEVER stores `salt` or `hash`.
3. Users can only create or update their own `/users/{uid}` profile with immutable `role: 'user'` unless they are verified `isAdmin()`.
4. `isAdmin()` is true ONLY for bootstrapped verified admin (`time165311@gmail.com` with `email_verified == true`) or UIDs present in `/admins/{uid}`.
5. Destructive `delete` operations across `/equipment`, `/drugs`, `/inspection_records`, `/channels`, `/restock_requisitions`, and `/settings/config` updates (`sheetUrl`, `apiUrl`) require `isAdmin()`.
6. `RestockRequisition` documents enforce terminal-state locking once `status == 'received'`, and only `isAdmin()` may transition requisitions to `approved`, `rejected`, or `received`.
7. `AuditLog` documents are strictly append-only (`update` and `delete` forbidden) and list queries are scoped by `isBootstrappedAdmin()` or `resource.data.userId == request.auth.uid`.

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
