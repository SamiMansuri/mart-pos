/**
 * Service to handle printing operations
 */

export const printStatement = async (customer) => {
  const today = new Date();
  const day = today.getDate().toString().padStart(2, '0');
  const month = today.toLocaleString('default', { month: 'short' });
  const year = today.getFullYear();
  const formattedDate = `${day} ${month} ${year}`; // Result like "13 Mar 2026"

  const payload = {
    statement: {
      name: customer.name,
      phone: customer.phone || null,
      total_due: parseFloat(customer.total_due || 0),
      date: formattedDate
    }
  };

  try {
    const response = await fetch('http://localhost:5000/print-statement', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to print statement');
    }

    return await response.json();
  } catch (error) {
    console.error('Print Statement Error:', error);
    throw error;
  }
};

export const printBarcodeLabel = async (product, quantity) => {
  const payload = {
    label: {
      product_name: product.name,
      mrp: product.mrp ? String(product.mrp) : "0",
      price: product.selling_price ? String(product.selling_price) : "0",
      barcode: product.barcode || "",
      quantity: quantity
    }
  };

  try {
    const response = await fetch('http://localhost:5000/print-barcode-label', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to print barcode label');
    }

    return await response.json();
  } catch (error) {
    console.error('Print Barcode Error:', error);
    throw error;
  }
};
