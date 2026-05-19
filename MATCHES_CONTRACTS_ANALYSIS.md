# Matches & Contracts Features Analysis

## 1. Database Schema

### Matches Table
**Location:** [packages/shared/db/src/schema/matches.ts](packages/shared/db/src/schema/matches.ts)

```typescript
export const matchesTable = pgTable("matches", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  ownerId: integer("owner_id").notNull(),
  roomId: integer("room_id").notNull(),
  status: text("status").notNull().default("pending"),
  tenantStatus: text("tenant_status").notNull().default("pending"),
  ownerStatus: text("owner_status").notNull().default("pending"),
  matchScore: integer("match_score").default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
```

**Columns:**
- `id` - Primary key (auto-increment)
- `tenantId` - FK to users table (interested tenant)
- `ownerId` - FK to users table (property owner)
- `roomId` - FK to rooms table
- `status` - Enum: "pending", "accepted", "rejected" (overall match status)
- `tenantStatus` - Enum: "pending", "accepted", "rejected" (tenant's response)
- `ownerStatus` - Enum: "pending", "accepted", "rejected" (owner's response)
- `matchScore` - Integer (0-100 match quality percentage)
- `createdAt` - Timestamp (auto-set)
- `updatedAt` - Timestamp (auto-set)

**Relationships:**
- Matches → Users (via tenantId)
- Matches → Users (via ownerId)
- Matches → Rooms (via roomId)

---

### Contracts Table
**Location:** [packages/shared/db/src/schema/contracts.ts](packages/shared/db/src/schema/contracts.ts)

```typescript
export const contractsTable = pgTable("contracts", {
  id: serial("id").primaryKey(),
  matchId: integer("match_id").notNull(),
  tenantId: integer("tenant_id").notNull(),
  ownerId: integer("owner_id").notNull(),
  roomId: integer("room_id").notNull(),
  rentAmount: integer("rent_amount").notNull(),
  startDate: text("start_date").notNull(),
  endDate: text("end_date").notNull(),
  terms: text("terms"),
  ownerSignature: text("owner_signature"),
  tenantSignature: text("tenant_signature"),
  ownerSignedAt: timestamp("owner_signed_at"),
  tenantSignedAt: timestamp("tenant_signed_at"),
  status: text("status").notNull().default("draft"),
  adminVerifiedAt: timestamp("admin_verified_at"),
  adminNote: text("admin_note"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
```

**Columns:**
- `id` - Primary key (auto-increment)
- `matchId` - FK to matches table (initiating match)
- `tenantId` - FK to users table
- `ownerId` - FK to users table
- `roomId` - FK to rooms table
- `rentAmount` - Integer (monthly rent in NPR)
- `startDate` - Text/Date (lease start date)
- `endDate` - Text/Date (lease end date)
- `terms` - Text (contract terms/conditions)
- `ownerSignature` - Text (owner's digital signature)
- `tenantSignature` - Text (tenant's digital signature)
- `ownerSignedAt` - Timestamp (when owner signed)
- `tenantSignedAt` - Timestamp (when tenant signed)
- `status` - Enum: "draft", "owner_signed", "tenant_signed", "fully_signed", "verified", "cancelled"
- `adminVerifiedAt` - Timestamp (admin verification time)
- `adminNote` - Text (admin verification notes)
- `createdAt` - Timestamp (auto-set)

**Relationships:**
- Contracts → Matches (via matchId)
- Contracts → Users (via tenantId)
- Contracts → Users (via ownerId)
- Contracts → Rooms (via roomId)

---

## 2. API Endpoints

### Matches Endpoints
**Location:** [apps/api/src/routes/matches.ts](apps/api/src/routes/matches.ts)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/matches` | ✅ Required | Create a new match (tenant shows interest in room) |
| GET | `/api/matches/tenant/:tenantId` | ✅ Required | Get all matches for a tenant (IDOR protected) |
| GET | `/api/matches/owner/:ownerId` | ✅ Required | Get all matches for a room owner (IDOR protected) |
| PATCH | `/api/matches/:id/respond` | ✅ Required | Owner/tenant responds to match (accept/reject) |

**POST /api/matches**
```
Request:
{
  "ownerId": number,
  "roomId": number,
  "matchScore": number (optional)
}

Response:
{
  "id": number,
  "tenantId": number,
  "ownerId": number,
  "roomId": number,
  "status": "pending",
  "tenantStatus": "accepted",
  "ownerStatus": "pending",
  "matchScore": number,
  "createdAt": timestamp,
  "updatedAt": timestamp
}
```

**GET /api/matches/tenant/:tenantId**
```
Response:
{
  "matches": [
    {
      "id": number,
      "tenantId": number,
      "ownerId": number,
      "roomId": number,
      "status": string,
      "tenantStatus": string,
      "ownerStatus": string,
      "matchScore": number,
      "createdAt": timestamp,
      "updatedAt": timestamp,
      "room": { id, title, city, address, price, roomType, photos, amenities, parking },
      "owner": { id, firstName, lastName, isVerified }
    }
  ]
}
```

**PATCH /api/matches/:id/respond**
```
Request:
{
  "decision": "accepted" | "rejected"
}

Response: Updated match object
```

**Auto-Contract Creation:** When both tenant and owner accept a match, a contract is automatically created with:
- Draft status
- 1-year lease term (today to today+365 days)
- Rent amount from room price
- Default terms generated from room details

---

### Contracts Endpoints
**Location:** [apps/api/src/routes/contracts.ts](apps/api/src/routes/contracts.ts)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/contracts` | ✅ Required | Create contract (rarely used - auto-created) |
| GET | `/api/contracts/match/:matchId` | None | Get contract by match ID |
| GET | `/api/contracts/user/:userId` | ✅ Required + Self | Get user's contracts (both owned & rented) |
| PATCH | `/api/contracts/:id/sign` | ✅ Required | Sign contract as owner or tenant |
| PATCH | `/api/contracts/:id/verify` | ✅ Required | Admin: verify/cancel contract |
| GET | `/api/admin/contracts` | ✅ Required | Admin: get all contracts |

**POST /api/contracts**
```
Request:
{
  "matchId": number,
  "tenantId": number,
  "ownerId": number,
  "roomId": number,
  "rentAmount": number,
  "startDate": string,
  "endDate": string,
  "terms": string (optional)
}

Response: Created contract object
```

**GET /api/contracts/user/:userId**
```
Response:
{
  "contracts": [
    {
      "id": number,
      "matchId": number,
      "tenantId": number,
      "ownerId": number,
      "roomId": number,
      "rentAmount": number,
      "startDate": string,
      "endDate": string,
      "terms": string,
      "ownerSignature": string,
      "tenantSignature": string,
      "ownerSignedAt": timestamp,
      "tenantSignedAt": timestamp,
      "status": string,
      "adminVerifiedAt": timestamp,
      "adminNote": string,
      "createdAt": timestamp,
      "tenant": { id, firstName, lastName },
      "owner": { id, firstName, lastName },
      "room": { id, title, city, address }
    }
  ]
}
```

**PATCH /api/contracts/:id/sign**
```
Request:
{
  "role": "owner" | "tenant",
  "signature": string (user's full legal name)
}

Response: Updated contract with new signature and status
Status updates:
- owner_signed (if only owner signed)
- tenant_signed (if only tenant signed)
- fully_signed (if both have signed)
```

**PATCH /api/contracts/:id/verify** (Admin)
```
Request:
{
  "decision": "verified" | "cancelled",
  "adminNote": string (optional)
}

Response: Updated contract with admin verification
```

---

## 3. Frontend Pages & Components

### Matches Page
**Location:** [apps/web/src/pages/matches.tsx](apps/web/src/pages/matches.tsx)

**Features:**
- Fetch matches based on user role (owner → interested tenants, tenant → available rooms)
- Display match cards with:
  - Room photo/info
  - Partner name & verification status
  - Match score (percentage)
  - Match status badge (Pending/Accepted/Declined)
- Owner can accept/reject interested tenants
- Accept match → opens chat button
- Navigate to room details
- Separate tabs for active vs declined matches
- Security: IDOR protection (can only view own matches)

**Components:**
- `MatchCard` - Individual match card UI
- Status config for styling (pending, accepted, rejected)

---

### Contracts Page
**Location:** [apps/web/src/pages/contracts.tsx](apps/web/src/pages/contracts.tsx)

**Features:**
- List all user contracts (both as tenant and owner)
- Contract cards show:
  - Room details
  - Monthly rent amount
  - Lease period (start → end dates)
  - Signing status (owner/tenant pending/signed)
  - Overall contract status badge
- View full contract details with:
  - Landlord/tenant party info
  - Contract terms
  - Signature status for both parties
  - Admin verification badge (if verified)
- Sign contract modal:
  - Type full legal name as digital signature
  - Legal warning about binding agreement
  - Submit signature
- Separate tabs for active vs cancelled contracts

**Components:**
- `ContractCard` - Summary card for contract list
- `SignModal` - Modal to sign contract
- `ContractDetail` - Full contract detail view

**Security:** 
- Only own contracts visible (checked via userId)
- Signature must be non-empty string

---

### Admin Panel
**Location:** [apps/web/src/pages/admin.tsx](apps/web/src/pages/admin.tsx)

**Admin Contract Management:**
- Tab: "contracts" shows all contracts
- View all contracts with enriched data (parties & room details)
- Verify/cancel contracts
- Add admin notes during verification
- Status tracking: draft → signed → verified/cancelled

---

## 4. Security Features

✅ **Implemented:**
- Authentication required on sensitive endpoints
- IDOR protection: tenants can only access their own matches
- IDOR protection: users can only access their own contracts
- Verification checks: tenant must be identity-verified to show interest
- Owner validation: match ownerId must match room owner
- Duplicate prevention: only one match per tenant-room pair
- Role-based response: can only accept/reject as participant
- Admin verification required for final contract status

⚠️ **Notes:**
- Signatures are stored as plain text (consider encryption for production)
- No expiry on contracts without lease end date enforcement
- No payment/rent verification integration

---

## 5. Data Flow

### Match Creation Flow
```
Tenant shows interest in room
  ↓
POST /api/matches
  ├─ Verify tenant is identity-verified
  ├─ Verify room exists
  ├─ Verify owner exists
  ├─ Check for existing match (prevent duplicates)
  └─ Create match with status="pending", tenantStatus="accepted", ownerStatus="pending"
  ↓
Owner receives notification of interested tenant
  ↓
Owner can accept or reject in UI (calls PATCH /matches/:id/respond)
```

### Match → Contract Flow
```
Both parties accept match
  ↓
PATCH /matches/:id/respond updates ownerStatus="accepted"
  ├─ Check if both tenant & owner have accepted
  └─ If both accepted:
      ├─ Update match.status = "accepted"
      └─ Auto-create contract with status="draft"
  ↓
Contract created with:
  - Default 1-year lease term
  - Room price as rent amount
  - Auto-generated terms from room details
```

### Contract Signing Flow
```
Tenant or Owner receives contract
  ↓
User views contract details
  ↓
If user hasn't signed yet:
  └─ Click "Sign Now" button
      ↓
      SignModal appears
      ↓
      User types full legal name
      ↓
      PATCH /contracts/:id/sign { role, signature }
      ├─ Store signature in ownerSignature or tenantSignature
      ├─ Store timestamp in ownerSignedAt or tenantSignedAt
      └─ Update status: "owner_signed" or "tenant_signed"
      ↓
      If both signed:
      └─ Update status = "fully_signed"
  ↓
Admin can then verify/cancel the contract
  └─ PATCH /contracts/:id/verify
      └─ Updates status = "verified" or "cancelled"
```

---

## 6. Missing/Incomplete Functionality

### Critical Gaps
1. **No Payment Integration**
   - No rent collection/payment tracking
   - No payment schedule enforcement
   - No transaction records

2. **Limited Contract Management**
   - Cannot edit contract terms once created
   - Cannot extend/renew contracts
   - No contract termination workflow
   - No penalty/dispute handling

3. **No Match Quality Scoring**
   - matchScore field exists but not calculated
   - Always defaults to 0
   - No algorithm for tenant-room compatibility

4. **No Notifications**
   - Matches created → no notification to owner
   - Contract signing status → no updates
   - Admin verification → no notification to parties

5. **Limited Admin Controls**
   - No ability to manually create contracts
   - Cannot override/edit contract details
   - No audit log for admin actions

### Performance Issues
1. **N+1 Query Problem**
   - Each match/contract fetch triggers multiple DB queries per item
   - Could use batch loading or joins for optimization

### UI/UX Gaps
1. **No Contract Templates**
   - All contracts use auto-generated terms
   - No ability to use pre-made terms

2. **Limited Search/Filter**
   - No way to search for specific matches/contracts
   - No status filtering in admin panel

3. **No Bulk Actions**
   - Admin cannot verify multiple contracts at once

4. **No Document Download**
   - Cannot export/download contract as PDF
   - Cannot print contract

### Data Validation
1. **Date Validation**
   - No check that endDate > startDate
   - No validation for past dates
   - No working days/business days logic

2. **Amount Validation**
   - No minimum/maximum rent validation
   - No currency precision (integer only, no decimals)

3. **Signature Validation**
   - Signatures are just plain text
   - No verification that signature matches user identity
   - No escrow/non-repudiation

---

## 7. Integration Points

### Dependencies on Other Features
- **Users:** Verification status required for matches
- **Rooms:** Room details included in contracts
- **Messages:** Chat opens when match accepted
- **Interactions:** Could track user-room interactions for matching algorithm
- **Storage:** Could store contract documents/PDFs

### External Services Needed
- **Email/SMS:** Send notifications for matches & contract updates
- **Payment Gateway:** For rent collection
- **Document Storage:** For contract PDFs/archives
- **Signing Service:** For legally binding e-signatures (DocuSign, etc.)

---

## 8. Testing Checklist

### Matches Feature
- [ ] Tenant can create match (verified only)
- [ ] Owner receives match notification
- [ ] Owner can accept match
- [ ] Owner can reject match
- [ ] Cannot create duplicate matches
- [ ] IDOR: Cannot view other user's matches
- [ ] Contract auto-creates when both accept

### Contracts Feature
- [ ] Contract visible to both parties after match accepts
- [ ] User can sign contract
- [ ] Status updates correctly (draft→signed→verified)
- [ ] Both parties' signatures stored correctly
- [ ] Admin can verify contract
- [ ] Admin can cancel contract
- [ ] IDOR: Cannot view other user's contracts
- [ ] Cannot sign if already signed

### Admin Features
- [ ] Admin can view all contracts
- [ ] Admin can verify contracts
- [ ] Admin can add notes
- [ ] Admin cannot access without admin role

---

## Summary Stats

| Category | Count |
|----------|-------|
| Database Tables | 2 (matches, contracts) |
| API Endpoints | 10 |
| Frontend Pages | 3 (matches, contracts, admin tab) |
| Components | 4+ |
| Auth Requirements | 7/10 endpoints |
| Status Types | 8 |
| Critical Missing Features | 4 |

