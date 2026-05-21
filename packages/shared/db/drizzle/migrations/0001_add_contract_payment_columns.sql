-- Add Khalti / contract payment fields to the contracts table
ALTER TABLE IF EXISTS contracts
  ADD COLUMN IF NOT EXISTS pidx text,
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'unpaid',
  ADD COLUMN IF NOT EXISTS signed_at timestamp,
  ADD COLUMN IF NOT EXISTS tenant_payment_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS tenant_payment_reference text,
  ADD COLUMN IF NOT EXISTS tenant_payment_verified_at timestamp;
