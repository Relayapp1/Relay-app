import { supabase } from '@/api/supabaseClient';

// Uploads to a private bucket and returns a "{bucket}/{path}" reference —
// stored verbatim in the same DB fields base44's opaque file_uri occupied.
export async function uploadPrivateFile(bucket, path, file) {
  const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: true });
  if (error) throw error;
  return `${bucket}/${path}`;
}

export async function createSignedUrl(fileRef, expiresIn = 3600) {
  const [bucket, ...rest] = fileRef.split('/');
  const path = rest.join('/');
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresIn);
  if (error) throw error;
  return data.signedUrl;
}
