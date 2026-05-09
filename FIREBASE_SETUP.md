# Firebase Setup

This site now includes a Firebase-powered client portal at `client-portal.html`.

## 1. Create and connect your Firebase project

1. Create a Firebase project in the Firebase console.
2. Add a Web App to that project.
3. Copy the Firebase config object values into `script/firebase-config.js`.

## 2. Turn on Authentication

1. In Firebase Console, open `Authentication`.
2. Go to `Sign-in method`.
3. Enable `Email/Password`.

## 3. Create Firestore

1. In Firebase Console, open `Firestore Database`.
2. Create the database in production mode.
3. Publish the rules from `firestore.rules`.

## 4. Client record structure

When a client signs up from the portal, the site creates this document automatically:

- `clients/{uid}`

Invoices should be added under that client:

- `clients/{uid}/invoices/{invoiceId}`

Recommended invoice fields:

```json
{
  "invoiceNumber": "INV-2026-001",
  "title": "Website Build Phase 1",
  "description": "Initial design and development invoice",
  "amount": 1250,
  "status": "Open",
  "issuedAt": "2026-05-09T00:00:00.000Z",
  "dueDate": "2026-05-23T00:00:00.000Z",
  "notes": "Payable within 14 days.",
  "pdfUrl": "https://your-domain.com/invoices/inv-2026-001.pdf",
  "excelUrl": "https://your-domain.com/invoices/inv-2026-001.xlsx"
}
```

If you only have one file, you can still use:

- `pdfUrl` for a PDF invoice
- `excelUrl` for an Excel invoice
- `fileUrl` as a fallback generic link

## 5. How to post invoices for a client

1. Have the client create their account on `client-portal.html`, or create the account for them from Firebase Authentication.
2. Find that client user in `Authentication` and copy the `UID`.
3. In Firestore, open `clients/{uid}/invoices`.
4. Add an invoice document with the fields shown above.

## 6. Optional hosting step

This portal works on any static hosting that serves these files over HTTPS. If you also want the whole site hosted on Firebase Hosting, connect this folder to your Firebase project and deploy from there.
