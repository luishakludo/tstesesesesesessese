"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { 
  DollarSign, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  Search,
  Loader2,
  User,
  CreditCard,
  Key,
  Calendar,
  AlertTriangle,
  RefreshCw,
} from "lucide-react"
import { createClient } from "@supabase/supabase-js"
import { toast } from "sonner"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface Withdraw {
  id: string
  user_id: string
  amount: number
  name: string
  cpf: string
  pix_key: string
  status: "pending" | "approved" | "rejected" | "paid"
  admin_notes: string | null
  created_at: string
  processed_at: string | null
  user?: {
    name: string
    email: string
  }
}

export default function SaquesAfiliadosPage() {
  const [withdraws, setWithdraws] = useState<Withdraw[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "paid" | "rejected">("all")
  const [search, setSearch] = useState("")
  const [selectedWithdraw, setSelectedWithdraw] = useState<Withdraw | null>(null)
  const [adminNotes, setAdminNotes] = useState("")
  const [processing, setProcessing] = useState(false)

  const fetchWithdraws = async () => {
    setLoading(true)
    try {
      let query = supabase
        .from("referral_withdraws")
        .select(`
          *,
          user:users!user_id(name, email)
        `)
        .order("created_at", { ascending: false })

      if (filter !== "all") {
        query = query.eq("status", filter)
      }

      const { data, error } = await query

      if (error) {
        console.error("Error fetching withdraws:", error)
        return
      }

      setWithdraws(data || [])
    } catch (err) {
      console.error("Error:", err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchWithdraws()
  }, [filter])

  const handleUpdateStatus = async (status: "approved" | "rejected" | "paid") => {
    if (!selectedWithdraw) return
    
    setProcessing(true)
    try {
      const { error } = await supabase
        .from("referral_withdraws")
        .update({
          status,
          admin_notes: adminNotes || null,
          processed_at: new Date().toISOString(),
        })
        .eq("id", selectedWithdraw.id)

      if (error) throw error

      toast.success(
        status === "approved" ? "Saque aprovado!" :
        status === "paid" ? "Saque marcado como pago!" :
        "Saque rejeitado!"
      )
      setSelectedWithdraw(null)
      setAdminNotes("")
      fetchWithdraws()
    } catch (err) {
      console.error("Error updating withdraw:", err)
      toast.error("Erro ao atualizar saque")
    } finally {
      setProcessing(false)
    }
  }

  const filteredWithdraws = withdraws.filter(w => {
    if (!search) return true
    const searchLower = search.toLowerCase()
    return (
      w.name.toLowerCase().includes(searchLower) ||
      w.cpf.includes(search) ||
      w.pix_key.toLowerCase().includes(searchLower) ||
      w.user?.email?.toLowerCase().includes(searchLower)
    )
  })

  const stats = {
    pending: withdraws.filter(w => w.status === "pending").length,
    pendingAmount: withdraws.filter(w => w.status === "pending").reduce((acc, w) => acc + Number(w.amount), 0),
    approved: withdraws.filter(w => w.status === "approved").length,
    paid: withdraws.filter(w => w.status === "paid").length,
    paidAmount: withdraws.filter(w => w.status === "paid").reduce((acc, w) => acc + Number(w.amount), 0),
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const formatCPF = (cpf: string) => {
    return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")
  }

  return (
    <ScrollArea className="flex-1">
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Saques de Afiliados</h1>
            <p className="text-sm text-zinc-400">Gerencie as solicitacoes de saque do programa de indicacao</p>
          </div>
          <Button variant="outline" size="sm" onClick={fetchWithdraws} className="border-zinc-700 text-zinc-300 hover:bg-zinc-800">
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-zinc-900 border-zinc-800">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                  <Clock className="h-5 w-5 text-amber-500" />
                </div>
                <div>
                  <p className="text-xs text-zinc-400">Pendentes</p>
                  <p className="text-xl font-bold text-white">{stats.pending}</p>
                  <p className="text-xs text-amber-500">R$ {stats.pendingAmount.toFixed(2)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-zinc-900 border-zinc-800">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-white/10 flex items-center justify-center">
                  <CheckCircle2 className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-xs text-zinc-400">Aprovados</p>
                  <p className="text-xl font-bold text-white">{stats.approved}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-zinc-900 border-zinc-800">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                  <DollarSign className="h-5 w-5 text-emerald-500" />
                </div>
                <div>
                  <p className="text-xs text-zinc-400">Pagos</p>
                  <p className="text-xl font-bold text-white">{stats.paid}</p>
                  <p className="text-xs text-emerald-500">R$ {stats.paidAmount.toFixed(2)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-zinc-900 border-zinc-800">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-white/10 flex items-center justify-center">
                  <DollarSign className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-xs text-zinc-400">Total Saques</p>
                  <p className="text-xl font-bold text-white">{withdraws.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                <Input
                  placeholder="Buscar por nome, CPF, PIX ou email..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500"
                />
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1 sm:pb-0">
                {[
                  { id: "all", label: "Todos" },
                  { id: "pending", label: "Pendentes" },
                  { id: "approved", label: "Aprovados" },
                  { id: "paid", label: "Pagos" },
                  { id: "rejected", label: "Rejeitados" },
                ].map((tab) => (
                  <Button
                    key={tab.id}
                    variant={filter === tab.id ? "default" : "outline"}
                    size="sm"
                    onClick={() => setFilter(tab.id as typeof filter)}
                    className={filter === tab.id ? "bg-white text-zinc-900 hover:bg-zinc-200" : "border-zinc-700 text-zinc-300 hover:bg-zinc-800"}
                  >
                    {tab.label}
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Withdraws List */}
        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
              </div>
            ) : filteredWithdraws.length === 0 ? (
              <div className="text-center py-12">
                <DollarSign className="h-12 w-12 text-zinc-700 mx-auto mb-3" />
                <p className="text-zinc-400">Nenhum saque encontrado</p>
              </div>
            ) : (
              <div className="divide-y divide-zinc-800">
                {filteredWithdraws.map((withdraw) => (
                  <div
                    key={withdraw.id}
                    onClick={() => {
                      setSelectedWithdraw(withdraw)
                      setAdminNotes(withdraw.admin_notes || "")
                    }}
                    className="p-4 hover:bg-zinc-800/50 cursor-pointer transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <div className="h-10 w-10 rounded-full bg-white/10 flex items-center justify-center shrink-0">
                          <span className="text-sm font-bold text-white">
                            {withdraw.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium text-white">{withdraw.name}</p>
                          <p className="text-xs text-zinc-400">{withdraw.user?.email}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-zinc-500">
                              CPF: {formatCPF(withdraw.cpf)}
                            </span>
                            <span className="text-xs text-zinc-500">|</span>
                            <span className="text-xs text-zinc-500">
                              PIX: {withdraw.pix_key}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-white">
                          R$ {Number(withdraw.amount).toFixed(2)}
                        </p>
                        <Badge
                          variant={
                            withdraw.status === "pending" ? "secondary" :
                            withdraw.status === "approved" ? "default" :
                            withdraw.status === "paid" ? "default" :
                            "destructive"
                          }
                          className={
                            withdraw.status === "pending" ? "bg-amber-500/10 text-amber-500" :
                            withdraw.status === "approved" ? "bg-white/10 text-white" :
                            withdraw.status === "paid" ? "bg-emerald-500/10 text-emerald-500" :
                            "bg-red-500/10 text-red-400"
                          }
                        >
                          {withdraw.status === "pending" ? "Pendente" :
                           withdraw.status === "approved" ? "Aprovado" :
                           withdraw.status === "paid" ? "Pago" :
                           "Rejeitado"}
                        </Badge>
                        <p className="text-[10px] text-zinc-500 mt-1">
                          {formatDate(withdraw.created_at)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Details Modal */}
      <Dialog open={!!selectedWithdraw} onOpenChange={() => setSelectedWithdraw(null)}>
        <DialogContent className="sm:max-w-[450px] p-0 gap-0 bg-zinc-900 border-zinc-800">
          {selectedWithdraw && (
            <>
              <div className="p-5 border-b border-zinc-800">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-full bg-white/10 flex items-center justify-center">
                    <span className="text-lg font-bold text-white">
                      {selectedWithdraw.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <h3 className="font-bold text-white">{selectedWithdraw.name}</h3>
                    <p className="text-sm text-zinc-400">{selectedWithdraw.user?.email}</p>
                  </div>
                </div>
              </div>

              <div className="p-5 space-y-4">
                <div className="text-center p-4 rounded-xl bg-white/5 border border-zinc-700">
                  <p className="text-xs text-zinc-400 mb-1">Valor do Saque</p>
                  <p className="text-3xl font-bold text-white">
                    R$ {Number(selectedWithdraw.amount).toFixed(2)}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-lg bg-zinc-800/50">
                    <div className="flex items-center gap-2 mb-1">
                      <User className="h-3 w-3 text-zinc-500" />
                      <span className="text-[10px] text-zinc-500">Nome</span>
                    </div>
                    <p className="text-sm font-medium text-white">{selectedWithdraw.name}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-zinc-800/50">
                    <div className="flex items-center gap-2 mb-1">
                      <CreditCard className="h-3 w-3 text-zinc-500" />
                      <span className="text-[10px] text-zinc-500">CPF</span>
                    </div>
                    <p className="text-sm font-medium text-white">{formatCPF(selectedWithdraw.cpf)}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-zinc-800/50 col-span-2">
                    <div className="flex items-center gap-2 mb-1">
                      <Key className="h-3 w-3 text-zinc-500" />
                      <span className="text-[10px] text-zinc-500">Chave PIX</span>
                    </div>
                    <p className="text-sm font-medium text-white break-all">{selectedWithdraw.pix_key}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-zinc-800/50 col-span-2">
                    <div className="flex items-center gap-2 mb-1">
                      <Calendar className="h-3 w-3 text-zinc-500" />
                      <span className="text-[10px] text-zinc-500">Data da Solicitacao</span>
                    </div>
                    <p className="text-sm font-medium text-white">{formatDate(selectedWithdraw.created_at)}</p>
                  </div>
                </div>

                {selectedWithdraw.status === "pending" && (
                  <div>
                    <label className="text-xs text-zinc-400 mb-1.5 block">
                      Observacoes (opcional)
                    </label>
                    <Textarea
                      value={adminNotes}
                      onChange={(e) => setAdminNotes(e.target.value)}
                      placeholder="Adicionar notas sobre este saque..."
                      className="min-h-[80px] bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500"
                    />
                  </div>
                )}

                {selectedWithdraw.admin_notes && selectedWithdraw.status !== "pending" && (
                  <div className="p-3 rounded-lg bg-zinc-800/50">
                    <p className="text-[10px] text-zinc-500 mb-1">Observacoes</p>
                    <p className="text-sm text-white">{selectedWithdraw.admin_notes}</p>
                  </div>
                )}
              </div>

              <div className="p-5 border-t border-zinc-800 bg-zinc-800/30">
                {selectedWithdraw.status === "pending" && (
                  <div className="flex gap-2">
                    <Button
                      variant="destructive"
                      onClick={() => handleUpdateStatus("rejected")}
                      disabled={processing}
                      className="flex-1"
                    >
                      {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                        <>
                          <XCircle className="h-4 w-4 mr-2" />
                          Rejeitar
                        </>
                      )}
                    </Button>
                    <Button
                      onClick={() => handleUpdateStatus("approved")}
                      disabled={processing}
                      className="flex-1 bg-white text-zinc-900 hover:bg-zinc-200"
                    >
                      {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                        <>
                          <CheckCircle2 className="h-4 w-4 mr-2" />
                          Aprovar
                        </>
                      )}
                    </Button>
                  </div>
                )}

                {selectedWithdraw.status === "approved" && (
                  <Button
                    onClick={() => handleUpdateStatus("paid")}
                    disabled={processing}
                    className="w-full bg-emerald-600 hover:bg-emerald-700"
                  >
                    {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                      <>
                        <DollarSign className="h-4 w-4 mr-2" />
                        Marcar como Pago
                      </>
                    )}
                  </Button>
                )}

                {(selectedWithdraw.status === "paid" || selectedWithdraw.status === "rejected") && (
                  <div className="text-center">
                    <Badge
                      className={
                        selectedWithdraw.status === "paid" 
                          ? "bg-emerald-500/10 text-emerald-500" 
                          : "bg-red-500/10 text-red-400"
                      }
                    >
                      {selectedWithdraw.status === "paid" ? "Saque Pago" : "Saque Rejeitado"}
                    </Badge>
                    {selectedWithdraw.processed_at && (
                      <p className="text-xs text-zinc-500 mt-2">
                        Processado em {formatDate(selectedWithdraw.processed_at)}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </ScrollArea>
  )
}
