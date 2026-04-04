"use client"

import { useEffect, useState, useCallback } from "react"
import { cn } from "@/lib/utils"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import {
  Users,
  Search,
  MoreHorizontal,
  Ban,
  CheckCircle,
  Eye,
  Bot,
  CreditCard,
  Loader2,
  RefreshCw,
  Wallet,
  DollarSign,
  Shield,
  Clock,
  UserPlus,
  Zap,
} from "lucide-react"

interface UserBot {
  id: string
  name: string
  username: string
  is_active: boolean
  created_at: string
}

interface UserGateway {
  id: string
  gateway_name: string
  is_active: boolean
  created_at: string
}

interface UserReferral {
  id: string
  email: string
  name: string
  created_at: string
}

interface UserStats {
  totalStarts: number
  totalPayments: number
  totalRevenue: number
}

interface AdminUser {
  id: string
  email: string
  name: string | null
  phone: string | null
  banned: boolean
  created_at: string
  bots: UserBot[]
  gateways: UserGateway[]
  referrals: UserReferral[]
  stats: UserStats
  affiliateBalance: number
  totalReferralEarnings: number
  totalWithdrawn: number
}

export default function UsersManagementPage() {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [search, setSearch] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  
  const [editingBalance, setEditingBalance] = useState(false)
  const [balanceInput, setBalanceInput] = useState("")
  const [balanceReason, setBalanceReason] = useState("")
  const [balanceLoading, setBalanceLoading] = useState(false)

  const loadUsers = useCallback(async () => {
    setIsLoading(true)
    try {
      console.log("[v0] Users page - fetching users...")
      const res = await fetch("/api/dragonadm/users")
      console.log("[v0] Users page - response status:", res.status)
      if (res.ok) {
        const data = await res.json()
        console.log("[v0] Users page - received users:", data.users?.length, "data:", data)
        setUsers(data.users || [])
      } else {
        const errorText = await res.text()
        console.error("[v0] Users page - API error:", errorText)
      }
    } catch (error) {
      console.error("[v0] Users page - Erro ao carregar usuarios:", error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadUsers()
  }, [loadUsers])

  const handleToggleBan = async (userId: string, currentBanned: boolean) => {
    setActionLoading(userId)
    try {
      const res = await fetch("/api/dragonadm/users/toggle-ban", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, banned: !currentBanned }),
      })

      if (res.ok) {
        setUsers(prev =>
          prev.map(u =>
            u.id === userId ? { ...u, banned: !currentBanned } : u
          )
        )
      }
    } catch (error) {
      console.error("Erro ao alterar status:", error)
    } finally {
      setActionLoading(null)
    }
  }

  const openUserDetails = (user: AdminUser) => {
    setSelectedUser(user)
    setDetailsOpen(true)
    setEditingBalance(false)
    setBalanceInput("")
    setBalanceReason("")
  }

  const handleUpdateBalance = async () => {
    if (!selectedUser || !balanceInput) return
    
    setBalanceLoading(true)
    try {
      const res = await fetch("/api/dragonadm/users/update-affiliate-balance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: selectedUser.id,
          amount: parseFloat(balanceInput.replace(",", ".")),
          type: "set",
          reason: balanceReason || "Ajuste manual pelo admin",
        }),
      })

      if (res.ok) {
        const data = await res.json()
        setUsers(prev =>
          prev.map(u =>
            u.id === selectedUser.id
              ? { ...u, affiliateBalance: data.newBalance }
              : u
          )
        )
        setSelectedUser(prev => prev ? { ...prev, affiliateBalance: data.newBalance } : null)
        setEditingBalance(false)
        setBalanceInput("")
        setBalanceReason("")
      }
    } catch (error) {
      console.error("Erro ao atualizar saldo:", error)
    } finally {
      setBalanceLoading(false)
    }
  }

  const filteredUsers = users.filter(u =>
    u.email?.toLowerCase().includes(search.toLowerCase()) ||
    u.name?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <>
      <ScrollArea className="flex-1">
        <div className="p-6 lg:p-8 space-y-8">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 pb-6" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div 
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ 
                    background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.2), rgba(139, 92, 246, 0.1))',
                    border: '1px solid rgba(59, 130, 246, 0.2)'
                  }}
                >
                  <Users className="w-5 h-5 text-[#3b82f6]" />
                </div>
                <h1 className="text-3xl font-bold text-white tracking-tight">Usuarios</h1>
              </div>
              <p className="text-[#666666] text-sm">
                Gerencie todos os usuarios do sistema
              </p>
            </div>
            <button
              onClick={loadUsers}
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

          {/* Users Table Card */}
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
                  <UserPlus className="w-5 h-5 text-[#95e468]" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white">Lista de Usuarios</h2>
                  <p className="text-xs text-[#666666]">{filteredUsers.length} usuarios encontrados</p>
                </div>
              </div>
              <div className="relative">
                <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#666666]" />
                <input
                  placeholder="Buscar usuario..."
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
                    <div className="w-12 h-12 rounded-xl bg-[#95e468]/10 flex items-center justify-center">
                      <Loader2 className="w-6 h-6 text-[#95e468] animate-spin" />
                    </div>
                    <div className="absolute inset-0 rounded-xl bg-[#95e468]/20 blur-xl animate-pulse" />
                  </div>
                  <p className="text-sm text-[#666666]">Carregando usuarios...</p>
                </div>
              ) : filteredUsers.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                  <div 
                    className="w-20 h-20 rounded-2xl flex items-center justify-center"
                    style={{ 
                      background: 'linear-gradient(135deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))',
                      border: '1px solid rgba(255,255,255,0.06)'
                    }}
                  >
                    <Users className="h-10 w-10 text-[#444444]" />
                  </div>
                  <p className="text-sm text-[#666666]">
                    {users.length === 0 ? "Nenhum usuario registrado" : "Nenhum resultado encontrado"}
                  </p>
                </div>
              ) : (
                <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {filteredUsers.map((user) => (
                    <div
                      key={user.id}
                      className="rounded-xl p-4 transition-all hover:scale-[1.02] cursor-pointer"
                      style={{ 
                        background: 'rgba(255,255,255,0.02)',
                        border: '1px solid rgba(255,255,255,0.06)'
                      }}
                      onClick={() => openUserDetails(user)}
                    >
                      {/* Card Header */}
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div 
                            className="w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold text-white"
                            style={{ 
                              background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.2), rgba(149, 228, 104, 0.1))',
                              border: '1px solid rgba(255,255,255,0.06)'
                            }}
                          >
                            {user.email?.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-white truncate">
                              {user.name || "Sem nome"}
                            </p>
                            <p className="text-xs text-[#666666] truncate">{user.email}</p>
                          </div>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              onClick={(e) => e.stopPropagation()}
                              disabled={actionLoading === user.id}
                              className="p-1.5 rounded-lg text-[#666666] hover:text-white hover:bg-white/[0.05] transition-colors disabled:opacity-50"
                            >
                              {actionLoading === user.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <MoreHorizontal className="h-4 w-4" />
                              )}
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent 
                            align="end" 
                            className="w-48 rounded-xl p-1"
                            style={{ 
                              background: '#111111',
                              border: '1px solid rgba(255,255,255,0.1)'
                            }}
                          >
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation()
                                openUserDetails(user)
                              }}
                              className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-white cursor-pointer hover:bg-white/[0.05]"
                            >
                              <Eye className="h-4 w-4 text-[#3b82f6]" />
                              Ver Detalhes
                            </DropdownMenuItem>
                            <DropdownMenuSeparator className="my-1 bg-white/[0.06]" />
                            {user.banned ? (
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleToggleBan(user.id, user.banned)
                                }}
                                className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-[#22c55e] cursor-pointer hover:bg-[#22c55e]/10"
                              >
                                <CheckCircle className="h-4 w-4" />
                                Desbanir Usuario
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleToggleBan(user.id, user.banned)
                                }}
                                className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-[#ef4444] cursor-pointer hover:bg-[#ef4444]/10"
                              >
                                <Ban className="h-4 w-4" />
                                Banir Usuario
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>

                      {/* Status Badge */}
                      <div className="flex items-center gap-2 mb-4">
                        {user.banned ? (
                          <span 
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium"
                            style={{ 
                              background: 'rgba(239, 68, 68, 0.1)',
                              color: '#ef4444',
                              border: '1px solid rgba(239, 68, 68, 0.2)'
                            }}
                          >
                            <Ban className="w-2.5 h-2.5" />
                            Banido
                          </span>
                        ) : (
                          <span 
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium"
                            style={{ 
                              background: 'rgba(34, 197, 94, 0.1)',
                              color: '#22c55e',
                              border: '1px solid rgba(34, 197, 94, 0.2)'
                            }}
                          >
                            <CheckCircle className="w-2.5 h-2.5" />
                            Ativo
                          </span>
                        )}
                        <span className="text-[10px] text-[#666666] flex items-center gap-1">
                          <Clock className="w-2.5 h-2.5" />
                          {new Date(user.created_at).toLocaleDateString("pt-BR")}
                        </span>
                      </div>

                      {/* Stats Grid */}
                      <div className="grid grid-cols-2 gap-2 mb-3">
                        <div 
                          className="p-2.5 rounded-lg text-center"
                          style={{ background: 'rgba(139, 92, 246, 0.05)', border: '1px solid rgba(139, 92, 246, 0.1)' }}
                        >
                          <div className="flex items-center justify-center gap-1 mb-1">
                            <Bot className="w-3 h-3 text-[#8b5cf6]" />
                            <span className="text-xs font-semibold text-white">{user.bots?.length || 0}</span>
                          </div>
                          <p className="text-[9px] text-[#666666] uppercase">Bots</p>
                        </div>
                        <div 
                          className="p-2.5 rounded-lg text-center"
                          style={{ background: 'rgba(59, 130, 246, 0.05)', border: '1px solid rgba(59, 130, 246, 0.1)' }}
                        >
                          <div className="flex items-center justify-center gap-1 mb-1">
                            <UserPlus className="w-3 h-3 text-[#3b82f6]" />
                            <span className="text-xs font-semibold text-white">{user.referrals?.length || 0}</span>
                          </div>
                          <p className="text-[9px] text-[#666666] uppercase">Indicacoes</p>
                        </div>
                      </div>

                      {/* Gateway & Saldo */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-[#666666] uppercase">Gateway</span>
                          {user.gateways?.length > 0 ? (
                            <span 
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium"
                              style={{ background: 'rgba(34, 197, 94, 0.1)', color: '#22c55e' }}
                            >
                              <Zap className="w-2.5 h-2.5" />
                              Ativa
                            </span>
                          ) : (
                            <span className="text-[10px] text-[#444444]">Nenhuma</span>
                          )}
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-[#666666] uppercase">Saldo Afiliado</span>
                          <span className={cn(
                            "text-xs font-semibold",
                            (user.affiliateBalance || 0) > 0 ? "text-[#22c55e]" : "text-[#666666]"
                          )}>
                            R$ {(user.affiliateBalance || 0).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </ScrollArea>

      {/* User Details Dialog */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent 
          className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl"
          style={{ 
            background: '#0a0a0a',
            border: '1px solid rgba(255,255,255,0.1)'
          }}
        >
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-white">Detalhes do Usuario</DialogTitle>
          </DialogHeader>

          {selectedUser && (
            <div className="space-y-6 pt-4">
              {/* User Header */}
              <div 
                className="flex items-start gap-4 p-5 rounded-xl"
                style={{ 
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.06)'
                }}
              >
                <div 
                  className="w-16 h-16 rounded-2xl flex items-center justify-center text-xl font-bold text-white"
                  style={{ 
                    background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.3), rgba(149, 228, 104, 0.2))',
                    border: '1px solid rgba(255,255,255,0.1)'
                  }}
                >
                  {selectedUser.email?.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-white">
                    {selectedUser.name || "Sem nome"}
                  </h3>
                  <p className="text-sm text-[#666666]">{selectedUser.email}</p>
                  {selectedUser.phone && (
                    <p className="text-sm text-[#666666]">{selectedUser.phone}</p>
                  )}
                  <div className="flex items-center gap-3 mt-3">
                    {selectedUser.banned ? (
                      <span 
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium"
                        style={{ 
                          background: 'rgba(239, 68, 68, 0.1)',
                          color: '#ef4444',
                          border: '1px solid rgba(239, 68, 68, 0.2)'
                        }}
                      >
                        <Ban className="w-3 h-3" />
                        Banido
                      </span>
                    ) : (
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
                    )}
                    <span className="text-xs text-[#666666] flex items-center gap-1.5">
                      <Clock className="w-3 h-3" />
                      Desde {new Date(selectedUser.created_at).toLocaleDateString("pt-BR")}
                    </span>
                  </div>
                </div>
              </div>

              {/* Affiliate Balance Card */}
              <div 
                className="rounded-xl overflow-hidden"
                style={{ 
                  background: 'linear-gradient(145deg, rgba(34, 197, 94, 0.05), rgba(149, 228, 104, 0.02))',
                  border: '1px solid rgba(34, 197, 94, 0.15)'
                }}
              >
                <div 
                  className="px-5 py-4 flex items-center justify-between"
                  style={{ borderBottom: '1px solid rgba(34, 197, 94, 0.1)' }}
                >
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-10 h-10 rounded-xl flex items-center justify-center"
                      style={{ background: 'rgba(34, 197, 94, 0.15)' }}
                    >
                      <Wallet className="h-5 w-5 text-[#22c55e]" />
                    </div>
                    <span className="text-sm font-semibold text-white">Saldo de Afiliado</span>
                  </div>
                  {!editingBalance && (
                    <button
                      onClick={() => {
                        setEditingBalance(true)
                        setBalanceInput(selectedUser.affiliateBalance?.toString() || "0")
                      }}
                      className="px-4 py-2 rounded-lg text-xs font-medium text-[#22c55e] transition-colors hover:bg-[#22c55e]/10"
                      style={{ border: '1px solid rgba(34, 197, 94, 0.3)' }}
                    >
                      Editar Saldo
                    </button>
                  )}
                </div>
                <div className="p-5">
                  {editingBalance ? (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-[#666666] uppercase tracking-wider">Novo Saldo (R$)</label>
                        <Input
                          value={balanceInput}
                          onChange={(e) => setBalanceInput(e.target.value)}
                          placeholder="0.00"
                          className="bg-[#111111] border-[rgba(255,255,255,0.1)] text-white text-lg font-semibold"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-[#666666] uppercase tracking-wider">Motivo (opcional)</label>
                        <Input
                          value={balanceReason}
                          onChange={(e) => setBalanceReason(e.target.value)}
                          placeholder="Ex: Ajuste manual"
                          className="bg-[#111111] border-[rgba(255,255,255,0.1)] text-white"
                        />
                      </div>
                      <div className="flex gap-3 pt-2">
                        <button
                          onClick={handleUpdateBalance}
                          disabled={balanceLoading}
                          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-[#050505] transition-all disabled:opacity-50"
                          style={{ background: '#22c55e' }}
                        >
                          {balanceLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                          Salvar
                        </button>
                        <button
                          onClick={() => setEditingBalance(false)}
                          className="px-4 py-2.5 rounded-xl text-sm font-medium text-[#a1a1a1] hover:text-white transition-colors"
                          style={{ background: 'rgba(255,255,255,0.05)' }}
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <p className="text-2xl font-bold text-[#22c55e]">
                          R$ {(selectedUser.affiliateBalance || 0).toFixed(2)}
                        </p>
                        <p className="text-xs text-[#666666] mt-1">Saldo Disponivel</p>
                      </div>
                      <div>
                        <p className="text-xl font-semibold text-white">
                          R$ {(selectedUser.totalReferralEarnings || 0).toFixed(2)}
                        </p>
                        <p className="text-xs text-[#666666] mt-1">Total Ganho</p>
                      </div>
                      <div>
                        <p className="text-xl font-semibold text-white">
                          R$ {(selectedUser.totalWithdrawn || 0).toFixed(2)}
                        </p>
                        <p className="text-xs text-[#666666] mt-1">Total Sacado</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-3 gap-4">
                {[
                  { icon: Bot, label: "Bots", value: selectedUser.bots?.length || 0, color: "#8b5cf6" },
                  { icon: CreditCard, label: "Pagamentos", value: selectedUser.stats?.totalPayments || 0, color: "#f59e0b" },
                  { icon: Users, label: "Indicados", value: selectedUser.referrals?.length || 0, color: "#3b82f6" },
                ].map((stat, i) => (
                  <div 
                    key={i}
                    className="p-4 rounded-xl text-center"
                    style={{ 
                      background: 'rgba(255,255,255,0.02)',
                      border: '1px solid rgba(255,255,255,0.06)'
                    }}
                  >
                    <div 
                      className="w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-3"
                      style={{ background: `${stat.color}15` }}
                    >
                      <stat.icon className="w-5 h-5" style={{ color: stat.color }} />
                    </div>
                    <p className="text-xl font-bold text-white">{stat.value}</p>
                    <p className="text-xs text-[#666666] mt-1">{stat.label}</p>
                  </div>
                ))}
              </div>

              {/* Bots List */}
              {selectedUser.bots && selectedUser.bots.length > 0 && (
                <div 
                  className="rounded-xl overflow-hidden"
                  style={{ 
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid rgba(255,255,255,0.06)'
                  }}
                >
                  <div 
                    className="px-5 py-4"
                    style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
                  >
                    <h4 className="text-sm font-semibold text-white">Bots do Usuario</h4>
                  </div>
                  <div className="p-4 space-y-2">
                    {selectedUser.bots.map((bot) => (
                      <div 
                        key={bot.id}
                        className="flex items-center justify-between p-3 rounded-lg"
                        style={{ background: 'rgba(255,255,255,0.02)' }}
                      >
                        <div className="flex items-center gap-3">
                          <div 
                            className="w-8 h-8 rounded-lg flex items-center justify-center"
                            style={{ background: 'rgba(139, 92, 246, 0.1)' }}
                          >
                            <Bot className="w-4 h-4 text-[#8b5cf6]" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-white">{bot.name}</p>
                            <p className="text-xs text-[#666666]">@{bot.username}</p>
                          </div>
                        </div>
                        {bot.is_active ? (
                          <span 
                            className="px-2.5 py-1 rounded-md text-[10px] font-medium"
                            style={{ 
                              background: 'rgba(34, 197, 94, 0.1)',
                              color: '#22c55e'
                            }}
                          >
                            Ativo
                          </span>
                        ) : (
                          <span 
                            className="px-2.5 py-1 rounded-md text-[10px] font-medium"
                            style={{ 
                              background: 'rgba(255,255,255,0.05)',
                              color: '#666666'
                            }}
                          >
                            Inativo
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
