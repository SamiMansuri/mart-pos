/* eslint-disable camelcase */

export const shorthands = undefined;

export const up = (pgm) => {
  pgm.sql(`
    -- Extensions
    CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;
    CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;

    -- Standalone sequence (not app-managed per-campaign, this one is a real fixed sequence)
    CREATE SEQUENCE IF NOT EXISTS public.batch_seq
        START WITH 1
        INCREMENT BY 1
        NO MINVALUE
        NO MAXVALUE
        CACHE 1;

    -- bill_events
    CREATE TABLE public.bill_events (
        id integer NOT NULL,
        bill_id integer NOT NULL,
        event_type text NOT NULL,
        performed_by integer NOT NULL,
        reason text,
        metadata jsonb,
        created_at timestamp with time zone DEFAULT now()
    );

    CREATE SEQUENCE public.bill_events_id_seq
        AS integer
        START WITH 1
        INCREMENT BY 1
        NO MINVALUE
        NO MAXVALUE
        CACHE 1;

    ALTER SEQUENCE public.bill_events_id_seq OWNED BY public.bill_events.id;

    -- bill_items
    CREATE TABLE public.bill_items (
        id integer NOT NULL,
        bill_id integer NOT NULL,
        product_id integer NOT NULL,
        quantity numeric(10,2) NOT NULL,
        price numeric(10,2) NOT NULL,
        line_total numeric(10,2) NOT NULL,
        product_name character varying(255),
        batch_id integer,
        cost_price numeric(10,2) DEFAULT 0,
        mrp numeric(10,2),
        taxable_amount numeric(10,2) DEFAULT 0 NOT NULL,
        gst_rate numeric(5,2) DEFAULT 0 NOT NULL,
        cgst_amount numeric(10,2) DEFAULT 0 NOT NULL,
        sgst_amount numeric(10,2) DEFAULT 0 NOT NULL,
        CONSTRAINT bill_items_line_total_check CHECK ((line_total >= (0)::numeric)),
        CONSTRAINT bill_items_price_check CHECK ((price >= (0)::numeric)),
        CONSTRAINT bill_items_quantity_check CHECK ((quantity > (0)::numeric))
    );

    COMMENT ON COLUMN public.bill_items.quantity IS 'Quantity sold (supports decimals for weight-based items)';

    ALTER TABLE public.bill_items ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
        SEQUENCE NAME public.bill_items_id_seq
        START WITH 1
        INCREMENT BY 1
        NO MINVALUE
        NO MAXVALUE
        CACHE 1
    );

    -- bills
    CREATE TABLE public.bills (
        id integer NOT NULL,
        bill_number character varying(50) NOT NULL,
        total_amount numeric(12,2) NOT NULL,
        payment_method character varying(20) NOT NULL,
        created_at timestamp with time zone DEFAULT now(),
        idempotency_key character varying(100),
        voided_at timestamp with time zone,
        is_void boolean DEFAULT false,
        void_reason text,
        returned_amount numeric(10,2) DEFAULT 0,
        payment_status character varying(255),
        settled boolean DEFAULT false,
        settlement_id integer,
        return_status character varying(255) DEFAULT 'NONE'::character varying,
        void_by integer,
        created_by integer NOT NULL,
        refundable_amount numeric(12,2) GENERATED ALWAYS AS ((total_amount - returned_amount)) STORED,
        invoice_number character varying(20),
        business_date date,
        round_adjustment numeric(10,2) DEFAULT 0,
        sub_total numeric(10,2) DEFAULT 0,
        customer_id integer,
        paid_amount numeric(12,2) DEFAULT 0 NOT NULL,
        credit_amount numeric(12,2) GENERATED ALWAYS AS ((total_amount - paid_amount)) STORED,
        is_credit boolean DEFAULT false NOT NULL,
        CONSTRAINT bills_total_amount_check CHECK ((total_amount >= (0)::numeric)),
        CONSTRAINT payment_method_check CHECK (((payment_method)::text = ANY (ARRAY[('CASH'::character varying)::text, ('CARD'::character varying)::text, ('UPI'::character varying)::text])))
    );

    ALTER TABLE public.bills ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
        SEQUENCE NAME public.bills_id_seq
        START WITH 1
        INCREMENT BY 1
        NO MINVALUE
        NO MAXVALUE
        CACHE 1
    );

    -- brands
    CREATE TABLE public.brands (
        id integer NOT NULL,
        name character varying(100) NOT NULL,
        is_active boolean DEFAULT true NOT NULL,
        created_at timestamp without time zone DEFAULT now() NOT NULL,
        updated_at timestamp without time zone DEFAULT now() NOT NULL
    );

    CREATE SEQUENCE public.brands_id_seq
        AS integer
        START WITH 1
        INCREMENT BY 1
        NO MINVALUE
        NO MAXVALUE
        CACHE 1;

    ALTER SEQUENCE public.brands_id_seq OWNED BY public.brands.id;

    -- credit_payments
    CREATE TABLE public.credit_payments (
        id integer NOT NULL,
        customer_id integer NOT NULL,
        amount numeric(12,2) NOT NULL,
        note text,
        created_by integer NOT NULL,
        created_at timestamp with time zone DEFAULT now() NOT NULL,
        CONSTRAINT credit_payments_amount_check CHECK ((amount > (0)::numeric))
    );

    ALTER TABLE public.credit_payments ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
        SEQUENCE NAME public.credit_payments_id_seq
        START WITH 1
        INCREMENT BY 1
        NO MINVALUE
        NO MAXVALUE
        CACHE 1
    );

    -- customer_ledger
    CREATE TABLE public.customer_ledger (
        id integer NOT NULL,
        customer_id integer NOT NULL,
        type character varying(10) NOT NULL,
        amount numeric(12,2) NOT NULL,
        balance_after numeric(12,2) NOT NULL,
        reference_id integer NOT NULL,
        note text,
        created_at timestamp with time zone DEFAULT now() NOT NULL,
        created_by integer,
        CONSTRAINT customer_ledger_amount_check CHECK ((amount > (0)::numeric)),
        CONSTRAINT customer_ledger_type_check CHECK (((type)::text = ANY (ARRAY[('CREDIT'::character varying)::text, ('PAYMENT'::character varying)::text, ('RETURN'::character varying)::text, ('DEBIT'::character varying)::text])))
    );

    ALTER TABLE public.customer_ledger ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
        SEQUENCE NAME public.customer_ledger_id_seq
        START WITH 1
        INCREMENT BY 1
        NO MINVALUE
        NO MAXVALUE
        CACHE 1
    );

    -- customers
    CREATE TABLE public.customers (
        id integer NOT NULL,
        name character varying(100) NOT NULL,
        phone character varying(20),
        credit_limit numeric(12,2) DEFAULT 0 NOT NULL,
        total_due numeric(12,2) DEFAULT 0 NOT NULL,
        notes text,
        created_at timestamp with time zone DEFAULT now() NOT NULL,
        updated_at timestamp with time zone DEFAULT now() NOT NULL,
        created_by integer NOT NULL
    );

    ALTER TABLE public.customers ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
        SEQUENCE NAME public.customers_id_seq
        START WITH 1
        INCREMENT BY 1
        NO MINVALUE
        NO MAXVALUE
        CACHE 1
    );

    -- invoice_counters
    CREATE TABLE public.invoice_counters (
        business_date date NOT NULL,
        last_number integer DEFAULT 0 NOT NULL
    );

    -- logs
    CREATE TABLE public.logs (
        id uuid DEFAULT public.gen_random_uuid() NOT NULL,
        event_type character varying(50) NOT NULL,
        performed_by integer NOT NULL,
        entity_type character varying(50),
        entity_id integer,
        reason text,
        metadata jsonb,
        created_at timestamp with time zone DEFAULT now()
    );

    -- lucky_draw_campaigns
    CREATE TABLE public.lucky_draw_campaigns (
        id integer NOT NULL,
        name character varying(255) NOT NULL,
        prefix character varying(20) DEFAULT 'LD'::character varying NOT NULL,
        min_bill_amount numeric(10,2) DEFAULT 2500.00 NOT NULL,
        start_date date NOT NULL,
        draw_date date NOT NULL,
        status character varying(20) DEFAULT 'inactive'::character varying NOT NULL,
        created_at timestamp without time zone DEFAULT now() NOT NULL,
        updated_at timestamp without time zone DEFAULT now() NOT NULL,
        start_offset integer DEFAULT 1000 NOT NULL,
        CONSTRAINT lucky_draw_campaigns_status_check CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'inactive'::character varying, 'completed'::character varying])::text[])))
    );

    CREATE SEQUENCE public.lucky_draw_campaigns_id_seq
        AS integer
        START WITH 1
        INCREMENT BY 1
        NO MINVALUE
        NO MAXVALUE
        CACHE 1;

    ALTER SEQUENCE public.lucky_draw_campaigns_id_seq OWNED BY public.lucky_draw_campaigns.id;

    -- lucky_draw_entries
    CREATE TABLE public.lucky_draw_entries (
        id integer NOT NULL,
        ticket_number character varying(50) NOT NULL,
        campaign_id integer NOT NULL,
        bill_id integer,
        customer_phone character varying(20) NOT NULL,
        eligible_amount numeric(10,2) NOT NULL,
        created_at timestamp without time zone DEFAULT now() NOT NULL,
        bill_number character varying(80)
    );

    CREATE SEQUENCE public.lucky_draw_entries_id_seq
        AS integer
        START WITH 1
        INCREMENT BY 1
        NO MINVALUE
        NO MAXVALUE
        CACHE 1;

    ALTER SEQUENCE public.lucky_draw_entries_id_seq OWNED BY public.lucky_draw_entries.id;

    -- lucky_draw_excluded_products
    CREATE TABLE public.lucky_draw_excluded_products (
        id integer NOT NULL,
        campaign_id integer NOT NULL,
        product_id integer NOT NULL,
        created_at timestamp without time zone DEFAULT now() NOT NULL
    );

    CREATE SEQUENCE public.lucky_draw_excluded_products_id_seq
        AS integer
        START WITH 1
        INCREMENT BY 1
        NO MINVALUE
        NO MAXVALUE
        CACHE 1;

    ALTER SEQUENCE public.lucky_draw_excluded_products_id_seq OWNED BY public.lucky_draw_excluded_products.id;

    -- NOTE: lucky_draw_seq_N sequences (e.g. lucky_draw_seq_1, lucky_draw_seq_3) are
    -- created dynamically per campaign by application code at runtime.
    -- They are intentionally NOT part of this baseline.

    -- product_batches
    CREATE TABLE public.product_batches (
        id integer NOT NULL,
        product_id integer NOT NULL,
        batch_no character varying(255) NOT NULL,
        expiry_date date,
        quantity numeric(10,2) DEFAULT 0 NOT NULL,
        cost_price numeric(10,2) DEFAULT 0 NOT NULL,
        created_at timestamp without time zone DEFAULT now(),
        created_by integer,
        mrp numeric(10,2)
    );

    COMMENT ON COLUMN public.product_batches.quantity IS 'Quantity in stock (supports decimals for weight-based items)';

    CREATE SEQUENCE public.product_batches_id_seq
        AS integer
        START WITH 1
        INCREMENT BY 1
        NO MINVALUE
        NO MAXVALUE
        CACHE 1;

    ALTER SEQUENCE public.product_batches_id_seq OWNED BY public.product_batches.id;

    -- products
    CREATE TABLE public.products (
        id integer NOT NULL,
        name character varying(255) NOT NULL,
        barcode character varying(100),
        selling_price numeric(10,2) NOT NULL,
        stock_qty integer DEFAULT 0 NOT NULL,
        created_at timestamp without time zone DEFAULT now(),
        created_by integer NOT NULL,
        updated_by integer,
        updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
        is_active boolean DEFAULT true,
        brand_id integer,
        sale_type character varying(10) DEFAULT 'UNIT'::character varying NOT NULL,
        gst_rate numeric(5,2) DEFAULT NULL::numeric,
        hsn_code character varying(8) DEFAULT ''::character varying NOT NULL,
        CONSTRAINT products_sale_type_check CHECK (((sale_type)::text = ANY ((ARRAY['UNIT'::character varying, 'WEIGHT'::character varying])::text[]))),
        CONSTRAINT products_selling_price_check CHECK ((selling_price >= (0)::numeric)),
        CONSTRAINT products_stock_qty_check CHECK ((stock_qty >= 0))
    );

    ALTER TABLE public.products ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
        SEQUENCE NAME public.products_id_seq
        START WITH 1
        INCREMENT BY 1
        NO MINVALUE
        NO MAXVALUE
        CACHE 1
    );

    -- purchase_items
    CREATE TABLE public.purchase_items (
        id integer NOT NULL,
        purchase_id integer,
        product_id integer,
        batch_no character varying(255) NOT NULL,
        expiry_date date,
        qty numeric(10,3) NOT NULL,
        cost_price numeric(10,2) DEFAULT 0 NOT NULL,
        mrp numeric(10,2) DEFAULT 0 NOT NULL,
        taxable_amount numeric(10,2) DEFAULT 0 NOT NULL,
        gst_rate numeric(5,2) DEFAULT 0 NOT NULL,
        cgst_amount numeric(10,2) DEFAULT 0 NOT NULL,
        sgst_amount numeric(10,2) DEFAULT 0 NOT NULL,
        total_amount numeric(10,2) DEFAULT 0 NOT NULL
    );

    CREATE SEQUENCE public.purchase_items_id_seq
        AS integer
        START WITH 1
        INCREMENT BY 1
        NO MINVALUE
        NO MAXVALUE
        CACHE 1;

    ALTER SEQUENCE public.purchase_items_id_seq OWNED BY public.purchase_items.id;

    -- purchases
    CREATE TABLE public.purchases (
        id integer NOT NULL,
        supplier_id integer,
        invoice_no character varying(50),
        invoice_date date NOT NULL,
        total_amount numeric(10,2) DEFAULT 0 NOT NULL,
        total_taxable numeric(10,2) DEFAULT 0 NOT NULL,
        total_cgst numeric(10,2) DEFAULT 0 NOT NULL,
        total_sgst numeric(10,2) DEFAULT 0 NOT NULL,
        notes text,
        created_by integer,
        created_at timestamp without time zone DEFAULT now()
    );

    CREATE SEQUENCE public.purchases_id_seq
        AS integer
        START WITH 1
        INCREMENT BY 1
        NO MINVALUE
        NO MAXVALUE
        CACHE 1;

    ALTER SEQUENCE public.purchases_id_seq OWNED BY public.purchases.id;

    -- refunds
    CREATE TABLE public.refunds (
        id integer NOT NULL,
        bill_id integer NOT NULL,
        amount numeric(10,2) NOT NULL,
        payment_method text NOT NULL,
        reason text,
        created_at timestamp without time zone DEFAULT now(),
        refund_by integer NOT NULL,
        CONSTRAINT refunds_amount_check CHECK ((amount > (0)::numeric))
    );

    CREATE SEQUENCE public.refunds_id_seq
        AS integer
        START WITH 1
        INCREMENT BY 1
        NO MINVALUE
        NO MAXVALUE
        CACHE 1;

    ALTER SEQUENCE public.refunds_id_seq OWNED BY public.refunds.id;

    -- return_items
    CREATE TABLE public.return_items (
        id integer NOT NULL,
        return_id integer NOT NULL,
        product_id integer NOT NULL,
        quantity numeric(10,2) NOT NULL,
        price numeric(10,2) NOT NULL,
        line_total numeric(10,2) NOT NULL
    );

    CREATE SEQUENCE public.return_items_id_seq
        AS integer
        START WITH 1
        INCREMENT BY 1
        NO MINVALUE
        NO MAXVALUE
        CACHE 1;

    ALTER SEQUENCE public.return_items_id_seq OWNED BY public.return_items.id;

    -- returns
    CREATE TABLE public.returns (
        id integer NOT NULL,
        total_return_amount numeric(10,2) NOT NULL,
        payment_method character varying(255) NOT NULL,
        idempotency_key character varying(255) NOT NULL,
        created_at timestamp without time zone DEFAULT now() NOT NULL,
        updated_at timestamp without time zone DEFAULT now() NOT NULL,
        bill_id integer NOT NULL,
        reason text,
        return_number character varying(255),
        return_by integer NOT NULL,
        customer_id integer,
        is_store_credit boolean DEFAULT false NOT NULL
    );

    CREATE SEQUENCE public.returns_id_seq
        AS integer
        START WITH 1
        INCREMENT BY 1
        NO MINVALUE
        NO MAXVALUE
        CACHE 1;

    ALTER SEQUENCE public.returns_id_seq OWNED BY public.returns.id;

    -- settlements
    CREATE TABLE public.settlements (
        id integer NOT NULL,
        settlement_date date NOT NULL,
        total_sales numeric(10,2),
        total_returns numeric(10,2),
        total_refunds numeric(10,2),
        net_amount numeric(10,2) NOT NULL,
        created_at timestamp without time zone DEFAULT now(),
        settled_by integer NOT NULL,
        bills_count integer NOT NULL,
        cash_total numeric DEFAULT 0,
        card_total numeric DEFAULT 0,
        upi_total numeric DEFAULT 0,
        wallet_total numeric DEFAULT 0
    );

    CREATE SEQUENCE public.settlements_id_seq
        AS integer
        START WITH 1
        INCREMENT BY 1
        NO MINVALUE
        NO MAXVALUE
        CACHE 1;

    ALTER SEQUENCE public.settlements_id_seq OWNED BY public.settlements.id;

    -- stock_movements
    CREATE TABLE public.stock_movements (
        id integer NOT NULL,
        product_id integer NOT NULL,
        quantity numeric(10,2) NOT NULL,
        movement_type character varying(10) NOT NULL,
        reference character varying(50),
        created_at timestamp without time zone DEFAULT now(),
        created_by integer NOT NULL,
        batch_id integer
    );

    COMMENT ON COLUMN public.stock_movements.quantity IS 'Quantity moved (supports decimals for weight-based items)';

    ALTER TABLE public.stock_movements ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
        SEQUENCE NAME public.stock_movements_id_seq
        START WITH 1
        INCREMENT BY 1
        NO MINVALUE
        NO MAXVALUE
        CACHE 1
    );

    -- suppliers
    CREATE TABLE public.suppliers (
        id integer NOT NULL,
        name character varying(100) NOT NULL,
        phone character varying(15),
        gstin character varying(15),
        address text,
        created_by integer,
        created_at timestamp without time zone DEFAULT now()
    );

    CREATE SEQUENCE public.suppliers_id_seq
        AS integer
        START WITH 1
        INCREMENT BY 1
        NO MINVALUE
        NO MAXVALUE
        CACHE 1;

    ALTER SEQUENCE public.suppliers_id_seq OWNED BY public.suppliers.id;

    -- users
    CREATE TABLE public.users (
        id integer NOT NULL,
        name text NOT NULL,
        role character varying(255) NOT NULL,
        created_at timestamp without time zone DEFAULT now(),
        password text NOT NULL,
        is_active boolean DEFAULT true,
        user_name text NOT NULL
    );

    CREATE SEQUENCE public.users_id_seq
        AS integer
        START WITH 1
        INCREMENT BY 1
        NO MINVALUE
        NO MAXVALUE
        CACHE 1;

    ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;

    -- Column defaults tied to sequences
    ALTER TABLE ONLY public.bill_events ALTER COLUMN id SET DEFAULT nextval('public.bill_events_id_seq'::regclass);
    ALTER TABLE ONLY public.brands ALTER COLUMN id SET DEFAULT nextval('public.brands_id_seq'::regclass);
    ALTER TABLE ONLY public.lucky_draw_campaigns ALTER COLUMN id SET DEFAULT nextval('public.lucky_draw_campaigns_id_seq'::regclass);
    ALTER TABLE ONLY public.lucky_draw_entries ALTER COLUMN id SET DEFAULT nextval('public.lucky_draw_entries_id_seq'::regclass);
    ALTER TABLE ONLY public.lucky_draw_excluded_products ALTER COLUMN id SET DEFAULT nextval('public.lucky_draw_excluded_products_id_seq'::regclass);
    ALTER TABLE ONLY public.product_batches ALTER COLUMN id SET DEFAULT nextval('public.product_batches_id_seq'::regclass);
    ALTER TABLE ONLY public.purchase_items ALTER COLUMN id SET DEFAULT nextval('public.purchase_items_id_seq'::regclass);
    ALTER TABLE ONLY public.purchases ALTER COLUMN id SET DEFAULT nextval('public.purchases_id_seq'::regclass);
    ALTER TABLE ONLY public.refunds ALTER COLUMN id SET DEFAULT nextval('public.refunds_id_seq'::regclass);
    ALTER TABLE ONLY public.return_items ALTER COLUMN id SET DEFAULT nextval('public.return_items_id_seq'::regclass);
    ALTER TABLE ONLY public.returns ALTER COLUMN id SET DEFAULT nextval('public.returns_id_seq'::regclass);
    ALTER TABLE ONLY public.settlements ALTER COLUMN id SET DEFAULT nextval('public.settlements_id_seq'::regclass);
    ALTER TABLE ONLY public.suppliers ALTER COLUMN id SET DEFAULT nextval('public.suppliers_id_seq'::regclass);
    ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);

    -- Primary keys / unique constraints
    ALTER TABLE ONLY public.bill_events ADD CONSTRAINT bill_events_pkey PRIMARY KEY (id);
    ALTER TABLE ONLY public.bill_items ADD CONSTRAINT bill_items_pkey PRIMARY KEY (id);
    ALTER TABLE ONLY public.bills ADD CONSTRAINT bills_bill_number_key UNIQUE (bill_number);
    ALTER TABLE ONLY public.bills ADD CONSTRAINT bills_idempotency_key_key UNIQUE (idempotency_key);
    ALTER TABLE ONLY public.bills ADD CONSTRAINT bills_pkey PRIMARY KEY (id);
    ALTER TABLE ONLY public.brands ADD CONSTRAINT brands_name_key UNIQUE (name);
    ALTER TABLE ONLY public.brands ADD CONSTRAINT brands_pkey PRIMARY KEY (id);
    ALTER TABLE ONLY public.credit_payments ADD CONSTRAINT credit_payments_pkey PRIMARY KEY (id);
    ALTER TABLE ONLY public.customer_ledger ADD CONSTRAINT customer_ledger_pkey PRIMARY KEY (id);
    ALTER TABLE ONLY public.customers ADD CONSTRAINT customers_pkey PRIMARY KEY (id);
    ALTER TABLE ONLY public.logs ADD CONSTRAINT logs_pkey PRIMARY KEY (id);
    ALTER TABLE ONLY public.lucky_draw_campaigns ADD CONSTRAINT lucky_draw_campaigns_pkey PRIMARY KEY (id);
    ALTER TABLE ONLY public.lucky_draw_entries ADD CONSTRAINT lucky_draw_entries_pkey PRIMARY KEY (id);
    ALTER TABLE ONLY public.lucky_draw_entries ADD CONSTRAINT lucky_draw_entries_ticket_number_key UNIQUE (ticket_number);
    ALTER TABLE ONLY public.lucky_draw_excluded_products ADD CONSTRAINT lucky_draw_excluded_products_campaign_id_product_id_key UNIQUE (campaign_id, product_id);
    ALTER TABLE ONLY public.lucky_draw_excluded_products ADD CONSTRAINT lucky_draw_excluded_products_pkey PRIMARY KEY (id);
    ALTER TABLE ONLY public.product_batches ADD CONSTRAINT product_batches_pkey PRIMARY KEY (id);
    ALTER TABLE ONLY public.product_batches ADD CONSTRAINT product_batches_product_id_batch_no_key UNIQUE (product_id, batch_no);
    ALTER TABLE ONLY public.products ADD CONSTRAINT products_barcode_key UNIQUE (barcode);
    ALTER TABLE ONLY public.products ADD CONSTRAINT products_pkey PRIMARY KEY (id);
    ALTER TABLE ONLY public.purchase_items ADD CONSTRAINT purchase_items_pkey PRIMARY KEY (id);
    ALTER TABLE ONLY public.purchases ADD CONSTRAINT purchases_pkey PRIMARY KEY (id);
    ALTER TABLE ONLY public.refunds ADD CONSTRAINT refunds_pkey PRIMARY KEY (id);
    ALTER TABLE ONLY public.return_items ADD CONSTRAINT return_items_pkey PRIMARY KEY (id);
    ALTER TABLE ONLY public.returns ADD CONSTRAINT returns_idempotency_key_key UNIQUE (idempotency_key);
    ALTER TABLE ONLY public.returns ADD CONSTRAINT returns_pkey PRIMARY KEY (id);
    ALTER TABLE ONLY public.returns ADD CONSTRAINT returns_return_number_key UNIQUE (return_number);
    ALTER TABLE ONLY public.settlements ADD CONSTRAINT settlements_pkey PRIMARY KEY (id);
    ALTER TABLE ONLY public.stock_movements ADD CONSTRAINT stock_movements_pkey PRIMARY KEY (id);
    ALTER TABLE ONLY public.suppliers ADD CONSTRAINT suppliers_pkey PRIMARY KEY (id);
    ALTER TABLE ONLY public.settlements ADD CONSTRAINT unique_settlement_date UNIQUE (settlement_date);
    ALTER TABLE ONLY public.users ADD CONSTRAINT users_pkey PRIMARY KEY (id);

    -- Indexes
    CREATE UNIQUE INDEX brands_name_ci_unique ON public.brands USING btree (lower((name)::text));
    CREATE INDEX idx_bill_events_bill_id ON public.bill_events USING btree (bill_id);
    CREATE INDEX idx_bill_events_event_type ON public.bill_events USING btree (event_type);
    CREATE INDEX idx_bills_customer_id ON public.bills USING btree (customer_id);
    CREATE INDEX idx_credit_payments_cust_id ON public.credit_payments USING btree (customer_id);
    CREATE INDEX idx_ledger_customer_id ON public.customer_ledger USING btree (customer_id);
    CREATE UNIQUE INDEX uniq_product_name_barcode ON public.products USING btree (lower((name)::text), barcode) WHERE (barcode IS NOT NULL);
    CREATE UNIQUE INDEX uniq_product_name_no_barcode ON public.products USING btree (lower((name)::text)) WHERE (barcode IS NULL);

    -- Foreign keys
    ALTER TABLE ONLY public.bill_events ADD CONSTRAINT bill_events_bill_id_fkey FOREIGN KEY (bill_id) REFERENCES public.bills(id) ON DELETE CASCADE;
    ALTER TABLE ONLY public.bill_events ADD CONSTRAINT bill_events_performed_by_fkey FOREIGN KEY (performed_by) REFERENCES public.users(id);
    ALTER TABLE ONLY public.bill_items ADD CONSTRAINT bill_items_batch_id_fkey FOREIGN KEY (batch_id) REFERENCES public.product_batches(id);
    ALTER TABLE ONLY public.bills ADD CONSTRAINT bills_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);
    ALTER TABLE ONLY public.bills ADD CONSTRAINT bills_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id);
    ALTER TABLE ONLY public.returns ADD CONSTRAINT bills_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id);
    ALTER TABLE ONLY public.bills ADD CONSTRAINT bills_settlement_id_fkey FOREIGN KEY (settlement_id) REFERENCES public.settlements(id);
    ALTER TABLE ONLY public.bills ADD CONSTRAINT bills_void_by_fkey FOREIGN KEY (void_by) REFERENCES public.users(id);
    ALTER TABLE ONLY public.credit_payments ADD CONSTRAINT credit_payments_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);
    ALTER TABLE ONLY public.credit_payments ADD CONSTRAINT credit_payments_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id);
    ALTER TABLE ONLY public.customer_ledger ADD CONSTRAINT customer_ledger_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);
    ALTER TABLE ONLY public.customer_ledger ADD CONSTRAINT customer_ledger_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id);
    ALTER TABLE ONLY public.customers ADD CONSTRAINT customers_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);
    ALTER TABLE ONLY public.bill_items ADD CONSTRAINT fk_bill FOREIGN KEY (bill_id) REFERENCES public.bills(id) ON DELETE CASCADE;
    ALTER TABLE ONLY public.bill_items ADD CONSTRAINT fk_product FOREIGN KEY (product_id) REFERENCES public.products(id);
    ALTER TABLE ONLY public.logs ADD CONSTRAINT logs_performed_by_fkey FOREIGN KEY (performed_by) REFERENCES public.users(id);
    ALTER TABLE ONLY public.lucky_draw_entries ADD CONSTRAINT lucky_draw_entries_bill_id_fkey FOREIGN KEY (bill_id) REFERENCES public.bills(id) ON DELETE RESTRICT;
    ALTER TABLE ONLY public.lucky_draw_entries ADD CONSTRAINT lucky_draw_entries_bill_number_fkey FOREIGN KEY (bill_number) REFERENCES public.bills(bill_number);
    ALTER TABLE ONLY public.lucky_draw_entries ADD CONSTRAINT lucky_draw_entries_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.lucky_draw_campaigns(id) ON DELETE RESTRICT;
    ALTER TABLE ONLY public.lucky_draw_excluded_products ADD CONSTRAINT lucky_draw_excluded_products_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.lucky_draw_campaigns(id) ON DELETE CASCADE;
    ALTER TABLE ONLY public.lucky_draw_excluded_products ADD CONSTRAINT lucky_draw_excluded_products_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;
    ALTER TABLE ONLY public.product_batches ADD CONSTRAINT product_batches_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);
    ALTER TABLE ONLY public.product_batches ADD CONSTRAINT product_batches_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id);
    ALTER TABLE ONLY public.products ADD CONSTRAINT products_brand_id_fkey FOREIGN KEY (brand_id) REFERENCES public.brands(id);
    ALTER TABLE ONLY public.products ADD CONSTRAINT products_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);
    ALTER TABLE ONLY public.products ADD CONSTRAINT products_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id);
    ALTER TABLE ONLY public.purchase_items ADD CONSTRAINT purchase_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id);
    ALTER TABLE ONLY public.purchase_items ADD CONSTRAINT purchase_items_purchase_id_fkey FOREIGN KEY (purchase_id) REFERENCES public.purchases(id) ON DELETE CASCADE;
    ALTER TABLE ONLY public.purchases ADD CONSTRAINT purchases_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);
    ALTER TABLE ONLY public.purchases ADD CONSTRAINT purchases_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id);
    ALTER TABLE ONLY public.refunds ADD CONSTRAINT refunds_bill_id_fkey FOREIGN KEY (bill_id) REFERENCES public.bills(id);
    ALTER TABLE ONLY public.refunds ADD CONSTRAINT refunds_refund_by_fkey FOREIGN KEY (refund_by) REFERENCES public.users(id);
    ALTER TABLE ONLY public.return_items ADD CONSTRAINT return_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id);
    ALTER TABLE ONLY public.return_items ADD CONSTRAINT return_items_return_id_fkey FOREIGN KEY (return_id) REFERENCES public.returns(id);
    ALTER TABLE ONLY public.returns ADD CONSTRAINT returns_bill_id_fkey FOREIGN KEY (bill_id) REFERENCES public.bills(id);
    ALTER TABLE ONLY public.returns ADD CONSTRAINT returns_return_by_fkey FOREIGN KEY (return_by) REFERENCES public.users(id);
    ALTER TABLE ONLY public.settlements ADD CONSTRAINT settlements_settled_by_fkey FOREIGN KEY (settled_by) REFERENCES public.users(id);
    ALTER TABLE ONLY public.stock_movements ADD CONSTRAINT stock_movements_batch_id_fkey FOREIGN KEY (batch_id) REFERENCES public.product_batches(id);
    ALTER TABLE ONLY public.stock_movements ADD CONSTRAINT stock_movements_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);
    ALTER TABLE ONLY public.stock_movements ADD CONSTRAINT stock_movements_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id);
    ALTER TABLE ONLY public.suppliers ADD CONSTRAINT suppliers_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);
  `);
};

export const down = (pgm) => {
  pgm.sql(`
    DROP TABLE IF EXISTS public.return_items CASCADE;
    DROP TABLE IF EXISTS public.returns CASCADE;
    DROP TABLE IF EXISTS public.refunds CASCADE;
    DROP TABLE IF EXISTS public.stock_movements CASCADE;
    DROP TABLE IF EXISTS public.purchase_items CASCADE;
    DROP TABLE IF EXISTS public.purchases CASCADE;
    DROP TABLE IF EXISTS public.product_batches CASCADE;
    DROP TABLE IF EXISTS public.bill_items CASCADE;
    DROP TABLE IF EXISTS public.bill_events CASCADE;
    DROP TABLE IF EXISTS public.bills CASCADE;
    DROP TABLE IF EXISTS public.settlements CASCADE;
    DROP TABLE IF EXISTS public.credit_payments CASCADE;
    DROP TABLE IF EXISTS public.customer_ledger CASCADE;
    DROP TABLE IF EXISTS public.customers CASCADE;
    DROP TABLE IF EXISTS public.lucky_draw_excluded_products CASCADE;
    DROP TABLE IF EXISTS public.lucky_draw_entries CASCADE;
    DROP TABLE IF EXISTS public.lucky_draw_campaigns CASCADE;
    DROP TABLE IF EXISTS public.products CASCADE;
    DROP TABLE IF EXISTS public.brands CASCADE;
    DROP TABLE IF EXISTS public.suppliers CASCADE;
    DROP TABLE IF EXISTS public.invoice_counters CASCADE;
    DROP TABLE IF EXISTS public.logs CASCADE;
    DROP TABLE IF EXISTS public.users CASCADE;
    DROP SEQUENCE IF EXISTS public.batch_seq;
  `);
};