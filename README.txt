BikriPage website files
=======================

This package contains the provided website pages with visible Pixigenie branding changed to BikriPage.

Files:
- index.html: homepage
- dashboard.html: merchant dashboard
- store.html: storefront
- my-orders.html: customer orders
- super-admin.html: super admin

Notes:
- Existing page names/navigation are preserved where possible.
- Firebase project configuration and project identifiers are intentionally preserved so the existing backend connection is not silently changed.
- This is a branding rename in the provided source files; hosting/domain settings and Firebase Console branding/configuration may need separate updates if you want the entire deployed service renamed.


SECURITY RULES (added)
======================
- firestore.rules: starter rules for Firestore.
- storage.rules: private-by-default Storage rules.

IMPORTANT:
The current HTML frontend appears to use localStorage/custom login and does not
use Firebase Authentication sign-in/create-user methods. Security rules cannot
trust localStorage. These rules require Firebase Authentication for protected
actions, so protected operations will fail until the frontend is migrated to
Firebase Authentication and order/customer documents are updated to include
the expected UID/owner fields (customerUid, shopOwnerEmail). Test and adapt
before publishing on a live project.

Deploy:
1. Firebase Console -> Firestore Database -> Rules; paste firestore.rules.
2. Firebase Console -> Storage -> Rules; paste storage.rules.
3. Remove any older broad `allow read, write: if true;` rules.
Never rely on hiding admin pages or localStorage flags for admin security.
