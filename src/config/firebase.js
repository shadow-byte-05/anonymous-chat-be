// src/config/firebase.js
const admin = require('firebase-admin');
const path = require('path'); // <-- 1. IMPORT THE 'path' MODULE

let serviceAccount;

if (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
    // This part for deployment is fine
    serviceAccount = JSON.parse(Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, 'base64').toString('ascii'));
} else if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
    // --- THIS IS THE FIX ---
    // 2. Create an absolute path from the project root to the key file
    const serviceAccountPath = path.join(process.cwd(), process.env.FIREBASE_SERVICE_ACCOUNT_PATH);
    
    // 3. Require the file using the new, correct path
    serviceAccount = require(serviceAccountPath);
} else {
    console.error("Firebase service account not configured. Set FIREBASE_SERVICE_ACCOUNT_PATH or FIREBASE_SERVICE_ACCOUNT_BASE64.");
    process.exit(1);
}

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: process.env.FIREBASE_DATABASE_URL
    });
}

const db = admin.database();

module.exports = { admin, db };