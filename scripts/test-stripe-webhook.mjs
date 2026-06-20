import { config } from "dotenv";
import Stripe from "stripe";

config({ path: ".env.local" });

const secret = process.env.STRIPE_WEBHOOK_SECRET;
const key = process.env.STRIPE_SECRET_KEY;
const url = process.argv[2] ?? "http://localhost:3000/api/stripe/webhook";

if (!secret?.startsWith("whsec_")) {
  console.error("STRIPE_WEBHOOK_SECRET missing or invalid format");
  process.exit(1);
}

const stripe = new Stripe(key ?? "sk_test_placeholder");
const payload = JSON.stringify({
  id: "evt_test_webhook",
  object: "event",
  type: "checkout.session.completed",
  data: { object: { metadata: {} } },
});

const signature = stripe.webhooks.generateTestHeaderString({
  payload,
  secret,
});

const res = await fetch(url, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "stripe-signature": signature,
  },
  body: payload,
});

const text = await res.text();
console.log("status", res.status, text.slice(0, 200));
process.exit(res.ok ? 0 : 1);
