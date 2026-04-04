"use client"

import { ScrollArea } from "@/components/ui/scroll-area"
import { BarChart3, TrendingUp, Users, Bot, Activity, ArrowUpRight } from "lucide-react"

export default function AnalyticsPage() {
  const stats = [
    { icon: TrendingUp, label: "Crescimento", value: "--", color: "#95e468", bg: "rgba(149, 228, 104, 0.1)" },
    { icon: Users, label: "Usuarios Novos", value: "--", color: "#3b82f6", bg: "rgba(59, 130, 246, 0.1)" },
    { icon: Bot, label: "Bots Criados", value: "--", color: "#8b5cf6", bg: "rgba(139, 92, 246, 0.1)" },
    { icon: BarChart3, label: "Conversoes", value: "--", color: "#f59e0b", bg: "rgba(245, 158, 11, 0.1)" },
  ]

  return (
    <ScrollArea className="flex-1">
      <div className="p-6 lg:p-8 space-y-8">
        {/* Header */}
        <div className="pb-6" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="flex items-center gap-3 mb-2">
            <div 
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ 
                background: 'linear-gradient(135deg, rgba(149, 228, 104, 0.2), rgba(34, 197, 94, 0.1))',
                border: '1px solid rgba(149, 228, 104, 0.2)'
              }}
            >
              <TrendingUp className="w-5 h-5 text-[#95e468]" />
            </div>
            <h1 className="text-3xl font-bold text-white tracking-tight">Analytics</h1>
          </div>
          <p className="text-[#666666] text-sm">
            Metricas e estatisticas do sistema
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat, i) => (
            <div
              key={i}
              className="group rounded-2xl p-6 transition-all duration-300 hover:-translate-y-1"
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
              <div className="flex items-start justify-between mb-4">
                <div 
                  className="w-12 h-12 rounded-xl flex items-center justify-center transition-transform duration-300 group-hover:scale-110"
                  style={{ background: stat.bg }}
                >
                  <stat.icon className="h-6 w-6" style={{ color: stat.color }} />
                </div>
                <div 
                  className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium"
                  style={{ background: 'rgba(102, 102, 102, 0.1)', color: '#666666' }}
                >
                  <ArrowUpRight className="w-3 h-3" />
                  --%
                </div>
              </div>
              <p className="text-3xl font-bold text-white mb-1">{stat.value}</p>
              <p className="text-sm text-[#666666]">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Charts Section */}
        <div 
          className="rounded-2xl overflow-hidden"
          style={{ 
            background: '#0f0f0f',
            border: '1px solid rgba(255,255,255,0.06)'
          }}
        >
          <div 
            className="px-6 py-5 flex items-center gap-3"
            style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
          >
            <div 
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: 'rgba(139, 92, 246, 0.1)' }}
            >
              <BarChart3 className="w-5 h-5 text-[#8b5cf6]" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Graficos e Metricas</h2>
              <p className="text-xs text-[#666666]">Visualizacao detalhada dos dados</p>
            </div>
          </div>
          <div className="p-6">
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div 
                className="w-24 h-24 rounded-3xl flex items-center justify-center mb-6"
                style={{ 
                  background: 'linear-gradient(135deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))',
                  border: '1px solid rgba(255,255,255,0.06)'
                }}
              >
                <BarChart3 className="h-12 w-12 text-[#444444]" />
              </div>
              <h3 className="text-xl font-semibold text-[#666666] mb-2">
                Em Desenvolvimento
              </h3>
              <p className="text-sm text-[#444444] max-w-sm">
                Graficos e metricas detalhadas estarao disponiveis em breve
              </p>
            </div>
          </div>
        </div>

        {/* Quick Insights */}
        <div className="grid gap-5 sm:grid-cols-2">
          {[
            { 
              title: "Tendencia de Crescimento", 
              description: "Analise de usuarios e receita ao longo do tempo",
              icon: TrendingUp,
              color: "#22c55e"
            },
            { 
              title: "Engajamento de Usuarios", 
              description: "Metricas de uso e retencao de usuarios",
              icon: Activity,
              color: "#3b82f6"
            },
          ].map((card, i) => (
            <div
              key={i}
              className="group rounded-2xl p-6 transition-all duration-300 hover:-translate-y-1"
              style={{
                background: '#0f0f0f',
                border: '1px solid rgba(255,255,255,0.06)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = `${card.color}30`
                e.currentTarget.style.boxShadow = `0 0 25px ${card.color}15`
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'
                e.currentTarget.style.boxShadow = 'none'
              }}
            >
              <div 
                className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
                style={{ background: `${card.color}15` }}
              >
                <card.icon className="h-6 w-6" style={{ color: card.color }} />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">{card.title}</h3>
              <p className="text-sm text-[#666666]">{card.description}</p>
              <div className="mt-4 pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <span className="text-xs text-[#444444]">Em breve</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </ScrollArea>
  )
}
