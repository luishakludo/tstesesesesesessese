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
import { Bot, Search, RefreshCw, Loader2, CheckCircle, XCircle } from "lucide-react"

interface BotData {
  id: string
  name: string
  username: string
  is_active: boolean
  created_at: string
  user_email?: string
}

export default function BotsPage() {
  const [bots, setBots] = useState<BotData[]>([])
  const [search, setSearch] = useState("")
  const [isLoading, setIsLoading] = useState(true)

  const loadBots = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch("/api/dragonadm/bots")
      if (res.ok) {
        const data = await res.json()
        setBots(data.bots || [])
      }
    } catch (error) {
      console.error("Erro ao carregar bots:", error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadBots()
  }, [loadBots])

  const filteredBots = bots.filter(b =>
    b.name?.toLowerCase().includes(search.toLowerCase()) ||
    b.username?.toLowerCase().includes(search.toLowerCase())
  )

  const activeBots = bots.filter(b => b.is_active).length

  return (
    <ScrollArea className="flex-1">
      <div className="p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Bots</h1>
            <p className="text-sm text-zinc-400">
              Gerencie todos os bots do sistema
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={loadBots}
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
                  <Bot className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-xl font-bold text-white">{bots.length}</p>
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
                  <p className="text-xl font-bold text-white">{activeBots}</p>
                  <p className="text-xs text-zinc-400">Ativos</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-zinc-900 border-zinc-800">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center">
                  <XCircle className="h-5 w-5 text-red-500" />
                </div>
                <div>
                  <p className="text-xl font-bold text-white">{bots.length - activeBots}</p>
                  <p className="text-xs text-zinc-400">Inativos</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <CardTitle className="text-base font-semibold text-white">
                Lista de Bots
              </CardTitle>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                <Input
                  placeholder="Buscar bot..."
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
            ) : filteredBots.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <Bot className="h-10 w-10 text-zinc-700" />
                <p className="text-sm text-zinc-400">
                  {bots.length === 0 ? "Nenhum bot criado" : "Nenhum resultado"}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-zinc-800 hover:bg-transparent">
                      <TableHead className="text-zinc-500 text-xs">Bot</TableHead>
                      <TableHead className="text-zinc-500 text-xs">Username</TableHead>
                      <TableHead className="text-zinc-500 text-xs">Dono</TableHead>
                      <TableHead className="text-zinc-500 text-xs">Status</TableHead>
                      <TableHead className="text-zinc-500 text-xs">Criado em</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredBots.map((bot) => (
                      <TableRow key={bot.id} className="border-zinc-800">
                        <TableCell>
                          <span className="text-sm font-medium text-white">
                            {bot.name}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-zinc-400">
                            @{bot.username}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-zinc-400">
                            {bot.user_email || "-"}
                          </span>
                        </TableCell>
                        <TableCell>
                          {bot.is_active ? (
                            <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-xs">
                              Ativo
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-zinc-500 border-zinc-700 text-xs">
                              Inativo
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-zinc-400">
                            {new Date(bot.created_at).toLocaleDateString("pt-BR")}
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
