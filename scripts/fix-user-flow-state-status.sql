-- ==============================================
-- FIX: Adicionar status faltantes na tabela user_flow_state
-- O codigo usa varios status que nao estao no CHECK constraint original
-- ==============================================

-- 1. REMOVER a constraint CHECK antiga que limita os status
ALTER TABLE user_flow_state DROP CONSTRAINT IF EXISTS user_flow_state_status_check;

-- 2. ADICIONAR nova constraint CHECK com TODOS os status usados no codigo
ALTER TABLE user_flow_state ADD CONSTRAINT user_flow_state_status_check 
  CHECK (status IN (
    'in_progress', 
    'completed', 
    'waiting_response',
    'waiting_order_bump',       -- Order bump global
    'waiting_multi_order_bump', -- Order bump especifico do plano
    'payment_pending',          -- Pagamento PIX gerado, aguardando
    'payment_completed',        -- Pagamento confirmado
    'cancelled'                 -- Cancelado
  ));

-- 3. ADICIONAR coluna metadata se nao existir (para guardar info do order bump)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_flow_state' AND column_name = 'metadata'
  ) THEN
    ALTER TABLE user_flow_state ADD COLUMN metadata JSONB DEFAULT '{}';
  END IF;
END $$;

-- 4. CRIAR indice unico correto para bot_id + telegram_user_id (sem flow_id)
-- Isso permite o upsert funcionar com onConflict: "bot_id,telegram_user_id"
DROP INDEX IF EXISTS idx_user_flow_state_bot_telegram;
CREATE UNIQUE INDEX idx_user_flow_state_bot_telegram ON user_flow_state(bot_id, telegram_user_id);

-- 5. PERMITIR DELETE pelo webhook (anon)
DROP POLICY IF EXISTS "Anon can delete user flow state" ON user_flow_state;
CREATE POLICY "Anon can delete user flow state" ON user_flow_state 
  FOR DELETE TO anon USING (true);

-- Verificar se a correcao foi aplicada
SELECT 
  conname AS constraint_name,
  pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint 
WHERE conrelid = 'user_flow_state'::regclass;
