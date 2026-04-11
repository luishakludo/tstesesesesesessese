-- Add source column to bot_users table to distinguish between
-- users captured by bot ('start') and imported users ('imported')

-- Add column if not exists
ALTER TABLE bot_users 
ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'start';

-- Update existing users to have source = 'start' (captured by bot)
UPDATE bot_users 
SET source = 'start' 
WHERE source IS NULL;

-- Create index for faster filtering by source
CREATE INDEX IF NOT EXISTS idx_bot_users_source ON bot_users(bot_id, source);
