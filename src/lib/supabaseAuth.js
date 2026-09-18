// Supabase Auth equivalents of the base44.auth.* surface this app used to
// call directly. Not a blind 1:1 shim — a few flows (OTP verification,
// password reset, change-password) work differently enough under Supabase
// that callers were rewritten to match, rather than papered over here.
import { supabase } from '@/api/supabaseClient';

// Merges the auth session with the profiles row into the single "user"
// shape every page already reads (user.id, user.account_type, user.role,
// etc.). email_link_verified/_at are derived from Supabase's own
// email_confirmed_at rather than stored as separate columns — see
// supabase/migrations/20260915000001_profiles.sql.
async function mergeUser(authUser) {
  if (!authUser) return null;
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', authUser.id)
    .single();
  if (error) throw error;
  return {
    ...profile,
    id: authUser.id,
    email: authUser.email,
    email_link_verified: Boolean(authUser.email_confirmed_at),
    email_link_verified_at: authUser.email_confirmed_at || null,
  };
}

export async function getCurrentUser() {
  const { data: { user: authUser }, error } = await supabase.auth.getUser();
  if (!authUser) {
    // AuthSessionMissingError just means no one is signed in yet — the
    // normal state for a fresh visitor, not a real failure. Normalize it
    // (and the plain-no-user case) to one sentinel so callers can tell it
    // apart from a genuine error (network, 5xx) without string-matching
    // Supabase's own error internals.
    if (error && error.name !== 'AuthSessionMissingError') throw error;
    throw new Error('Not authenticated');
  }
  return mergeUser(authUser);
}

export async function updateCurrentUser(patch) {
  const { data: { user: authUser }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !authUser) throw authErr || new Error('Not authenticated');
  const { error } = await supabase.from('profiles').update(patch).eq('id', authUser.id);
  if (error) throw error;
  return mergeUser(authUser);
}

export async function logout(returnTo) {
  await supabase.auth.signOut();
  if (returnTo) window.location.href = returnTo;
}

export function redirectToLogin(returnTo) {
  window.location.href = '/login' + (returnTo ? '?returnTo=' + encodeURIComponent(returnTo) : '');
}

export async function loginWithProvider(provider, returnTo) {
  const { error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: returnTo },
  });
  if (error) throw error;
}

export async function loginWithPassword(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return { user: await mergeUser(data.user) };
}

export async function signUp(email, password) {
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: window.location.origin + '/profile?onboarding=1' },
  });
  if (error) throw error;
}

export async function verifySignupOtp(email, otpCode) {
  const { error } = await supabase.auth.verifyOtp({ email, token: otpCode, type: 'signup' });
  if (error) throw error;
}

export async function resendSignupOtp(email) {
  const { error } = await supabase.auth.resend({ type: 'signup', email });
  if (error) throw error;
}

export async function changePassword(currentPassword, newPassword) {
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser?.email) throw new Error('Not authenticated');
  const { error: reauthError } = await supabase.auth.signInWithPassword({
    email: authUser.email,
    password: currentPassword,
  });
  if (reauthError) throw new Error('Current password is incorrect');
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
}

export async function requestPasswordReset(email) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin + '/reset-password',
  });
  if (error) throw error;
}

// Called on the /reset-password page after Supabase's recovery link has
// already established a session (see ResetPassword.jsx's onAuthStateChange
// listener) — no separate reset token to thread through manually.
export async function updatePassword(newPassword) {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
}
