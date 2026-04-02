"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Users,
  Bot,
  CreditCard,
  TrendingUp,
  Activity,
  DollarSign,
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
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
    },
    {
      title: "Usuarios Ativos",
      value: stats?.activeUsers || 0,
      icon: Activity,
      color: "text-emerald-500",
      bgColor: "bg-emerald-500/10",
    },
    {
      title: "Usuarios Banidos",
      value: stats?.bannedUsers || 0,
      icon: Users,
      color: "text-red-500",
      bgColor: "bg-red-500/10",
    },
    {
      title: "Total de Bots",
      value: stats?.totalBots || 0,
      icon: Bot,
      color: "text-purple-500",
      bgColor: "bg-purple-500/10",
    },
    {
      title: "Bots Ativos",
      value: stats?.activeBots || 0,
      icon: Bot,
      color: "text-accent",
      bgColor: "bg-accent/10",
    },
    {
      title: "Total Pagamentos",
      value: stats?.totalPayments || 0,
      icon: CreditCard,
      color: "text-orange-500",
      bgColor: "bg-orange-500/10",
    },
    {
      title: "Receita Total",
      value: `R$ ${(stats?.totalRevenue || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
      icon: DollarSign,
      color: "text-emerald-500",
      bgColor: "bg-emerald-500/10",
    },
    {
      title: "Pagamentos Pendentes",
      value: stats?.pendingPayments || 0,
      icon: TrendingUp,
      color: "text-yellow-500",
      bgColor: "bg-yellow-500/10",
    },
  ]

  return (
    <ScrollArea className="flex-1">
      <div className="p-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Visao geral do sistema Dragon
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {statCards.map((stat, index) => (
            <Card key={index} className="bg-card border-border">
              <CardContent className="p-5">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-xl ${stat.bgColor} flex items-center justify-center`}>
                    <stat.icon className={`h-6 w-6 ${stat.color}`} />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground">
                      {isLoading ? "..." : stat.value}
                    </p>
                    <p className="text-xs text-muted-foreground">{stat.title}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Recent Activity */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-foreground">
              Atividade Recente
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Activity className="h-12 w-12 text-muted-foreground/30 mb-4" />
              <p className="text-sm text-muted-foreground">
                Nenhuma atividade recente
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </ScrollArea>
  )
}
