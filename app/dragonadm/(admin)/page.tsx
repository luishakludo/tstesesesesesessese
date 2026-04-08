"use client"

import { useEffect, useState } from "react"
import {
  Users,
  Bot,
  CreditCard,
  TrendingUp,
  Activity,
  DollarSign,
  ArrowUpRight,
  Zap,
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
    { title: "Total Usuarios", value: stats?.totalUsers || 0, icon: Users },
    { title: "Usuarios Ativos", value: stats?.activeUsers || 0, icon: Activity },
    { title: "Banidos", value: stats?.bannedUsers || 0, icon: Users },
    { title: "Total Bots", value: stats?.totalBots || 0, icon: Bot },
    { title: "Bots Ativos", value: stats?.activeBots || 0, icon: Zap, highlight: true },
    { title: "Pagamentos", value: stats?.totalPayments || 0, icon: CreditCard },
    { 
      title: "Receita Total", 
      value: `R$ ${(stats?.totalRevenue || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
      icon: DollarSign,
      highlight: true
    },
    { title: "Pendentes", value: stats?.pendingPayments || 0, icon: TrendingUp },
  ]

  return (
    <div className="p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#95e468]/10">
          <div className="w-2 h-2 rounded-full bg-[#95e468]" />
          <span className="text-xs text-[#95e468]">Atualizado</span>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat, index) => (
          <div
            key={index}
            className={`rounded-xl p-5 border transition-all hover:border-[#95e468]/30 ${
              stat.highlight ? 'bg-[#95e468]/5 border-[#95e468]/20' : 'bg-[#111] border-white/5'
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                stat.highlight ? 'bg-[#95e468]/20' : 'bg-white/5'
              }`}>
                <stat.icon className={`h-5 w-5 ${stat.highlight ? 'text-[#95e468]' : 'text-white/60'}`} />
              </div>
            </div>
            <p className={`text-2xl font-bold mb-1 ${stat.highlight ? 'text-[#95e468]' : 'text-white'}`}>
              {isLoading ? '...' : stat.value}
            </p>
            <p className="text-sm text-[#666]">{stat.title}</p>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { icon: Users, label: "Usuarios", href: "/dragonadm/users" },
          { icon: Bot, label: "Bots", href: "/dragonadm/bots" },
          { icon: CreditCard, label: "Pagamentos", href: "/dragonadm/payments" },
        ].map((action, i) => (
          <a
            key={i}
            href={action.href}
            className="group rounded-xl p-4 bg-[#111] border border-white/5 hover:border-[#95e468]/30 transition-all flex items-center gap-4"
          >
            <div className="w-12 h-12 rounded-lg bg-[#95e468]/10 flex items-center justify-center group-hover:bg-[#95e468]/20 transition-colors">
              <action.icon className="h-6 w-6 text-[#95e468]" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-white">{action.label}</h3>
              <p className="text-xs text-[#666]">Gerenciar</p>
            </div>
            <ArrowUpRight className="w-4 h-4 text-[#444] ml-auto group-hover:text-[#95e468] transition-colors" />
          </a>
        ))}
      </div>
    </div>
  )
}
