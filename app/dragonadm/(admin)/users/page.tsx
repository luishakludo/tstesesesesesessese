"use client"

import { useEffect, useState, useCallback } from "react"
import { cn } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
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
  UserPlus,
  Activity,
  Loader2,
  RefreshCw,
  Wallet,
  DollarSign,
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
  
  // Affiliate balance editing
  const [editingBalance, setEditingBalance] = useState(false)
  const [balanceInput, setBalanceInput] = useState("")
  const [balanceReason, setBalanceReason] = useState("")
  const [balanceLoading, setBalanceLoading] = useState(false)

  const loadUsers = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch("/api/dragonadm/users")
      if (res.ok) {
        const data = await res.json()
        setUsers(data.users || [])
      }
    } catch (error) {
      console.error("Erro ao carregar usuarios:", error)
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
        // Atualizar usuario localmente
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

  const activeUsers = users.filter(u => !u.banned).length
  const bannedUsers = users.filter(u => u.banned).length
  const totalBots = users.reduce((acc, u) => acc + (u.bots?.length || 0), 0)

  return (
    <>
      <ScrollArea className="flex-1">
        <div className="p-6 space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-white">Usuarios</h1>
              <p className="text-sm text-zinc-400">
                Gerencie todos os usuarios do sistema
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={loadUsers}
              disabled={isLoading}
              className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
          </div>

          {/* Stats Cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="bg-zinc-900 border-zinc-800">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                    <Users className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="text-xl font-bold text-white">{users.length}</p>
                    <p className="text-xs text-zinc-400">Total</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-zinc-900 border-zinc-800">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                    <CheckCircle className="h-5 w-5 text-emerald-500" />
                  </div>
                  <div>
                    <p className="text-xl font-bold text-white">{activeUsers}</p>
                    <p className="text-xs text-zinc-400">Ativos</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-zinc-900 border-zinc-800">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center">
                    <Ban className="h-5 w-5 text-red-500" />
                  </div>
                  <div>
                    <p className="text-xl font-bold text-white">{bannedUsers}</p>
                    <p className="text-xs text-zinc-400">Banidos</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-zinc-900 border-zinc-800">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                    <Bot className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="text-xl font-bold text-white">{totalBots}</p>
                    <p className="text-xs text-zinc-400">Bots</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Users Table */}
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <CardTitle className="text-base font-semibold text-white">
                  Lista de Usuarios
                </CardTitle>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                  <Input
                    placeholder="Buscar usuario..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full sm:w-64 bg-zinc-800 pl-9 border-zinc-700 text-white placeholder:text-zinc-500 text-sm"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="h-8 w-8 animate-spin text-zinc-500" />
                </div>
              ) : filteredUsers.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <Users className="h-10 w-10 text-zinc-700" />
                  <p className="text-sm text-zinc-400">
                    {users.length === 0 ? "Nenhum usuario registrado" : "Nenhum resultado"}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-zinc-800 hover:bg-transparent">
                        <TableHead className="text-zinc-500 text-xs">Usuario</TableHead>
                        <TableHead className="text-zinc-500 text-xs">Bots</TableHead>
                        <TableHead className="text-zinc-500 text-xs">Gateway</TableHead>
                        <TableHead className="text-zinc-500 text-xs">Indicacoes</TableHead>
                        <TableHead className="text-zinc-500 text-xs">Saldo Afiliado</TableHead>
                        <TableHead className="text-zinc-500 text-xs">Status</TableHead>
                        <TableHead className="text-zinc-500 text-xs">Criado em</TableHead>
                        <TableHead className="text-zinc-500 text-xs text-right">Acoes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredUsers.map((user) => (
                        <TableRow key={user.id} className="border-zinc-800">
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="text-sm font-medium text-white">
                                {user.name || "Sem nome"}
                              </span>
                              <span className="text-xs text-zinc-400">
                                {user.email}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="text-xs bg-zinc-800 text-zinc-300">
                              {user.bots?.length || 0} bots
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {user.gateways?.length > 0 ? (
                              <Badge 
                                variant="outline" 
                                className="text-xs bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                              >
                                Ativa
                              </Badge>
                            ) : (
                              <Badge 
                                variant="outline" 
                                className="text-xs text-zinc-500 border-zinc-700"
                              >
                                Sem gateway
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-white">
                              {user.referrals?.length || 0}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className={cn(
                              "text-sm font-medium",
                              (user.affiliateBalance || 0) > 0 ? "text-emerald-500" : "text-zinc-500"
                            )}>
                              R$ {(user.affiliateBalance || 0).toFixed(2)}
                            </span>
                          </TableCell>
                          <TableCell>
                            {user.banned ? (
                              <Badge
                                variant="outline"
                                className="bg-red-500/10 text-red-400 border-red-500/20 text-xs"
                              >
                                Banido
                              </Badge>
                            ) : (
                              <Badge
                                variant="outline"
                                className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-xs"
                              >
                                Ativo
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-zinc-400">
                              {new Date(user.created_at).toLocaleDateString("pt-BR")}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-zinc-400 hover:bg-zinc-800"
                                  disabled={actionLoading === user.id}
                                >
                                  {actionLoading === user.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <MoreHorizontal className="h-4 w-4" />
                                  )}
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="bg-zinc-900 border-zinc-800">
                                <DropdownMenuItem
                                  onClick={() => openUserDetails(user)}
                                  className="text-white hover:bg-zinc-800"
                                >
                                  <Eye className="mr-2 h-4 w-4" />
                                  Ver Detalhes
                                </DropdownMenuItem>
                                <DropdownMenuSeparator className="bg-zinc-800" />
                                {user.banned ? (
                                  <DropdownMenuItem
                                    onClick={() => handleToggleBan(user.id, user.banned)}
                                    className="text-emerald-400 hover:bg-zinc-800"
                                  >
                                    <CheckCircle className="mr-2 h-4 w-4" />
                                    Desbanir
                                  </DropdownMenuItem>
                                ) : (
                                  <DropdownMenuItem
                                    onClick={() => handleToggleBan(user.id, user.banned)}
                                    className="text-red-400 hover:bg-zinc-800"
                                  >
                                    <Ban className="mr-2 h-4 w-4" />
                                    Banir
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </ScrollArea>

      {/* User Details Dialog */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-2xl bg-zinc-900 border-zinc-800 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white">Detalhes do Usuario</DialogTitle>
          </DialogHeader>

          {selectedUser && (
            <div className="space-y-6">
              {/* User Info */}
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center">
                  <span className="text-xl font-bold text-white">
                    {selectedUser.email?.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-white">
                    {selectedUser.name || "Sem nome"}
                  </h3>
                  <p className="text-sm text-zinc-400">{selectedUser.email}</p>
                  {selectedUser.phone && (
                    <p className="text-sm text-zinc-400">{selectedUser.phone}</p>
                  )}
                  <div className="flex items-center gap-2 mt-2">
                    {selectedUser.banned ? (
                      <Badge variant="outline" className="bg-red-500/10 text-red-400 border-red-500/20">
                        Banido
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                        Ativo
                      </Badge>
                    )}
                    <span className="text-xs text-zinc-500">
                      Desde {new Date(selectedUser.created_at).toLocaleDateString("pt-BR")}
                    </span>
                  </div>
                </div>
              </div>

              {/* Affiliate Balance */}
              <Card className="bg-zinc-800 border-zinc-700">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Wallet className="h-5 w-5 text-emerald-500" />
                      <span className="text-sm font-semibold text-white">Saldo de Afiliado (Indique e Ganhe)</span>
                    </div>
                    {!editingBalance && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setEditingBalance(true)
                          setBalanceInput((selectedUser.affiliateBalance || 0).toFixed(2))
                        }}
                        className="text-xs border-zinc-600 text-zinc-300 hover:bg-zinc-700"
                      >
                        Editar Saldo
                      </Button>
                    )}
                  </div>
                  
                  {editingBalance ? (
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs text-zinc-400 mb-1 block">Novo Saldo (R$)</label>
                        <Input
                          value={balanceInput}
                          onChange={(e) => setBalanceInput(e.target.value.replace(/[^0-9.,]/g, ""))}
                          placeholder="0.00"
                          className="bg-zinc-900 border-zinc-700 text-white"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-zinc-400 mb-1 block">Motivo (opcional)</label>
                        <Input
                          value={balanceReason}
                          onChange={(e) => setBalanceReason(e.target.value)}
                          placeholder="Ex: Ajuste de teste"
                          className="bg-zinc-900 border-zinc-700 text-white placeholder:text-zinc-500"
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setEditingBalance(false)}
                          disabled={balanceLoading}
                          className="flex-1 border-zinc-600 text-zinc-300 hover:bg-zinc-700"
                        >
                          Cancelar
                        </Button>
                        <Button
                          size="sm"
                          onClick={handleUpdateBalance}
                          disabled={balanceLoading || !balanceInput}
                          className="flex-1 bg-white text-zinc-900 hover:bg-zinc-200"
                        >
                          {balanceLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-4">
                      <div className="text-center">
                        <p className="text-2xl font-bold text-emerald-500">
                          R$ {(selectedUser.affiliateBalance || 0).toFixed(2)}
                        </p>
                        <p className="text-[10px] text-zinc-400">Saldo Disponivel</p>
                      </div>
                      <div className="text-center">
                        <p className="text-lg font-bold text-white">
                          R$ {(selectedUser.totalReferralEarnings || 0).toFixed(2)}
                        </p>
                        <p className="text-[10px] text-zinc-400">Total Ganho</p>
                      </div>
                      <div className="text-center">
                        <p className="text-lg font-bold text-white">
                          R$ {(selectedUser.totalWithdrawn || 0).toFixed(2)}
                        </p>
                        <p className="text-[10px] text-zinc-400">Sacado</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-4">
                <Card className="bg-zinc-800/50 border-zinc-700">
                  <CardContent className="p-4 text-center">
                    <Activity className="h-5 w-5 text-white mx-auto mb-2" />
                    <p className="text-lg font-bold text-white">{selectedUser.stats?.totalStarts || 0}</p>
                    <p className="text-xs text-zinc-400">Total Starts</p>
                  </CardContent>
                </Card>
                <Card className="bg-zinc-800/50 border-zinc-700">
                  <CardContent className="p-4 text-center">
                    <CreditCard className="h-5 w-5 text-white mx-auto mb-2" />
                    <p className="text-lg font-bold text-white">{selectedUser.stats?.totalPayments || 0}</p>
                    <p className="text-xs text-zinc-400">Pagamentos</p>
                  </CardContent>
                </Card>
                <Card className="bg-zinc-800/50 border-zinc-700">
                  <CardContent className="p-4 text-center">
                    <UserPlus className="h-5 w-5 text-white mx-auto mb-2" />
                    <p className="text-lg font-bold text-white">{selectedUser.referrals?.length || 0}</p>
                    <p className="text-xs text-zinc-400">Indicacoes</p>
                  </CardContent>
                </Card>
              </div>

              {/* Bots */}
              <div>
                <h4 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                  <Bot className="h-4 w-4" />
                  Bots ({selectedUser.bots?.length || 0})
                </h4>
                {selectedUser.bots?.length > 0 ? (
                  <div className="space-y-2">
                    {selectedUser.bots.map((bot) => (
                      <div
                        key={bot.id}
                        className="flex items-center justify-between p-3 rounded-lg bg-zinc-800/50"
                      >
                        <div>
                          <p className="text-sm font-medium text-white">{bot.name}</p>
                          <p className="text-xs text-zinc-400">@{bot.username}</p>
                        </div>
                        <Badge
                          variant="outline"
                          className={bot.is_active 
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" 
                            : "text-zinc-500 border-zinc-700"
                          }
                        >
                          {bot.is_active ? "Ativo" : "Inativo"}
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-zinc-400">Nenhum bot cadastrado</p>
                )}
              </div>

              {/* Gateways */}
              <div>
                <h4 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                  <CreditCard className="h-4 w-4" />
                  Gateways de Pagamento ({selectedUser.gateways?.length || 0})
                </h4>
                {selectedUser.gateways?.length > 0 ? (
                  <div className="space-y-2">
                    {selectedUser.gateways.map((gateway) => (
                      <div
                        key={gateway.id}
                        className="flex items-center justify-between p-3 rounded-lg bg-zinc-800/50"
                      >
                        <div>
                          <p className="text-sm font-medium text-white capitalize">
                            {gateway.gateway_name}
                          </p>
                          <p className="text-xs text-zinc-400">
                            Criado em {new Date(gateway.created_at).toLocaleDateString("pt-BR")}
                          </p>
                        </div>
                        <Badge
                          variant="outline"
                          className={gateway.is_active 
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" 
                            : "text-zinc-500 border-zinc-700"
                          }
                        >
                          {gateway.is_active ? "Ativa" : "Inativa"}
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-zinc-400">Nenhuma gateway configurada</p>
                )}
              </div>

              {/* Referrals */}
              <div>
                <h4 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                  <UserPlus className="h-4 w-4" />
                  Usuarios Indicados ({selectedUser.referrals?.length || 0})
                </h4>
                {selectedUser.referrals?.length > 0 ? (
                  <div className="space-y-2">
                    {selectedUser.referrals.map((ref) => (
                      <div
                        key={ref.id}
                        className="flex items-center justify-between p-3 rounded-lg bg-zinc-800/50"
                      >
                        <div>
                          <p className="text-sm font-medium text-white">{ref.name || ref.email}</p>
                          <p className="text-xs text-zinc-400">{ref.email}</p>
                        </div>
                        <span className="text-xs text-zinc-500">
                          {new Date(ref.created_at).toLocaleDateString("pt-BR")}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-zinc-400">Nenhum usuario indicado</p>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
