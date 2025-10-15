# OSD Web Form — Merged (Top Design + Paperless Features)

This build keeps the **clean top UI** and adds all **bottom features**:
- Door dropdown includes fixed doors (17–19 @ Bixby Rd) **plus** 100–140 range
- BOL **image or PDF** upload
- Client-side **OCR** (image) to auto-fill BOL/PO (Tesseract.js)
- **Digital BOL Link / Load #** field
- Required: **Door**, **Driver Name**, **Carrier**, **Signature**
- Gallery **photo** uploads with compression
- Backend **PDF** generation, local storage, and **SMTP email**
- **Dynamic email routing** (To/CC/BCC/Subject/Message) from the frontend
- **Mailto** fallback button

## Deploy backend (Render/any Node host)
- Root: `server/`
- Build: `npm install`
- Start: `node server.js`
- Copy `.env.example` to `.env` and fill SMTP creds.
- Create `submissions/` or let the server create it.

## Host frontend
- Put `frontend/index.html` on any static host (GitHub Pages, Netlify, S3).
- In `index.html`, set: `const BACKEND_URL = "https://osd-webform.onrender.com"`
  (already set). Change if you deploy elsewhere.

## API
POST `${BACKEND_URL}/api/osd/submit`
Body: JSON matching the payload built in `index.html` (see code).
Response: `{ ok: true, ref, mailed }`

## Notes
- If you attach a BOL **PDF**, it is **not embedded** in the main PDF; it is saved and **attached** to the email.
- If you attach a BOL **image**, it is embedded in the PDF.
- SMTP is optional; if not configured, PDFs still save to `/submissions`.
