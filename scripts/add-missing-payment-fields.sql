-- Migration: Add missing columns to payments table
-- These columns are needed for Order Bump, Upsell, Downsell tracking

-- Telegram chat ID (for sending messages)
ALTER TABLE payments 
ADD COLUMN IF NOT EXISTS telegram_chat_id TEXT;

-- Flow ID (to track which flow the payment belongs to)
ALTER TABLE payments 
ADD COLUMN IF NOT EXISTS flow_id UUID REFERENCES flows(id) ON DELETE SET NULL;

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_payments_telegram_chat_id ON payments(telegram_chat_id);
CREATE INDEX IF NOT EXISTS idx_payments_flow_id ON payments(flow_id);

-- Add comments for documentation
COMMENT ON COLUMN payments.telegram_chat_id IS 'Telegram chat ID for sending messages to the user';
COMMENT ON COLUMN payments.flow_id IS 'Reference to the flow this payment belongs to';
