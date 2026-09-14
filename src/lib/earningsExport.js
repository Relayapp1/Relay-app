const csvCell = (value) => {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

const csvRow = (cells) => cells.map(csvCell).join(',') + '\r\n';

export function buildTripStatementCsv(trips, expenses, isPoster) {
  const rows = [csvRow(['Date completed', 'Year', isPoster ? 'Driver' : 'Broker', 'Vehicle', 'Route', 'Hours', 'Rate ($/hr)', 'Labor', 'Expenses', 'Tip', 'Total', 'Payment status'])];
  const completed = (trips || []).filter((t) => t.status === 'completed').sort((a, b) => new Date(a.completed_at || a.created_date) - new Date(b.completed_at || b.created_date));
  for (const trip of completed) {
    const date = trip.completed_at || trip.created_date;
    const year = date ? new Date(date).getFullYear() : '';
    const hours = Number(trip.tracked_minutes || 0) / 60;
    const rate = Number(trip.accepted_rate || 0);
    const labor = rate * hours;
    const expenseTotal = (expenses || []).filter((x) => x.trip_id === trip.id && x.status !== 'rejected').reduce((sum, x) => sum + Number(x.amount || 0), 0);
    const tip = Number(trip.tip_amount || 0);
    const total = labor + expenseTotal + tip;
    rows.push(csvRow([
      date ? new Date(date).toLocaleDateString() : '',
      year,
      isPoster ? (trip.driver_name || '') : (trip.broker_name || ''),
      trip.vehicle_info || '',
      `${trip.pickup_location || ''} -> ${trip.delivery_location || ''}`,
      hours.toFixed(2),
      rate.toFixed(2),
      labor.toFixed(2),
      expenseTotal.toFixed(2),
      tip.toFixed(2),
      total.toFixed(2),
      trip.payment_status || ''
    ]));
  }
  return rows.join('');
}

export function downloadCsv(filename, csvContent) {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
