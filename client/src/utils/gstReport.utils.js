/**
 * Utility helpers for GST Summary Report
 */

/**
 * Format Date object to local YYYY-MM-DD string without timezone shifting
 * @param {Date|string} date
 * @returns {string} YYYY-MM-DD
 */
export const formatLocalDate = (date) => {
  const d = date instanceof Date ? date : new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Format numbers with Indian Rupee symbol and en-IN thousand grouping
 * Always maintains 2 decimals. Supports negative flag for deductions/returns.
 * @param {number|string} val
 * @param {boolean} isNegative
 * @returns {string} e.g. "₹13,67,293.15" or "-₹19,438.05"
 */
export const formatINR = (val, isNegative = false) => {
  const num = Number(val) || 0;
  const abs = Math.abs(num);
  const formatted = abs.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  if ((num < 0 || isNegative) && abs > 0) {
    return `-₹${formatted}`;
  }
  return `₹${formatted}`;
};

/**
 * Display GST rate with "0% / Nil" format
 * @param {number|string} rate
 * @returns {string} e.g. "0% / Nil", "5%", "18%"
 */
export const formatRate = (rate) => {
  const num = Number(rate) || 0;
  if (num === 0) return '0% / Nil';
  return `${num}%`;
};

/**
 * Calculate preset date ranges based on Indian Calendar & Financial Year
 * FY runs April to March:
 * - Q1: Apr-Jun
 * - Q2: Jul-Sep
 * - Q3: Oct-Dec
 * - Q4: Jan-Mar
 * @param {Date} [now]
 * @returns {Record<string, { from: string, to: string }>}
 */
export const getPeriodPresets = (now = new Date()) => {
  const y = now.getFullYear();
  const m = now.getMonth(); // 0-indexed: 0 = Jan, 3 = Apr, etc.

  // This Month: 1st of current month to last day of current month
  const thisMonth = {
    from: formatLocalDate(new Date(y, m, 1)),
    to: formatLocalDate(new Date(y, m + 1, 0)),
  };

  // Last Month: 1st of prev month to last day of prev month
  const lastMonth = {
    from: formatLocalDate(new Date(y, m - 1, 1)),
    to: formatLocalDate(new Date(y, m, 0)),
  };

  // Quarters
  let thisQuarter, lastQuarter;
  if (m >= 3 && m <= 5) {
    // Q1 (Apr-Jun)
    thisQuarter = {
      from: formatLocalDate(new Date(y, 3, 1)),
      to: formatLocalDate(new Date(y, 5, 30)),
    };
    lastQuarter = {
      from: formatLocalDate(new Date(y, 0, 1)),
      to: formatLocalDate(new Date(y, 2, 31)),
    };
  } else if (m >= 6 && m <= 8) {
    // Q2 (Jul-Sep)
    thisQuarter = {
      from: formatLocalDate(new Date(y, 6, 1)),
      to: formatLocalDate(new Date(y, 8, 30)),
    };
    lastQuarter = {
      from: formatLocalDate(new Date(y, 3, 1)),
      to: formatLocalDate(new Date(y, 5, 30)),
    };
  } else if (m >= 9 && m <= 11) {
    // Q3 (Oct-Dec)
    thisQuarter = {
      from: formatLocalDate(new Date(y, 9, 1)),
      to: formatLocalDate(new Date(y, 11, 31)),
    };
    lastQuarter = {
      from: formatLocalDate(new Date(y, 6, 1)),
      to: formatLocalDate(new Date(y, 8, 30)),
    };
  } else {
    // Q4 (Jan-Mar)
    thisQuarter = {
      from: formatLocalDate(new Date(y, 0, 1)),
      to: formatLocalDate(new Date(y, 2, 31)),
    };
    lastQuarter = {
      from: formatLocalDate(new Date(y - 1, 9, 1)),
      to: formatLocalDate(new Date(y - 1, 11, 31)),
    };
  }

  // Indian Financial Year: Apr 1 of starting year to Mar 31 of following year
  const fyStartYear = m >= 3 ? y : y - 1;
  const thisFY = {
    from: formatLocalDate(new Date(fyStartYear, 3, 1)),
    to: formatLocalDate(new Date(fyStartYear + 1, 2, 31)),
  };

  return {
    'This month': thisMonth,
    'Last month': lastMonth,
    'This quarter': thisQuarter,
    'Last quarter': lastQuarter,
    'This financial year': thisFY,
  };
};

/**
 * Count unique purchase invoices by date + invoice_no + supplier
 * @param {Array} rows
 * @returns {number}
 */
export const countDistinctPurchaseInvoices = (rows = []) => {
  const set = new Set();
  for (const r of rows) {
    if (r) {
      set.add(`${r.date || ''}|${r.invoice_no || ''}|${r.supplier || ''}`);
    }
  }
  return set.size;
};
