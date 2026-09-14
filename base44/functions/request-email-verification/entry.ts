import { createClientFromRequest } from "npm:@base44/sdk";

const hex = (bytes: Uint8Array) => Array.from(bytes).map((value) => value.toString(16).padStart(2, "0")).join("");

const sha256 = async (value: string) => {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return hex(new Uint8Array(digest));
};

const safeOrigin = (req: Request) => {
  const value = req.headers.get("origin");
  if (!value) throw new Error("Missing app origin");
  const parsed = new URL(value);
  if (!["https:", "http:"].includes(parsed.protocol)) throw new Error("Invalid app origin");
  return parsed.origin;
};

Deno.serve(async (req) => {
  if (req.method !== "POST") return Response.json({ error: "Method not allowed" }, { status: 405 });

  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user?.id || !user?.email) return Response.json({ error: "Sign in required" }, { status: 401 });
    if (user.email_link_verified) return Response.json({ success: true, already_verified: true });

    const existing = await base44.asServiceRole.entities.EmailVerification.filter(
      { user_id: user.id },
      "-created_date",
      1
    );
    const latest = existing[0];
    if (latest && !latest.used_at && Date.now() - new Date(latest.created_date).getTime() < 60000) {
      return Response.json({ success: true, recently_sent: true });
    }

    const token = hex(crypto.getRandomValues(new Uint8Array(32)));
    const tokenHash = await sha256(token);
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    const origin = safeOrigin(req);

    await base44.asServiceRole.entities.EmailVerification.create({
      user_id: user.id,
      email: user.email,
      token_hash: tokenHash,
      expires_at: expiresAt
    });

    const link = `${origin}/verify-email?token=${encodeURIComponent(token)}`;
    await base44.integrations.Core.SendEmail({
      to: user.email,
      subject: "Verify your DriveBid email",
      from_name: "DriveBid",
      body: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:28px;color:#17243a">
        <h1 style="color:#10233f">Verify your email</h1>
        <p>Confirm that <strong>${user.email}</strong> belongs to you by selecting the button below.</p>
        <p style="margin:28px 0"><a href="${link}" style="background:#2563eb;color:white;text-decoration:none;padding:13px 20px;border-radius:9px;font-weight:bold">Verify email address</a></p>
        <p style="font-size:13px;color:#6b778c">This secure link expires in 30 minutes and can be used once. If you did not request it, you can ignore this email.</p>
      </div>`
    });

    return Response.json({ success: true });
  } catch (error) {
    console.error("request-email-verification", error);
    return Response.json({ error: error instanceof Error ? error.message : "Could not send verification email" }, { status: 500 });
  }
});
