"use client"

import { useEffect, useState, useCallback } from "react"
import { cn } from "@/lib/utils"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Bot, Search, RefreshCw, Loader2, CheckCircle, XCircle, Clock, Zap, User } from "lucide-react"

interface BotData {
  id: string
  name: string
  username: string
  is_active: boolean
  created_at: string
  user_email?: string
}

export default function BotsPage() {
  const [bots, setBots] = useState<BotData[]>([])
  const [search, setSearch] = useState("")
  const [isLoading, setIsLoading] = useState(true)

  const loadBots = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch("/api/dragonadm/bots")
      if (res.ok) {
        const data = await res.json()
        setBots(data.bots || [])
      }
    } catch (error) {
      console.error("Erro ao carregar bots:", error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadBots()
  }, [loadBots])

  const filteredBots = bots.filter(b =>
    b.name?.toLowerCase().includes(search.toLowerCase()) ||
    b.username?.toLowerCase().includes(search.toLowerCase())
  )

  const activeBots = bots.filter(b => b.is_active).length

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
                  background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.2), rgba(168, 85, 247, 0.1))',
                  border: '1px solid rgba(139, 92, 246, 0.2)'
                }}
              >
                <Bot className="w-5 h-5 text-[#8b5cf6]" />
              </div>
              <h1 className="text-3xl font-bold text-white tracking-tight">Bots</h1>
            </div>
            <p className="text-[#666666] text-sm">
              Gerencie todos os bots do sistema
            </p>
          </div>
          <button
            onClick={loadBots}
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
            { icon: Bot, label: "Total", value: bots.length, color: "#a1a1a1", bg: "rgba(255,255,255,0.05)" },
            { icon: Zap, label: "Ativos", value: activeBots, color: "#22c55e", bg: "rgba(34, 197, 94, 0.1)" },
            { icon: XCircle, label: "Inativos", value: bots.length - activeBots, color: "#ef4444", bg: "rgba(239, 68, 68, 0.1)" },
          ].map((stat, i) => (
            <div
              key={i}
              className="group rounded-2xl p-5 transition-all duration-300 hover:-translate-y-1"
              style={{
                background: '#0f0f0f',
                border: '1px solid rgba(255,255,255,0.06)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = `${stat.color}30`
                e.currentTarget.style.boxShadow = `0 0 25px ${stat.color}15`
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'
                e.currentTarget.style.boxShadow = 'none'
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
                  <p className="text-2xl font-bold text-white">{stat.value}</p>
                  <p className="text-sm text-[#666666]">{stat.label}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Bots Table Card */}
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
                <Bot className="w-5 h-5 text-[#95e468]" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">Lista de Bots</h2>
                <p className="text-xs text-[#666666]">{filteredBots.length} bots encontrados</p>
              </div>
            </div>
            <div className="relative">
              <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#666666]" />
              <input
                placeholder="Buscar bot..."
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
                  <div className="w-12 h-12 rounded-xl bg-[#8b5cf6]/10 flex items-center justify-center">
                    <Loader2 className="w-6 h-6 text-[#8b5cf6] animate-spin" />
                  </div>
                  <div className="absolute inset-0 rounded-xl bg-[#8b5cf6]/20 blur-xl animate-pulse" />
                </div>
                <p className="text-sm text-[#666666]">Carregando bots...</p>
              </div>
            ) : filteredBots.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <div 
                  className="w-20 h-20 rounded-2xl flex items-center justify-center"
                  style={{ 
                    background: 'linear-gradient(135deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))',
                    border: '1px solid rgba(255,255,255,0.06)'
                  }}
                >
                  <Bot className="h-10 w-10 text-[#444444]" />
                </div>
                <p className="text-sm text-[#666666]">
                  {bots.length === 0 ? "Nenhum bot criado" : "Nenhum resultado encontrado"}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                      <th className="px-6 py-4 text-left text-[11px] font-semibold text-[#666666] uppercase tracking-wider">Bot</th>
                      <th className="px-6 py-4 text-left text-[11px] font-semibold text-[#666666] uppercase tracking-wider">Username</th>
                      <th className="px-6 py-4 text-left text-[11px] font-semibold text-[#666666] uppercase tracking-wider">Dono</th>
                      <th className="px-6 py-4 text-left text-[11px] font-semibold text-[#666666] uppercase tracking-wider">Status</th>
                      <th className="px-6 py-4 text-left text-[11px] font-semibold text-[#666666] uppercase tracking-wider">Criado em</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredBots.map((bot) => (
                      <tr 
                        key={bot.id}
                        className="group transition-colors hover:bg-white/[0.02]"
                        style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div 
                              className="w-10 h-10 rounded-xl flex items-center justify-center"
                              style={{ 
                                background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.2), rgba(168, 85, 247, 0.1))',
                                border: '1px solid rgba(139, 92, 246, 0.2)'
                              }}
                            >
                              <Bot className="w-5 h-5 text-[#8b5cf6]" />
                            </div>
                            <span className="text-sm font-medium text-white">
                              {bot.name}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span 
                            className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-medium"
                            style={{ 
                              background: 'rgba(255,255,255,0.03)',
                              color: '#a1a1a1',
                              border: '1px solid rgba(255,255,255,0.06)'
                            }}
                          >
                            @{bot.username}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2 text-sm text-[#666666]">
                            <User className="w-3.5 h-3.5" />
                            {bot.user_email || "-"}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {bot.is_active ? (
                            <span 
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium"
                              style={{ 
                                background: 'rgba(34, 197, 94, 0.1)',
                                color: '#22c55e',
                                border: '1px solid rgba(34, 197, 94, 0.2)'
                              }}
                            >
                              <CheckCircle className="w-3 h-3" />
                              Ativo
                            </span>
                          ) : (
                            <span 
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium"
                              style={{ 
                                background: 'rgba(255,255,255,0.03)',
                                color: '#666666',
                                border: '1px solid rgba(255,255,255,0.06)'
                              }}
                            >
                              <XCircle className="w-3 h-3" />
                              Inativo
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2 text-sm text-[#666666]">
                            <Clock className="w-3.5 h-3.5" />
                            {new Date(bot.created_at).toLocaleDateString("pt-BR")}
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
