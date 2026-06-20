import { config } from "dotenv";
import { Resend } from "resend";

config({ path: ".env.local" });

const apiKey = process.env.RESEND_API_KEY;
if (!apiKey || apiKey === "re_xxxxxxxxx") {
  console.error(
    "Set RESEND_API_KEY in .env.local (replace re_xxxxxxxxx with your real key from resend.com/api-keys)"
  );
  process.exit(1);
}

const resend = new Resend(apiKey);
const to = process.env.RESEND_TEST_TO ?? "satchitbasnet01@gmail.com";

const { data, error } = await resend.emails.send({
  from: process.env.REPORT_FROM_EMAIL ?? "onboarding@resend.dev",
  to,
  subject: "Hello World",
  html: "<p>Congrats on sending your <strong>first email</strong>!</p>",
});

if (error) {
  console.error("Failed:", error);
  process.exit(1);
}

console.log("Sent:", data);
