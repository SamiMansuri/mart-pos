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
  pgm.createTable('supplier_product_mappings', {
    id: 'id',
    supplier_id: {
      type: 'integer',
      notNull: true,
      references: 'suppliers',
      onDelete: 'CASCADE',
    },
    vendor_product_name: {
      type: 'varchar(255)',
      notNull: true,
    },
    system_product_id: {
      type: 'integer',
      notNull: true,
      references: 'products',
      onDelete: 'CASCADE',
    },
    created_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('now()'),
    },
    updated_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('now()'),
    },
  });

  pgm.createIndex('supplier_product_mappings', ['supplier_id', 'vendor_product_name'], {
    unique: true,
    name: 'unique_supplier_vendor_product_idx',
  });

  pgm.createIndex('supplier_product_mappings', 'system_product_id');
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const down = (pgm) => {
  pgm.dropTable('supplier_product_mappings');
};
