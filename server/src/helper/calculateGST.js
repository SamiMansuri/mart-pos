export const calculateGST = (lineTotal, gstRate) => {
  const rate = parseFloat(gstRate) || 0;
  if (rate === 0) {
    return {
      taxable_amount: lineTotal,
      gst_rate: 0,
      cgst_amount: 0,
      sgst_amount: 0,
    };
  }
  const taxable_amount = lineTotal / (1 + rate / 100);
  const gst_amount = lineTotal - taxable_amount;
  return {
    taxable_amount: parseFloat(taxable_amount.toFixed(2)),
    gst_rate: rate,
    cgst_amount: parseFloat((gst_amount / 2).toFixed(2)),
    sgst_amount: parseFloat((gst_amount / 2).toFixed(2)),
  };
};