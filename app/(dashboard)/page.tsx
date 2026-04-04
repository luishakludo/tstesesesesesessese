"use client"

import { useState } from "react"
import useSWR from "swr"
import {
  Search,
  Moon,
  Sun,
  Calendar,
  Filter,
  BarChart2,
  TrendingUp,
  Clock,
  FileText,
  HelpCircle,
  ChevronDown,
  Minus,
  Plus,
  Send,
  Mic,
  MoreVertical,
  List,
  Check,
  Bot,
  MessageSquare,
  User,
  DollarSign,
  Users,
  Zap,
  ArrowUpRight,
  Sparkles,
} from "lucide-react"
import Link from "next/link"
import { useTheme } from "next-themes"
import { useBots } from "@/lib/bot-context"
import { useAuth } from "@/lib/auth-context"
import { NoBotSelected } from "@/components/no-bot-selected"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { ChatDialog } from "@/components/chat/chat-dialog"

const dateRanges = [
  { label: "Hoje", value: "today" },
  { label: "Ultimos 7 dias", value: "7days" },
  { label: "Ultimos 30 dias", value: "30days" },
  { label: "Este mes", value: "month" },
  { label: "Este ano", value: "year" },
]

const filterOptions = [
  { label: "Todos", value: "all" },
  { label: "Ativos", value: "active" },
  { label: "Inativos", value: "inactive" },
  { label: "Novos", value: "new" },
]

const fetcher = (url: string) => fetch(url).then(res => res.json())

interface Conversation {
  id: string
  nome: string
  telegram: string
  telegramUserId: string
  telegramChatId: string
  mensagens: number
  status: string
  statusLabel: string
  tempoResposta: string
  resultado: string
  resultadoTipo: string
  fluxo: string | null
  iniciadoEm: string
  ultimaAtividade: string
}

function getCurrentMonthWeekRanges() {
  const now = new Date()
  const currentMonth = now.getMonth()
  const currentYear = now.getFullYear()

  const monthNames = [
    "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
    "Jul", "Ago", "Set", "Out", "Nov", "Dez"
  ]
  const fullMonthNames = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
  ]

  const monthAbbr = monthNames[currentMonth]
  const fullMonthName = fullMonthNames[currentMonth]
  const lastDay = new Date(currentYear, currentMonth + 1, 0).getDate()

  const weeks: string[] = []
  let startDay = 1

  while (startDay <= lastDay) {
    const endDay = Math.min(startDay + 6, lastDay)
    weeks.push(`${String(startDay).padStart(2, '0')}-${String(endDay).padStart(2, '0')} ${monthAbbr}`)
    startDay = endDay + 1
  }

  weeks.push(`Todo ${fullMonthName}`)

  return { weeks, firstWeek: weeks[0] }
}

export default function DashboardPage() {
  const { selectedBot, bots, setSelectedBot } = useBots()
  const { session } = useAuth()
  const { theme, setTheme } = useTheme()
  const [selectedDateRange, setSelectedDateRange] = useState("7days")
  const [selectedFilter, setSelectedFilter] = useState("all")

  const { weeks: currentMonthWeeks, firstWeek } = getCurrentMonthWeekRanges()
  const [salesDateRange, setSalesDateRange] = useState(firstWeek)
  const [dealDateRange, setDealDateRange] = useState(firstWeek)
  const [tablePeriod, setTablePeriod] = useState("month")
  const [chatOpen, setChatOpen] = useState(false)
  const [selectedChatUserId, setSelectedChatUserId] = useState<string | null>(null)

  const { data: conversationsData, isLoading: loadingConversations } = useSWR<{
    conversations: Conversation[]
    total: number
  }>(
    selectedBot ? `/api/conversations?bot_id=${selectedBot.id}&period=${tablePeriod}` : null,
    fetcher,
    { refreshInterval: 30000 }
  )

  const { data: paymentsData } = useSWR<{
    stats: {
      totalApproved: number
      approved: number
      approvedUniqueUsers: number
    }
  }>(
    selectedBot ? `/api/payments/list?bot_id=${selectedBot.id}&page=1&per_page=1` : null,
    fetcher,
    { refreshInterval: 30000 }
  )

  const faturamento = paymentsData?.stats?.totalApproved || 0
  const conversations = conversationsData?.conversations || []

  if (!selectedBot) {
    return <NoBotSelected />
  }

  return (
    <div className="flex flex-1 flex-col h-full overflow-hidden bg-background">
      {/* Top Header */}
      <header className="px-6 lg:px-8 py-5 flex items-center justify-between flex-shrink-0 border-b border-border/50">
        {/* Search Bar */}
        <div className="flex items-center gap-3 bg-secondary/50 backdrop-blur-sm px-4 py-2.5 rounded-2xl border border-border/50 w-full max-w-[400px] group focus-within:border-accent/50 focus-within:shadow-[0_0_20px_rgba(34,197,94,0.1)] transition-all">
          <Search size={18} className="text-muted-foreground group-focus-within:text-accent transition-colors" />
          <input
            type="text"
            placeholder="Buscar..."
            className="bg-transparent border-none outline-none text-sm w-full placeholder-muted-foreground text-foreground"
          />
          <div className="hidden sm:flex items-center gap-1 bg-accent/10 text-accent px-2 py-1 rounded-lg text-[10px] font-semibold whitespace-nowrap">
            <span>⌘</span> + <span>K</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="w-10 h-10 bg-secondary/50 rounded-xl flex items-center justify-center text-muted-foreground border border-border/50 hover:border-accent/30 hover:text-accent transition-all hover:shadow-[0_0_15px_rgba(34,197,94,0.15)]"
          >
            {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <Link href="/bots">
            <button className="w-10 h-10 bg-accent/20 rounded-xl flex items-center justify-center text-accent border border-accent/30 hover:bg-accent/30 transition-all hover:shadow-[0_0_15px_rgba(34,197,94,0.3)]">
              <Bot size={18} />
            </button>
          </Link>
          <div className="h-8 w-px bg-border/50 mx-1"></div>
          <Popover>
            <PopoverTrigger asChild>
              <div className="flex items-center gap-3 cursor-pointer hover:opacity-90 transition-all group">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent to-accent/70 flex items-center justify-center shadow-[0_0_20px_rgba(34,197,94,0.3)] group-hover:shadow-[0_0_25px_rgba(34,197,94,0.4)] transition-all">
                  <Bot size={18} className="text-accent-foreground" />
                </div>
                <div className="hidden md:flex flex-col">
                  <span className="text-sm font-bold text-foreground leading-tight">{selectedBot.name}</span>
                  <span className="text-[11px] text-accent">{selectedBot.status === "active" ? "Online" : "Offline"}</span>
                </div>
                <ChevronDown size={16} className="text-muted-foreground" />
              </div>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-2 bg-card/95 backdrop-blur-xl border-border/50" align="end">
              <div className="flex flex-col gap-1">
                {bots.map((bot) => (
                  <button
                    key={bot.id}
                    onClick={() => setSelectedBot(bot)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all ${selectedBot?.id === bot.id
                        ? "bg-accent/20 text-foreground font-medium shadow-[inset_0_0_20px_rgba(34,197,94,0.1)]"
                        : "hover:bg-secondary text-foreground"
                      }`}
                  >
                    <div className={`w-2.5 h-2.5 rounded-full ${bot.status === "active" ? "bg-accent shadow-[0_0_8px_rgba(34,197,94,0.6)]" : "bg-muted-foreground"}`} />
                    <span className="truncate">{bot.name}</span>
                    {selectedBot?.id === bot.id && <Check size={14} className="ml-auto text-accent" />}
                  </button>
                ))}
                <div className="h-px bg-border/50 my-1" />
                <Link href="/bots" className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm text-accent hover:bg-accent/10 transition-all">
                  <Plus size={14} />
                  <span>Gerenciar bots</span>
                </Link>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </header>

      {/* Dashboard Content Area */}
      <div className="flex-1 overflow-y-auto px-6 lg:px-8 pb-8">
        {/* Content Header */}
        <div className="flex flex-row items-end justify-between py-6 gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-foreground tracking-tight">
              Painel Analitico
            </h1>
            <p className="text-sm text-muted-foreground mt-1">Visao geral do seu negocio</p>
          </div>
          <div className="flex items-center gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <button className="flex items-center gap-2 bg-secondary/50 backdrop-blur-sm px-4 py-2.5 rounded-xl border border-border/50 text-sm font-medium text-foreground hover:border-accent/30 transition-all">
                  <Calendar size={16} className="text-accent" />
                  {dateRanges.find(d => d.value === selectedDateRange)?.label || "Selecionar"}
                  <ChevronDown size={14} className="text-muted-foreground" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-48 p-2 bg-card/95 backdrop-blur-xl border-border/50" align="end">
                <div className="flex flex-col gap-1">
                  {dateRanges.map((range) => (
                    <button
                      key={range.value}
                      onClick={() => setSelectedDateRange(range.value)}
                      className={`flex items-center justify-between px-3 py-2 rounded-xl text-sm transition-all ${selectedDateRange === range.value
                          ? "bg-accent/20 text-foreground font-medium"
                          : "hover:bg-secondary text-foreground"
                        }`}
                    >
                      {range.label}
                      {selectedDateRange === range.value && <Check size={14} className="text-accent" />}
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>

            <Popover>
              <PopoverTrigger asChild>
                <button className={`w-10 h-10 rounded-xl border flex items-center justify-center transition-all ${selectedFilter !== "all"
                    ? "bg-accent/20 border-accent/50 text-accent shadow-[0_0_15px_rgba(34,197,94,0.2)]"
                    : "bg-secondary/50 border-border/50 text-muted-foreground hover:border-accent/30"
                  }`}>
                  <Filter size={16} />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-40 p-2 bg-card/95 backdrop-blur-xl border-border/50" align="end">
                <div className="flex flex-col gap-1">
                  {filterOptions.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setSelectedFilter(option.value)}
                      className={`flex items-center justify-between px-3 py-2 rounded-xl text-sm transition-all ${selectedFilter === option.value
                          ? "bg-accent/20 text-foreground font-medium"
                          : "hover:bg-secondary text-foreground"
                        }`}
                    >
                      {option.label}
                      {selectedFilter === option.value && <Check size={14} className="text-accent" />}
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* Metrics Grid - Premium Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {/* Receita Total */}
          <div className="group relative bg-card rounded-2xl p-5 border border-border/50 overflow-hidden transition-all hover:border-accent/30 hover:shadow-[0_0_30px_rgba(34,197,94,0.1)]">
            <div className="absolute inset-0 bg-gradient-to-br from-accent/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-accent/10 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="relative">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-xl bg-accent/20 flex items-center justify-center group-hover:shadow-[0_0_20px_rgba(34,197,94,0.3)] transition-all">
                  <DollarSign className="w-6 h-6 text-accent" />
                </div>
                <div className="flex items-center gap-1 text-accent text-xs font-semibold bg-accent/10 px-2 py-1 rounded-lg">
                  <ArrowUpRight size={12} />
                  <span>+0%</span>
                </div>
              </div>
              <p className="text-muted-foreground text-sm mb-1">Receita Total</p>
              <p className="text-2xl lg:text-3xl font-bold text-foreground">
                R$ {faturamento.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>

          {/* Usuarios Ativos */}
          <div className="group relative bg-card rounded-2xl p-5 border border-border/50 overflow-hidden transition-all hover:border-purple-500/30 hover:shadow-[0_0_30px_rgba(168,85,247,0.1)]">
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-purple-500/10 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="relative">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center group-hover:shadow-[0_0_20px_rgba(168,85,247,0.3)] transition-all">
                  <Users className="w-6 h-6 text-purple-400" />
                </div>
                <div className="flex items-center gap-1 text-purple-400 text-xs font-semibold bg-purple-500/10 px-2 py-1 rounded-lg">
                  <Sparkles size={12} />
                  <span>VIP</span>
                </div>
              </div>
              <p className="text-muted-foreground text-sm mb-1">Usuarios Ativos</p>
              <p className="text-2xl lg:text-3xl font-bold text-foreground">
                {paymentsData?.stats?.approvedUniqueUsers || 0}
              </p>
            </div>
          </div>

          {/* Total Leads */}
          <div className="group relative bg-card rounded-2xl p-5 border border-border/50 overflow-hidden transition-all hover:border-blue-500/30 hover:shadow-[0_0_30px_rgba(59,130,246,0.1)]">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="relative">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center group-hover:shadow-[0_0_20px_rgba(59,130,246,0.3)] transition-all">
                  <MessageSquare className="w-6 h-6 text-blue-400" />
                </div>
                <div className="flex items-center gap-1 text-blue-400 text-xs font-semibold bg-blue-500/10 px-2 py-1 rounded-lg">
                  <TrendingUp size={12} />
                  <span>Leads</span>
                </div>
              </div>
              <p className="text-muted-foreground text-sm mb-1">Total de Leads</p>
              <p className="text-2xl lg:text-3xl font-bold text-foreground">
                {conversationsData?.total || 0}
              </p>
            </div>
          </div>

          {/* Vendas Aprovadas */}
          <div className="group relative bg-card rounded-2xl p-5 border border-border/50 overflow-hidden transition-all hover:border-cyan-500/30 hover:shadow-[0_0_30px_rgba(6,182,212,0.1)]">
            <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-cyan-500/10 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="relative">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-xl bg-cyan-500/20 flex items-center justify-center group-hover:shadow-[0_0_20px_rgba(6,182,212,0.3)] transition-all">
                  <Zap className="w-6 h-6 text-cyan-400" />
                </div>
                <div className="flex items-center gap-1 text-cyan-400 text-xs font-semibold bg-cyan-500/10 px-2 py-1 rounded-lg">
                  <Check size={12} />
                  <span>Aprovadas</span>
                </div>
              </div>
              <p className="text-muted-foreground text-sm mb-1">Vendas Aprovadas</p>
              <p className="text-2xl lg:text-3xl font-bold text-foreground">
                {paymentsData?.stats?.approved || 0}
              </p>
            </div>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6">
          {/* Left Column - Charts */}
          <div className="flex flex-col gap-6">
            {/* Sales Analysis + Deal Analysis Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Sales Analysis Card */}
              <div className="group bg-card rounded-2xl p-5 border border-border/50 flex flex-col hover:border-accent/30 transition-all">
                <div className="flex justify-between items-center mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-accent shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
                    <h3 className="font-semibold text-foreground text-sm">Analise de Vendas</h3>
                  </div>
                  <Popover>
                    <PopoverTrigger asChild>
                      <button className="text-[10px] font-medium text-muted-foreground flex items-center hover:text-foreground transition-colors bg-secondary/50 px-2 py-1 rounded-lg">
                        {salesDateRange} <ChevronDown size={12} className="ml-1" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-36 p-2 bg-card/95 backdrop-blur-xl border-border/50" align="end">
                      <div className="flex flex-col gap-1">
                        {currentMonthWeeks.map((range) => (
                          <button
                            key={range}
                            onClick={() => setSalesDateRange(range)}
                            className={`px-3 py-1.5 rounded-lg text-xs text-left transition-all ${salesDateRange === range
                                ? "bg-accent/20 text-foreground font-medium"
                                : "hover:bg-secondary text-muted-foreground"
                              }`}
                          >
                            {range}
                          </button>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="flex-1 flex items-center gap-4">
                  {/* Donut Chart */}
                  <div className="relative w-28 h-28 flex-shrink-0">
                    <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
                      <circle cx="50" cy="50" r="40" fill="transparent" className="stroke-secondary" strokeWidth="10" />
                      <circle cx="50" cy="50" r="40" fill="transparent" stroke="url(#premiumGradient)" strokeWidth="12" strokeDasharray="100 251" strokeDashoffset="0" strokeLinecap="round" className="drop-shadow-[0_0_10px_rgba(34,197,94,0.5)]" />
                      <defs>
                        <linearGradient id="premiumGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor="hsl(var(--accent))" />
                          <stop offset="100%" stopColor="hsl(262 83% 65%)" />
                        </linearGradient>
                      </defs>
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-lg font-bold text-foreground">R${faturamento > 0 ? (faturamento / 1000).toFixed(1) + "k" : "0"}</span>
                      <span className="text-[10px] text-muted-foreground">Total</span>
                    </div>
                  </div>

                  {/* Legend */}
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
                      <span className="text-sm font-bold text-foreground">{conversationsData?.total || 0}</span>
                      <span className="text-xs text-muted-foreground">Leads</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded bg-accent shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
                      <span className="text-sm font-bold text-foreground">{paymentsData?.stats?.approved || 0}</span>
                      <span className="text-xs text-muted-foreground">Vendas</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.5)]" />
                      <span className="text-sm font-bold text-foreground">0%</span>
                      <span className="text-xs text-muted-foreground">Conv.</span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-border/50 text-[10px] text-muted-foreground flex items-center gap-1">
                  <HelpCircle size={10} />
                  Calculado a partir da atividade do periodo
                </div>
              </div>

              {/* Deal Analysis Card */}
              <div className="group relative bg-gradient-to-br from-accent/20 to-accent/5 rounded-2xl p-5 border border-accent/30 flex flex-col overflow-hidden hover:border-accent/50 transition-all">
                <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(34,197,94,0.1) 10px, rgba(34,197,94,0.1) 20px)" }} />
                <div className="absolute -bottom-20 -right-20 w-40 h-40 bg-accent/20 rounded-full blur-3xl" />
                
                <div className="flex justify-between items-center mb-3 relative z-10">
                  <div className="flex items-center gap-2">
                    <BarChart2 size={14} className="text-accent" />
                    <h3 className="font-semibold text-foreground text-sm">Analise de Negocios</h3>
                  </div>
                  <Popover>
                    <PopoverTrigger asChild>
                      <button className="text-[10px] font-medium text-accent flex items-center hover:text-foreground transition-colors bg-accent/20 px-2 py-1 rounded-lg">
                        {dealDateRange} <ChevronDown size={12} className="ml-1" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-36 p-2 bg-card/95 backdrop-blur-xl border-border/50" align="end">
                      <div className="flex flex-col gap-1">
                        {currentMonthWeeks.map((range) => (
                          <button
                            key={range}
                            onClick={() => setDealDateRange(range)}
                            className={`px-3 py-1.5 rounded-lg text-xs text-left transition-all ${dealDateRange === range
                                ? "bg-accent/30 text-foreground font-medium"
                                : "hover:bg-secondary text-muted-foreground"
                              }`}
                          >
                            {range}
                          </button>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Mini Cards */}
                <div className="flex-1 flex items-end gap-3 mt-4 relative z-10">
                  <div className="flex-1 bg-accent rounded-xl p-3 shadow-[0_0_20px_rgba(34,197,94,0.3)]">
                    <div className="bg-background/90 backdrop-blur-sm px-2 py-1 rounded-lg text-xs font-bold text-foreground inline-block">
                      Ganhos 0
                    </div>
                  </div>
                  <div className="flex-1 bg-secondary rounded-xl p-3 border border-border/50">
                    <div className="bg-card/80 backdrop-blur-sm px-2 py-1 rounded-lg text-xs font-bold text-foreground inline-block">
                      Perdas 0
                    </div>
                  </div>
                  <div className="flex-1 bg-purple-500/30 rounded-xl p-3 border border-purple-500/30">
                    <div className="bg-background/90 backdrop-blur-sm px-2 py-1 rounded-lg text-xs font-bold text-foreground inline-block">
                      ROI 0%
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Conversations Table */}
            <div className="bg-card rounded-2xl p-6 border border-border/50">
              <div className="flex flex-row justify-between items-center mb-6 gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-accent/20 rounded-xl flex items-center justify-center shadow-[0_0_15px_rgba(34,197,94,0.2)]">
                    <List size={18} className="text-accent" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground text-lg">Conversas Recentes</h3>
                    <p className="text-xs text-muted-foreground">{conversations.length} conversas no periodo</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Popover>
                    <PopoverTrigger asChild>
                      <button className="flex items-center gap-2 text-sm font-medium text-foreground bg-secondary/50 px-3 py-2 rounded-xl border border-border/50 hover:border-accent/30 transition-all">
                        {tablePeriod === "week" ? "Semana" : tablePeriod === "month" ? "Mes" : "Ano"}
                        <ChevronDown size={14} className="text-muted-foreground" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-32 p-2 bg-card/95 backdrop-blur-xl border-border/50" align="end">
                      <div className="flex flex-col gap-1">
                        {[
                          { label: "Semana", value: "week" },
                          { label: "Mes", value: "month" },
                          { label: "Ano", value: "year" },
                        ].map((period) => (
                          <button
                            key={period.value}
                            onClick={() => setTablePeriod(period.value)}
                            className={`px-3 py-1.5 rounded-lg text-xs text-left transition-all ${tablePeriod === period.value
                                ? "bg-accent/20 text-foreground font-medium"
                                : "hover:bg-secondary text-muted-foreground"
                              }`}
                          >
                            {period.label}
                          </button>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                  <button className="w-10 h-10 rounded-xl bg-secondary/50 border border-border/50 flex items-center justify-center hover:border-accent/30 transition-all">
                    <MoreVertical size={16} className="text-muted-foreground" />
                  </button>
                </div>
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[600px]">
                  <thead>
                    <tr className="text-xs text-muted-foreground border-b border-border/50">
                      <th className="pb-4 font-medium px-2">Usuario</th>
                      <th className="pb-4 font-medium px-2">Mensagens</th>
                      <th className="pb-4 font-medium px-2">Status</th>
                      <th className="pb-4 font-medium px-2">Tempo</th>
                      <th className="pb-4 font-medium px-2">Resultado</th>
                      <th className="pb-4 font-medium px-2 text-right">Acao</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loadingConversations ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-sm text-muted-foreground">
                          <div className="flex flex-col items-center gap-3">
                            <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                            <span>Carregando conversas...</span>
                          </div>
                        </td>
                      </tr>
                    ) : conversations.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center">
                          <div className="flex flex-col items-center gap-3 text-muted-foreground">
                            <MessageSquare size={32} className="opacity-30" />
                            <span className="text-sm">Nenhuma conversa registrada</span>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      conversations.map((conv) => (
                        <tr 
                          key={conv.id} 
                          className="border-b border-border/30 hover:bg-secondary/30 transition-colors cursor-pointer group"
                          onClick={() => {
                            setSelectedChatUserId(conv.telegramUserId)
                            setChatOpen(true)
                          }}
                        >
                          <td className="py-4 px-2">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent/30 to-purple-500/30 flex items-center justify-center border border-accent/20 group-hover:shadow-[0_0_15px_rgba(34,197,94,0.2)] transition-all">
                                <User size={16} className="text-foreground" />
                              </div>
                              <div className="flex flex-col">
                                <span className="text-sm font-medium text-foreground">{conv.nome}</span>
                                <span className="text-xs text-muted-foreground">{conv.telegram}</span>
                              </div>
                            </div>
                          </td>
                          <td className="py-4 px-2">
                            <div className="flex items-center gap-2">
                              <MessageSquare size={14} className="text-muted-foreground" />
                              <span className="text-sm font-medium text-foreground">{conv.mensagens}</span>
                              {conv.fluxo && (
                                <span className="text-[10px] text-muted-foreground bg-secondary px-2 py-0.5 rounded-lg truncate max-w-[80px]">
                                  {conv.fluxo}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-4 px-2">
                            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium ${
                              conv.status === "ativo" 
                                ? "bg-accent/20 text-accent" 
                                : conv.status === "aguardando"
                                ? "bg-yellow-500/20 text-yellow-500"
                                : conv.status === "concluido"
                                ? "bg-blue-500/20 text-blue-400"
                                : "bg-secondary text-muted-foreground"
                            }`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${
                                conv.status === "ativo" 
                                  ? "bg-accent shadow-[0_0_6px_rgba(34,197,94,0.8)]" 
                                  : conv.status === "aguardando"
                                  ? "bg-yellow-500"
                                  : conv.status === "concluido"
                                  ? "bg-blue-500"
                                  : "bg-muted-foreground"
                              }`} />
                              {conv.statusLabel}
                            </span>
                          </td>
                          <td className="py-4 px-2">
                            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                              <Clock size={14} />
                              {conv.tempoResposta}
                            </div>
                          </td>
                          <td className="py-4 px-2">
                            <span className={`text-sm font-medium ${
                              conv.resultadoTipo === "positivo" 
                                ? "text-accent" 
                                : conv.resultadoTipo === "negativo"
                                ? "text-red-400"
                                : "text-muted-foreground"
                            }`}>
                              {conv.resultado}
                            </span>
                          </td>
                          <td className="py-4 px-2 text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation()
                                setSelectedChatUserId(conv.telegramUserId)
                                setChatOpen(true)
                              }}
                              className="gap-1.5 bg-secondary/50 border-border/50 hover:border-accent/50 hover:text-accent"
                            >
                              <MessageSquare size={14} />
                              Chat
                            </Button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Right Column - Dragon AI Panel */}
          <div className="hidden lg:block">
            <div className="sticky top-6 bg-card rounded-2xl p-5 flex flex-col border border-border/50 overflow-hidden shadow-[0_0_40px_rgba(0,0,0,0.3)]">
              {/* Glow Effects */}
              <div className="absolute top-0 right-0 w-24 h-24 bg-accent/20 rounded-full blur-3xl" />
              <div className="absolute bottom-0 left-0 w-20 h-20 bg-purple-500/10 rounded-full blur-3xl" />

              {/* Header */}
              <div className="flex justify-between items-center mb-4 relative z-10">
                <button className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center border border-border/50 text-muted-foreground hover:text-foreground hover:border-accent/30 transition-all">
                  <Minus size={14} />
                </button>
                <span className="font-black text-sm text-foreground tracking-[0.15em] italic uppercase bg-gradient-to-r from-accent to-purple-400 bg-clip-text text-transparent">Dragon AI</span>
                <button className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center border border-border/50 text-muted-foreground hover:text-foreground hover:border-accent/30 transition-all">
                  <Plus size={14} />
                </button>
              </div>

              {/* AI Sphere */}
              <div className="flex-1 flex flex-col items-center justify-center relative z-10 py-6">
                <div className="relative w-28 h-28 mb-4 group cursor-pointer">
                  {/* Main Sphere */}
                  <div className="absolute inset-0 rounded-full bg-gradient-to-br from-accent via-green-500 to-green-900 shadow-[0_0_40px_rgba(34,197,94,0.4)] animate-pulse transition-all duration-700 group-hover:scale-105 group-hover:shadow-[0_0_60px_rgba(34,197,94,0.6)]" />
                  
                  {/* Glass Effect */}
                  <div className="absolute inset-0 rounded-full shadow-[inset_-10px_-10px_25px_rgba(0,0,0,0.6),inset_10px_10px_25px_rgba(255,255,255,0.2)]" />
                  
                  {/* Light Points */}
                  <div className="absolute top-3 left-5 w-6 h-6 rounded-full bg-white/30 blur-md" />
                  <div className="absolute bottom-5 right-5 w-10 h-10 rounded-full bg-cyan-400/20 blur-xl" />
                  
                  {/* Outer Ring */}
                  <div className="absolute -inset-3 rounded-full border border-accent/20 scale-95 group-hover:scale-100 transition-transform duration-1000" />
                </div>

                <h2 className="text-foreground/70 text-sm font-medium text-center">Como posso ajudar?</h2>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 mb-3 relative z-10">
                <button className="flex-1 bg-secondary hover:bg-secondary/80 px-3 py-2.5 rounded-xl border border-border/50 flex items-center gap-2 transition-all group hover:border-accent/30">
                  <div className="w-7 h-7 rounded-lg border border-accent/50 flex items-center justify-center group-hover:shadow-[0_0_10px_rgba(34,197,94,0.3)] transition-all">
                    <Clock size={12} className="text-accent" />
                  </div>
                  <span className="text-xs font-medium text-foreground/80">Analise</span>
                </button>

                <button className="flex-1 bg-secondary hover:bg-secondary/80 px-3 py-2.5 rounded-xl border border-border/50 flex items-center gap-2 transition-all group hover:border-purple-500/30">
                  <div className="w-7 h-7 rounded-lg bg-purple-500/20 flex items-center justify-center">
                    <FileText size={12} className="text-purple-400" />
                  </div>
                  <span className="text-xs font-medium text-foreground/80">Relatorio</span>
                </button>
              </div>

              {/* Input */}
              <div className="relative z-10">
                <div className="bg-secondary rounded-xl p-1.5 pl-3 flex items-center border border-border/50 focus-within:border-accent/50 transition-all">
                  <input
                    type="text"
                    placeholder="Pergunte o que quiser..."
                    className="bg-transparent border-none outline-none text-xs text-foreground placeholder-muted-foreground w-full font-medium"
                  />
                  <div className="flex items-center gap-1">
                    <button className="w-7 h-7 flex items-center justify-center text-muted-foreground hover:text-accent transition-colors">
                      <Send size={12} className="transform rotate-45" />
                    </button>
                    <button className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center text-accent-foreground hover:shadow-[0_0_15px_rgba(34,197,94,0.4)] transition-all">
                      <Mic size={14} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Chat Dialog */}
      <ChatDialog 
        open={chatOpen} 
        onOpenChange={setChatOpen}
        botId={selectedBot?.id}
        initialUserId={selectedChatUserId || undefined}
      />
    </div>
  )
}
