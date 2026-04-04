-- ============================================
-- SETUP COMPLETO DO SISTEMA DE AFILIADOS
-- Execute este script no SQL Editor do Supabase
-- ============================================

-- 1. Adicionar campo commission_amount na tabela referrals (para rastrear comissoes)
ALTER TABLE referrals 
ADD COLUMN IF NOT EXISTS commission_amount DECIMAL(10, 2) DEFAULT 0;

ALTER TABLE referrals 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';

-- Index para performance
CREATE INDEX IF NOT EXISTS idx_referrals_referrer_id ON referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referrals_status ON referrals(status);

-- Comentario
COMMENT ON COLUMN referrals.commission_amount IS 'Valor da comissao do afiliado por esta indicacao';
COMMENT ON COLUMN referrals.status IS 'Status da indicacao: active, admin_adjustment, etc';

-- ============================================
-- 2. Criar tabela referral_withdraws (saques de afiliados)
-- ============================================

CREATE TABLE IF NOT EXISTS referral_withdraws (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount DECIMAL(10, 2) NOT NULL,
  name TEXT NOT NULL,
  cpf TEXT NOT NULL,
  pix_key TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'paid')),
  admin_notes TEXT,
  processed_at TIMESTAMP WITH TIME ZONE,
  processed_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index para queries mais rapidas
CREATE INDEX IF NOT EXISTS idx_referral_withdraws_user_id ON referral_withdraws(user_id);
CREATE INDEX IF NOT EXISTS idx_referral_withdraws_status ON referral_withdraws(status);

-- ============================================
-- 3. Campos opcionais na tabela users (para ajustes manuais)
-- ============================================

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS affiliate_balance DECIMAL(10, 2) DEFAULT 0;

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS affiliate_balance_adjustment DECIMAL(10, 2) DEFAULT 0;

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS affiliate_balance_reason TEXT;

-- Comentarios
COMMENT ON COLUMN users.affiliate_balance IS 'Saldo atual de afiliado (cache)';
COMMENT ON COLUMN users.affiliate_balance_adjustment IS 'Ajuste manual do saldo feito por admin';
COMMENT ON COLUMN users.affiliate_balance_reason IS 'Motivo do ultimo ajuste';

-- ============================================
-- PRONTO! Sistema de afiliados configurado.
-- ============================================
