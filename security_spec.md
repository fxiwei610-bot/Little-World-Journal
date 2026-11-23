# Security Specification: The Little World Journal

## 1. Data Invariants
1. All user data (`UserProfile`, `CountryRecord`, `TripRecord`, `WishRecord`, `JournalRecord`, `BookingRecord`, `ExpenseRecord`) is strictly private to the authenticated, email-verified owner (`request.auth.uid == userId && request.auth.token.email_verified == true`).
2. Every subcollection document must declare `ownerId == request.auth.uid`, and `ownerId` and `createdAt` are immutable once created.
3. All document IDs (`userId`, `countryId`, `tripId`, `wishId`, `journalId`, `bookingId`, `expenseId`) must satisfy `isValidId(id)` (`^[a-zA-Z0-9_\-]+$`, max 128 chars).
4. All strings have strict maxLength limits (up to 5000 chars for journal stories), all arrays have strict max size limits (`<= 12` for photo galleries, `<= 15` for highlights, `<= 30`, `<= 50`, or `<= 60` for packing lists), and all numeric fields (`budget`, `days`, `amount`) are bounded to non-negative numbers.
5. `createdAt` and `updatedAt` timestamps must match `request.time`.

## 2. Adversarial Test Payloads ("Dirty Dozen")
1. **Cross-user profile read**: Authenticated User B attempts `get` on `/users/userA`. Expected: `PERMISSION_DENIED`.
2. **Unverified email write**: Authenticated user with `email_verified: false` attempts `create` on `/users/userA`. Expected: `PERMISSION_DENIED`.
3. **Spoofed ownerId on create**: User A creates `/users/userA/trips/trip1` with `ownerId: "userB"`. Expected: `PERMISSION_DENIED`.
4. **Ghost field injection (Shadow Update)**: User A creates `/users/userA` with `{ ..., isAdmin: true }`. Expected: `PERMISSION_DENIED` (blocked by `hasOnly`).
5. **Immutable field mutation**: User A updates `/users/userA/trips/trip1` changing `createdAt` or `ownerId`. Expected: `PERMISSION_DENIED`.
6. **Client-forged timestamp**: User A creates `/users/userA/expenses/exp1` with `createdAt: Timestamp(2020-01-01)`. Expected: `PERMISSION_DENIED` (`createdAt == request.time`).
7. **ID poisoning**: User A creates `/users/userA/wishes/bad$id!@#` with invalid characters or >128 chars. Expected: `PERMISSION_DENIED`.
8. **Unbounded array exhaustion**: User A creates `/users/userA/trips/trip1` with 100 activities (>50). Expected: `PERMISSION_DENIED`.
9. **String resource exhaustion**: User A creates `/users/userA/journals/j1` with 10,000 char `text` (>5000). Expected: `PERMISSION_DENIED`.
10. **Negative financial figure**: User A creates `/users/userA/expenses/exp1` with `amount: -500`. Expected: `PERMISSION_DENIED`.
11. **Invalid enum value**: User A creates `/users/userA/trips/trip1` with `status: "Hacked"`. Expected: `PERMISSION_DENIED`.
12. **Blanket list scraping**: User B attempts `list` on `/users/userA/bookings` without ownership. Expected: `PERMISSION_DENIED`.
