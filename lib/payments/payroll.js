export function groupPayroll(payouts, batchId) {
  const grouped = new Map();
  for (const row of payouts.filter((item) => item.batch_id === batchId)) {
    const bank = row.bank_snapshot || row.provider || {};
    const key = JSON.stringify([row.provider_profile_id, bank]);
    const item = grouped.get(key) || { providerId: row.provider_profile_id, bank, amount: 0, ids: [] };
    item.amount += Number(row.net_amount);
    item.ids.push(row.id);
    grouped.set(key, item);
  }
  return [...grouped.values()];
}

export function payrollCsv(rows) {
  const quote = (value) => {
    let text = String(value ?? '');
    if (/^[\s]*[=+@-]/.test(text)) text = `'${text}`;
    return `"${text.replace(/"/g, '""')}"`;
  };
  const header = ['Proveedor', 'RUT', 'Banco', 'Tipo cuenta', 'Numero cuenta', 'Email', 'Monto CLP', 'Liquidaciones'];
  return '\uFEFF' + [header, ...rows.map(({ bank, amount, ids }) => [bank.nombre_titular, bank.rut_titular,
    bank.banco, bank.tipo_cuenta, bank.numero_cuenta, bank.email_titular, amount, ids.join(',')])]
    .map((row) => row.map(quote).join(';')).join('\r\n');
}
