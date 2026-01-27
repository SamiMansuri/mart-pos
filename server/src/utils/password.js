import bcrypt from "bcrypt";

const SALT_ROUNDS = 10;

export const hashPassword = (password) => {
  return bcrypt.hash(password, SALT_ROUNDS);
};

export const comparePassword = (password, hash) => {
  return bcrypt.compare(password, hash);
};
