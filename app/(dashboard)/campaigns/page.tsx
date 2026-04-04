"use client"

import { useState, useEffect, useCallback } from "react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { NoBotSelected } from "@/components/no-bot-selected"
import { useBots } from "@/lib/bot-context"
import { useAuth } from "@/lib/auth-context"
import {
  Plus, Search, MoreVertical, Trash2, Pause, Play, Copy,
  Megaphone, Send, UserX, ShoppingCart, CheckCircle2,
  RefreshCw, Loader2, ChevronRight, Users, ChevronDown, Download, Upload, Bot
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface CampaignNode {
  id?: string
  type: "message" | "delay"
  label: string
  config: Record<string, unknown>
  position: number
}

interface Campaign {
  id: string
  bot_id: string
  user_id: string
  name: string
  status: "rascunho" | "ativa" | "pausada" | "concluida"
  audience?: "started_not_continued" | "not_paid" | "paid"
  campaign_type: "basic" | "complete"
  created_at: string
  updated_at: string
  nodes: CampaignNode[]
  sent_count?: number
  open_rate?: number
}

const AUDIENCES = [
  {
    id: "started_not_continued",
    label: "Abandonou",
    description: "Iniciou mas nao continuou",
    icon: UserX,
    color: "#f59e0b",
    bgClass: "bg-amber-500/20",
    textClass: "text-amber-400",
  },
  {
    id: "not_paid",
    label: "Nao pagou",
    description: "Gerou PIX mas nao finalizou",
    icon: ShoppingCart,
    color: "#ef4444",
    bgClass: "bg-red-500/20",
    textClass: "text-red-400",
  },
  {
    id: "paid",
    label: "Pagou",
    description: "Clientes que ja compraram",
    icon: CheckCircle2,
    color: "#22c55e",
    bgClass: "bg-emerald-500/20",
    textClass: "text-emerald-400",
  },
]

interface BotUser {
  id: string
  telegram_user_id: string
  first_name?: string
  username?: string
  funnel_step?: string
  is_subscriber?: boolean
  payment_status?: string
  created_at: string
}

export default function CampaignsPage() {
  const { selectedBot, bots } = useBots()
  const { session } = useAuth()
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [activeTab, setActiveTab] = useState("todas")
  
  // Section toggle: "campanhas" ou "usuarios"
  const [activeSection, setActiveSection] = useState<"campanhas" | "usuarios">("campanhas")
  
  // Users section state
  const [expandedBots, setExpandedBots] = useState<Record<string, boolean>>({})
  const [botUsers, setBotUsers] = useState<Record<string, BotUser[]>>({})
  const [loadingBotUsers, setLoadingBotUsers] = useState<Record<string, boolean>>({})
  
  // Create Modal
  const [createOpen, setCreateOpen] = useState(false)
  const [step, setStep] = useState(1)
  const [newName, setNewName] = useState("")
  const [selectedAudience, setSelectedAudience] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  
  const [deleting, setDeleting] = useState<string | null>(null)
  const [activating, setActivating] = useState<string | null>(null)

  const fetchCampaigns = useCallback(async () => {
    if (!selectedBot) return
    setIsLoading(true)
    try {
      const res = await fetch(`/api/campaigns?bot_id=${selectedBot.id}`)
      const data = await res.json()
      setCampaigns(data.campaigns || [])
    } catch { /* ignore */ }
    setIsLoading(false)
  }, [selectedBot])

  useEffect(() => {
    fetchCampaigns()
  }, [fetchCampaigns])

  const handleDelete = async (id: string) => {
    setDeleting(id)
    try {
      await fetch(`/api/campaigns?id=${id}`, { method: "DELETE" })
      setCampaigns((prev) => prev.filter((c) => c.id !== id))
    } catch { /* ignore */ }
    setDeleting(null)
  }

  const handleToggleStatus = async (campaign: Campaign) => {
    const newStatus = campaign.status === "ativa" ? "pausada" : "ativa"
    setActivating(campaign.id)
    try {
      await fetch("/api/campaigns", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: campaign.id, status: newStatus }),
      })
      setCampaigns((prev) =>
        prev.map((c) => (c.id === campaign.id ? { ...c, status: newStatus } : c))
      )
    } catch { /* ignore */ }
    setActivating(null)
  }

  const handleCreate = async () => {
    if (!newName.trim() || !selectedAudience || !selectedBot || !session?.userId) return
    
    setIsCreating(true)
    try {
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bot_id: selectedBot.id,
          user_id: session.userId,
          name: newName,
          audience: selectedAudience,
          status: "rascunho",
          campaign_type: "basic",
          nodes: []
        }),
      })
      const data = await res.json()
      if (data.campaign) {
        setCampaigns((prev) => [data.campaign, ...prev])
      }
    } catch { /* ignore */ }
    
    setIsCreating(false)
    resetModal()
  }

  const resetModal = () => {
    setCreateOpen(false)
    setNewName("")
    setSelectedAudience(null)
    setStep(1)
  }

  const getAudience = (id: string) => AUDIENCES.find(a => a.id === id) || AUDIENCES[0]

  // Fetch users for a bot
  const fetchBotUsers = async (botId: string) => {
    setLoadingBotUsers(prev => ({ ...prev, [botId]: true }))
    try {
      const res = await fetch(`/api/bots/${botId}/users`)
      const data = await res.json()
      setBotUsers(prev => ({ ...prev, [botId]: data.users || [] }))
    } catch { /* ignore */ }
    setLoadingBotUsers(prev => ({ ...prev, [botId]: false }))
  }

  const toggleBotExpanded = (botId: string) => {
    const isExpanding = !expandedBots[botId]
    setExpandedBots(prev => ({ ...prev, [botId]: isExpanding }))
    if (isExpanding && !botUsers[botId]) {
      fetchBotUsers(botId)
    }
  }

  const getUsersByStatus = (users: BotUser[], status: string) => {
    switch (status) {
      case "all": return users
      case "started_not_continued": return users.filter(u => u.funnel_step === "started" && !u.payment_status)
      case "not_paid": return users.filter(u => u.payment_status === "pending" || u.payment_status === "pix_generated")
      case "paid": return users.filter(u => u.payment_status === "paid" || u.payment_status === "approved")
      case "subscribers": return users.filter(u => u.is_subscriber)
      default: return users
    }
  }

  const exportUsers = (users: BotUser[], botName: string) => {
    const csv = [
      ["ID", "Nome", "Username", "Status", "Data"].join(","),
      ...users.map(u => [
        u.telegram_user_id,
        u.first_name || "-",
        u.username || "-",
        u.payment_status || u.funnel_step || "-",
        new Date(u.created_at).toLocaleDateString("pt-BR")
      ].join(","))
    ].join("\n")
    
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `usuarios_${botName}_${Date.now()}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const totalUsers = Object.values(botUsers).reduce((acc, users) => acc + users.length, 0)

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    })
  }

  const filteredCampaigns = campaigns.filter((c) => {
    const matchesSearch = c.name.toLowerCase().includes(search.toLowerCase())
    const matchesTab = activeTab === "todas" || c.status === activeTab
    return matchesSearch && matchesTab
  })

  const stats = {
    total: campaigns.length,
    ativas: campaigns.filter(c => c.status === "ativa").length,
    enviadas: campaigns.reduce((acc, c) => acc + (c.sent_count || 0), 0),
  }

  const tabs = [
    { id: "todas", label: "Todas", count: campaigns.length },
    { id: "ativa", label: "Ativas", count: campaigns.filter(c => c.status === "ativa").length },
    { id: "pausada", label: "Pausadas", count: campaigns.filter(c => c.status === "pausada").length },
    { id: "rascunho", label: "Rascunhos", count: campaigns.filter(c => c.status === "rascunho").length },
  ]

  if (!selectedBot) {
    return <NoBotSelected />
  }

  return (
    <>
      <ScrollArea className="flex-1">
        <div className="p-4 md:p-8 bg-[#f5f5f7] min-h-[calc(100vh-60px)]">
          <div className="max-w-5xl mx-auto">
            
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 mb-1">Remarketing</h1>
                <p className="text-gray-500">Reconquiste leads com campanhas automatizadas</p>
              </div>
              <button 
                onClick={() => setCreateOpen(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#1c1c1e] text-white text-sm font-medium hover:bg-[#2a2a2e] transition-colors"
              >
                <Plus className="h-4 w-4" />
                Nova Campanha
              </button>
            </div>

            {/* Stats Cards com Glow */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
              {/* Total */}
              <div className="relative rounded-[20px] p-5 overflow-hidden bg-[#1c1c1e]">
                <div 
                  className="absolute bottom-0 left-0 right-0 h-24 pointer-events-none"
                  style={{ background: "radial-gradient(ellipse at center bottom, rgba(190, 255, 0, 0.15) 0%, transparent 70%)" }}
                />
                <div className="relative">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-gray-400 uppercase tracking-wide">Campanhas</span>
                    <div className="w-9 h-9 rounded-xl bg-[#bfff00]/20 flex items-center justify-center">
                      <Megaphone className="h-4 w-4 text-[#bfff00]" />
                    </div>
                  </div>
                  <p className="text-3xl font-extrabold text-white">{stats.total}</p>
                  <p className="text-sm font-medium text-gray-500 mt-1">campanhas criadas</p>
                </div>
              </div>

              {/* Ativas */}
              <div className="relative rounded-[20px] p-5 overflow-hidden bg-[#1c1c1e]">
                <div 
                  className="absolute bottom-0 left-0 right-0 h-24 pointer-events-none"
                  style={{ background: "radial-gradient(ellipse at center bottom, rgba(34, 197, 94, 0.15) 0%, transparent 70%)" }}
                />
                <div className="relative">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-gray-400 uppercase tracking-wide">Ativas</span>
                    <div className="w-9 h-9 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                      <Play className="h-4 w-4 text-emerald-400" />
                    </div>
                  </div>
                  <p className="text-3xl font-extrabold text-emerald-400">{stats.ativas}</p>
                  <p className="text-sm font-medium text-gray-500 mt-1">em execucao</p>
                </div>
              </div>

              {/* Enviadas */}
              <div className="relative rounded-[20px] p-5 overflow-hidden bg-[#1c1c1e]">
                <div 
                  className="absolute bottom-0 left-0 right-0 h-24 pointer-events-none"
                  style={{ background: "radial-gradient(ellipse at center bottom, rgba(59, 130, 246, 0.15) 0%, transparent 70%)" }}
                />
                <div className="relative">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-gray-400 uppercase tracking-wide">Enviadas</span>
                    <div className="w-9 h-9 rounded-xl bg-blue-500/20 flex items-center justify-center">
                      <Send className="h-4 w-4 text-blue-400" />
                    </div>
                  </div>
                  <p className="text-3xl font-extrabold text-blue-400">{stats.enviadas}</p>
                  <p className="text-sm font-medium text-gray-500 mt-1">mensagens no total</p>
                </div>
              </div>
            </div>

            {/* Section Toggle Buttons */}
            <div className="flex gap-3 mb-6">
              <button
                onClick={() => setActiveSection("campanhas")}
                className={`flex-1 flex items-center justify-center gap-3 py-4 rounded-2xl font-bold text-base transition-all ${
                  activeSection === "campanhas"
                    ? "bg-[#bfff00] text-[#1c1c1e]"
                    : "bg-white text-gray-700 border border-gray-200 hover:bg-gray-50"
                }`}
              >
                <Megaphone className="h-5 w-5" />
                Campanhas
              </button>
              <button
                onClick={() => setActiveSection("usuarios")}
                className={`flex-1 flex items-center justify-center gap-3 py-4 rounded-2xl font-bold text-base transition-all ${
                  activeSection === "usuarios"
                    ? "bg-[#bfff00] text-[#1c1c1e]"
                    : "bg-white text-gray-700 border border-gray-200 hover:bg-gray-50"
                }`}
              >
                <Users className="h-5 w-5" />
                Usuarios
              </button>
            </div>

            {/* CAMPANHAS SECTION */}
            {activeSection === "campanhas" && (
            <>
            {/* Search and Tabs */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 mb-4">
              <div className="relative flex-1 max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Buscar campanha..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full h-9 pl-9 pr-4 bg-white border border-gray-200 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-100 focus:border-gray-300 transition-all"
                />
              </div>

              <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                      activeTab === tab.id
                        ? "bg-white text-gray-900 shadow-sm"
                        : "text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    {tab.label} ({tab.count})
                  </button>
                ))}
              </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              {/* Header */}
              <div className="grid grid-cols-[1fr_140px_100px_100px_60px] gap-4 px-5 py-3 bg-gray-50 border-b border-gray-200">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Campanha</span>
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Publico</span>
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wide text-center">Enviadas</span>
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wide text-center">Status</span>
                <span />
              </div>

              {/* Body */}
              {isLoading ? (
                <div className="flex items-center justify-center py-16">
                  <RefreshCw className="h-5 w-5 animate-spin text-gray-400" />
                </div>
              ) : filteredCampaigns.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-3">
                    <Megaphone className="h-5 w-5 text-gray-400" />
                  </div>
                  <p className="text-sm font-bold text-gray-900">Nenhuma campanha encontrada</p>
                  <p className="text-xs text-gray-500 mt-1">Crie sua primeira campanha de remarketing</p>
                  <button 
                    onClick={() => setCreateOpen(true)}
                    className="mt-4 flex items-center gap-2 px-4 py-2 rounded-lg bg-[#bfff00] text-[#1c1c1e] text-sm font-semibold hover:bg-[#d4ff4d] transition-colors"
                  >
                    <Plus className="h-4 w-4" />
                    Nova Campanha
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {filteredCampaigns.map((campaign) => {
                    const audience = getAudience(campaign.audience || "not_paid")
                    const Icon = audience.icon
                    return (
                      <div
                        key={campaign.id}
                        className="grid grid-cols-[1fr_140px_100px_100px_60px] gap-4 items-center px-5 py-4 hover:bg-gray-50 transition-colors"
                      >
                        {/* Nome */}
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-gray-900 truncate">{campaign.name}</p>
                          <p className="text-xs text-gray-500">{formatDate(campaign.created_at)}</p>
                        </div>

                        {/* Publico */}
                        <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium ${audience.bgClass} ${audience.textClass} w-fit`}>
                          <Icon className="h-3 w-3" />
                          {audience.label}
                        </div>

                        {/* Enviadas */}
                        <div className="text-center">
                          <p className="text-sm font-semibold text-gray-900">{campaign.sent_count || 0}</p>
                        </div>

                        {/* Status */}
                        <div className="flex justify-center">
                          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold ${
                            campaign.status === "ativa" 
                              ? "bg-emerald-100 text-emerald-700" 
                              : campaign.status === "pausada"
                                ? "bg-amber-100 text-amber-700"
                                : "bg-gray-100 text-gray-600"
                          }`}>
                            {campaign.status === "ativa" && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
                            {campaign.status.charAt(0).toUpperCase() + campaign.status.slice(1)}
                          </span>
                        </div>

                        {/* Acoes */}
                        <div className="flex justify-end">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center transition-colors">
                                <MoreVertical className="h-4 w-4 text-gray-500" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-40">
                              <DropdownMenuItem 
                                onClick={() => handleToggleStatus(campaign)}
                                className="gap-2"
                              >
                                {activating === campaign.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : campaign.status === "ativa" ? (
                                  <>
                                    <Pause className="h-4 w-4" />
                                    Pausar
                                  </>
                                ) : (
                                  <>
                                    <Play className="h-4 w-4" />
                                    Ativar
                                  </>
                                )}
                              </DropdownMenuItem>
                              <DropdownMenuItem className="gap-2">
                                <Copy className="h-4 w-4" />
                                Duplicar
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={() => handleDelete(campaign.id)}
                                className="gap-2 text-red-600"
                              >
                                {deleting === campaign.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <>
                                    <Trash2 className="h-4 w-4" />
                                    Excluir
                                  </>
                                )}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
            </>
            )}

            {/* USUARIOS SECTION */}
            {activeSection === "usuarios" && (
            <div className="space-y-4">
              {/* Info */}
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <p className="text-sm text-gray-600">
                  Visualize e gerencie os usuarios de cada bot. Clique em um bot para expandir e ver os publicos segmentados.
                </p>
              </div>

              {/* Bots List */}
              {bots.length === 0 ? (
                <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
                  <Bot className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                  <p className="text-sm font-bold text-gray-900">Nenhum bot encontrado</p>
                  <p className="text-xs text-gray-500 mt-1">Crie um bot primeiro para ver os usuarios</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {bots.map((bot) => {
                    const users = botUsers[bot.id] || []
                    const isExpanded = expandedBots[bot.id]
                    const isLoading = loadingBotUsers[bot.id]
                    
                    const audiences = [
                      { id: "all", label: "Todos", count: users.length, color: "bg-gray-100 text-gray-700" },
                      { id: "started_not_continued", label: "Abandonou", count: getUsersByStatus(users, "started_not_continued").length, color: "bg-amber-100 text-amber-700" },
                      { id: "not_paid", label: "Nao pagou", count: getUsersByStatus(users, "not_paid").length, color: "bg-red-100 text-red-700" },
                      { id: "paid", label: "Pagou", count: getUsersByStatus(users, "paid").length, color: "bg-emerald-100 text-emerald-700" },
                      { id: "subscribers", label: "Assinantes", count: getUsersByStatus(users, "subscribers").length, color: "bg-blue-100 text-blue-700" },
                    ]

                    return (
                      <div key={bot.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                        {/* Bot Header */}
                        <button
                          onClick={() => toggleBotExpanded(bot.id)}
                          className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-[#1c1c1e] flex items-center justify-center">
                              <Bot className="h-5 w-5 text-[#bfff00]" />
                            </div>
                            <div className="text-left">
                              <p className="font-bold text-gray-900">{bot.name}</p>
                              <p className="text-xs text-gray-500">@{bot.username || "sem_username"}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-semibold text-gray-600">{users.length} usuarios</span>
                            <ChevronDown className={`h-5 w-5 text-gray-400 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                          </div>
                        </button>

                        {/* Expanded Content */}
                        {isExpanded && (
                          <div className="border-t border-gray-100 p-4 bg-gray-50">
                            {isLoading ? (
                              <div className="flex items-center justify-center py-8">
                                <RefreshCw className="h-5 w-5 animate-spin text-gray-400" />
                              </div>
                            ) : (
                              <>
                                {/* Audiences Grid */}
                                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-4">
                                  {audiences.map((aud) => (
                                    <div key={aud.id} className={`rounded-xl p-3 ${aud.color}`}>
                                      <p className="text-2xl font-bold">{aud.count}</p>
                                      <p className="text-xs font-medium">{aud.label}</p>
                                    </div>
                                  ))}
                                </div>

                                {/* Actions */}
                                <div className="flex flex-wrap gap-2">
                                  <button
                                    onClick={() => exportUsers(users, bot.name)}
                                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                                  >
                                    <Download className="h-4 w-4" />
                                    Exportar CSV
                                  </button>
                                  <button
                                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                                  >
                                    <Upload className="h-4 w-4" />
                                    Importar
                                  </button>
                                  <button
                                    onClick={() => {
                                      setActiveSection("campanhas")
                                      setCreateOpen(true)
                                    }}
                                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#1c1c1e] text-sm font-medium text-white hover:bg-[#2a2a2e] transition-colors"
                                  >
                                    <Plus className="h-4 w-4" />
                                    Nova Campanha
                                  </button>
                                </div>

                                {/* Users Preview */}
                                {users.length > 0 && (
                                  <div className="mt-4 pt-4 border-t border-gray-200">
                                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Ultimos usuarios</p>
                                    <div className="space-y-2">
                                      {users.slice(0, 5).map((user) => (
                                        <div key={user.id} className="flex items-center justify-between py-2 px-3 bg-white rounded-lg">
                                          <div className="flex items-center gap-2">
                                            <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-600">
                                              {(user.first_name || "U")[0].toUpperCase()}
                                            </div>
                                            <div>
                                              <p className="text-sm font-medium text-gray-900">{user.first_name || "Usuario"}</p>
                                              <p className="text-xs text-gray-500">{user.username ? `@${user.username}` : user.telegram_user_id}</p>
                                            </div>
                                          </div>
                                          <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                                            user.payment_status === "paid" || user.payment_status === "approved"
                                              ? "bg-emerald-100 text-emerald-700"
                                              : user.payment_status === "pending"
                                                ? "bg-amber-100 text-amber-700"
                                                : "bg-gray-100 text-gray-600"
                                          }`}>
                                            {user.payment_status || user.funnel_step || "inicio"}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                    {users.length > 5 && (
                                      <p className="text-xs text-gray-500 text-center mt-2">E mais {users.length - 5} usuarios...</p>
                                    )}
                                  </div>
                                )}
                              </>
                            )}
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

      {/* Create Modal - Dark Theme */}
      <Dialog open={createOpen} onOpenChange={(open) => {
        if (!open) resetModal()
        else setCreateOpen(true)
      }}>
        <DialogContent className="sm:max-w-[400px] bg-[#1c1c1e] border-[#2a2a2e] p-0 gap-0 overflow-hidden rounded-[20px] [&>button]:text-gray-400 [&>button]:hover:text-white">
          <div className="p-5">
            {/* Header */}
            <div className="flex items-center gap-3 mb-5">
              <div className="w-12 h-12 rounded-xl bg-[#bfff00]/10 flex items-center justify-center border border-[#bfff00]/20">
                <Megaphone className="h-6 w-6 text-[#bfff00]" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Nova Campanha</h2>
                <p className="text-xs text-gray-400">Etapa {step} de 2</p>
              </div>
            </div>

            {/* Progress */}
            <div className="flex gap-2 mb-5">
              <div className={`flex-1 h-1 rounded-full ${step >= 1 ? "bg-[#bfff00]" : "bg-[#2a2a2e]"}`} />
              <div className={`flex-1 h-1 rounded-full ${step >= 2 ? "bg-[#bfff00]" : "bg-[#2a2a2e]"}`} />
            </div>

            {step === 1 && (
              <div className="space-y-4">
                <div>
                  <Label className="text-xs font-medium text-gray-400 mb-1.5 block uppercase tracking-wide">
                    Nome da Campanha
                  </Label>
                  <Input
                    placeholder="Ex: Recuperar carrinho abandonado"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && newName.trim() && setStep(2)}
                    className="bg-[#2a2a2e] border-[#3a3a3e] text-white placeholder:text-gray-500 h-12 rounded-xl focus:border-[#bfff00] focus:ring-0"
                    autoFocus
                  />
                </div>
                
                <button
                  onClick={() => setStep(2)}
                  disabled={!newName.trim()}
                  className="w-full bg-[#bfff00] text-[#1c1c1e] py-3 rounded-xl font-bold text-sm hover:bg-[#d4ff4d] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  Continuar
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <div>
                  <Label className="text-xs font-medium text-gray-400 mb-3 block uppercase tracking-wide">
                    Selecione o Publico
                  </Label>
                  <div className="space-y-2">
                    {AUDIENCES.map((audience) => {
                      const Icon = audience.icon
                      return (
                        <button
                          key={audience.id}
                          onClick={() => setSelectedAudience(audience.id)}
                          className={`w-full flex items-center gap-3 p-4 rounded-xl border transition-all text-left ${
                            selectedAudience === audience.id
                              ? "bg-[#bfff00]/10 border-[#bfff00]/50"
                              : "bg-[#2a2a2e] border-[#3a3a3e] hover:border-[#4a4a4e]"
                          }`}
                        >
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${audience.bgClass}`}>
                            <Icon className={`h-5 w-5 ${audience.textClass}`} />
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-semibold text-white">{audience.label}</p>
                            <p className="text-xs text-gray-500">{audience.description}</p>
                          </div>
                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                            selectedAudience === audience.id
                              ? "border-[#bfff00] bg-[#bfff00]"
                              : "border-gray-600"
                          }`}>
                            {selectedAudience === audience.id && (
                              <svg className="w-3 h-3 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
                
                <div className="flex gap-3">
                  <button
                    onClick={() => setStep(1)}
                    className="flex-1 bg-[#2a2a2e] text-white py-3 rounded-xl font-semibold text-sm hover:bg-[#3a3a3e] transition-colors"
                  >
                    Voltar
                  </button>
                  <button
                    onClick={handleCreate}
                    disabled={!selectedAudience || isCreating}
                    className="flex-1 bg-[#bfff00] text-[#1c1c1e] py-3 rounded-xl font-bold text-sm hover:bg-[#d4ff4d] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                  >
                    {isCreating ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Criar Campanha"
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
