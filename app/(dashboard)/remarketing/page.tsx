"use client"

import { useEffect, useState, useMemo } from "react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Dialog, DialogContent } from "@/components/ui/dialog"
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
  ChevronDown,
  Filter,
  Download,
  Upload,
  Eye,
  TrendingUp,
  MessageSquare,
  Zap,
  AlertTriangle,
  Copy
} from "lucide-react"
import useSWR from "swr"
import { useToast } from "@/hooks/use-toast"

// Types
interface BotUser {
  id: string
  bot_id: string
  telegram_user_id: number
  chat_id: number
  first_name: string
  last_name?: string
  username?: string
  funnel_step: number
  payment_status: string // calculated by API: "abandoned" | "not_paid" | "paid" | "subscriber" | "imported"
  is_subscriber: boolean
  has_approved_payment?: boolean
  source?: "start" | "imported" // 'start' = captured by bot, 'imported' = manually imported
  created_at: string
}

interface BotData {
  id: string
  name: string
  token: string
  username?: string
  photo_url?: string
  user_count?: number
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
  message_template?: string
  scheduled_at?: string
  created_at: string
  sent_count: number
  delivered_count: number
  open_rate: number
  click_rate: number
}

// Audiences/Publicos
// payment_status calculado pela API:
// - abandoned: funnel_step == 1 (so deu start, nao avancou)
// - not_paid: avancou no funil mas nunca pagou
// - paid: tem pelo menos um pagamento aprovado
// - subscriber: e assinante ativo
// - imported: leads importados manualmente (sem tracking de pagamento)
// source campo:
// - 'start': usuarios que interagiram com o bot
// - 'imported': usuarios importados manualmente

// Audiences for ORGANIC users (captured by bot)
const AUDIENCES_START: Audience[] = [
  {
    id: "all_start",
    name: "Todos (Start)",
    description: "Todos que deram /start no bot",
    icon: Users,
    color: "text-foreground",
    bgColor: "bg-muted",
    borderColor: "border-border",
    filter: (user) => user.source !== "imported"
  },
  {
    id: "started_not_continued",
    name: "Abandonou",
    description: "Deram /start mas nao avancaram no funil",
    icon: UserX,
    color: "text-yellow-600",
    bgColor: "bg-yellow-100",
    borderColor: "border-yellow-300",
    filter: (user) => user.payment_status === "abandoned" && user.source !== "imported"
  },
  {
    id: "not_paid",
    name: "Nao pagou",
    description: "Avancaram no funil mas nunca finalizaram pagamento",
    icon: ShoppingCart,
    color: "text-red-600",
    bgColor: "bg-red-100",
    borderColor: "border-red-300",
    filter: (user) => user.payment_status === "not_paid" && user.source !== "imported"
  },
  {
    id: "paid",
    name: "Pagou",
    description: "Ja realizaram pelo menos uma compra aprovada",
    icon: CheckCircle2,
    color: "text-emerald-600",
    bgColor: "bg-emerald-100",
    borderColor: "border-emerald-300",
    filter: (user) => (user.payment_status === "paid" || user.payment_status === "subscriber") && user.source !== "imported"
  },
  {
    id: "subscribers",
    name: "Assinantes",
    description: "Usuarios com assinatura ativa",
    icon: Zap,
    color: "text-blue-600",
    bgColor: "bg-blue-100",
    borderColor: "border-blue-300",
    filter: (user) => (user.payment_status === "subscriber" || user.is_subscriber === true) && user.source !== "imported"
  }
]

// Audience for IMPORTED users
const AUDIENCES_IMPORTED: Audience[] = [
  {
    id: "imported",
    name: "Importados",
    description: "Usuarios importados manualmente",
    icon: Upload,
    color: "text-purple-600",
    bgColor: "bg-purple-100",
    borderColor: "border-purple-300",
    filter: (user) => user.source === "imported"
  }
]

// Combined audiences for backward compatibility
const AUDIENCES: Audience[] = [
  {
    id: "all",
    name: "Todos",
    description: "Todos usuarios (start + importados)",
    icon: Users,
    color: "text-foreground",
    bgColor: "bg-muted",
    borderColor: "border-border",
    filter: () => true
  },
  ...AUDIENCES_START.slice(1), // Skip the "all_start" since we have a combined "all"
  ...AUDIENCES_IMPORTED
]

// Fetcher
const fetcher = (url: string) => fetch(url).then(res => res.json())

export default function RemarketingPage() {
  const { toast } = useToast()
  const [activeSection, setActiveSection] = useState<"campanhas" | "usuarios">("campanhas")
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedBot, setSelectedBot] = useState<string | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [expandedBots, setExpandedBots] = useState<string[]>([])
  const [selectedAudienceForBot, setSelectedAudienceForBot] = useState<{botId: string, audienceId: string} | null>(null)
  const [showUsersModal, setShowUsersModal] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null)
  const [showImportModal, setShowImportModal] = useState(false)
  const [importBotId, setImportBotId] = useState<string | null>(null)
  const [importText, setImportText] = useState("")
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<{
    success?: boolean
    imported?: number
    duplicates?: number
    skipped?: number
    parseErrors?: string[]
    error?: string
  } | null>(null)
  
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
  const { data: botsData, isLoading: loadingBots, mutate: mutateBots } = useSWR("/api/bots", fetcher)
  const rawBots: BotData[] = botsData?.bots || []
  
  // Store telegram data (username, photo_url) for each bot
  const [telegramData, setTelegramData] = useState<Record<string, { username?: string, photo_url?: string }>>({})
  const [loadingTelegramData, setLoadingTelegramData] = useState(false)
  
  // Fetch telegram data for each bot - similar to bots page logic
  useEffect(() => {
    async function fetchTelegramData() {
      // Get IDs that need fetching - check against current state via callback
      const botsNeedingData = rawBots.filter(bot => {
        // Use a ref or check outside to avoid stale closure
        return true // We'll dedupe inside
      })
      
      if (botsNeedingData.length === 0) return
      
      setLoadingTelegramData(true)
      
      // Fetch in parallel
      const results = await Promise.all(botsNeedingData.map(async (bot) => {
        try {
          const res = await fetch("/api/telegram/validate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token: bot.token })
          })
          if (res.ok) {
            const data = await res.json()
            if (data.bot) {
              return {
                id: bot.id,
                username: data.bot.username,
                photo_url: data.bot.photo_url
              }
            }
          }
        } catch {
          // Ignore errors
        }
        return null
      }))
      
      // Update state with all results at once
      setTelegramData(prev => {
        const newData = { ...prev }
        for (const result of results) {
          if (result && !newData[result.id]) {
            newData[result.id] = {
              username: result.username,
              photo_url: result.photo_url
            }
          }
        }
        return newData
      })
      
      setLoadingTelegramData(false)
    }
    
    if (rawBots.length > 0) {
      // Only fetch if we have bots that don't have data yet
      const needsFetch = rawBots.some(bot => !telegramData[bot.id])
      if (needsFetch) {
        fetchTelegramData()
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawBots])
  
  // Merge bots with telegram data
  const bots: BotData[] = rawBots.map(bot => ({
    ...bot,
    username: telegramData[bot.id]?.username,
    photo_url: telegramData[bot.id]?.photo_url
  }))

  // Fetch all bot users
  const { data: allUsersData, isLoading: loadingAllUsers, mutate: mutateAllUsers } = useSWR(
    "/api/remarketing/users",
    fetcher
  )
  const allBotUsers: Record<string, BotUser[]> = allUsersData?.usersByBot || {}

  // Fetch campaigns
  const { data: campaignsData, isLoading: loadingCampaigns, mutate: mutateCampaigns } = useSWR(
    "/api/remarketing/campaigns",
    fetcher
  )
  const campaigns: Campaign[] = campaignsData?.campaigns || []

  // Stats
  const stats = useMemo(() => {
    const totalUsers = Object.values(allBotUsers).reduce((acc, users) => acc + users.length, 0)
    const activeCampaigns = campaigns.filter(c => c.status === "ativa").length
    const totalSent = campaigns.reduce((acc, c) => acc + (c.sent_count || 0), 0)

    return { totalUsers, activeCampaigns, totalCampaigns: campaigns.length, totalSent }
  }, [allBotUsers, campaigns])

  // Get users for a specific bot and audience
  const getFilteredUsers = (botId: string, audienceId: string) => {
    const users = allBotUsers[botId] || []
    // Search in all audience arrays
    const allAudiences = [...AUDIENCES, ...AUDIENCES_START, ...AUDIENCES_IMPORTED]
    const audience = allAudiences.find(a => a.id === audienceId)
    if (!audience) return users
    return users.filter(audience.filter)
  }

  // Get audience counts for a bot - includes both start and imported audiences
  const getAudienceCounts = (botId: string) => {
    const users = allBotUsers[botId] || []
    // Combine all audience types for counting
    const allAudiences = [...AUDIENCES, ...AUDIENCES_START, ...AUDIENCES_IMPORTED]
    return allAudiences.reduce((acc, audience) => {
      acc[audience.id] = users.filter(audience.filter).length
      return acc
    }, {} as Record<string, number>)
  }

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
        toast({ title: "Campanha criada!", description: "Sua campanha foi criada com sucesso." })
      }
    } catch (error) {
      console.error("Error creating campaign:", error)
      toast({ title: "Erro", description: "Nao foi possivel criar a campanha.", variant: "destructive" })
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

  const handleDeleteBotUsers = async (botId: string) => {
    try {
      const res = await fetch(`/api/bots/${botId}/users`, {
        method: "DELETE"
      })
      
      if (res.ok) {
        mutateAllUsers()
        setShowDeleteConfirm(null)
        toast({ title: "Dados apagados!", description: "Todos os usuarios deste bot foram removidos." })
      }
    } catch (error) {
      toast({ title: "Erro", description: "Nao foi possivel apagar os dados.", variant: "destructive" })
    }
  }

  const handleImportUsers = async () => {
    if (!importBotId || !importText.trim()) {
      toast({ title: "Erro", description: "Selecione um bot e insira os chat IDs", variant: "destructive" })
      return
    }

    setImporting(true)
    setImportResult(null)

    try {
      const res = await fetch("/api/remarketing/import", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          botId: importBotId,
          textData: importText
        })
      })

      const data = await res.json()
      setImportResult(data)

      if (data.success) {
        toast({ 
          title: "Importacao concluida!", 
          description: `${data.imported} usuarios importados com sucesso` 
        })
        mutateAllUsers()
      } else if (data.error) {
        toast({ title: "Erro", description: data.error, variant: "destructive" })
      }
    } catch (error) {
      toast({ title: "Erro", description: "Falha ao importar usuarios", variant: "destructive" })
    } finally {
      setImporting(false)
    }
  }

  const resetImportModal = () => {
    setShowImportModal(false)
    setImportBotId(null)
    setImportText("")
    setImportResult(null)
  }

  const handleExportUsers = (botId: string, audienceId?: string) => {
    const users = audienceId ? getFilteredUsers(botId, audienceId) : (allBotUsers[botId] || [])
    const botName = bots.find(b => b.id === botId)?.name || "bot"
    
    const csvContent = [
      ["ID", "Nome", "Username", "Status Pagamento", "Etapa Funil", "Assinante", "Data"].join(","),
      ...users.map(u => [
        u.telegram_user_id,
        `${u.first_name} ${u.last_name || ""}`.trim(),
        u.username || "",
        u.payment_status,
        u.funnel_step,
        u.is_subscriber ? "Sim" : "Nao",
        new Date(u.created_at).toLocaleDateString("pt-BR")
      ].join(","))
    ].join("\n")
    
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `${botName}_usuarios_${audienceId || "todos"}.csv`
    link.click()
  }

  const toggleBotExpanded = (botId: string) => {
    setExpandedBots(prev => 
      prev.includes(botId) ? prev.filter(id => id !== botId) : [...prev, botId]
    )
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
                <p className="text-gray-500">Gerencie usuarios e campanhas de remarketing dos seus bots</p>
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
                  <p className="text-xs text-gray-500 mt-1">em {bots.length} bots</p>
                </div>
              </div>

              <div className="relative rounded-2xl p-5 overflow-hidden bg-[#1c1c1e] border border-[#2a2a2e]">
                <div className="absolute bottom-0 left-0 right-0 h-20 pointer-events-none" style={{ background: "radial-gradient(ellipse at center bottom, rgba(34, 197, 94, 0.15) 0%, transparent 70%)" }} />
                <div className="relative">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Campanhas</span>
                    <Target className="h-4 w-4 text-emerald-400" />
                  </div>
                  <p className="text-2xl font-bold text-emerald-400">{stats.totalCampaigns}</p>
                  <p className="text-xs text-gray-500 mt-1">{stats.activeCampaigns} ativas</p>
                </div>
              </div>

              <div className="relative rounded-2xl p-5 overflow-hidden bg-[#1c1c1e] border border-[#2a2a2e]">
                <div className="absolute bottom-0 left-0 right-0 h-20 pointer-events-none" style={{ background: "radial-gradient(ellipse at center bottom, rgba(168, 85, 247, 0.15) 0%, transparent 70%)" }} />
                <div className="relative">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Enviadas</span>
                    <Send className="h-4 w-4 text-purple-400" />
                  </div>
                  <p className="text-2xl font-bold text-white">{stats.totalSent.toLocaleString("pt-BR")}</p>
                  <p className="text-xs text-gray-500 mt-1">mensagens</p>
                </div>
              </div>

              <div className="relative rounded-2xl p-5 overflow-hidden bg-[#1c1c1e] border border-[#2a2a2e]">
                <div className="absolute bottom-0 left-0 right-0 h-20 pointer-events-none" style={{ background: "radial-gradient(ellipse at center bottom, rgba(251, 191, 36, 0.15) 0%, transparent 70%)" }} />
                <div className="relative">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Bots Ativos</span>
                    <Bot className="h-4 w-4 text-amber-400" />
                  </div>
                  <p className="text-2xl font-bold text-white">{bots.length}</p>
                  <p className="text-xs text-gray-500 mt-1">coletando dados</p>
                </div>
              </div>
            </div>

            {/* Section Buttons */}
            <div className="flex gap-3 mb-6">
              <button
                onClick={() => setActiveSection("campanhas")}
                className={`flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold transition-all ${
                  activeSection === "campanhas"
                    ? "bg-[#bfff00] text-black shadow-lg shadow-[#bfff00]/20"
                    : "bg-[#1c1c1e] text-gray-400 border border-[#2a2a2e] hover:border-[#bfff00]/30"
                }`}
              >
                <Target className="h-4 w-4" />
                Campanhas
              </button>
              <button
                onClick={() => setActiveSection("usuarios")}
                className={`flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold transition-all ${
                  activeSection === "usuarios"
                    ? "bg-[#bfff00] text-black shadow-lg shadow-[#bfff00]/20"
                    : "bg-[#1c1c1e] text-gray-400 border border-[#2a2a2e] hover:border-[#bfff00]/30"
                }`}
              >
                <Users className="h-4 w-4" />
                Usuarios
              </button>
            </div>

            {/* Section: Campanhas */}
            {activeSection === "campanhas" && (
              <div className="space-y-4">
                {/* Search */}
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
                </div>

                {/* Campaigns Table */}
                <div className="bg-[#1c1c1e] rounded-2xl border border-[#2a2a2e] overflow-hidden">
                  <div className="grid grid-cols-[1fr_100px_120px_100px_80px] gap-4 px-5 py-3 bg-[#141416] border-b border-[#2a2a2e]">
                    <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Campanha</span>
                    <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Bot</span>
                    <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Publico</span>
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
                      <p className="text-sm font-bold text-white">Nenhuma campanha</p>
                      <p className="text-xs text-gray-500 mt-1">Crie sua primeira campanha de remarketing</p>
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
                            className="grid grid-cols-[1fr_100px_120px_100px_80px] gap-4 items-center px-5 py-4 hover:bg-[#141416] transition-colors"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-10 h-10 rounded-xl bg-[#bfff00]/10 flex items-center justify-center shrink-0">
                                <Target className="h-5 w-5 text-[#bfff00]" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-bold text-white truncate">{campaign.name}</p>
                                <p className="text-xs text-gray-500">{campaign.sent_count} enviadas</p>
                              </div>
                            </div>

                            <span className="text-xs font-medium text-gray-400 truncate">{botName}</span>

                            <div className="flex items-center gap-2">
                              <div className={`w-5 h-5 rounded-md ${audience?.bgColor} flex items-center justify-center`}>
                                <AudienceIcon className={`h-3 w-3 ${audience?.color}`} />
                              </div>
                              <span className="text-xs text-gray-400 truncate">{audience?.name?.split(" ")[0]}</span>
                            </div>

                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${status.bgColor} ${status.color}`}>
                              {campaign.status === "ativa" && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />}
                              {status.label}
                            </span>

                            <div className="flex items-center justify-end gap-1">
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
              </div>
            )}

            {/* Section: Usuarios */}
            {activeSection === "usuarios" && (
              <div className="space-y-4">
                {/* Info */}
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-500">
                    Usuarios que interagiram com seus bots. Expanda para ver os publicos.
                  </p>
                  <button
                    onClick={() => setShowImportModal(true)}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#1c1c1e] border border-[#2a2a2e] text-gray-400 hover:text-white hover:border-[#bfff00]/30 transition-colors text-sm"
                  >
                    <Upload className="h-4 w-4" />
                    Importar Lista
                  </button>
                </div>

                {/* Bots List */}
                {loadingBots ? (
                  <div className="flex items-center justify-center py-16">
                    <RefreshCw className="h-5 w-5 animate-spin text-gray-500" />
                  </div>
                ) : bots.length === 0 ? (
                  <div className="bg-[#1c1c1e] rounded-2xl border border-[#2a2a2e] p-8 text-center">
                    <Bot className="h-10 w-10 text-gray-500 mx-auto mb-3" />
                    <p className="text-sm font-bold text-white">Nenhum bot encontrado</p>
                    <p className="text-xs text-gray-500 mt-1">Crie um bot primeiro para coletar usuarios</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {bots.map(bot => {
                      const botUsers = allBotUsers[bot.id] || []
                      const isExpanded = expandedBots.includes(bot.id)
                      const audienceCounts = getAudienceCounts(bot.id)
                      
                      return (
                        <div key={bot.id} className="bg-[#1c1c1e] rounded-2xl border border-[#2a2a2e] overflow-hidden">
                          {/* Bot Header */}
                          <button
                            onClick={() => toggleBotExpanded(bot.id)}
                            className="w-full flex items-center justify-between p-4 hover:bg-[#141416] transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              {bot.photo_url ? (
                                <img 
                                  src={bot.photo_url} 
                                  alt={bot.name}
                                  className="w-10 h-10 rounded-xl object-cover border border-[#2a2a2e]"
                                />
                              ) : (
                                <div className="w-10 h-10 rounded-xl bg-[#bfff00]/10 flex items-center justify-center">
                                  <Bot className="h-5 w-5 text-[#bfff00]" />
                                </div>
                              )}
                              <div className="text-left">
                                <p className="text-sm font-bold text-white">{bot.name}</p>
                                <p className="text-xs text-gray-500">
                                  {bot.username ? `@${bot.username}` : `${botUsers.length} usuarios coletados`}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="flex gap-1">
                                {AUDIENCES.slice(0, 4).map(audience => {
                                  const count = audienceCounts[audience.id] || 0
                                  if (count === 0) return null
                                  const Icon = audience.icon
                                  return (
                                    <div 
                                      key={audience.id}
                                      className={`flex items-center gap-1 px-2 py-1 rounded-md ${audience.bgColor}`}
                                      title={`${audience.name}: ${count}`}
                                    >
                                      <Icon className={`h-3 w-3 ${audience.color}`} />
                                      <span className={`text-xs font-medium ${audience.color}`}>{count}</span>
                                    </div>
                                  )
                                })}
                              </div>
                              {isExpanded ? (
                                <ChevronDown className="h-5 w-5 text-gray-500" />
                              ) : (
                                <ChevronRight className="h-5 w-5 text-gray-500" />
                              )}
                            </div>
                          </button>

                          {/* Expanded Content */}
                          {isExpanded && (
                            <div className="border-t border-[#2a2a2e] p-4 space-y-6">
                              {/* Section: Usuarios Start (organicos) */}
                              <div className="space-y-3">
                                <div className="flex items-center gap-2">
                                  <MessageSquare className="h-4 w-4 text-[#bfff00]" />
                                  <h4 className="text-sm font-bold text-white">Usuarios Start</h4>
                                  <span className="text-xs text-gray-500">(capturados pelo bot)</span>
                                </div>
                                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                                  {AUDIENCES_START.map(audience => {
                                    const count = audienceCounts[audience.id] || 0
                                    const Icon = audience.icon
                                    
                                    return (
                                      <button
                                        key={audience.id}
                                        onClick={() => {
                                          setSelectedAudienceForBot({ botId: bot.id, audienceId: audience.id })
                                          setShowUsersModal(true)
                                        }}
                                        className={`p-4 rounded-xl border ${audience.borderColor} ${audience.bgColor} hover:scale-[1.02] transition-all text-left`}
                                      >
                                        <div className="flex items-center gap-2 mb-2">
                                          <Icon className={`h-4 w-4 ${audience.color}`} />
                                          <span className="text-xs font-medium text-gray-400">{audience.name}</span>
                                        </div>
                                        <p className={`text-2xl font-bold ${audience.color}`}>{count}</p>
                                      </button>
                                    )
                                  })}
                                </div>
                              </div>

                              {/* Section: Usuarios Importados */}
                              <div className="space-y-3">
                                <div className="flex items-center gap-2">
                                  <Upload className="h-4 w-4 text-purple-400" />
                                  <h4 className="text-sm font-bold text-white">Usuarios Importados</h4>
                                  <span className="text-xs text-gray-500">(lista externa)</span>
                                </div>
                                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                                  {AUDIENCES_IMPORTED.map(audience => {
                                    const count = audienceCounts[audience.id] || 0
                                    const Icon = audience.icon
                                    
                                    return (
                                      <button
                                        key={audience.id}
                                        onClick={() => {
                                          setSelectedAudienceForBot({ botId: bot.id, audienceId: audience.id })
                                          setShowUsersModal(true)
                                        }}
                                        className={`p-4 rounded-xl border ${audience.borderColor} ${audience.bgColor} hover:scale-[1.02] transition-all text-left`}
                                      >
                                        <div className="flex items-center gap-2 mb-2">
                                          <Icon className={`h-4 w-4 ${audience.color}`} />
                                          <span className="text-xs font-medium text-gray-400">{audience.name}</span>
                                        </div>
                                        <p className={`text-2xl font-bold ${audience.color}`}>{count}</p>
                                      </button>
                                    )
                                  })}
                                  {audienceCounts["imported"] === 0 && (
                                    <button
                                      onClick={() => {
                                        setImportBotId(bot.id)
                                        setShowImportModal(true)
                                      }}
                                      className="p-4 rounded-xl border border-dashed border-[#2a2a2e] hover:border-purple-500/50 transition-all text-left flex flex-col items-center justify-center gap-2"
                                    >
                                      <Plus className="h-5 w-5 text-gray-500" />
                                      <span className="text-xs text-gray-500">Importar lista</span>
                                    </button>
                                  )}
                                </div>
                              </div>

                              {/* Actions */}
                              <div className="flex items-center gap-2 pt-2 border-t border-[#2a2a2e]">
                                <button
                                  onClick={() => handleExportUsers(bot.id)}
                                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#2a2a2e] text-gray-400 hover:text-white transition-colors text-xs"
                                >
                                  <Download className="h-3.5 w-3.5" />
                                  Exportar Todos
                                </button>
                                <button
                                  onClick={() => {
                                    setImportBotId(bot.id)
                                    setShowImportModal(true)
                                  }}
                                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#2a2a2e] text-gray-400 hover:text-white transition-colors text-xs"
                                >
                                  <Upload className="h-3.5 w-3.5" />
                                  Importar
                                </button>
                                <button
                                  onClick={() => {
                                    setNewCampaign(prev => ({ ...prev, bot_id: bot.id }))
                                    setShowCreateModal(true)
                                  }}
                                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#bfff00]/10 text-[#bfff00] hover:bg-[#bfff00]/20 transition-colors text-xs"
                                >
                                  <Target className="h-3.5 w-3.5" />
                                  Criar Campanha
                                </button>
                                <div className="flex-1" />
                                <button
                                  onClick={() => setShowDeleteConfirm(bot.id)}
                                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors text-xs"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                  Apagar Dados
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

          </div>
        </div>
      </ScrollArea>

      {/* Create Campaign Modal */}
      <Dialog open={showCreateModal} onOpenChange={(open) => !open && resetCreateModal()}>
        <DialogContent className="sm:max-w-md bg-[#1c1c1e] border-[#2a2a2e] p-0">
          <div className="p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-bold text-white">Nova Campanha</h2>
                <p className="text-xs text-gray-500">Passo {createStep} de 4</p>
              </div>
              <button onClick={resetCreateModal} className="w-8 h-8 rounded-lg hover:bg-[#2a2a2e] flex items-center justify-center">
                <X className="h-4 w-4 text-gray-400" />
              </button>
            </div>

            {/* Progress */}
            <div className="flex gap-1 mb-6">
              {[1, 2, 3, 4].map(step => (
                <div 
                  key={step}
                  className={`h-1 flex-1 rounded-full ${step <= createStep ? "bg-[#bfff00]" : "bg-[#2a2a2e]"}`}
                />
              ))}
            </div>

            {/* Step 1: Name */}
            {createStep === 1 && (
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-gray-400 mb-2 block">Nome da Campanha</label>
                  <input
                    type="text"
                    value={newCampaign.name}
                    onChange={(e) => setNewCampaign(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Ex: Recuperar carrinho abandonado"
                    className="w-full h-11 px-4 bg-[#141416] border border-[#2a2a2e] rounded-xl text-white placeholder:text-gray-500 focus:outline-none focus:border-[#bfff00]/50"
                  />
                </div>
              </div>
            )}

            {/* Step 2: Bot */}
            {createStep === 2 && (
              <div className="space-y-3">
                <label className="text-xs font-medium text-gray-400 mb-2 block">Selecione o Bot</label>
                {bots.map(bot => {
                  const userCount = (allBotUsers[bot.id] || []).length
                  return (
                    <button
                      key={bot.id}
                      onClick={() => setNewCampaign(prev => ({ ...prev, bot_id: bot.id }))}
                      className={`w-full flex items-center gap-3 p-4 rounded-xl border transition-all ${
                        newCampaign.bot_id === bot.id
                          ? "border-[#bfff00] bg-[#bfff00]/5"
                          : "border-[#2a2a2e] hover:border-[#bfff00]/30"
                      }`}
                    >
                      {bot.photo_url ? (
                        <img 
                          src={bot.photo_url} 
                          alt={bot.name}
                          className="w-10 h-10 rounded-xl object-cover border border-[#2a2a2e]"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-xl bg-[#bfff00]/10 flex items-center justify-center">
                          <Bot className="h-5 w-5 text-[#bfff00]" />
                        </div>
                      )}
                      <div className="text-left flex-1">
                        <p className="text-sm font-bold text-white">{bot.name}</p>
                        <p className="text-xs text-gray-500">
                          {bot.username ? `@${bot.username}` : `${userCount} usuarios`}
                        </p>
                      </div>
                      {newCampaign.bot_id === bot.id && (
                        <CheckCircle2 className="h-5 w-5 text-[#bfff00]" />
                      )}
                    </button>
                  )
                })}
              </div>
            )}

            {/* Step 3: Audience */}
            {createStep === 3 && (
              <div className="space-y-3">
                <label className="text-xs font-medium text-gray-400 mb-2 block">Selecione o Publico</label>
                {AUDIENCES.map(audience => {
                  const count = newCampaign.bot_id ? (getAudienceCounts(newCampaign.bot_id)[audience.id] || 0) : 0
                  const Icon = audience.icon
                  return (
                    <button
                      key={audience.id}
                      onClick={() => setNewCampaign(prev => ({ ...prev, audience_id: audience.id }))}
                      className={`w-full flex items-center gap-3 p-4 rounded-xl border transition-all ${
                        newCampaign.audience_id === audience.id
                          ? `${audience.borderColor} ${audience.bgColor}`
                          : "border-[#2a2a2e] hover:border-[#bfff00]/30"
                      }`}
                    >
                      <div className={`w-10 h-10 rounded-xl ${audience.bgColor} flex items-center justify-center`}>
                        <Icon className={`h-5 w-5 ${audience.color}`} />
                      </div>
                      <div className="text-left flex-1">
                        <p className="text-sm font-bold text-white">{audience.name}</p>
                        <p className="text-xs text-gray-500">{audience.description}</p>
                      </div>
                      <span className={`text-sm font-bold ${audience.color}`}>{count}</span>
                    </button>
                  )
                })}
              </div>
            )}

            {/* Step 4: Message */}
            {createStep === 4 && (
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-gray-400 mb-2 block">Mensagem</label>
                  <textarea
                    value={newCampaign.message_template}
                    onChange={(e) => setNewCampaign(prev => ({ ...prev, message_template: e.target.value }))}
                    placeholder="Ola {nome}! Notamos que voce..."
                    rows={5}
                    className="w-full px-4 py-3 bg-[#141416] border border-[#2a2a2e] rounded-xl text-white placeholder:text-gray-500 focus:outline-none focus:border-[#bfff00]/50 resize-none"
                  />
                  <p className="text-xs text-gray-500 mt-2">Use {"{nome}"} para personalizar com o nome do usuario</p>
                </div>
              </div>
            )}

            {/* Navigation */}
            <div className="flex gap-3 mt-6">
              {createStep > 1 && (
                <button
                  onClick={() => setCreateStep(prev => prev - 1)}
                  className="flex-1 h-11 rounded-xl border border-[#2a2a2e] text-gray-400 hover:text-white hover:border-[#bfff00]/30 transition-colors text-sm font-medium"
                >
                  Voltar
                </button>
              )}
              {createStep < 4 ? (
                <button
                  onClick={() => setCreateStep(prev => prev + 1)}
                  disabled={
                    (createStep === 1 && !newCampaign.name) ||
                    (createStep === 2 && !newCampaign.bot_id) ||
                    (createStep === 3 && !newCampaign.audience_id)
                  }
                  className="flex-1 h-11 rounded-xl bg-[#bfff00] text-black font-bold text-sm hover:bg-[#a8e600] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Continuar
                </button>
              ) : (
                <button
                  onClick={handleCreateCampaign}
                  className="flex-1 h-11 rounded-xl bg-[#bfff00] text-black font-bold text-sm hover:bg-[#a8e600] transition-colors"
                >
                  Criar Campanha
                </button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Users Modal */}
      <Dialog open={showUsersModal} onOpenChange={setShowUsersModal}>
        <DialogContent className="sm:max-w-2xl bg-[#1c1c1e] border-[#2a2a2e] p-0 max-h-[80vh]">
          {selectedAudienceForBot && (
            <>
              <div className="p-6 border-b border-[#2a2a2e]">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-white">
                      {AUDIENCES.find(a => a.id === selectedAudienceForBot.audienceId)?.name}
                    </h2>
                    <p className="text-xs text-gray-500">
                      {bots.find(b => b.id === selectedAudienceForBot.botId)?.name} - {getFilteredUsers(selectedAudienceForBot.botId, selectedAudienceForBot.audienceId).length} usuarios
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleExportUsers(selectedAudienceForBot.botId, selectedAudienceForBot.audienceId)}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#2a2a2e] text-gray-400 hover:text-white transition-colors text-xs"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Exportar
                    </button>
                    <button
                      onClick={() => {
                        setNewCampaign(prev => ({ 
                          ...prev, 
                          bot_id: selectedAudienceForBot.botId,
                          audience_id: selectedAudienceForBot.audienceId
                        }))
                        setShowUsersModal(false)
                        setCreateStep(3)
                        setShowCreateModal(true)
                      }}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#bfff00] text-black font-bold text-xs"
                    >
                      <Target className="h-3.5 w-3.5" />
                      Criar Campanha
                    </button>
                  </div>
                </div>
              </div>
              <ScrollArea className="max-h-[50vh]">
                <div className="p-4">
                  <div className="space-y-2">
                    {getFilteredUsers(selectedAudienceForBot.botId, selectedAudienceForBot.audienceId).map(user => (
                      <div key={user.id} className="flex items-center justify-between p-3 rounded-xl bg-[#141416] border border-[#2a2a2e]">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-[#bfff00]/10 flex items-center justify-center text-[#bfff00] font-bold text-sm">
                            {user.first_name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-white">{user.first_name} {user.last_name || ""}</p>
                            <p className="text-xs text-gray-500">@{user.username || "sem username"}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500">{user.funnel_step}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            user.payment_status === "paid" ? "bg-emerald-500/10 text-emerald-400" :
                            user.payment_status === "pending" ? "bg-yellow-500/10 text-yellow-400" :
                            "bg-gray-500/10 text-gray-400"
                          }`}>
                            {user.payment_status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </ScrollArea>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Modal */}
      <Dialog open={!!showDeleteConfirm} onOpenChange={() => setShowDeleteConfirm(null)}>
        <DialogContent className="sm:max-w-sm bg-[#1c1c1e] border-[#2a2a2e] p-6">
          <div className="flex flex-col items-center text-center">
            <div className="w-14 h-14 rounded-2xl bg-red-500/10 flex items-center justify-center mb-4">
              <AlertTriangle className="h-7 w-7 text-red-400" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Apagar todos os dados?</h3>
            <p className="text-sm text-gray-500 mb-6">
              Esta acao vai apagar todos os usuarios coletados deste bot. Esta acao nao pode ser desfeita.
            </p>
            <div className="flex gap-3 w-full">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="flex-1 h-11 rounded-xl border border-[#2a2a2e] text-gray-400 hover:text-white transition-colors font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={() => showDeleteConfirm && handleDeleteBotUsers(showDeleteConfirm)}
                className="flex-1 h-11 rounded-xl bg-red-500 text-white font-bold hover:bg-red-600 transition-colors"
              >
                Apagar
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Import Modal */}
      <Dialog open={showImportModal} onOpenChange={(open) => !open && resetImportModal()}>
        <DialogContent className="sm:max-w-lg bg-[#1c1c1e] border-[#2a2a2e] p-0">
          <div className="p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-bold text-white">Importar Usuarios</h2>
              <button onClick={resetImportModal} className="w-8 h-8 rounded-lg hover:bg-[#2a2a2e] flex items-center justify-center">
                <X className="h-4 w-4 text-gray-400" />
              </button>
            </div>
            <p className="text-sm text-gray-500 mb-6">Importe chat IDs do Telegram para remarketing</p>
            
            <div className="space-y-4">
              {/* Bot Selection */}
              <div>
                <label className="text-xs font-medium text-gray-400 mb-2 block">Selecione o Bot</label>
                <select
                  value={importBotId || ""}
                  onChange={(e) => setImportBotId(e.target.value)}
                  className="w-full h-11 px-4 bg-[#141416] border border-[#2a2a2e] rounded-xl text-white focus:outline-none focus:border-[#bfff00]/50"
                >
                  <option value="">Escolha um bot</option>
                  {bots.map(bot => (
                    <option key={bot.id} value={bot.id}>{bot.name}</option>
                  ))}
                </select>
              </div>

              {/* Chat IDs Input */}
              <div>
                <label className="text-xs font-medium text-gray-400 mb-2 block">
                  Cole os Chat IDs dos usuarios
                </label>
                <textarea
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                  placeholder={"123456789, 987654321, 456789123\n\nou um por linha:\n123456789\n987654321\n456789123"}
                  rows={8}
                  className="w-full px-4 py-3 bg-[#141416] border border-[#2a2a2e] rounded-xl text-white placeholder:text-gray-600 focus:outline-none focus:border-[#bfff00]/50 resize-none font-mono text-sm"
                />
                <p className="text-xs text-gray-500 mt-2">
                  Aceita IDs separados por <span className="text-gray-400">virgula</span> ou <span className="text-gray-400">um por linha</span>
                </p>
              </div>

              {/* Import Result */}
              {importResult && (
                <div className={`p-4 rounded-xl ${importResult.success ? "bg-emerald-500/10 border border-emerald-500/30" : "bg-red-500/10 border border-red-500/30"}`}>
                  {importResult.success ? (
                    <div className="flex items-start gap-3">
                      <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-emerald-400">Importacao concluida!</p>
                        <p className="text-xs text-gray-400 mt-1">
                          {importResult.imported} importados
                          {importResult.skipped ? ` • ${importResult.skipped} ja existiam` : ""}
                          {importResult.duplicates ? ` • ${importResult.duplicates} duplicados` : ""}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-red-400">{importResult.error || "Erro na importacao"}</p>
                        {importResult.parseErrors && importResult.parseErrors.length > 0 && (
                          <ul className="text-xs text-gray-400 mt-2 space-y-1">
                            {importResult.parseErrors.slice(0, 5).map((err: string, i: number) => (
                              <li key={i}>• {err}</li>
                            ))}
                            {importResult.parseErrors.length > 5 && (
                              <li>• e mais {importResult.parseErrors.length - 5} erros...</li>
                            )}
                          </ul>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={resetImportModal}
                  className="flex-1 h-11 rounded-xl border border-[#2a2a2e] text-gray-400 hover:text-white hover:border-[#bfff00]/30 transition-colors text-sm font-medium"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleImportUsers}
                  disabled={!importBotId || !importText.trim() || importing}
                  className="flex-1 h-11 rounded-xl bg-[#bfff00] text-black font-bold text-sm hover:bg-[#a8e600] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {importing ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      Importando...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4" />
                      Importar
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
