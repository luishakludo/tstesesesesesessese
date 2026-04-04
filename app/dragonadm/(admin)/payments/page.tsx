"use client"

import { useEffect, useState, useCallback } from "react"
import { cn } from "@/lib/utils"
import { ScrollArea } from "@/components/ui/scroll-area"
import { CreditCard, Search, RefreshCw, Loader2, DollarSign, Clock, CheckCircle, XCircle, TrendingUp } from "lucide-react"

interface PaymentData {
  id: string
  user_email?: string
  amount: number
  status: string
  created_at: string
}

export default function PaymentsPage() {
  const [payments, setPayments] = useState<PaymentData[]>([])
  const [search, setSearch] = useState("")
  const [isLoading, setIsLoading] = useState(true)

  const loadPayments = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch("/api/dragonadm/payments")
      if (res.ok) {
        const data = await res.json()
        setPayments(data.payments || [])
      }
    } catch (error) {
      console.error("Erro ao carregar pagamentos:", error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadPayments()
  }, [loadPayments])

  const filteredPayments = payments.filter(p =>
    p.user_email?.toLowerCase().includes(search.toLowerCase()) ||
    p.status?.toLowerCase().includes(search.toLowerCase())
  )

  const approvedPayments = payments.filter(p => p.status === "approved")
  const totalRevenue = approvedPayments.reduce((acc, p) => acc + (p.amount || 0), 0)
  const pendingPayments = payments.filter(p => p.status === "pending").length

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return (
          <span 
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium"
            style={{ 
              background: 'rgba(34, 197, 94, 0.1)',
              color: '#22c55e',
              border: '1px solid rgba(34, 197, 94, 0.2)'
            }}
          >
            <CheckCircle className="w-3 h-3" />
            Aprovado
          </span>
        )
      case "pending":
        return (
          <span 
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium"
            style={{ 
              background: 'rgba(245, 158, 11, 0.1)',
              color: '#f59e0b',
              border: '1px solid rgba(245, 158, 11, 0.2)'
            }}
          >
            <Clock className="w-3 h-3" />
            Pendente
          </span>
        )
      case "rejected":
        return (
          <span 
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium"
            style={{ 
              background: 'rgba(239, 68, 68, 0.1)',
              color: '#ef4444',
              border: '1px solid rgba(239, 68, 68, 0.2)'
            }}
          >
            <XCircle className="w-3 h-3" />
            Rejeitado
          </span>
        )
      default:
        return (
          <span 
            className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium"
            style={{ 
              background: 'rgba(255,255,255,0.03)',
              color: '#666666',
              border: '1px solid rgba(255,255,255,0.06)'
            }}
          >
            {status}
          </span>
        )
    }
  }

  return (
    <ScrollArea className="flex-1">
      <div className="p-6 lg:p-8 space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 pb-6" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div 
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ 
                  background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.2), rgba(234, 88, 12, 0.1))',
                  border: '1px solid rgba(245, 158, 11, 0.2)'
                }}
              >
                <CreditCard className="w-5 h-5 text-[#f59e0b]" />
              </div>
              <h1 className="text-3xl font-bold text-white tracking-tight">Pagamentos</h1>
            </div>
            <p className="text-[#666666] text-sm">
              Gerencie todos os pagamentos do sistema
            </p>
          </div>
          <button
            onClick={loadPayments}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 text-[#a1a1a1] hover:text-white disabled:opacity-50"
            style={{ 
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.06)'
            }}
          >
            <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
            Atualizar
          </button>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-5 sm:grid-cols-3">
          {[
            { icon: CreditCard, label: "Total", value: payments.length, color: "#a1a1a1", bg: "rgba(255,255,255,0.05)" },
            { icon: DollarSign, label: "Receita", value: `R$ ${totalRevenue.toFixed(2)}`, color: "#22c55e", bg: "rgba(34, 197, 94, 0.1)", highlight: true },
            { icon: Clock, label: "Pendentes", value: pendingPayments, color: "#f59e0b", bg: "rgba(245, 158, 11, 0.1)" },
          ].map((stat, i) => (
            <div
              key={i}
              className="group rounded-2xl p-5 transition-all duration-300 hover:-translate-y-1"
              style={{
                background: stat.highlight ? 'linear-gradient(145deg, #0f0f0f 0%, #111111 100%)' : '#0f0f0f',
                border: stat.highlight ? '1px solid rgba(34, 197, 94, 0.2)' : '1px solid rgba(255,255,255,0.06)',
                boxShadow: stat.highlight ? '0 0 30px rgba(34, 197, 94, 0.1)' : 'none'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = `${stat.color}30`
                e.currentTarget.style.boxShadow = `0 0 25px ${stat.color}15`
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = stat.highlight ? 'rgba(34, 197, 94, 0.2)' : 'rgba(255,255,255,0.06)'
                e.currentTarget.style.boxShadow = stat.highlight ? '0 0 30px rgba(34, 197, 94, 0.1)' : 'none'
              }}
            >
              <div className="flex items-center gap-4">
                <div 
                  className="w-12 h-12 rounded-xl flex items-center justify-center transition-transform duration-300 group-hover:scale-110"
                  style={{ background: stat.bg }}
                >
                  <stat.icon className="h-6 w-6" style={{ color: stat.color }} />
                </div>
                <div>
                  <p 
                    className="text-2xl font-bold"
                    style={stat.highlight ? {
                      background: 'linear-gradient(135deg, #22c55e, #95e468)',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent'
                    } : { color: 'white' }}
                  >
                    {stat.value}
                  </p>
                  <p className="text-sm text-[#666666]">{stat.label}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Payments Table Card */}
        <div 
          className="rounded-2xl overflow-hidden"
          style={{ 
            background: '#0f0f0f',
            border: '1px solid rgba(255,255,255,0.06)'
          }}
        >
          {/* Card Header */}
          <div 
            className="px-6 py-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
            style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
          >
            <div className="flex items-center gap-3">
              <div 
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: 'rgba(149, 228, 104, 0.1)' }}
              >
                <TrendingUp className="w-5 h-5 text-[#95e468]" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">Lista de Pagamentos</h2>
                <p className="text-xs text-[#666666]">{filteredPayments.length} pagamentos encontrados</p>
              </div>
            </div>
            <div className="relative">
              <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#666666]" />
              <input
                placeholder="Buscar pagamento..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full sm:w-72 pl-11 pr-4 py-2.5 rounded-xl text-sm text-white placeholder:text-[#666666] focus:outline-none focus:ring-2 focus:ring-[#95e468]/30 transition-all"
                style={{ 
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.06)'
                }}
              />
            </div>
          </div>

          {/* Table Content */}
          <div className="p-0">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <div className="relative">
                  <div className="w-12 h-12 rounded-xl bg-[#f59e0b]/10 flex items-center justify-center">
                    <Loader2 className="w-6 h-6 text-[#f59e0b] animate-spin" />
                  </div>
                  <div className="absolute inset-0 rounded-xl bg-[#f59e0b]/20 blur-xl animate-pulse" />
                </div>
                <p className="text-sm text-[#666666]">Carregando pagamentos...</p>
              </div>
            ) : filteredPayments.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <div 
                  className="w-20 h-20 rounded-2xl flex items-center justify-center"
                  style={{ 
                    background: 'linear-gradient(135deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))',
                    border: '1px solid rgba(255,255,255,0.06)'
                  }}
                >
                  <CreditCard className="h-10 w-10 text-[#444444]" />
                </div>
                <p className="text-sm text-[#666666]">
                  {payments.length === 0 ? "Nenhum pagamento" : "Nenhum resultado encontrado"}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                      <th className="px-6 py-4 text-left text-[11px] font-semibold text-[#666666] uppercase tracking-wider">Usuario</th>
                      <th className="px-6 py-4 text-left text-[11px] font-semibold text-[#666666] uppercase tracking-wider">Valor</th>
                      <th className="px-6 py-4 text-left text-[11px] font-semibold text-[#666666] uppercase tracking-wider">Status</th>
                      <th className="px-6 py-4 text-left text-[11px] font-semibold text-[#666666] uppercase tracking-wider">Data</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPayments.map((payment) => (
                      <tr 
                        key={payment.id}
                        className="group transition-colors hover:bg-white/[0.02]"
                        style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div 
                              className="w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold text-white"
                              style={{ 
                                background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.2), rgba(234, 88, 12, 0.1))',
                                border: '1px solid rgba(255,255,255,0.06)'
                              }}
                            >
                              {payment.user_email?.charAt(0).toUpperCase() || "?"}
                            </div>
                            <span className="text-sm text-white">
                              {payment.user_email || "-"}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm font-semibold text-[#22c55e]">
                            R$ {(payment.amount || 0).toFixed(2)}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          {getStatusBadge(payment.status)}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2 text-sm text-[#666666]">
                            <Clock className="w-3.5 h-3.5" />
                            {new Date(payment.created_at).toLocaleDateString("pt-BR")}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </ScrollArea>
  )
}
