# Firebase account administration

The app uses Firebase Authentication email/password accounts. Enable the
Email/Password provider in Firebase Console before allowing users to register.
Registration collects a name, a required full address, and an optional
telephone number. These profile details are stored in a private Firestore
collection readable only by the account owner. They are copied to private
listing/request records and shown only to the owner and requester while a
request is active; they are not displayed in public listings. The login dialog
has separate normal-user and administrator entry points; administrator access
is still determined only by the Firebase Authentication `admin` custom claim.
Existing users without a saved profile are prompted to add these details before
their next listing or request.

## Grant or revoke administrator access

Administrator access is a Firebase Authentication custom claim, never a
password or role value stored in Firestore. Use trusted Google Application
Default Credentials for the Firebase project; do not put service-account keys
in the repository.

From the `functions` directory, set `FIREBASE_PROJECT_ID` to the intended
project and run:

```powershell
$env:FIREBASE_PROJECT_ID = "nachbarschafts-werkzeugkiste"
npm run set-admin-claim -- <firebase-auth-uid> grant
npm run set-admin-claim -- <firebase-auth-uid> revoke
```

The command preserves other custom claims. After a claim change, the user must
sign out and sign back in so Firebase issues a token containing the new role.
Only trusted project administrators should have access to the credentials used
to run this command.
For local Google credentials, sign in with `gcloud auth application-default login`
before running the script.
The administrator must first create the account with the intended email through
the app's normal registration flow (or create it in Firebase Authentication),
then grant the `admin` claim to that account's UID. The Admin Einloggen button
does not create an account.

## Deploying access rules

Deploy the Hosting page and Firestore rules after reviewing them against the
Firebase project:

```powershell
firebase deploy --only hosting,firestore
```

The deny-all Realtime Database rules can be deployed separately if needed:

```powershell
firebase deploy --only database
```

The legacy `recoverUserAccount` Cloud Function now returns HTTP 410 and no
longer accesses ID mappings. Deploy the functions source to replace the
previous implementation:

```powershell
firebase deploy --only functions
```

Legacy listings are not automatically assigned to new accounts or published.
An administrator should review and delete old records; owners should recreate
their listings while signed in so ownership and private contact data are
properly associated with their Firebase UID.
