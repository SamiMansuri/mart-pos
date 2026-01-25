const Receipt = ({ billData }) => {
  if (!billData) return null;

  return (
    <div className="receipt-container">
      <div className="receipt-header">
        <h1>SUPER MART</h1>
        <p>123 Grocery Lane, Fresh City</p>
        <p>Phone: +91 98765 43210</p>
        <div className="divider">***************************</div>
      </div>

      <div className="bill-info">
        <p><strong>Bill ID:</strong> {billData.billId}</p>
        <p><strong>Date:</strong> {new Date(billData.createdAt).toLocaleString()}</p>
        <p><strong>Payment:</strong> {billData.paymentMethod}</p>
      </div>

      <div className="divider">---------------------------</div>

      <table className="receipt-table">
        <thead>
          <tr>
            <th align="left">Item</th>
            <th align="center">Qty</th>
            <th align="right">Price</th>
          </tr>
        </thead>
        <tbody>
          {billData.items.map(item => (
            <tr key={item.id}>
              <td>{item.name}</td>
              <td align="center">{item.qty}</td>
              <td align="right">₹{item.price * item.qty}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="divider">---------------------------</div>

      <div className="receipt-footer">
        <div className="total-row">
          <strong>TOTAL</strong>
          <strong>₹{billData.totalAmount}</strong>
        </div>
        <div className="divider">***************************</div>
        <p style={{ marginTop: '10px' }}>Thank you for shopping!</p>
        <p>Visit again!</p>
      </div>
    </div>
  );
};

export default Receipt;
