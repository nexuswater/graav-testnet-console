-- Apply to a reviewable local/preview database first. No legacy table is dropped.
CREATE SCHEMA graav_x1;
CREATE TABLE graav_x1.locks (key text PRIMARY KEY);
CREATE TABLE graav_x1.subjects (x_user_id text PRIMARY KEY CHECK (x_user_id ~ '^[1-9][0-9]{0,31}$'), revision integer NOT NULL DEFAULT 0);
CREATE TABLE graav_x1.bindings (
  id uuid PRIMARY KEY,
  chain_id integer NOT NULL DEFAULT 1449000 CHECK (chain_id=1449000),
  x_user_id text NOT NULL REFERENCES graav_x1.subjects(x_user_id),
  wallet text NOT NULL CHECK (wallet ~ '^0x[0-9a-f]{40}$'),
  handle text, nonce text NOT NULL UNIQUE, signature text NOT NULL, typed_data jsonb NOT NULL,
  bound_at double precision NOT NULL,
  revoked_at double precision, revoke_reason text, revoke_proof jsonb
);
CREATE UNIQUE INDEX x1_active_x ON graav_x1.bindings(chain_id,x_user_id) WHERE revoked_at IS NULL;
CREATE UNIQUE INDEX x1_active_wallet ON graav_x1.bindings(chain_id,wallet) WHERE revoked_at IS NULL;
CREATE TABLE graav_x1.challenges (
  nonce text PRIMARY KEY, x_user_id text NOT NULL REFERENCES graav_x1.subjects(x_user_id),
  wallet text NOT NULL, purpose text NOT NULL CHECK (purpose IN ('BIND','REVOKE')),
  bind_id uuid REFERENCES graav_x1.bindings(id), session_hash text NOT NULL,
  revision integer NOT NULL, typed_data jsonb NOT NULL,
  created_at double precision NOT NULL, expires_at double precision NOT NULL, used_at double precision
);
CREATE INDEX x1_challenge_expiry ON graav_x1.challenges(expires_at) WHERE used_at IS NULL;
CREATE TABLE graav_x1.sessions (
  id text PRIMARY KEY, action text NOT NULL CHECK (action='BUY'),
  chain_id integer NOT NULL CHECK (chain_id=1449000), market text NOT NULL,
  token text NOT NULL, amount_wei numeric(78,0) NOT NULL CHECK (amount_wei=100000000000000000),
  created_by_x_user_id text, via text, created_at double precision NOT NULL, expires_at double precision NOT NULL
);
CREATE TABLE graav_x1.touches (
  seq bigserial PRIMARY KEY, id uuid NOT NULL UNIQUE,
  visitor_id text NOT NULL, session_id text NOT NULL REFERENCES graav_x1.sessions(id),
  idempotency_key uuid NOT NULL, via text, bind_id uuid REFERENCES graav_x1.bindings(id), wallet text,
  touched_at double precision NOT NULL, expires_at double precision NOT NULL, reason text NOT NULL,
  UNIQUE(visitor_id,idempotency_key)
);
CREATE INDEX x1_last_touch ON graav_x1.touches(visitor_id,seq DESC);
CREATE TABLE graav_x1.orders (
  id uuid PRIMARY KEY, session_id text NOT NULL REFERENCES graav_x1.sessions(id),
  visitor_id text NOT NULL, idempotency_key uuid NOT NULL,
  wallet text NOT NULL, buyer_x_user_id text, quote jsonb NOT NULL, nonce text NOT NULL UNIQUE,
  transaction_nonce bigint NOT NULL, created_at double precision NOT NULL, expires_at double precision NOT NULL,
  touch jsonb, intent_signature text, authorized_at double precision, tx_hash text UNIQUE,
  status text NOT NULL DEFAULT 'PREPARED' CHECK (status IN ('PREPARED','AUTHORIZED','SUBMITTED','COMPLETE','FAILED','REVIEW_REQUIRED','EXPIRED')),
  evidence jsonb, credit_reason text,
  UNIQUE(visitor_id,idempotency_key)
);
-- A nonce is reserved only after the wallet signs its order. Prepare cannot reserve another person's nonce.
CREATE UNIQUE INDEX x1_authorized_nonce ON graav_x1.orders(wallet,transaction_nonce) WHERE authorized_at IS NOT NULL AND status <> 'EXPIRED';
CREATE TABLE graav_x1.ledger (
  id uuid PRIMARY KEY, order_id uuid NOT NULL REFERENCES graav_x1.orders(id),
  tx_hash text NOT NULL, kind text NOT NULL CHECK (kind IN ('CREDIT','REVERSAL')),
  distributor_x_user_id text NOT NULL, distributor_wallet text NOT NULL,
  buyer_wallet text NOT NULL, market text NOT NULL,
  funded_amount_wei numeric(78,0) NOT NULL CHECK (funded_amount_wei>0),
  amount_wei numeric(78,0) NOT NULL,
  bps integer NOT NULL CHECK (bps=15), evidence jsonb NOT NULL,
  created_at double precision NOT NULL,
  CHECK ((kind='CREDIT' AND amount_wei>0) OR (kind='REVERSAL' AND amount_wei<0)),
  UNIQUE(order_id,kind), UNIQUE(tx_hash,kind)
);
CREATE INDEX x1_rewards_by_x ON graav_x1.ledger(distributor_x_user_id,created_at DESC);
-- The production application role should receive SELECT/INSERT only on ledger.
-- No automatic deletion of bindings, used challenges, orders, or accounting evidence.

CREATE TABLE IF NOT EXISTS graav_x1.rate_limits (key text NOT NULL, window_start bigint NOT NULL, count integer NOT NULL, PRIMARY KEY(key,window_start));
