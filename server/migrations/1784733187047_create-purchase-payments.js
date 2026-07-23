/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
export const shorthands = undefined;

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const up = (pgm) => {
  pgm.createTable('purchase_payments', {
    id: 'id',
    purchase_id: {
      type: 'integer',
      notNull: true,
      references: 'purchases',
      onDelete: 'CASCADE',
    },
    amount: {
      type: 'numeric(12,2)',
      notNull: true,
      check: 'amount > 0',
    },
    recorded_by: {
      type: 'integer',
      notNull: true,
      references: 'users',
    },
    payer_name: {
      type: 'varchar(100)',
    },
    note: {
      type: 'text',
    },
    created_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('now()'),
    },
  });

  pgm.createIndex('purchase_payments', 'purchase_id');
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const down = (pgm) => {
  pgm.dropTable('purchase_payments');
};
