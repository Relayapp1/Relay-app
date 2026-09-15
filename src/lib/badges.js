// Computes achievement badges from a driver's own stats (Driver entity fields).
// Pure and defensive — never throws on missing/partial data, since callers may
// pass a bid's denormalized stats instead of a full Driver record.
export function computeDriverBadges(stats) {
  const completed = Number(stats?.completed_deliveries ?? stats?.completed ?? 0);
  const rating = Number(stats?.rating ?? 5);
  const reviewCount = Number(stats?.review_count ?? 0);
  const onTime = Number(stats?.on_time_percentage ?? stats?.onTime ?? 100);
  const cancelled = Number(stats?.cancelled_trips ?? 0);

  const badges = [];

  if (completed >= 100) badges.push({ key: 'elite', label: 'Elite', emoji: '🏆' });
  else if (completed >= 50) badges.push({ key: 'pro', label: 'Pro', emoji: '⭐' });
  else if (completed >= 10) badges.push({ key: 'rising', label: 'Rising', emoji: '🚀' });

  if (rating >= 4.8 && reviewCount >= 5) badges.push({ key: 'top-rated', label: 'Top Rated', emoji: '🌟' });

  if (completed >= 5 && onTime >= 95) badges.push({ key: 'reliable', label: 'Reliable', emoji: '⏱️' });

  if (completed >= 5 && cancelled === 0) badges.push({ key: 'zero-cancellations', label: 'Zero Cancellations', emoji: '✅' });

  return badges;
}
