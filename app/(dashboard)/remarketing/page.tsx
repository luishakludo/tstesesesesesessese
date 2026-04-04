"use client"

import { useEffect, useState, useMemo } from "react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  Plus,
  Search,
  Users,
  Target,
  Play,
  Pause,
  MoreVertical,
  X,
  Send,
  UserX,
  ShoppingCart,
  CheckCircle2,
  Trash2,
  RefreshCw,
  Bot,
  ChevronRight,
  Filter,
  Download,
  Upload,
  Eye,
  BarChart3,
  TrendingUp,
  Clock,
  MessageSquare,
  UserPlus,
  Zap,
  Settings,
  Copy,
  ExternalLink
} from "lucide-react"
import useSWR from "swr"

// Types
interface BotUser {
  id: string
  bot_id: string
  telegram_user_id: number
  chat_id: number
  first_name: string
  last_name?: string
  username?: string
  funnel_step: string
  payment_status: string
  is_subscriber: boolean
  created_at: string
}

interface BotData {
  id: string
  name: string
  token: string
  user_count?: number
  users?: BotUser[]
}

interface Audience {
  id: string
  name: string
  description: string
  icon: React.ElementType
  color: string
  bgColor: string
  borderColor: string
  filter: (user: BotUser) => boolean
}

interface Campaign {
  id: string
  name: string
  status: "rascunho" | "ativa" | "pausada" | "concluida"
  bot_id: string
  bot_name?: string
  audience_id: string
  audience_filters?: AudienceFilter[]
  message_template?: string
  scheduled_at?: string
  created_at: string
  sent_count: number
  delivered_count: number
  open_rate: number
  click_rate: number
}

interface AudienceFilter {
  type: "funnel_step" | "payment_status" | "is_subscriber" | "created_after" | "created_before"
  value: string | boolean | Date
}

// Audiences
const AUDIENCES: Audience[] = [
  {
    id: "all",
    name: "Todos os Usuarios",
    description: "Todos que interagiram com o bot",
    icon: Users,
    color: "text-blue-400",
    bgColor: "bg-blue-500/10",
    borderColor: "border-blue-500/30",
    filter: () => true
  },
  {
    id: "started_not_continued",
    name: "Iniciou mas nao continuou",
    description: "Deram /start mas nao avancaram no fluxo",
    icon: UserX,
    color: "text-orange-400",
    bgColor: "bg-orange-500/10",
    borderColor: "border-orange-500/30",
    filter: (user) => user.funnel_step === "start" || user.funnel_step === "welcome"
  },
  {
    id: "not_paid",
    name: "Nao pagou",
    description: "Chegaram ate o pagamento mas nao finalizaram",
    icon: ShoppingCart,
    color: "text-red-400",
    bgColor: "bg-red-500/10",
    borderColor: "border-red-500/30",
    filter: (user) => user.payment_status === "pending" || user.payment_status === "abandoned"
  },
  {
    id: "paid",
    name: "Pagou",
    description: "Ja realizaram pelo menos uma compra",
    icon: CheckCircle2,
    color: "text-emerald-400",
    bgColor: "bg-emerald-500/10",
    borderColor: "border-emerald-500/30",
    filter: (user) => user.payment_status === "paid" || user.is_subscriber
  },
  {
    id: "subscribers",
    name: "Assinantes Ativos",
    description: "Usuarios com assinatura ativa",
    icon: Zap,
    color: "text-purple-400",
    bgColor: "bg-purple-500/10",
    borderColor: "border-purple-500/30",
    filter: (user) => user.is_subscriber === true
  }
]

// Fetcher
const fetcher = (url: string) => fetch(url).then(res => res.json())

export default function RemarketingPage() {
  const [activeTab, setActiveTab] = useState<"campaigns" | "audiences" | "contacts">("campaigns")
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedBot, setSelectedBot] = useState<string | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showAudienceModal, setShowAudienceModal] = useState(false)
  const [selectedAudience, setSelectedAudience] = useState<string | null>(null)
  const [expandedBot, setExpandedBot] = useState<string | null>(null)
  
  // Create campaign states
  const [createStep, setCreateStep] = useState(1)
  const [newCampaign, setNewCampaign] = useState({
    name: "",
    bot_id: "",
    audience_id: "",
    message_template: "",
    scheduled_at: ""
  })

  // Fetch bots
  const { data: botsData, isLoading: loadingBots } = useSWR("/api/bots", fetcher)
  const bots: BotData[] = botsData?.bots || []

  // Fetch bot users for selected bot
  const { data: botUsersData, isLoading: loadingUsers } = useSWR(
    selectedBot ? `/api/bots/${selectedBot}/users` : null,
    fetcher
  )
  const botUsers: BotUser[] = botUsersData?.users || []

  // Fetch campaigns
  const { data: campaignsData, isLoading: loadingCampaigns, mutate: mutateCampaigns } = useSWR(
    selectedBot ? `/api/campaigns?bot_id=${selectedBot}` : "/api/remarketing/campaigns",
    fetcher
  )
  const campaigns: Campaign[] = campaignsData?.campaigns || []

  // Stats
  const stats = useMemo(() => {
    const totalUsers = bots.reduce((acc, bot) => acc + (bot.user_count || 0), 0)
    const activeCampaigns = campaigns.filter(c => c.status === "ativa").length
    const totalSent = campaigns.reduce((acc, c) => acc + (c.sent_count || 0), 0)
    const avgOpenRate = campaigns.length > 0 
      ? campaigns.reduce((acc, c) => acc + (c.open_rate || 0), 0) / campaigns.length 
      : 0

    return { totalUsers, activeCampaigns, totalCampaigns: campaigns.length, totalSent, avgOpenRate }
  }, [bots, campaigns])

  // Audience stats for selected bot
  const audienceStats = useMemo(() => {
    if (!botUsers.length) return {}
    
    return AUDIENCES.reduce((acc, audience) => {
      acc[audience.id] = botUsers.filter(audience.filter).length
      return acc
    }, {} as Record<string, number>)
  }, [botUsers])

  const getStatusInfo = (status: string) => {
    switch (status) {
      case "ativa":
        return { label: "Ativa", color: "text-emerald-400", bgColor: "bg-emerald-500/10" }
      case "pausada":
        return { label: "Pausada", color: "text-yellow-400", bgColor: "bg-yellow-500/10" }
      case "rascunho":
        return { label: "Rascunho", color: "text-gray-400", bgColor: "bg-gray-500/10" }
      case "concluida":
        return { label: "Concluida", color: "text-blue-400", bgColor: "bg-blue-500/10" }
      default:
        return { label: status, color: "text-gray-400", bgColor: "bg-gray-500/10" }
    }
  }

  const handleCreateCampaign = async () => {
    if (!newCampaign.name || !newCampaign.bot_id || !newCampaign.audience_id) return
    
    try {
      const res = await fetch("/api/remarketing/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newCampaign)
      })
      
      if (res.ok) {
        mutateCampaigns()
        resetCreateModal()
      }
    } catch (error) {
      console.error("Error creating campaign:", error)
    }
  }

  const resetCreateModal = () => {
    setShowCreateModal(false)
    setCreateStep(1)
    setNewCampaign({
      name: "",
      bot_id: "",
      audience_id: "",
      message_template: "",
      scheduled_at: ""
    })
  }

  const filteredCampaigns = campaigns.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <>
      <ScrollArea className="flex-1">
        <div className="p-4 md:p-8 bg-[#0a0a0a] min-h-[calc(100vh-60px)]">
          <div className="max-w-6xl mx-auto">
            
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
              <div>
                <h1 className="text-2xl font-bold text-white mb-1">Remarketing</h1>
                <p className="text-gray-500">Gerencie publicos e campanhas para seus bots</p>
              </div>
              <button 
                onClick={() => setShowCreateModal(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#bfff00] text-black text-sm font-bold hover:bg-[#a8e600] transition-colors shadow-lg shadow-[#bfff00]/20"
              >
                <Plus className="h-4 w-4" />
                Nova Campanha
              </button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <div className="relative rounded-2xl p-5 overflow-hidden bg-[#1c1c1e] border border-[#2a2a2e]">
                <div className="absolute bottom-0 left-0 right-0 h-20 pointer-events-none" style={{ background: "radial-gradient(ellipse at center bottom, rgba(59, 130, 246, 0.15) 0%, transparent 70%)" }} />
                <div className="relative">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Total Contatos</span>
                    <Users className="h-4 w-4 text-blue-400" />
                  </div>
                  <p className="text-2xl font-bold text-white">{stats.totalUsers.toLocaleString("pt-BR")}</p>
                  <p className="text-xs text-gray-500 mt-1">em todos os bots</p>
                </div>
              </div>

              <div className="relative rounded-2xl p-5 overflow-hidden bg-[#1c1c1e] border border-[#2a2a2e]">
                <div className="absolute bottom-0 left-0 right-0 h-20 pointer-events-none" style={{ background: "radial-gradient(ellipse at center bottom, rgba(34, 197, 94, 0.15) 0%, transparent 70%)" }} />
                <div className="relative">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Campanhas Ativas</span>
                    <Play className="h-4 w-4 text-emerald-400" />
                  </div>
                  <p className="text-2xl font-bold text-emerald-400">{stats.activeCampaigns}</p>
                  <p className="text-xs text-gray-500 mt-1">de {stats.totalCampaigns} total</p>
                </div>
              </div>

              <div className="relative rounded-2xl p-5 overflow-hidden bg-[#1c1c1e] border border-[#2a2a2e]">
                <div className="absolute bottom-0 left-0 right-0 h-20 pointer-events-none" style={{ background: "radial-gradient(ellipse at center bottom, rgba(168, 85, 247, 0.15) 0%, transparent 70%)" }} />
                <div className="relative">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Mensagens Enviadas</span>
                    <Send className="h-4 w-4 text-purple-400" />
                  </div>
                  <p className="text-2xl font-bold text-white">{stats.totalSent.toLocaleString("pt-BR")}</p>
                  <p className="text-xs text-gray-500 mt-1">no total</p>
                </div>
              </div>

              <div className="relative rounded-2xl p-5 overflow-hidden bg-[#1c1c1e] border border-[#2a2a2e]">
                <div className="absolute bottom-0 left-0 right-0 h-20 pointer-events-none" style={{ background: "radial-gradient(ellipse at center bottom, rgba(251, 191, 36, 0.15) 0%, transparent 70%)" }} />
                <div className="relative">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Taxa de Abertura</span>
                    <TrendingUp className="h-4 w-4 text-amber-400" />
                  </div>
                  <p className="text-2xl font-bold text-white">{stats.avgOpenRate.toFixed(1)}%</p>
                  <p className="text-xs text-gray-500 mt-1">media geral</p>
                </div>
              </div>
            </div>

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)} className="space-y-6">
              <TabsList className="bg-[#1c1c1e] border border-[#2a2a2e] p-1 rounded-xl">
                <TabsTrigger value="campaigns" className="data-[state=active]:bg-[#bfff00] data-[state=active]:text-black rounded-lg px-4 text-gray-400">
                  <Target className="h-4 w-4 mr-2" />
                  Campanhas
                </TabsTrigger>
                <TabsTrigger value="audiences" className="data-[state=active]:bg-[#bfff00] data-[state=active]:text-black rounded-lg px-4 text-gray-400">
                  <Users className="h-4 w-4 mr-2" />
                  Publicos
                </TabsTrigger>
                <TabsTrigger value="contacts" className="data-[state=active]:bg-[#bfff00] data-[state=active]:text-black rounded-lg px-4 text-gray-400">
                  <Bot className="h-4 w-4 mr-2" />
                  Contatos por Bot
                </TabsTrigger>
              </TabsList>

              {/* Tab: Campanhas */}
              <TabsContent value="campaigns" className="space-y-4">
                {/* Search and Filter */}
                <div className="flex items-center gap-4">
                  <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                    <input
                      type="text"
                      placeholder="Buscar campanha..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full h-10 pl-10 pr-4 bg-[#1c1c1e] border border-[#2a2a2e] rounded-xl text-white placeholder:text-gray-500 focus:outline-none focus:border-[#bfff00]/50 transition-colors"
                    />
                  </div>
                  <select
                    value={selectedBot || ""}
                    onChange={(e) => setSelectedBot(e.target.value || null)}
                    className="h-10 px-4 bg-[#1c1c1e] border border-[#2a2a2e] rounded-xl text-white focus:outline-none focus:border-[#bfff00]/50"
                  >
                    <option value="">Todos os Bots</option>
                    {bots.map(bot => (
                      <option key={bot.id} value={bot.id}>{bot.name}</option>
                    ))}
                  </select>
                </div>

                {/* Campaigns List */}
                <div className="bg-[#1c1c1e] rounded-2xl border border-[#2a2a2e] overflow-hidden">
                  {/* Header */}
                  <div className="grid grid-cols-[1fr_120px_120px_100px_100px_80px] gap-4 px-5 py-3 bg-[#141416] border-b border-[#2a2a2e]">
                    <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Campanha</span>
                    <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Bot</span>
                    <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Publico</span>
                    <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Enviados</span>
                    <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Status</span>
                    <span className="text-xs font-bold text-gray-500 uppercase tracking-wide text-right">Acoes</span>
                  </div>

                  {loadingCampaigns ? (
                    <div className="flex items-center justify-center py-16">
                      <RefreshCw className="h-5 w-5 animate-spin text-gray-500" />
                    </div>
                  ) : filteredCampaigns.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                      <div className="w-14 h-14 rounded-2xl bg-[#2a2a2e] flex items-center justify-center mb-4">
                        <Target className="h-6 w-6 text-gray-500" />
                      </div>
                      <p className="text-sm font-bold text-white">Nenhuma campanha encontrada</p>
                      <p className="text-xs text-gray-500 mt-1 max-w-xs">Crie sua primeira campanha para comecar a reconquistar seus leads</p>
                      <button 
                        onClick={() => setShowCreateModal(true)}
                        className="mt-4 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#bfff00] text-black text-sm font-bold hover:bg-[#a8e600] transition-colors"
                      >
                        <Plus className="h-4 w-4" />
                        Criar Campanha
                      </button>
                    </div>
                  ) : (
                    <div className="divide-y divide-[#2a2a2e]">
                      {filteredCampaigns.map((campaign) => {
                        const audience = AUDIENCES.find(a => a.id === campaign.audience_id)
                        const status = getStatusInfo(campaign.status)
                        const AudienceIcon = audience?.icon || Users
                        const botName = bots.find(b => b.id === campaign.bot_id)?.name || "Bot"
                        
                        return (
                          <div
                            key={campaign.id}
                            className="grid grid-cols-[1fr_120px_120px_100px_100px_80px] gap-4 items-center px-5 py-4 hover:bg-[#141416] transition-colors"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-10 h-10 rounded-xl bg-[#bfff00]/10 flex items-center justify-center shrink-0">
                                <Target className="h-5 w-5 text-[#bfff00]" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-bold text-white truncate">{campaign.name}</p>
                                <p className="text-xs text-gray-500">{new Date(campaign.created_at).toLocaleDateString("pt-BR")}</p>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <Bot className="h-4 w-4 text-gray-500" />
                              <span className="text-xs font-medium text-gray-400 truncate">{botName}</span>
                            </div>

                            <div className="flex items-center gap-2">
                              <div className={`w-6 h-6 rounded-lg ${audience?.bgColor} flex items-center justify-center`}>
                                <AudienceIcon className={`h-3 w-3 ${audience?.color}`} />
                              </div>
                              <span className="text-xs text-gray-400 truncate">{audience?.name}</span>
                            </div>

                            <div>
                              <p className="text-sm font-semibold text-white">{(campaign.sent_count || 0).toLocaleString("pt-BR")}</p>
                              <p className="text-xs text-gray-500">{(campaign.open_rate || 0)}% abertos</p>
                            </div>

                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${status.bgColor} ${status.color}`}>
                              {campaign.status === "ativa" && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />}
                              {status.label}
                            </span>

                            <div className="flex items-center justify-end gap-1">
                              {campaign.status === "ativa" ? (
                                <button className="w-8 h-8 rounded-lg hover:bg-[#2a2a2e] flex items-center justify-center text-gray-400 hover:text-yellow-400 transition-colors">
                                  <Pause className="h-4 w-4" />
                                </button>
                              ) : (
                                <button className="w-8 h-8 rounded-lg hover:bg-[#2a2a2e] flex items-center justify-center text-gray-400 hover:text-emerald-400 transition-colors">
                                  <Play className="h-4 w-4" />
                                </button>
                              )}
                              <button className="w-8 h-8 rounded-lg hover:bg-[#2a2a2e] flex items-center justify-center text-gray-400 hover:text-white transition-colors">
                                <MoreVertical className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </TabsContent>

              {/* Tab: Publicos */}
              <TabsContent value="audiences" className="space-y-4">
                <div className="flex items-center gap-4 mb-4">
                  <select
                    value={selectedBot || ""}
                    onChange={(e) => setSelectedBot(e.target.value || null)}
                    className="h-10 px-4 bg-[#1c1c1e] border border-[#2a2a2e] rounded-xl text-white focus:outline-none focus:border-[#bfff00]/50"
                  >
                    <option value="">Selecione um Bot</option>
                    {bots.map(bot => (
                      <option key={bot.id} value={bot.id}>{bot.name}</option>
                    ))}
                  </select>
                  {selectedBot && (
                    <span className="text-sm text-gray-500">
                      {botUsers.length.toLocaleString("pt-BR")} contatos neste bot
                    </span>
                  )}
                </div>

                {!selectedBot ? (
                  <div className="bg-[#1c1c1e] rounded-2xl border border-[#2a2a2e] p-12 text-center">
                    <div className="w-14 h-14 rounded-2xl bg-[#2a2a2e] flex items-center justify-center mx-auto mb-4">
                      <Bot className="h-6 w-6 text-gray-500" />
                    </div>
                    <p className="text-sm font-bold text-white">Selecione um Bot</p>
                    <p className="text-xs text-gray-500 mt-1">Escolha um bot para visualizar os publicos disponiveis</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {AUDIENCES.map((audience) => {
                      const Icon = audience.icon
                      const count = audienceStats[audience.id] || 0
                      
                      return (
                        <button
                          key={audience.id}
                          onClick={() => {
                            setSelectedAudience(audience.id)
                            setShowAudienceModal(true)
                          }}
                          className={`relative overflow-hidden rounded-2xl p-5 border transition-all text-left group hover:scale-[1.02] ${audience.bgColor} ${audience.borderColor} border-2`}
                        >
                          <div className="flex items-start justify-between mb-4">
                            <div className={`w-12 h-12 rounded-xl ${audience.bgColor} flex items-center justify-center`}>
                              <Icon className={`h-6 w-6 ${audience.color}`} />
                            </div>
                            <ChevronRight className={`h-5 w-5 ${audience.color} opacity-0 group-hover:opacity-100 transition-opacity`} />
                          </div>
                          <p className="font-bold text-white mb-1">{audience.name}</p>
                          <p className="text-xs text-gray-400 mb-3">{audience.description}</p>
                          <div className="flex items-center justify-between">
                            <span className={`text-2xl font-bold ${audience.color}`}>{count.toLocaleString("pt-BR")}</span>
                            <span className="text-xs text-gray-500">contatos</span>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )}
              </TabsContent>

              {/* Tab: Contatos por Bot */}
              <TabsContent value="contacts" className="space-y-4">
                {loadingBots ? (
                  <div className="flex items-center justify-center py-16">
                    <RefreshCw className="h-5 w-5 animate-spin text-gray-500" />
                  </div>
                ) : bots.length === 0 ? (
                  <div className="bg-[#1c1c1e] rounded-2xl border border-[#2a2a2e] p-12 text-center">
                    <div className="w-14 h-14 rounded-2xl bg-[#2a2a2e] flex items-center justify-center mx-auto mb-4">
                      <Bot className="h-6 w-6 text-gray-500" />
                    </div>
                    <p className="text-sm font-bold text-white">Nenhum bot encontrado</p>
                    <p className="text-xs text-gray-500 mt-1">Crie um bot para comecar a coletar contatos</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {bots.map((bot) => {
                      const isExpanded = expandedBot === bot.id
                      
                      return (
                        <div key={bot.id} className="bg-[#1c1c1e] rounded-2xl border border-[#2a2a2e] overflow-hidden">
                          <button
                            onClick={() => {
                              setExpandedBot(isExpanded ? null : bot.id)
                              if (!isExpanded) setSelectedBot(bot.id)
                            }}
                            className="w-full flex items-center justify-between p-5 hover:bg-[#141416] transition-colors"
                          >
                            <div className="flex items-center gap-4">
                              <div className="w-12 h-12 rounded-xl bg-[#bfff00]/10 flex items-center justify-center">
                                <Bot className="h-6 w-6 text-[#bfff00]" />
                              </div>
                              <div className="text-left">
                                <p className="font-bold text-white">{bot.name}</p>
                                <p className="text-xs text-gray-500">{(bot.user_count || 0).toLocaleString("pt-BR")} contatos salvos</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-semibold text-white">{(bot.user_count || 0).toLocaleString("pt-BR")}</span>
                                <Users className="h-4 w-4 text-gray-500" />
                              </div>
                              <ChevronRight className={`h-5 w-5 text-gray-500 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                            </div>
                          </button>

                          {isExpanded && (
                            <div className="border-t border-[#2a2a2e] p-5 bg-[#141416]">
                              {/* Audience breakdown */}
                              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
                                {AUDIENCES.map((audience) => {
                                  const Icon = audience.icon
                                  const count = audienceStats[audience.id] || 0
                                  
                                  return (
                                    <div key={audience.id} className={`p-3 rounded-xl ${audience.bgColor} border ${audience.borderColor}`}>
                                      <div className="flex items-center gap-2 mb-2">
                                        <Icon className={`h-4 w-4 ${audience.color}`} />
                                        <span className="text-xs font-medium text-gray-400 truncate">{audience.name}</span>
                                      </div>
                                      <p className={`text-xl font-bold ${audience.color}`}>{count.toLocaleString("pt-BR")}</p>
                                    </div>
                                  )
                                })}
                              </div>

                              {/* Actions */}
                              <div className="flex items-center gap-3">
                                <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#2a2a2e] text-white text-sm font-medium hover:bg-[#3a3a3e] transition-colors">
                                  <Download className="h-4 w-4" />
                                  Exportar Contatos
                                </button>
                                <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#2a2a2e] text-white text-sm font-medium hover:bg-[#3a3a3e] transition-colors">
                                  <Eye className="h-4 w-4" />
                                  Ver Todos
                                </button>
                                <button 
                                  onClick={() => {
                                    setNewCampaign({ ...newCampaign, bot_id: bot.id })
                                    setShowCreateModal(true)
                                  }}
                                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#bfff00] text-black text-sm font-bold hover:bg-[#a8e600] transition-colors"
                                >
                                  <Plus className="h-4 w-4" />
                                  Criar Campanha
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </TabsContent>
            </Tabs>

          </div>
        </div>
      </ScrollArea>

      {/* Create Campaign Modal */}
      <Dialog open={showCreateModal} onOpenChange={(open) => !open && resetCreateModal()}>
        <DialogContent className="sm:max-w-[560px] bg-[#1c1c1e] border-[#2a2a2e] p-0 gap-0 overflow-hidden rounded-2xl [&>button]:hidden">
          <div className="p-6">
            <button
              onClick={resetCreateModal}
              className="absolute top-4 right-4 w-8 h-8 rounded-xl bg-[#2a2a2e] flex items-center justify-center text-gray-400 hover:text-white transition-colors z-10"
            >
              <X className="h-4 w-4" />
            </button>

            {/* Progress */}
            <div className="flex items-center gap-2 mb-6">
              {[1, 2, 3, 4].map((step) => (
                <div key={step} className="flex items-center gap-2 flex-1">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                    createStep >= step ? "bg-[#bfff00] text-black" : "bg-[#2a2a2e] text-gray-500"
                  }`}>
                    {step}
                  </div>
                  {step < 4 && <div className={`flex-1 h-0.5 ${createStep > step ? "bg-[#bfff00]" : "bg-[#2a2a2e]"}`} />}
                </div>
              ))}
            </div>

            {/* Step 1: Nome */}
            {createStep === 1 && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-bold text-white mb-1">Nova Campanha</h3>
                  <p className="text-sm text-gray-500">De um nome para sua campanha</p>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium text-gray-400 uppercase tracking-wide">Nome da Campanha</label>
                  <input
                    type="text"
                    value={newCampaign.name}
                    onChange={(e) => setNewCampaign({ ...newCampaign, name: e.target.value })}
                    placeholder="Ex: Recuperacao de Carrinho"
                    className="w-full h-12 px-4 bg-[#2a2a2e] border border-[#3a3a3e] rounded-xl text-white placeholder:text-gray-500 focus:outline-none focus:border-[#bfff00]/50 transition-colors"
                    autoFocus
                  />
                </div>

                <button
                  onClick={() => newCampaign.name.trim() && setCreateStep(2)}
                  disabled={!newCampaign.name.trim()}
                  className="w-full h-12 rounded-xl bg-[#bfff00] text-black font-bold hover:bg-[#a8e600] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Continuar
                </button>
              </div>
            )}

            {/* Step 2: Selecionar Bot */}
            {createStep === 2 && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-bold text-white mb-1">Selecione o Bot</h3>
                  <p className="text-sm text-gray-500">Escolha de qual bot voce quer enviar</p>
                </div>

                <div className="space-y-3 max-h-[300px] overflow-y-auto">
                  {bots.map((bot) => {
                    const isSelected = newCampaign.bot_id === bot.id
                    
                    return (
                      <button
                        key={bot.id}
                        onClick={() => setNewCampaign({ ...newCampaign, bot_id: bot.id })}
                        className={`w-full flex items-center gap-4 p-4 rounded-xl border transition-all text-left ${
                          isSelected
                            ? "bg-[#bfff00]/10 border-[#bfff00]/50 border-2"
                            : "bg-[#2a2a2e] border-[#3a3a3e] hover:border-[#4a4a4e]"
                        }`}
                      >
                        <div className="w-12 h-12 rounded-xl bg-[#bfff00]/10 flex items-center justify-center shrink-0">
                          <Bot className={`h-6 w-6 ${isSelected ? "text-[#bfff00]" : "text-gray-400"}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`font-bold ${isSelected ? "text-[#bfff00]" : "text-white"}`}>{bot.name}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{(bot.user_count || 0).toLocaleString("pt-BR")} contatos</p>
                        </div>
                        {isSelected && (
                          <CheckCircle2 className="h-5 w-5 text-[#bfff00]" />
                        )}
                      </button>
                    )
                  })}
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setCreateStep(1)}
                    className="flex-1 h-12 rounded-xl bg-[#2a2a2e] text-white font-medium hover:bg-[#3a3a3e] transition-colors"
                  >
                    Voltar
                  </button>
                  <button
                    onClick={() => newCampaign.bot_id && setCreateStep(3)}
                    disabled={!newCampaign.bot_id}
                    className="flex-1 h-12 rounded-xl bg-[#bfff00] text-black font-bold hover:bg-[#a8e600] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Continuar
                  </button>
                </div>
              </div>
            )}

            {/* Step 3: Selecionar Publico */}
            {createStep === 3 && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-bold text-white mb-1">Selecione o Publico</h3>
                  <p className="text-sm text-gray-500">Escolha quem vai receber sua campanha</p>
                </div>

                <div className="space-y-3 max-h-[300px] overflow-y-auto">
                  {AUDIENCES.map((audience) => {
                    const Icon = audience.icon
                    const isSelected = newCampaign.audience_id === audience.id
                    
                    return (
                      <button
                        key={audience.id}
                        onClick={() => setNewCampaign({ ...newCampaign, audience_id: audience.id })}
                        className={`w-full flex items-center gap-4 p-4 rounded-xl border transition-all text-left ${
                          isSelected
                            ? `${audience.bgColor} ${audience.borderColor} border-2`
                            : "bg-[#2a2a2e] border-[#3a3a3e] hover:border-[#4a4a4e]"
                        }`}
                      >
                        <div className={`w-12 h-12 rounded-xl ${audience.bgColor} flex items-center justify-center shrink-0`}>
                          <Icon className={`h-6 w-6 ${audience.color}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`font-bold ${isSelected ? audience.color : "text-white"}`}>{audience.name}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{audience.description}</p>
                        </div>
                        {isSelected && (
                          <CheckCircle2 className={`h-5 w-5 ${audience.color}`} />
                        )}
                      </button>
                    )
                  })}
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setCreateStep(2)}
                    className="flex-1 h-12 rounded-xl bg-[#2a2a2e] text-white font-medium hover:bg-[#3a3a3e] transition-colors"
                  >
                    Voltar
                  </button>
                  <button
                    onClick={() => newCampaign.audience_id && setCreateStep(4)}
                    disabled={!newCampaign.audience_id}
                    className="flex-1 h-12 rounded-xl bg-[#bfff00] text-black font-bold hover:bg-[#a8e600] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Continuar
                  </button>
                </div>
              </div>
            )}

            {/* Step 4: Mensagem */}
            {createStep === 4 && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-bold text-white mb-1">Mensagem da Campanha</h3>
                  <p className="text-sm text-gray-500">Escreva a mensagem que sera enviada</p>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium text-gray-400 uppercase tracking-wide">Mensagem</label>
                  <textarea
                    value={newCampaign.message_template}
                    onChange={(e) => setNewCampaign({ ...newCampaign, message_template: e.target.value })}
                    placeholder="Oi {nome}! Voce deixou algo pendente..."
                    rows={5}
                    className="w-full px-4 py-3 bg-[#2a2a2e] border border-[#3a3a3e] rounded-xl text-white placeholder:text-gray-500 focus:outline-none focus:border-[#bfff00]/50 transition-colors resize-none"
                  />
                  <p className="text-xs text-gray-500">Use {"{nome}"} para inserir o nome do usuario</p>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setCreateStep(3)}
                    className="flex-1 h-12 rounded-xl bg-[#2a2a2e] text-white font-medium hover:bg-[#3a3a3e] transition-colors"
                  >
                    Voltar
                  </button>
                  <button
                    onClick={handleCreateCampaign}
                    className="flex-1 h-12 rounded-xl bg-[#bfff00] text-black font-bold hover:bg-[#a8e600] transition-colors"
                  >
                    Criar Campanha
                  </button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Audience Details Modal */}
      <Dialog open={showAudienceModal} onOpenChange={setShowAudienceModal}>
        <DialogContent className="sm:max-w-[600px] bg-[#1c1c1e] border-[#2a2a2e] p-0 gap-0 overflow-hidden rounded-2xl [&>button]:hidden">
          {selectedAudience && (() => {
            const audience = AUDIENCES.find(a => a.id === selectedAudience)
            if (!audience) return null
            const Icon = audience.icon
            const filteredUsers = botUsers.filter(audience.filter)
            
            return (
              <div>
                {/* Header */}
                <div className={`p-6 ${audience.bgColor} border-b ${audience.borderColor}`}>
                  <button
                    onClick={() => setShowAudienceModal(false)}
                    className="absolute top-4 right-4 w-8 h-8 rounded-xl bg-black/20 flex items-center justify-center text-white/70 hover:text-white transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                  
                  <div className="flex items-center gap-4">
                    <div className={`w-14 h-14 rounded-2xl ${audience.bgColor} border ${audience.borderColor} flex items-center justify-center`}>
                      <Icon className={`h-7 w-7 ${audience.color}`} />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-white">{audience.name}</h3>
                      <p className="text-sm text-gray-400">{audience.description}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-6 mt-6">
                    <div>
                      <p className={`text-3xl font-bold ${audience.color}`}>{filteredUsers.length.toLocaleString("pt-BR")}</p>
                      <p className="text-xs text-gray-500">contatos</p>
                    </div>
                  </div>
                </div>

                {/* Users List */}
                <div className="p-4 max-h-[400px] overflow-y-auto">
                  {filteredUsers.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-sm text-gray-500">Nenhum contato neste publico</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {filteredUsers.slice(0, 50).map((user) => (
                        <div key={user.id} className="flex items-center gap-3 p-3 rounded-xl bg-[#2a2a2e] hover:bg-[#3a3a3e] transition-colors">
                          <div className="w-10 h-10 rounded-full bg-[#3a3a3e] flex items-center justify-center">
                            <span className="text-sm font-bold text-white">{user.first_name?.charAt(0) || "U"}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-white truncate">
                              {user.first_name} {user.last_name || ""}
                            </p>
                            <p className="text-xs text-gray-500">@{user.username || user.telegram_user_id}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-gray-400">{user.funnel_step}</p>
                            <p className="text-xs text-gray-500">{new Date(user.created_at).toLocaleDateString("pt-BR")}</p>
                          </div>
                        </div>
                      ))}
                      {filteredUsers.length > 50 && (
                        <p className="text-center text-xs text-gray-500 py-2">
                          E mais {filteredUsers.length - 50} contatos...
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="p-4 border-t border-[#2a2a2e] flex gap-3">
                  <button className="flex-1 flex items-center justify-center gap-2 h-11 rounded-xl bg-[#2a2a2e] text-white font-medium hover:bg-[#3a3a3e] transition-colors">
                    <Download className="h-4 w-4" />
                    Exportar
                  </button>
                  <button 
                    onClick={() => {
                      setNewCampaign({ ...newCampaign, audience_id: selectedAudience })
                      setShowAudienceModal(false)
                      setShowCreateModal(true)
                      setCreateStep(2)
                    }}
                    className="flex-1 flex items-center justify-center gap-2 h-11 rounded-xl bg-[#bfff00] text-black font-bold hover:bg-[#a8e600] transition-colors"
                  >
                    <Send className="h-4 w-4" />
                    Criar Campanha
                  </button>
                </div>
              </div>
            )
          })()}
        </DialogContent>
      </Dialog>
    </>
  )
}
