"use strict";

const ADMIN_CONTACT_EMAIL = "ghulam.ay.ahmad@gmail.com";
const CONTACT_FROM_EMAIL = "Nachbarschafts-Werkzeugkiste <onboarding@resend.dev>";
const FIREBASE_PROJECT_ID = "nachbarschafts-werkzeugkiste";
const FIREBASE_APP_ID = "nachbarschafts-werkzeugkiste-default";
const ALLOWED_ORIGINS = new Set([
  "https://nachbarschafts-werkzeugkiste.web.app",
  "https://nachbarschafts-werkzeugkiste.firebaseapp.com",
  "https://akprj.github.io",
  "http://localhost:3000",
  "http://127.0.0.1:3000"
]);

function jsonResponse(body, status, origin) {
  const headers = new Headers({
    "Content-Type": "application/json; charset=utf-8",
    "Vary": "Origin"
  });
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    headers.set("Access-Control-Allow-Headers", "Authorization, Content-Type");
    headers.set("Access-Control-Max-Age", "86400");
  }
  return new Response(JSON.stringify(body), { status, headers });
}

async function logResendRejection(label, response) {
  let providerError;
  try {
    providerError = await response.json();
  } catch (error) {
    console.error(`${label}: could not read Resend error response:`, error);
    return;
  }
  console.error(label, {
    status: response.status,
    error: providerError
  });
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin");
    if (!origin || !ALLOWED_ORIGINS.has(origin)) {
      return jsonResponse({ error: "Origin not allowed." }, 403, null);
    }

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": origin,
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Authorization, Content-Type",
          "Access-Control-Max-Age": "86400",
          "Vary": "Origin"
        }
      });
    }

    if (request.method !== "POST") {
      return jsonResponse({ error: "Method not allowed." }, 405, origin);
    }

    const clientIp = request.headers.get("CF-Connecting-IP");
    if (!clientIp) {
      return jsonResponse({ error: "Request source unavailable." }, 400, origin);
    }
    const rateLimit = await env.CONTACT_RATE_LIMITER.limit({
      key: `${new URL(request.url).pathname}:${clientIp}`
    });
    if (!rateLimit.success) {
      return jsonResponse({ error: "Too many requests." }, 429, origin);
    }

    if (!request.headers.get("Content-Type")?.startsWith("application/json")) {
      return jsonResponse({ error: "Expected JSON." }, 415, origin);
    }

    let data;
    try {
      data = await request.json();
    } catch {
      return jsonResponse({ error: "Invalid JSON." }, 400, origin);
    }

    if (new URL(request.url).pathname === "/notify-pending-listing") {
      return notifyPendingListing(request, env, data, origin);
    }

    const fullName = typeof data.fullName === "string" ? data.fullName.trim() : "";
    const email = typeof data.email === "string" ? data.email.trim() : "";
    const details = typeof data.details === "string" ? data.details.trim() : "";
    if (!fullName || fullName.length > 120) {
      return jsonResponse({ error: "Invalid name." }, 400, origin);
    }
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return jsonResponse({ error: "Invalid email address." }, 400, origin);
    }
    if (!details || details.length > 5000) {
      return jsonResponse({ error: "Invalid message details." }, 400, origin);
    }

    let resendResponse;
    try {
      resendResponse = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.RESEND_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          from: CONTACT_FROM_EMAIL,
          to: [ADMIN_CONTACT_EMAIL],
          reply_to: email,
          subject: `Hallo Admin, ${fullName} hat Ihnen eine Nachricht geschickt`,
          text: `Name: ${fullName}\nE-Mail: ${email}\n\nNachricht:\n${details}`
        })
      });
    } catch (error) {
      console.error("Resend request failed:", error);
      return jsonResponse({ error: "Email provider unavailable." }, 503, origin);
    }

    if (!resendResponse.ok) {
      await logResendRejection("Resend rejected contact email:", resendResponse);
      return jsonResponse({ error: "Email provider rejected the message." }, 502, origin);
    }

    return jsonResponse({ success: true }, 200, origin);
  }
};

async function notifyPendingListing(request, env, data, origin) {
  const itemId = typeof data.itemId === "string" ? data.itemId.trim() : "";
  const title = typeof data.title === "string" ? data.title.trim() : "";
  const category = typeof data.category === "string" ? data.category.trim() : "";
  const type = typeof data.type === "string" ? data.type.trim() : "";
  const details = typeof data.details === "string" ? data.details.trim() : "";
  const ownerName = typeof data.ownerName === "string" ? data.ownerName.trim() : "";
  const ownerEmail = typeof data.ownerEmail === "string" ? data.ownerEmail.trim() : "";

  if (!itemId || !title || !category || !type || !ownerName) {
    return jsonResponse({ error: "Missing listing details." }, 400, origin);
  }
  if (!env.RESEND_API_KEY) {
    console.error("RESEND_API_KEY is not configured for listing notifications.");
    return jsonResponse({ error: "Listing notification service is not configured." }, 503, origin);
  }

  let resendResponse;
  try {
    resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: CONTACT_FROM_EMAIL,
        to: [ADMIN_CONTACT_EMAIL],
        reply_to: ownerEmail || ADMIN_CONTACT_EMAIL,
        subject: `Neues Angebot wartet auf Freigabe: ${title}`,
        text: [
          `Besitzer: ${ownerName}`,
          ownerEmail ? `E-Mail: ${ownerEmail}` : "",
          `Eintrag: ${title}`,
          `Kategorie: ${category}`,
          `Art: ${type}`,
          "",
          "Beschreibung:",
          details || "Keine Beschreibung angegeben.",
          "",
          `Eintrags-ID: ${itemId}`
        ].filter(Boolean).join("\n")
      })
    });
  } catch (error) {
    console.error("Resend listing notification request failed:", error);
    return jsonResponse({ error: "Email provider unavailable." }, 503, origin);
  }

  if (!resendResponse.ok) {
    await logResendRejection("Resend rejected listing notification:", resendResponse);
    return jsonResponse({ error: "Email provider rejected the notification." }, 502, origin);
  }

  return jsonResponse({ success: true }, 200, origin);
}
