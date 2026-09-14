import { createClientFromRequest } from "npm:@base44/sdk";

const hex = (bytes: Uint8Array) => Array.from(bytes).map((value) => value.toString(16).padStart(2, "0")).join("");

const sha256 = async (value: string) => {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return hex(new Uint8Array(digest));
};

Deno.serve(async (req) => {
  if (req.method !== "POST") return Response.json({ error: "Method not allowed" }, { status: 405 });

  try {
    const { token } = await req.json();
    if (typeof token !== "string" || !/^[a-f0-9]{64}$/.test(token)) {
      return Response.json({ error: "This verification link is invalid." }, { status: 400 });
    }

    const base44 = createClientFromRequest(req);
    const tokenHash = await sha256(token);
    const matches = await base44.asServiceRole.entities.EmailVerification.filter(
      { token_hash: tokenHash },
      "-created_date",
      1
    );
    const record = matches[0];

    if (!record || record.used_at) {
      return Response.json({ error: "This verification link is invalid or has already been used." }, { status: 400 });
    }
    if (new Date(record.expires_at).getTime() <= Date.now()) {
      return Response.json({ error: "This verification link has expired. Request a new one from your profile." }, { status: 400 });
    }

    const verifiedAt = new Date().toISOString();
    await base44.asServiceRole.entities.User.update(record.user_id, {
      email_link_verified: true,
      email_link_verified_at: verifiedAt
    });
    await base44.asServiceRole.entities.EmailVerification.update(record.id, { used_at: verifiedAt });

    return Response.json({ success: true, email: record.email });
  } catch (error) {
    console.error("confirm-email-verification", error);
    return Response.json({ error: "We could not verify this email link." }, { status: 500 });
  }
});
