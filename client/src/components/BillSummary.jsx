import { useEffect, useState } from "react";

/**
 * BillSummary: compact, structured right-hand panel for the Cashier page.
 *
 * Layout (top to bottom)
 *   1. Customer row            (fixed)
 *   2. Totals                  (items, subtotal, round off, then Total Payable)
 *   3. Payment                 (credit toggle, method, cash received/change, phone)
 *   4. Actions                 (pinned to the bottom, never scrolls away)
 *
 * Only section 2-3 scroll if the screen is short. Section 1 and 4 stay put.
 *
 * Props
 *  - customerSlot: your existing customer Autocomplete + add button, rendered as-is
 *  - totalItems, subtotal, roundAdjust, total: numbers
 *  - onRoundAdjustChange(value)
 *  - isCredit, onCreditChange(bool)
 *  - method: "CASH" | "UPI", onMethodChange(m)
 *  - phone, onPhoneChange(str)
 *  - hasCart: boolean (cart has at least one line)
 *  - onCheckout({ print: boolean, cashReceived: number | null })
 */

const fmt = (n) =>
  "₹" + Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function BillSummary({
  customerSlot,
  selectedCustomer = null,
  totalItems = 0,
  subtotal = 0,
  roundAdjust = 0,
  onRoundAdjustChange,
  total = 0,
  isCredit = false,
  onCreditChange,
  paidAmount = "",
  onPaidAmountChange,
  method = "CASH",
  onMethodChange,
  phone = "",
  onPhoneChange,
  hasCart = false,
  onCheckout,
}) {
  const [received, setReceived] = useState("");

  // New total means the old tendered amount no longer applies.
  useEffect(() => setReceived(""), [total]);

  const showCash = !isCredit && method === "CASH";
  const receivedNum = parseFloat(received);
  const change = isFinite(receivedNum) ? receivedNum - total : null;

  const canSubmit =
    hasCart &&
    (!showCash || change === null || change >= 0) &&
    (!isCredit || Boolean(selectedCustomer));

  const quick = [100, 200, 500, 2000];

  function submit(print) {
    onCheckout?.({ print, cashReceived: showCash && isFinite(receivedNum) ? receivedNum : null });
  }

  return (
    <aside className="bs" aria-label="Bill summary">
      <style>{css}</style>

      {/* 1. Customer */}
      <header className="bs-top">
        <h2 className="bs-h">Bill summary</h2>
        <div className="bs-customer">{customerSlot}</div>
      </header>

      <div className="bs-scroll">
        {/* 2. Totals */}
        <section className="bs-totals" aria-label="Totals">
          <dl className="bs-rows">
            <div className="bs-row">
              <dt>Items</dt>
              <dd>{totalItems}</dd>
            </div>
            <div className="bs-row">
              <dt>Subtotal</dt>
              <dd>{fmt(subtotal)}</dd>
            </div>
            <div className="bs-row">
              <dt>
                <label htmlFor="bs-round">Round off</label>
              </dt>
              <dd>
                <input
                  id="bs-round"
                  className="bs-round"
                  inputMode="decimal"
                  value={roundAdjust}
                  onChange={(e) => onRoundAdjustChange?.(e.target.value)}
                />
              </dd>
            </div>
            <div className="bs-row bs-row-total" aria-live="polite">
              <dt>Total payable</dt>
              <dd>{fmt(total)}</dd>
            </div>
          </dl>
        </section>

        {/* 3. Payment */}
        <section className="bs-pay" aria-label="Payment">
          <div className="bs-credit">
            <label className="bs-switch-wrap" htmlFor="bs-credit-toggle">
              <input
                id="bs-credit-toggle"
                type="checkbox"
                role="switch"
                checked={isCredit}
                onChange={(e) => onCreditChange?.(e.target.checked)}
              />
              <span className="bs-switch" aria-hidden="true" />
            </label>
            <span>Credit bill</span>
            {isCredit && <em className="bs-note">Pay later, customer needed</em>}
          </div>

          {isCredit && (
            <div className="bs-credit-box">
              {!selectedCustomer ? (
                <p className="bs-credit-warn">Please select a customer above</p>
              ) : (
                <>
                  <div className="bs-credit-row">
                    <span className="bs-credit-label">Current Due</span>
                    <strong className="bs-credit-due">
                      {fmt(selectedCustomer.total_due || 0)}
                    </strong>
                  </div>
                  <div className="bs-credit-row">
                    <span className="bs-credit-label">Credit Limit</span>
                    <strong>
                      {parseFloat(selectedCustomer.credit_limit || 0) === 0
                        ? "No Limit"
                        : fmt(selectedCustomer.credit_limit)}
                    </strong>
                  </div>
                  <div className="bs-credit-line">
                    <label htmlFor="bs-paid">Paid at counter</label>
                    <div className="bs-input-curr">
                      <span>₹</span>
                      <input
                        id="bs-paid"
                        className="bs-credit-input"
                        inputMode="decimal"
                        placeholder="0"
                        value={paidAmount}
                        onChange={(e) => /^\d*\.?\d{0,2}$/.test(e.target.value) && onPaidAmountChange?.(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="bs-credit-amount">
                    <span>Credit amount</span>
                    <strong>{fmt(Math.max(0, total - Number(paidAmount || 0)))}</strong>
                  </div>
                </>
              )}
            </div>
          )}

          {!isCredit && (
            <div className="bs-seg" role="group" aria-label="Payment method">
              {["CASH", "UPI"].map((m) => (
                <button key={m} className={m === method ? "on" : ""} aria-pressed={m === method} onClick={() => onMethodChange?.(m)}>
                  {m === "CASH" ? "Cash" : "UPI"}
                </button>
              ))}
            </div>
          )}

          {showCash && (
            <div className="bs-cash">
              <div className="bs-cash-line">
                <label htmlFor="bs-recv">Received</label>
                <input
                  id="bs-recv"
                  className="bs-recv"
                  inputMode="decimal"
                  placeholder="0"
                  value={received}
                  onChange={(e) => /^\d*\.?\d{0,2}$/.test(e.target.value) && setReceived(e.target.value)}
                />
              </div>
              <div className="bs-quick">
                {quick.map((q) => (
                  <button key={q} onClick={() => setReceived(String(q))}>
                    {q}
                  </button>
                ))}
                <button onClick={() => setReceived(String(total))}>Exact</button>
              </div>
              {change !== null && (
                <div className={"bs-change " + (change >= 0 ? "ok" : "short")}>
                  <span>{change >= 0 ? "Change to return" : "Short by"}</span>
                  <strong>{fmt(Math.abs(change))}</strong>
                </div>
              )}
            </div>
          )}

          <div className="bs-field">
            <label htmlFor="bs-phone">Customer phone (optional)</label>
            <input
              id="bs-phone"
              className="bs-input"
              inputMode="numeric"
              maxLength={15}
              placeholder="Customer mobile number"
              value={phone}
              onChange={(e) => onPhoneChange?.(e.target.value.replace(/\D/g, ""))}
            />
          </div>
        </section>
      </div>

      {/* 4. Actions (pinned) */}
      <footer className="bs-actions">
        <button className="bs-primary" disabled={!canSubmit} onClick={() => submit(true)}>
          Checkout &amp; print {fmt(total)}
        </button>
        <button className="bs-secondary" disabled={!canSubmit} onClick={() => submit(false)}>
          Save without printing
        </button>
      </footer>
    </aside>
  );
}

const css = `
.bs {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  color: #1f2d3d;
  font-family: inherit;
}
.bs-top {
  padding: 14px 16px 12px;
  border-bottom: 1px solid #f1f5f9;
}
.bs-h {
  margin: 0 0 10px;
  font-size: 15px;
  font-weight: 700;
  color: #1f2d3d;
  letter-spacing: -0.01em;
}
.bs-customer {
  display: flex;
  gap: 8px;
  align-items: center;
}
.bs-customer > :first-child {
  flex: 1;
  min-width: 0;
}

.bs-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 12px 16px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

/* Totals section */
.bs-totals {
  display: flex;
  flex-direction: column;
}
.bs-rows {
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.bs-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  min-height: 26px;
  font-size: 13.5px;
}
.bs-row dt {
  color: #64748b;
  font-weight: 500;
}
.bs-row dd {
  margin: 0;
  font-weight: 600;
  color: #1f2d3d;
  font-variant-numeric: tabular-nums;
}
.bs-round {
  width: 70px;
  height: 28px;
  text-align: right;
  padding: 2px 6px;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  font-weight: 600;
  font-size: 13.5px;
  background: #fff;
  color: #1f2d3d;
}

/* Compact Total Row */
.bs-row-total {
  border-top: 1px solid #e2e8f0;
  margin-top: 4px;
  padding-top: 8px;
  min-height: 36px;
  align-items: baseline;
}
.bs-row-total dt {
  font-size: 14.5px;
  font-weight: 700;
  color: #1f2d3d;
}
.bs-row-total dd {
  font-size: 24px;
  font-weight: 800;
  color: #1f2d3d;
  font-variant-numeric: tabular-nums;
}

/* Payment section */
.bs-pay {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding-top: 12px;
  border-top: 1px solid #f1f5f9;
}
.bs-credit {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13.5px;
  font-weight: 600;
  min-height: 28px;
  user-select: none;
}
.bs-switch-wrap {
  display: inline-flex;
  align-items: center;
  cursor: pointer;
  position: relative;
  line-height: 0;
}
.bs-credit input {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}
.bs-switch {
  width: 32px;
  height: 18px;
  border-radius: 999px;
  background: #cbd5e1;
  position: relative;
  flex: none;
  cursor: pointer;
  transition: background 0.15s ease;
}
.bs-switch::after {
  content: "";
  position: absolute;
  top: 2px;
  left: 2px;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #fff;
  transition: transform 0.15s ease;
}
.bs-credit input:checked + .bs-switch {
  background: #1f2d3d;
}
.bs-credit input:checked + .bs-switch::after {
  transform: translateX(14px);
}
.bs-credit input:focus-visible + .bs-switch {
  outline: 2px solid #1f2d3d;
  outline-offset: 2px;
}
.bs-note {
  font-style: normal;
  font-weight: 500;
  font-size: 12px;
  color: #94a3b8;
  margin-left: auto;
}

/* Credit info section */
.bs-credit-box {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 8px 0 2px;
  border-top: 1px dashed #e2e8f0;
  margin-top: 2px;
}
.bs-credit-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 13px;
}
.bs-credit-label {
  color: #64748b;
  font-weight: 500;
}
.bs-credit-row strong {
  font-variant-numeric: tabular-nums;
  font-weight: 600;
  color: #1f2d3d;
}
.bs-credit-due {
  color: #b91c1c !important;
}
.bs-credit-line {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-size: 13px;
}
.bs-credit-line label {
  color: #475569;
  font-weight: 500;
}
.bs-input-curr {
  display: flex;
  align-items: center;
  background: #fff;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  padding: 0 8px;
  height: 32px;
}
.bs-input-curr span {
  color: #64748b;
  font-weight: 600;
  font-size: 13px;
  margin-right: 4px;
}
.bs-credit-input {
  width: 80px;
  text-align: right;
  padding: 2px 0;
  border: none;
  font-weight: 600;
  font-size: 13.5px;
  outline: none;
  background: transparent;
  color: #1f2d3d;
}
.bs-credit-amount {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  padding-top: 6px;
  border-top: 1px solid #e2e8f0;
  font-size: 13px;
  font-weight: 600;
  color: #1f2d3d;
}
.bs-credit-amount strong {
  font-size: 15px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: #1f2d3d;
}
.bs-credit-warn {
  color: #b91c1c;
  font-size: 12px;
  font-weight: 500;
  text-align: center;
  margin: 0;
  padding: 4px 0;
}

/* Payment method toggle */
.bs-seg {
  display: grid;
  grid-template-columns: 1fr 1fr;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  overflow: hidden;
  background: #f8fafc;
  padding: 2px;
  gap: 2px;
}
.bs-seg button {
  height: 32px;
  border: 0;
  background: transparent;
  font-weight: 600;
  font-size: 13px;
  color: #64748b;
  cursor: pointer;
  border-radius: 6px;
  transition: all 0.15s ease;
}
.bs-seg button.on {
  background: #1f2d3d;
  color: #ffffff;
  font-weight: 700;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}

/* Cash received section */
.bs-cash {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.bs-cash-line {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  font-size: 13.5px;
  color: #475569;
}
.bs-cash-line label {
  font-weight: 500;
}
.bs-recv {
  width: 110px;
  height: 32px;
  text-align: right;
  padding: 4px 8px;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 700;
  background: #fff;
  color: #1f2d3d;
}
.bs-quick {
  display: flex;
  gap: 5px;
}
.bs-quick button {
  flex: 1;
  height: 28px;
  border: 1px solid #e2e8f0;
  background: #f8fafc;
  border-radius: 6px;
  font-size: 11.5px;
  font-weight: 600;
  color: #475569;
  cursor: pointer;
  transition: all 0.15s ease;
}
.bs-quick button:hover {
  border-color: #1f2d3d;
  color: #1f2d3d;
  background: #f1f5f9;
}
.bs-change {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  padding: 6px 10px;
  border-radius: 8px;
  font-size: 12.5px;
  font-weight: 600;
}
.bs-change strong {
  font-size: 16px;
  font-variant-numeric: tabular-nums;
}
.bs-change.ok {
  background: #f0fdf4;
  color: #166534;
  border: 1px solid #bbf7d0;
}
.bs-change.short {
  background: #fef2f2;
  color: #991b1b;
  border: 1px solid #fecaca;
}

/* Phone input field */
.bs-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.bs-field label {
  font-size: 12px;
  font-weight: 600;
  color: #64748b;
}
.bs-input {
  height: 36px;
  padding: 0 10px;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  font-size: 14px;
  background: #fff;
  color: #1f2d3d;
}
.bs-input.bad {
  border-color: #b91c1c;
}
.bs-err {
  font-size: 11.5px;
  color: #b91c1c;
  font-weight: 500;
}

/* Actions footer */
.bs-actions {
  padding: 12px 16px 14px;
  border-top: 1px solid #f1f5f9;
  display: flex;
  flex-direction: column;
  gap: 6px;
  background: #fff;
  border-radius: 0 0 12px 12px;
}
.bs-primary {
  height: 44px;
  border: 0;
  border-radius: 8px;
  background: #1f2d3d;
  color: #fff;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.15s ease, opacity 0.15s ease;
  box-shadow: 0 1px 3px rgba(31, 45, 61, 0.12);
}
.bs-primary:hover:not(:disabled) {
  background: #2a3d52;
}
.bs-primary:disabled {
  background: #e2e8f0;
  color: #94a3b8;
  cursor: not-allowed;
  box-shadow: none;
}
.bs-secondary {
  height: 28px;
  border: 0;
  background: none;
  font-size: 12.5px;
  font-weight: 600;
  color: #64748b;
  cursor: pointer;
  transition: color 0.15s ease;
}
.bs-secondary:hover:not(:disabled) {
  color: #1f2d3d;
  text-decoration: underline;
}
.bs-secondary:disabled {
  color: #cbd5e1;
  cursor: not-allowed;
}

.bs button:focus-visible {
  outline: 2px solid #1f2d3d;
  outline-offset: 2px;
}

/* Remove raw outline from MUI inputs in customerSlot */
.bs-customer input,
.bs-customer input:focus,
.bs-customer input:focus-visible {
  outline: none !important;
}

/* Modern, smooth focus states for custom inputs without harsh rectangular outlines */
.bs-round:focus,
.bs-round:focus-visible,
.bs-recv:focus,
.bs-recv:focus-visible,
.bs-input:focus,
.bs-input:focus-visible {
  outline: none !important;
  border-color: #1f2d3d;
  box-shadow: 0 0 0 2px rgba(31, 45, 61, 0.15);
}

.bs-input-curr:focus-within {
  border-color: #1f2d3d;
  box-shadow: 0 0 0 2px rgba(31, 45, 61, 0.15);
}

.bs-credit-input:focus,
.bs-credit-input:focus-visible {
  outline: none !important;
}
`;
