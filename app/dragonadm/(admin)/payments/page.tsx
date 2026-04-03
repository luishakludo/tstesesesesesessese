"use client"

import { useEffect, useState, useCallback } from "react"
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
import { CreditCard, Search, RefreshCw, Loader2, DollarSign, Clock, CheckCircle } from "lucide-react"

interface PaymentData {
  id: string
  user_email?: string
  amount: number
  status: string
  created_at: string
}

export default function PaymentsPage() {
  const [payments, setPayments] = useState<PaymentData[]>([])
  const [search, setSearch] = useState("")
  const [isLoading, setIsLoading] = useState(true)

  const loadPayments = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch("/api/dragonadm/payments")
      if (res.ok) {
        const data = await res.json()
        setPayments(data.payments || [])
      }
    } catch (error) {
      console.error("Erro ao carregar pagamentos:", error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadPayments()
  }, [loadPayments])

  const filteredPayments = payments.filter(p =>
    p.user_email?.toLowerCase().includes(search.toLowerCase()) ||
    p.status?.toLowerCase().includes(search.toLowerCase())
  )

  const approvedPayments = payments.filter(p => p.status === "approved")
  const totalRevenue = approvedPayments.reduce((acc, p) => acc + (p.amount || 0), 0)
  const pendingPayments = payments.filter(p => p.status === "pending").length

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-xs">Aprovado</Badge>
      case "pending":
        return <Badge className="bg-yellow-500/10 text-yellow-400 border-yellow-500/20 text-xs">Pendente</Badge>
      case "rejected":
        return <Badge className="bg-red-500/10 text-red-400 border-red-500/20 text-xs">Rejeitado</Badge>
      default:
        return <Badge variant="outline" className="text-zinc-500 border-zinc-700 text-xs">{status}</Badge>
    }
  }

  return (
    <ScrollArea className="flex-1">
      <div className="p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Pagamentos</h1>
            <p className="text-sm text-zinc-400">
              Gerencie todos os pagamentos do sistema
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={loadPayments}
            disabled={isLoading}
            className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Card className="bg-zinc-900 border-zinc-800">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                  <CreditCard className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-xl font-bold text-white">{payments.length}</p>
                  <p className="text-xs text-zinc-400">Total</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-zinc-900 border-zinc-800">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                  <DollarSign className="h-5 w-5 text-emerald-500" />
                </div>
                <div>
                  <p className="text-xl font-bold text-white">R$ {totalRevenue.toFixed(2)}</p>
                  <p className="text-xs text-zinc-400">Receita</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-zinc-900 border-zinc-800">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-yellow-500/10 flex items-center justify-center">
                  <Clock className="h-5 w-5 text-yellow-500" />
                </div>
                <div>
                  <p className="text-xl font-bold text-white">{pendingPayments}</p>
                  <p className="text-xs text-zinc-400">Pendentes</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <CardTitle className="text-base font-semibold text-white">
                Lista de Pagamentos
              </CardTitle>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                <Input
                  placeholder="Buscar pagamento..."
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
            ) : filteredPayments.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <CreditCard className="h-10 w-10 text-zinc-700" />
                <p className="text-sm text-zinc-400">
                  {payments.length === 0 ? "Nenhum pagamento" : "Nenhum resultado"}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-zinc-800 hover:bg-transparent">
                      <TableHead className="text-zinc-500 text-xs">Usuario</TableHead>
                      <TableHead className="text-zinc-500 text-xs">Valor</TableHead>
                      <TableHead className="text-zinc-500 text-xs">Status</TableHead>
                      <TableHead className="text-zinc-500 text-xs">Data</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPayments.map((payment) => (
                      <TableRow key={payment.id} className="border-zinc-800">
                        <TableCell>
                          <span className="text-sm text-white">
                            {payment.user_email || "-"}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm font-medium text-white">
                            R$ {(payment.amount || 0).toFixed(2)}
                          </span>
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(payment.status)}
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-zinc-400">
                            {new Date(payment.created_at).toLocaleDateString("pt-BR")}
                          </span>
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
  )
}
