export const calculateGST = (totalAmount, gstRate) => {
  const rate = parseFloat(gstRate) || 0;
  if (rate === 0) {
    return {
      taxable_amount: totalAmount,
      gst_rate: 0,
      cgst_amount: 0,
      sgst_amount: 0,
    };
  }
  const taxable_amount = totalAmount / (1 + rate / 100);
  const gst_amount = totalAmount - taxable_amount;
  return {
    taxable_amount: parseFloat(taxable_amount.toFixed(2)),
    gst_rate: rate,
    cgst_amount: parseFloat((gst_amount / 2).toFixed(2)),
    sgst_amount: parseFloat((gst_amount / 2).toFixed(2)),
  };
};