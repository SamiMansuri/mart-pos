const normalizeItems = (items) => {
  const map = new Map();

  for (const item of items) {
    if (!map.has(item.product_id)) {
      map.set(item.product_id, {
        product_id: item.product_id,
        quantity: 0,
      });
    }

    map.get(item.product_id).quantity += item.quantity;
  }

  return Array.from(map.values());
};

export default normalizeItems;
