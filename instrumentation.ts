export async function register() {
  // Só roda no servidor Node.js (não no Edge)
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    console.log('[PaymentSync] Iniciando worker de sincronização de pagamentos...')
    
    // Importa dinamicamente para evitar problemas no cliente
    const { startPaymentSyncWorker } = await import('./lib/payment-sync-worker')
    
    // Inicia o worker
    startPaymentSyncWorker()
  }
}
