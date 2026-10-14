"use strict";

const { applicationDefault, getApps, initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");

async function main() {
  const [uid, action, ...extraArgs] = process.argv.slice(2);
  const projectId = process.env.FIREBASE_PROJECT_ID;

  if (!uid || !["grant", "revoke"].includes(action) || extraArgs.length > 0) {
    throw new Error("Usage: npm run set-admin-claim -- <firebase-auth-uid> <grant|revoke>");
  }
  if (!projectId) {
    throw new Error("Set FIREBASE_PROJECT_ID to the Firebase project before running this command.");
  }

  const app = getApps()[0] || initializeApp({
    credential: applicationDefault(),
    projectId
  });
  const auth = getAuth(app);
  const user = await auth.getUser(uid);
  const claims = { ...user.customClaims };

  if (action === "grant") {
    claims.admin = true;
  } else {
    delete claims.admin;
  }

  await auth.setCustomUserClaims(uid, claims);
  console.log(`Admin claim ${action === "grant" ? "granted to" : "removed from"} ${uid} in ${projectId}.`);
  console.log("The user must refresh their Firebase ID token (sign out and back in) for the change to take effect.");
}

main().catch(error => {
  console.error(`Could not update admin claim: ${error.message}`);
  process.exitCode = 1;
});
