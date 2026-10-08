const { onRequest } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { Resend } = require("resend");

// Initialize the Firebase Admin SDK (Bypasses firestore.rules completely)
admin.initializeApp();
const db = admin.firestore();

// Initialize the Resend SDK with your API Key
const resend = new Resend("YOUR_RESEND_API_KEY_HERE");

exports.recoverUserAccount = onRequest({ cors: true }, async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: "Email address is required." });
    }

    // 1. Look up the 12-character ID from your protected collection mapping
    // This matches your layout pattern: public/user_emails
    const emailRef = db.collection("public").doc("user_emails");
    const doc = await emailRef.get();

    if (!doc.exists) {
      return res.status(404).json({ error: "No email mappings found." });
    }

    const emailMappingData = doc.data();
    
    // Find the 12-char key where the value matches the requested email address
    const userId = Object.keys(emailMappingData).find(key => emailMappingData[key] === email);

    if (!userId) {
      return res.status(404).json({ error: "This email is not bound to any ID." });
    }

    // 2. Send the ID to the user using Resend
    const { data, error } = await resend.emails.send({
      from: "Nachbarschafts-Werkzeugkiste <onboarding@resend.dev>", // Or your custom verified domain
      to: [email],
      subject: "Your Neighborhood Account Recovery",
      html: `<p>Hello Neighbor,</p>
             <p>You requested a recovery code for your account.</p>
             <p>Your unique 12-character Access ID is: <strong>${userId}</strong></p>
             <p>Use this ID to log back into the tool sharing portal.</p>`
    });

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({ success: true, message: "Recovery email sent successfully!" });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});
