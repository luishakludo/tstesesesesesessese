"use client"

import { useEffect, useState } from "react"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Users,
  Bot,
  CreditCard,
  TrendingUp,
  Activity,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  Zap,
  Sparkles,
} from "lucide-react"

interface DashboardStats {
  totalUsers: number
  activeUsers: number
  bannedUsers: number
  totalBots: number
  activeBots: number
  totalPayments: number
  totalRevenue: number
  pendingPayments: number
}

export default function DragonAdmDashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function loadStats() {
      try {
        const res = await fetch("/api/dragonadm/stats")
        if (res.ok) {
          const data = await res.json()
          setStats(data)
        }
      } catch (error) {
        console.error("Erro ao carregar stats:", error)
      } finally {
        setIsLoading(false)
      }
    }

    loadStats()
  }, [])

  const statCards = [
    {
      title: "Total Usuarios",
      value: stats?.totalUsers || 0,
      icon: Users,
      iconColor: "#3b82f6",
      bgGradient: "linear-gradient(135deg, rgba(59, 130, 246, 0.15), rgba(59, 130, 246, 0.05))",
      trend: "+12%",
      trendUp: true,
    },
    {
      title: "Usuarios Ativos",
      value: stats?.activeUsers || 0,
      icon: Activity,
      iconColor: "#22c55e",
      bgGradient: "linear-gradient(135deg, rgba(34, 197, 94, 0.15), rgba(34, 197, 94, 0.05))",
      trend: "+8%",
      trendUp: true,
    },
    {
      title: "Usuarios Banidos",
      value: stats?.bannedUsers || 0,
      icon: Users,
      iconColor: "#ef4444",
      bgGradient: "linear-gradient(135deg, rgba(239, 68, 68, 0.15), rgba(239, 68, 68, 0.05))",
      trend: "-2%",
      trendUp: false,
    },
    {
      title: "Total de Bots",
      value: stats?.totalBots || 0,
      icon: Bot,
      iconColor: "#8b5cf6",
      bgGradient: "linear-gradient(135deg, rgba(139, 92, 246, 0.15), rgba(139, 92, 246, 0.05))",
      trend: "+15%",
      trendUp: true,
    },
    {
      title: "Bots Ativos",
      value: stats?.activeBots || 0,
      icon: Zap,
      iconColor: "#95e468",
      bgGradient: "linear-gradient(135deg, rgba(149, 228, 104, 0.15), rgba(149, 228, 104, 0.05))",
      trend: "+20%",
      trendUp: true,
    },
    {
      title: "Total Pagamentos",
      value: stats?.totalPayments || 0,
      icon: CreditCard,
      iconColor: "#f59e0b",
      bgGradient: "linear-gradient(135deg, rgba(245, 158, 11, 0.15), rgba(245, 158, 11, 0.05))",
      trend: "+5%",
      trendUp: true,
    },
    {
      title: "Receita Total",
      value: `R$ ${(stats?.totalRevenue || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
      icon: DollarSign,
      iconColor: "#22c55e",
      bgGradient: "linear-gradient(135deg, rgba(34, 197, 94, 0.2), rgba(149, 228, 104, 0.1))",
      trend: "+18%",
      trendUp: true,
      highlight: true,
    },
    {
      title: "Pendentes",
      value: stats?.pendingPayments || 0,
      icon: TrendingUp,
      iconColor: "#f59e0b",
      bgGradient: "linear-gradient(135deg, rgba(245, 158, 11, 0.15), rgba(245, 158, 11, 0.05))",
      trend: "3 novos",
      trendUp: true,
    },
  ]

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
                  background: 'linear-gradient(135deg, rgba(149, 228, 104, 0.2), rgba(139, 92, 246, 0.1))',
                  border: '1px solid rgba(149, 228, 104, 0.2)'
                }}
              >
                <Sparkles className="w-5 h-5 text-[#95e468]" />
              </div>
              <h1 className="text-3xl font-bold text-white tracking-tight">Dashboard</h1>
            </div>
            <p className="text-[#666666] text-sm">
              Visao geral completa do sistema Dragon
            </p>
          </div>
          <div 
            className="flex items-center gap-2 px-4 py-2 rounded-full self-start"
            style={{ background: 'rgba(34, 197, 94, 0.1)', border: '1px solid rgba(34, 197, 94, 0.2)' }}
          >
            <div className="w-2 h-2 rounded-full bg-[#22c55e] admin-pulse" />
            <span className="text-xs text-[#22c55e] font-medium">Atualizado agora</span>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {statCards.map((stat, index) => (
            <div
              key={index}
              className="group relative rounded-2xl p-6 transition-all duration-300 hover:-translate-y-1"
              style={{
                background: stat.highlight 
                  ? 'linear-gradient(145deg, #0f0f0f 0%, #111111 100%)'
                  : '#0f0f0f',
                border: stat.highlight 
                  ? '1px solid rgba(149, 228, 104, 0.2)' 
                  : '1px solid rgba(255,255,255,0.06)',
                boxShadow: stat.highlight 
                  ? '0 0 30px rgba(149, 228, 104, 0.1)' 
                  : 'none'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'rgba(149, 228, 104, 0.3)'
                e.currentTarget.style.boxShadow = '0 0 30px rgba(149, 228, 104, 0.15)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = stat.highlight 
                  ? 'rgba(149, 228, 104, 0.2)' 
                  : 'rgba(255,255,255,0.06)'
                e.currentTarget.style.boxShadow = stat.highlight 
                  ? '0 0 30px rgba(149, 228, 104, 0.1)' 
                  : 'none'
              }}
            >
              {/* Top highlight line */}
              <div 
                className="absolute top-0 left-4 right-4 h-px"
                style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.05), transparent)' }}
              />
              
              {/* Glow effect on hover */}
              <div 
                className="absolute top-0 right-0 w-32 h-32 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
                style={{ 
                  background: `radial-gradient(circle, ${stat.iconColor}15 0%, transparent 70%)`,
                }}
              />

              <div className="flex items-start justify-between mb-4 relative z-10">
                <div 
                  className="w-12 h-12 rounded-xl flex items-center justify-center transition-transform duration-300 group-hover:scale-110"
                  style={{ 
                    background: stat.bgGradient,
                    border: `1px solid ${stat.iconColor}20`
                  }}
                >
                  <stat.icon className="h-6 w-6" style={{ color: stat.iconColor }} />
                </div>
                
                {stat.trend && (
                  <div 
                    className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium"
                    style={{ 
                      background: stat.trendUp ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                      color: stat.trendUp ? '#22c55e' : '#ef4444'
                    }}
                  >
                    {stat.trendUp ? (
                      <ArrowUpRight className="w-3 h-3" />
                    ) : (
                      <ArrowDownRight className="w-3 h-3" />
                    )}
                    {stat.trend}
                  </div>
                )}
              </div>

              <div className="relative z-10">
                <p 
                  className="text-3xl font-bold text-white mb-1 tracking-tight"
                  style={stat.highlight ? {
                    background: 'linear-gradient(135deg, #95e468, #22c55e)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent'
                  } : {}}
                >
                  {isLoading ? (
                    <span className="inline-block w-20 h-8 rounded-lg admin-skeleton" />
                  ) : (
                    stat.value
                  )}
                </p>
                <p className="text-sm text-[#666666]">{stat.title}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Activity Section */}
        <div 
          className="rounded-2xl overflow-hidden"
          style={{ 
            background: '#0f0f0f',
            border: '1px solid rgba(255,255,255,0.06)'
          }}
        >
          {/* Card Header */}
          <div 
            className="px-6 py-5 flex items-center justify-between"
            style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
          >
            <div className="flex items-center gap-3">
              <div 
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: 'rgba(139, 92, 246, 0.1)' }}
              >
                <Activity className="w-5 h-5 text-[#8b5cf6]" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">Atividade Recente</h2>
                <p className="text-xs text-[#666666]">Ultimas acoes do sistema</p>
              </div>
            </div>
            <button 
              className="px-4 py-2 rounded-xl text-sm font-medium text-[#a1a1a1] transition-all duration-200 hover:text-white"
              style={{ 
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.06)'
              }}
            >
              Ver Todas
            </button>
          </div>

          {/* Card Content */}
          <div className="p-6">
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div 
                className="w-20 h-20 rounded-2xl flex items-center justify-center mb-6"
                style={{ 
                  background: 'linear-gradient(135deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))',
                  border: '1px solid rgba(255,255,255,0.06)'
                }}
              >
                <Activity className="h-10 w-10 text-[#444444]" />
              </div>
              <h3 className="text-lg font-medium text-[#666666] mb-2">
                Nenhuma atividade recente
              </h3>
              <p className="text-sm text-[#444444] max-w-sm">
                As atividades do sistema aparacerao aqui em tempo real
              </p>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid gap-5 sm:grid-cols-3">
          {[
            { icon: Users, label: "Gerenciar Usuarios", href: "/dragonadm/users", color: "#3b82f6" },
            { icon: Bot, label: "Visualizar Bots", href: "/dragonadm/bots", color: "#8b5cf6" },
            { icon: CreditCard, label: "Ver Pagamentos", href: "/dragonadm/payments", color: "#f59e0b" },
          ].map((action, i) => (
            <a
              key={i}
              href={action.href}
              className="group relative rounded-2xl p-6 transition-all duration-300 hover:-translate-y-1 flex items-center gap-4"
              style={{
                background: '#0f0f0f',
                border: '1px solid rgba(255,255,255,0.06)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = `${action.color}40`
                e.currentTarget.style.boxShadow = `0 0 30px ${action.color}20`
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'
                e.currentTarget.style.boxShadow = 'none'
              }}
            >
              <div 
                className="w-14 h-14 rounded-xl flex items-center justify-center transition-transform duration-300 group-hover:scale-110"
                style={{ 
                  background: `linear-gradient(135deg, ${action.color}20, ${action.color}10)`,
                  border: `1px solid ${action.color}30`
                }}
              >
                <action.icon className="h-7 w-7" style={{ color: action.color }} />
              </div>
              <div>
                <h3 className="text-base font-semibold text-white mb-1">{action.label}</h3>
                <p className="text-xs text-[#666666]">Clique para acessar</p>
              </div>
              <ArrowUpRight className="w-5 h-5 text-[#444444] ml-auto transition-all duration-300 group-hover:text-white group-hover:translate-x-1 group-hover:-translate-y-1" />
            </a>
          ))}
        </div>
      </div>
    </ScrollArea>
  )
}
