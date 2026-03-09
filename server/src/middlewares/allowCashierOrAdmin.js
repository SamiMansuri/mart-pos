export const allowCashierOrAdmin = (req, res, next) => {
  const role = req.user?.role;
  if (role !== "ADMIN" && role !== "CASHIER") {
    return res.status(403).json({ message: "Access denied" });
  }
  next();
};
