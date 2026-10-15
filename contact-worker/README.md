# Admin contact email Worker

The Worker validates contact-form submissions, permits three submissions per
IP per minute, and sends accepted messages through Resend. The Resend key is
stored in Cloudflare Worker secrets, not in the website or repository.

## Deploy

Install Node.js, then use Wrangler from this directory:

```powershell
npx wrangler@latest login
npx wrangler@latest secret put RESEND_API_KEY
npx wrangler@latest deploy
```

When prompted for `RESEND_API_KEY`, paste a valid Resend API key into the
terminal prompt only. If an API key was ever pasted into chat or browser code,
revoke it in Resend and create a replacement first.

After deployment, Wrangler prints a URL similar to
`https://nachbarschafts-werkzeugkiste-contact.<account-subdomain>.workers.dev`.
Set that exact URL as `ADMIN_CONTACT_WORKER_URL` near the Firebase setup in
`index.html`, then deploy the website to Firebase Hosting:

```powershell
firebase deploy --only hosting --project nachbarschafts-werkzeugkiste
```

The Worker allows the Firebase Hosting origins and local Live Preview origins
listed in `src/index.js`. Add any custom website origin to `ALLOWED_ORIGINS`
before deploying if the site uses a custom domain.

## Resend sender restrictions

The Worker currently sends contact messages to `ghulam.ay.ahmad@gmail.com` and
uses Resend's `onboarding@resend.dev` test sender. Resend restricts this test
sender to the Resend account owner's email address, so delivery to this
recipient may be rejected unless it matches that account. For regular delivery,
verify a sender domain in Resend and change `CONTACT_FROM_EMAIL` in
`src/index.js` to an address on that domain.

The rate-limit binding in `wrangler.toml` uses namespace ID `20261015`. It must
be unique to this Worker within the Cloudflare account; change it if this ID is
already used by another rate-limit binding in that account.
