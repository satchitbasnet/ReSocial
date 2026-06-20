import { Resend } from "resend";

let client: Resend | null = null;

export function getResend(): Resend {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not set");
  }

  if (!client) {
    client = new Resend(apiKey);
  }

  return client;
}

export function isResendConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

export interface SendEmailOptions {
  from?: string;
  to: string | string[];
  subject: string;
  html: string;
}

/** Default from address — use onboarding@resend.dev while testing without a verified domain. */
export function getDefaultFromEmail(): string {
  return process.env.REPORT_FROM_EMAIL ?? "ReSocial <onboarding@resend.dev>";
}

export async function sendEmail({
  from,
  to,
  subject,
  html,
}: SendEmailOptions): Promise<boolean> {
  if (!isResendConfigured()) {
    console.warn("[Resend] RESEND_API_KEY not set — skipping email send");
    return false;
  }

  try {
    const resend = getResend();
    const { error } = await resend.emails.send({
      from: from ?? getDefaultFromEmail(),
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
    });

    if (error) {
      console.error("[Resend] send error:", error);
      return false;
    }

    return true;
  } catch (err) {
    console.error("[Resend] send failed:", err);
    return false;
  }
}
