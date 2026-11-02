# Security Specification - Anesthesia Care

## Data Invariants
1. A `User` must have a valid `role` ('admin' or 'user').
2. `EquipmentItem` and `DrugItem` are shared resources; only admins can modify them.
3. `InspectionRecord` documents are historical and should be immutable once created (except by admins for correction).
4. All `timestamp` and `updatedAt` fields must be validated against `request.time`.
5. PII in `User` (like `signature`, `hash`, `salt`) must be protected.

## The "Dirty Dozen" Payloads

### 1. Identity Spoofing (User Collection)
Attempt to create a user profile for someone else.
```json
{
  "id": "victim_uid",
  "username": "attacker",
  "name": "Attacker",
  "role": "admin",
  "active": true,
  "created": "2023-10-01T00:00:00Z"
}
```
**Expected**: PERMISSION_DENIED (UID must match `request.auth.uid`).

### 2. Privilege Escalation
A regular user tries to make themselves an admin.
```json
{
  "role": "admin"
}
```
**Expected**: PERMISSION_DENIED (Users cannot change their own `role`).

### 3. Resource Poisoning (Equipment)
Injecting a massive string into a field to cause "Denial of Wallet".
```json
{
  "name": "A".repeat(1000000)
}
```
**Expected**: PERMISSION_DENIED (Length checks).

### 4. Orphaned Record (Inspection)
Creating an inspection record with a fake ID.
```json
{
  "id": "invalid!!id",
  "who": "attacker",
  "type": "eq"
}
```
**Expected**: PERMISSION_DENIED (`isValidId` check).

### 5. Ghost Field Injection
Adding a field that doesn't exist in the schema.
```json
{
  "name": "Stethoscope",
  "isVerifiedByGod": true
}
```
**Expected**: PERMISSION_DENIED (`hasOnly` check).

### 6. Unauthorized Catalog Deletion
Regular user tries to delete a drug.
**Expected**: PERMISSION_DENIED (Only admins can delete).

### 7. Unauthorized Settings Modification
Regular user tries to change `sheetUrl`.
**Expected**: PERMISSION_DENIED (Only admins can modify settings).

### 8. PII Leak (User Signature)
Regular user tries to read another user's signature.
**Expected**: PERMISSION_DENIED (Signatures should only be readable by the owner or admin).

### 9. State Shortcutting (Inspection)
Changing the timestamp to a future date.
```json
{
  "timestamp": "2099-01-01T00:00:00Z"
}
```
**Expected**: PERMISSION_DENIED (Must match `request.time`).

### 10. Bulk Inspection Data Attack
Uploading an array of 10,000 rows.
**Expected**: PERMISSION_DENIED (Array size limits).

### 11. Fake User Creation (Pre-verified Email)
Attempting to bypass `email_verified` if required.
**Expected**: PERMISSION_DENIED.

### 12. Cross-User Record Deletion
User A tries to delete User B's inspection record.
**Expected**: PERMISSION_DENIED.

## Test Runner (Conceptual)
Verifies that all above payloads return PERMISSION_DENIED.
