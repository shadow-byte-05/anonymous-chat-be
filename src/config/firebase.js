// src/config/firebase.js
const admin = require('firebase-admin');

if (!process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
    console.error("❌ Missing FIREBASE_SERVICE_ACCOUNT_BASE64 in environment variables");
    process.exit(1);
}

// Decode Base64 → JSON
const serviceAccount = JSON.parse(
    Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, 'base64').toString('utf8')
);

// Initialize Firebase Admin
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: process.env.FIREBASE_DATABASE_URL
    });
}

const db = admin.database();

module.exports = { admin, db };
