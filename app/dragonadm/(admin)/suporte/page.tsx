"use client"

import { useEffect, useState } from "react"
import { getSupabase } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useToast } from "@/hooks/use-toast"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import {
  MessageSquare,
  Search,
  Loader2,
  User,
  Clock,
  CheckCircle,
  AlertCircle,
  Send,
  X,
} from "lucide-react"

interface Ticket {
  id: string
  user_id: string
  subject: string
  message: string
  status: "open" | "in_progress" | "closed"
  priority: "low" | "medium" | "high"
  created_at: string
  closed_at?: string
  user?: {
    name: string
    email: string
  }
  replies?: TicketReply[]
}

interface TicketReply {
  id: string
  ticket_id: string
  message: string
  is_admin: boolean
  created_at: string
}

export default function SuportePage() {
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [activeTab, setActiveTab] = useState<"open" | "in_progress" | "closed" | "all">("open")
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null)
  const [replyMessage, setReplyMessage] = useState("")
  const [sending, setSending] = useState(false)
  const supabase = getSupabase()
  const { toast } = useToast()

  useEffect(() => {
    loadTickets()
  }, [])

  const loadTickets = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from("support_tickets")
        .select(`*, user:users(name, email), replies:ticket_replies(*)`)
        .order("created_at", { ascending: false })

      if (error) throw error
      setTickets(data || [])
    } catch (error) {
      console.error("Error loading tickets:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleReply = async () => {
    if (!replyMessage.trim() || !selectedTicket) return

    setSending(true)
    try {
      // Add reply
      const { error: replyError } = await supabase.from("ticket_replies").insert({
        ticket_id: selectedTicket.id,
        message: replyMessage,
        is_admin: true,
      })

      if (replyError) throw replyError

      // Update status to in_progress if open
      if (selectedTicket.status === "open") {
        await supabase
          .from("support_tickets")
          .update({ status: "in_progress" })
          .eq("id", selectedTicket.id)
      }
      
      toast({ title: "Resposta enviada" })
      setReplyMessage("")
      loadTickets()
      
      // Reload selected ticket
      const { data } = await supabase
        .from("support_tickets")
        .select(`*, user:users(name, email), replies:ticket_replies(*)`)
        .eq("id", selectedTicket.id)
        .single()
      
      if (data) setSelectedTicket(data)
    } catch (error) {
      toast({ title: "Erro", description: "Falha ao enviar resposta", variant: "destructive" })
    } finally {
      setSending(false)
    }
  }

  const handleClose = async (id: string) => {
    try {
      const { error } = await supabase
        .from("support_tickets")
        .update({ status: "closed", closed_at: new Date().toISOString() })
        .eq("id", id)

      if (error) throw error
      
      toast({ title: "Ticket fechado" })
      loadTickets()
      setSelectedTicket(null)
    } catch (error) {
      toast({ title: "Erro", description: "Falha ao fechar ticket", variant: "destructive" })
    }
  }

  const filteredTickets = tickets.filter(t => {
    const matchesTab = activeTab === "all" || t.status === activeTab
    const matchesSearch = search === "" || 
      t.subject.toLowerCase().includes(search.toLowerCase()) ||
      t.user?.name?.toLowerCase().includes(search.toLowerCase()) ||
      t.user?.email?.toLowerCase().includes(search.toLowerCase())
    return matchesTab && matchesSearch
  })

  const stats = {
    open: tickets.filter(t => t.status === "open").length,
    in_progress: tickets.filter(t => t.status === "in_progress").length,
    closed: tickets.filter(t => t.status === "closed").length,
  }

  const tabs = [
    { id: "open", label: "Abertos", count: stats.open },
    { id: "in_progress", label: "Em Andamento", count: stats.in_progress },
    { id: "closed", label: "Fechados", count: stats.closed },
    { id: "all", label: "Todos", count: tickets.length },
  ]

  const priorityColors = {
    low: "bg-blue-500/10 text-blue-500",
    medium: "bg-yellow-500/10 text-yellow-500",
    high: "bg-red-500/10 text-red-500",
  }

  const statusColors = {
    open: "bg-yellow-500/10 text-yellow-500",
    in_progress: "bg-blue-500/10 text-blue-500",
    closed: "bg-emerald-500/10 text-emerald-500",
  }

  return (
    <ScrollArea className="flex-1">
      <div className="p-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">Suporte</h1>
          <p className="text-sm text-muted-foreground">
            Gerencie tickets de suporte dos usuarios
          </p>
        </div>

        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-3">
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-yellow-500/10 flex items-center justify-center">
                  <AlertCircle className="h-5 w-5 text-yellow-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.open}</p>
                  <p className="text-xs text-muted-foreground">Abertos</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                  <Clock className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.in_progress}</p>
                  <p className="text-xs text-muted-foreground">Em Andamento</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                  <CheckCircle className="h-5 w-5 text-emerald-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.closed}</p>
                  <p className="text-xs text-muted-foreground">Fechados</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar por assunto, nome ou email..."
                  className="pl-9"
                />
              </div>
              <div className="flex gap-1">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as typeof activeTab)}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      activeTab === tab.id
                        ? "bg-accent text-accent-foreground"
                        : "bg-secondary text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {tab.label} ({tab.count})
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tickets List */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-lg">Tickets</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-accent" />
              </div>
            ) : filteredTickets.length === 0 ? (
              <div className="text-center py-12">
                <MessageSquare className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
                <p className="text-muted-foreground">Nenhum ticket encontrado</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredTickets.map((ticket) => (
                  <div
                    key={ticket.id}
                    className="p-4 rounded-xl border border-border bg-secondary/30 flex items-center gap-4 cursor-pointer hover:bg-secondary/50 transition-colors"
                    onClick={() => setSelectedTicket(ticket)}
                  >
                    <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center">
                      <User className="h-5 w-5 text-accent" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{ticket.subject}</p>
                      <p className="text-sm text-muted-foreground truncate">
                        {ticket.user?.name} - {ticket.user?.email}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">
                        {new Date(ticket.created_at).toLocaleDateString("pt-BR")}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {ticket.replies?.length || 0} respostas
                      </p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${priorityColors[ticket.priority]}`}>
                      {ticket.priority === "high" ? "Alta" : ticket.priority === "medium" ? "Media" : "Baixa"}
                    </span>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColors[ticket.status]}`}>
                      {ticket.status === "open" ? "Aberto" : ticket.status === "in_progress" ? "Em Andamento" : "Fechado"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Ticket Details Modal */}
      <Dialog open={!!selectedTicket} onOpenChange={() => setSelectedTicket(null)}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] p-0 gap-0 overflow-hidden">
          {selectedTicket && (
            <>
              {/* Header */}
              <div className="p-5 border-b">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center">
                      <MessageSquare className="h-5 w-5 text-accent" />
                    </div>
                    <div>
                      <h3 className="font-semibold">{selectedTicket.subject}</h3>
                      <p className="text-sm text-muted-foreground">
                        {selectedTicket.user?.name} - {selectedTicket.user?.email}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[selectedTicket.status]}`}>
                      {selectedTicket.status === "open" ? "Aberto" : selectedTicket.status === "in_progress" ? "Em Andamento" : "Fechado"}
                    </span>
                    {selectedTicket.status !== "closed" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleClose(selectedTicket.id)}
                        className="text-emerald-500 hover:text-emerald-600"
                      >
                        <CheckCircle className="h-4 w-4 mr-1" />
                        Fechar
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              {/* Messages */}
              <ScrollArea className="max-h-[400px] p-5">
                <div className="space-y-4">
                  {/* Original message */}
                  <div className="p-3 rounded-lg bg-secondary">
                    <p className="text-xs text-muted-foreground mb-1">
                      {new Date(selectedTicket.created_at).toLocaleString("pt-BR")}
                    </p>
                    <p className="text-sm">{selectedTicket.message}</p>
                  </div>

                  {/* Replies */}
                  {selectedTicket.replies?.sort((a, b) => 
                    new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
                  ).map((reply) => (
                    <div
                      key={reply.id}
                      className={`p-3 rounded-lg ${
                        reply.is_admin 
                          ? "bg-accent/10 border border-accent/20 ml-4" 
                          : "bg-secondary mr-4"
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs font-medium ${reply.is_admin ? "text-accent" : "text-foreground"}`}>
                          {reply.is_admin ? "Suporte Dragon" : selectedTicket.user?.name}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(reply.created_at).toLocaleString("pt-BR")}
                        </span>
                      </div>
                      <p className="text-sm">{reply.message}</p>
                    </div>
                  ))}
                </div>
              </ScrollArea>

              {/* Reply Input */}
              {selectedTicket.status !== "closed" && (
                <div className="p-5 border-t">
                  <div className="flex gap-2">
                    <Textarea
                      value={replyMessage}
                      onChange={(e) => setReplyMessage(e.target.value)}
                      placeholder="Digite sua resposta..."
                      rows={2}
                      className="flex-1 resize-none"
                    />
                    <Button
                      onClick={handleReply}
                      disabled={sending || !replyMessage.trim()}
                      className="bg-accent hover:bg-accent/90"
                    >
                      {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </ScrollArea>
  )
}
