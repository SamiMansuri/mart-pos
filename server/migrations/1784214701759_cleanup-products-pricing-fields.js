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
  pgm.sql(`
    ALTER TABLE public.products
    DROP CONSTRAINT IF EXISTS products_pricing_type_check
  `)

  pgm.sql(`
    DROP INDEX IF EXISTS public.idx_products_pricing_type
  `)

  pgm.sql(`
    ALTER TABLE public.products
    drop column if exists pricing_type,
    drop column if exists unit
  `)

  pgm.sql(`
    alter table public.products
    alter column gst_rate set default null
  `)
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const down = (pgm) => {
  pgm.sql(`
    ALTER TABLE public.products
    ADD COLUMN pricing_type character varying(20) DEFAULT 'fixed'::character varying,
    ADD COLUMN unit character varying(10);
  `);

  pgm.sql(`
    ALTER TABLE public.products
    ADD CONSTRAINT products_pricing_type_check
    CHECK (((pricing_type)::text = ANY ((ARRAY['fixed'::character varying, 'per_unit'::character varying, 'per_weight'::character varying])::text[])));
  `);

  pgm.sql(`
    CREATE INDEX idx_products_pricing_type ON public.products USING btree (pricing_type);
  `);

  pgm.sql(`
    ALTER TABLE public.products
    ALTER COLUMN gst_rate SET DEFAULT 0;
  `);
};
