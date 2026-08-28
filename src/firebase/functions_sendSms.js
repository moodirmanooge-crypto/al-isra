/**
 * =========================================================================
 *  RESING SCHOOL ERP — Bulk SMS Cloud Function (Hormuud SMS API)
 * =========================================================================
 *
 *  WHY A CLOUD FUNCTION?
 *  Your Hormuud username/password (or API password) must NEVER be placed
 *  in the React frontend — anyone could open dev tools and steal it and
 *  send SMS on your account's balance. This function keeps those secrets
 *  on the server (Firebase) and only exposes a single safe HTTPS endpoint
 *  that your Dashboard calls.
 *
 *  WHERE TO PUT THIS FILE
 *  If your project does not have Cloud Functions yet, run this ONCE from
 *  your project root (RESING_SCHOOL folder):
 *
 *      npm install -g firebase-tools     (if not installed)
 *      firebase login
 *      firebase init functions           (choose JavaScript, existing project)
 *
 *  This creates a "functions" folder. Then:
 *    1. Replace the contents of functions/index.js with this file's content
 *       (or `require` it from index.js — see bottom note).
 *    2. Inside the functions folder run:
 *         npm install firebase-admin firebase-functions axios
 *    3. Set your Hormuud credentials as function config / env (see SETUP
 *       COMMANDS section below) — do NOT hardcode them here.
 *    4. Deploy:
 *         firebase deploy --only functions
 *
 *  SETUP COMMANDS (run once, from the functions folder or project root)
 *  ---------------------------------------------------------------------
 *  For firebase-functions v2 (recommended, what this file uses) secrets
 *  are set like this:
 *
 *      firebase functions:secrets:set HORMUUD_USERNAME
 *      firebase functions:secrets:set HORMUUD_PASSWORD
 *      firebase functions:secrets:set HORMUUD_SENDERID   (optional, e.g. "RESING")
 *
 *  It will prompt you to type the value — paste your real Hormuud API
 *  username/password there (the same ones from https://business.hormuud.com/).
 *
 * =========================================================================
 */

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
const axios = require("axios");

if (getApps().length === 0) {
  initializeApp();
}
const db = admin.firestore();

// Secrets — values are set via `firebase functions:secrets:set`, never
// committed to code or the frontend.
const HORMUUD_USERNAME = defineSecret("HORMUUD_USERNAME");
const HORMUUD_PASSWORD = defineSecret("HORMUUD_PASSWORD");
const HORMUUD_SENDERID = defineSecret("HORMUUD_SENDERID");

const TOKEN_URL = "https://smsapi.hormuud.com/token";
const SEND_URL = "https://smsapi.hormuud.com/api/SendSMS";

/**
 * Gets a fresh Bearer token from Hormuud using the username/password grant.
 */
async function getHormuudToken(username, password) {
  const payload = new URLSearchParams();
  payload.append("grant_type", "password");
  payload.append("username", username);
  payload.append("password", password);

  const res = await axios.post(TOKEN_URL, payload.toString(), {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });

  if (!res.data || !res.data.access_token) {
    throw new Error("Ma helin token Hormuud (access_token) — hubi username/password.");
  }
  return res.data.access_token;
}

/**
 * Sends a single SMS through Hormuud using an existing bearer token.
 * Returns { mobile, success, responseCode, message }.
 */
async function sendOneSms(token, mobile, message, senderid) {
  try {
    const res = await axios.post(
      SEND_URL,
      {
        refid: "0",
        mobile,
        message,
        senderid: senderid || "RESING",
        validity: 0,
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      }
    );

    const code = res.data?.ResponseCode || res.data?.Data?.ResponseCode;
    const ok = String(code) === "200" || res.status === 200;
    return {
      mobile,
      success: ok,
      responseCode: code || String(res.status),
      message: res.data?.ResponseMessage || "Sent",
    };
  } catch (err) {
    return {
      mobile,
      success: false,
      responseCode: err.response?.data?.ResponseCode || "ERROR",
      message: err.response?.data?.ResponseMessage || err.message,
    };
  }
}

/**
 * Cleans a phone number for sending. Hormuud generally expects numbers
 * without a leading "+" (e.g. "6XXXXXXXX" or "252XXXXXXXXX" depending on
 * your account setup). We just strip spaces, dashes, and a leading "+".
 * Adjust this if Hormuud tells you they need a specific format for you.
 */
function cleanPhone(raw) {
  if (!raw) return null;
  const cleaned = String(raw).trim().replace(/[\s-]/g, "").replace(/^\+/, "");
  return cleaned || null;
}

/**
 * Pulls the target phone numbers from Firestore based on the audience
 * the admin picked in the dashboard.
 *
 * audience:
 *   "all_parents"          -> every unique parentPhone in "students"
 *   "all_teachers"         -> every teacher's phone in "teachers"
 *   "one_teacher"          -> a single teacher, needs targetId (doc id)
 *   "all_students"         -> every studentPhone in "students"
 *   "one_student"          -> a single student, needs targetId (doc id)
 */
async function resolveRecipients(audience, targetId) {
  const recipients = []; // { phone, label }

  if (audience === "all_parents") {
    const snap = await db.collection("students").get();
    const seen = new Set();
    snap.forEach((doc) => {
      const d = doc.data();
      const phone = cleanPhone(d.parentPhone);
      if (phone && !seen.has(phone)) {
        seen.add(phone);
        recipients.push({ phone, label: `Parent of ${d.fullName || doc.id}` });
      }
    });
  }

  if (audience === "one_parent" && targetId) {
    const doc = await db.collection("students").doc(targetId).get();
    if (doc.exists) {
      const d = doc.data();
      const phone = cleanPhone(d.parentPhone);
      if (phone) recipients.push({ phone, label: `Parent of ${d.fullName || doc.id}` });
    }
  }

  if (audience === "all_teachers" || audience === "one_teacher") {
    const snap = audience === "one_teacher" && targetId
      ? [await db.collection("teachers").doc(targetId).get()]
      : (await db.collection("teachers").get()).docs;

    snap.forEach((doc) => {
      if (!doc.exists) return;
      const d = doc.data();
      const phone = cleanPhone(d.phone || d.teacherPhone || d.mobile);
      if (phone) recipients.push({ phone, label: d.fullName || doc.id });
    });
  }

  if (audience === "all_students" || audience === "one_student") {
    const snap = audience === "one_student" && targetId
      ? [await db.collection("students").doc(targetId).get()]
      : (await db.collection("students").get()).docs;

    snap.forEach((doc) => {
      if (!doc.exists) return;
      const d = doc.data();
      const phone = cleanPhone(d.studentPhone);
      if (phone) recipients.push({ phone, label: d.fullName || doc.id });
    });
  }

  // De-dupe by phone (in case the same number appears twice)
  const uniqueMap = new Map();
  recipients.forEach((r) => {
    if (!uniqueMap.has(r.phone)) uniqueMap.set(r.phone, r);
  });
  return Array.from(uniqueMap.values());
}

/**
 * Callable function: sendBulkSms
 *
 * Call this from the React dashboard with:
 *   const functions = getFunctions(app);
 *   const sendBulkSms = httpsCallable(functions, "sendBulkSms");
 *   await sendBulkSms({ audience: "all_parents", message: "..." });
 *
 * audience: "all_parents" | "one_parent" | "all_teachers" | "one_teacher" |
 *           "all_students" | "one_student"
 * targetId: Firestore doc id, required for "one_parent" (student's doc id),
 *           "one_teacher", and "one_student"
 * message:  the SMS text
 */
exports.sendBulkSms = onCall(
  {
    secrets: [HORMUUD_USERNAME, HORMUUD_PASSWORD, HORMUUD_SENDERID],
    region: "us-central1",
  },
  async (request) => {
    const { audience, targetId, message } = request.data || {};

    if (!audience) {
      throw new HttpsError("invalid-argument", "Fadlan dooro audience-ka (parents/teachers/students).");
    }
    if (!message || !message.trim()) {
      throw new HttpsError("invalid-argument", "Fariinta (message) waa faaruq.");
    }

    // OPTIONAL BUT RECOMMENDED: only allow logged-in admins to trigger this.
    // Uncomment once you set custom claims / rules for your admin accounts.
    // if (!request.auth) {
    //   throw new HttpsError("unauthenticated", "Waa in aad login gasho si aad SMS u dirto.");
    // }

    const recipients = await resolveRecipients(audience, targetId);

    if (recipients.length === 0) {
      throw new HttpsError(
        "not-found",
        "Lambar telefoon lama helin dadka la doortay (hubi in Firestore uu leeyahay taleefanno sax ah)."
      );
    }

    const token = await getHormuudToken(
      HORMUUD_USERNAME.value(),
      HORMUUD_PASSWORD.value()
    );
    const senderid = HORMUUD_SENDERID.value();

    // Send sequentially with a small stagger so we don't hammer the API.
    const results = [];
    for (const r of recipients) {
      // eslint-disable-next-line no-await-in-loop
      const result = await sendOneSms(token, r.phone, message.trim(), senderid);
      results.push({ ...result, label: r.label });
    }

    const successCount = results.filter((r) => r.success).length;
    const failCount = results.length - successCount;

    return {
      total: results.length,
      successCount,
      failCount,
      results,
    };
  }
);

/**
 * If you already have a functions/index.js with other exports, instead of
 * replacing it, just add near the top:
 *
 *   const { sendBulkSms } = require("./sendSms");
 *   exports.sendBulkSms = sendBulkSms;
 *
 * and save this whole file as functions/sendSms.js
 */