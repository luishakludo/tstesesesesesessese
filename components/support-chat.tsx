"use client"

import { useState, useRef, useEffect } from "react"
import { X, Send, Loader2, Minus, MessageCircle, Sparkles, Headphones } from "lucide-react"
import { cn } from "@/lib/utils"

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: Date
  showCategories?: boolean
}

const CATEGORIES = [
  { id: "premium", label: "Planos", icon: Sparkles },
  { id: "bots", label: "Bots", icon: MessageCircle },
  { id: "fluxos", label: "Fluxos", icon: Sparkles },
  { id: "pagamentos", label: "Pagamentos", icon: Sparkles },
  { id: "outro", label: "Outro", icon: Headphones },
]

export function SupportChat() {
  const [isOpen, setIsOpen] = useState(false)
  const [isMinimized, setIsMinimized] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    if (isOpen && !isMinimized) {
      inputRef.current?.focus()
    }
  }, [isOpen, isMinimized])

  const handleCategoryClick = (categoryId: string) => {
    setSelectedCategory(categoryId)
    
    const categoryResponses: Record<string, string> = {
      premium: "Otimo! Me conta sua duvida sobre planos e assinaturas.",
      bots: "Certo! Qual o problema com seu bot?",
      fluxos: "Perfeito! Como posso ajudar com seus fluxos?",
      pagamentos: "Entendido! Qual sua duvida sobre pagamentos?",
      outro: "Sem problemas! Me conta o que precisa."
    }

    const assistantMessage: Message = {
      id: Date.now().toString(),
      role: "assistant",
      content: categoryResponses[categoryId],
      timestamp: new Date()
    }
    setMessages(prev => [...prev, assistantMessage])
  }

  const handleSend = async () => {
    if (!input.trim() || isLoading) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input.trim(),
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setInput("")
    setIsLoading(true)

    if (messages.length === 0) {
      setTimeout(() => {
        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: "Ola! Selecione o assunto da sua duvida:",
          timestamp: new Date(),
          showCategories: true
        }
        setMessages(prev => [...prev, assistantMessage])
        setIsLoading(false)
      }, 500)
      return
    }

    setTimeout(() => {
      const responses = [
        "Entendi! Vou verificar isso pra voce. Pode me dar mais detalhes?",
        "Certo! Vou encaminhar para nossa equipe resolver.",
        "Perfeito! Ja estou analisando sua solicitacao.",
        "Obrigado pela informacao! Em breve resolvemos isso."
      ]
      
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: responses[Math.floor(Math.random() * responses.length)],
        timestamp: new Date()
      }

      setMessages(prev => [...prev, assistantMessage])
      setIsLoading(false)
    }, 800 + Math.random() * 700)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleClose = () => {
    setIsOpen(false)
    setIsMinimized(false)
    setMessages([])
    setSelectedCategory(null)
  }

  // Botao flutuante
  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-50 group"
        aria-label="Abrir chat de suporte"
      >
        <div className="relative">
          {/* Glow effect */}
          <div className="absolute inset-0 bg-accent/30 rounded-2xl blur-xl group-hover:bg-accent/50 transition-all duration-300" />
          {/* Button */}
          <div className="relative w-14 h-14 rounded-2xl bg-gradient-to-br from-accent to-accent/80 flex items-center justify-center shadow-lg transition-all duration-300 group-hover:scale-110 group-hover:shadow-accent/25 group-hover:shadow-xl">
            <Headphones className="w-6 h-6 text-background" />
          </div>
          {/* Pulse indicator */}
          <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-background animate-pulse" />
        </div>
      </button>
    )
  }

  // Minimizado
  if (isMinimized) {
    return (
      <button
        onClick={() => setIsMinimized(false)}
        className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-card border border-border shadow-xl hover:border-accent/30 transition-all duration-300 group"
      >
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-accent to-accent/80 flex items-center justify-center">
          <Headphones className="w-4 h-4 text-background" />
        </div>
        <div className="text-left">
          <span className="text-foreground text-sm font-medium block">Suporte</span>
          <span className="text-xs text-muted-foreground">1 conversa ativa</span>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation()
            handleClose()
          }}
          className="ml-2 w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </button>
    )
  }

  // Chat aberto
  return (
    <div className="fixed bottom-6 right-6 z-50 w-[380px] h-[540px] rounded-3xl bg-card border border-border shadow-2xl overflow-hidden flex flex-col">
      {/* Header */}
      <div className="relative px-5 py-4 bg-gradient-to-r from-background to-card border-b border-border">
        {/* Accent glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-1 bg-gradient-to-r from-transparent via-accent/50 to-transparent" />
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-accent to-accent/80 flex items-center justify-center shadow-lg shadow-accent/20">
                <Headphones className="w-5 h-5 text-background" />
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-card" />
            </div>
            <div>
              <h3 className="text-foreground font-semibold text-sm">Suporte Dragon</h3>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs text-emerald-500 font-medium">Online agora</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setIsMinimized(true)}
              className="w-8 h-8 rounded-xl hover:bg-muted/50 flex items-center justify-center transition-colors"
            >
              <Minus className="w-4 h-4 text-muted-foreground" />
            </button>
            <button
              onClick={handleClose}
              className="w-8 h-8 rounded-xl hover:bg-muted/50 flex items-center justify-center transition-colors"
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gradient-to-b from-background/50 to-background">
        {messages.length === 0 && (
          <div className="text-center py-10">
            <div className="relative inline-block">
              <div className="absolute inset-0 bg-accent/20 rounded-2xl blur-xl" />
              <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-accent/20 to-accent/10 flex items-center justify-center mx-auto border border-accent/20">
                <Headphones className="w-7 h-7 text-accent" />
              </div>
            </div>
            <h4 className="text-foreground font-medium mt-4 mb-1">Como podemos ajudar?</h4>
            <p className="text-muted-foreground text-sm">Envie uma mensagem para iniciar</p>
          </div>
        )}

        {messages.map((message) => (
          <div key={message.id}>
            <div
              className={cn(
                "flex gap-2.5",
                message.role === "user" ? "justify-end" : "justify-start"
              )}
            >
              {message.role === "assistant" && (
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-accent to-accent/80 flex items-center justify-center shrink-0 shadow-sm">
                  <Headphones className="w-4 h-4 text-background" />
                </div>
              )}
              
              <div className={cn(
                "max-w-[75%] px-4 py-2.5 text-sm leading-relaxed",
                message.role === "user"
                  ? "bg-accent text-background rounded-2xl rounded-br-md font-medium"
                  : "bg-muted/50 text-foreground border border-border rounded-2xl rounded-bl-md"
              )}>
                {message.content}
              </div>
            </div>

            {/* Category buttons */}
            {message.showCategories && !selectedCategory && (
              <div className="flex flex-wrap gap-2 mt-3 ml-10">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => handleCategoryClick(cat.id)}
                    className="px-3.5 py-2 rounded-xl text-xs font-medium bg-muted/30 border border-border text-muted-foreground hover:bg-accent hover:text-background hover:border-accent transition-all duration-200 hover:shadow-lg hover:shadow-accent/10"
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}

        {isLoading && (
          <div className="flex gap-2.5 justify-start">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-accent to-accent/80 flex items-center justify-center shrink-0 shadow-sm">
              <Headphones className="w-4 h-4 text-background" />
            </div>
            <div className="px-4 py-3 rounded-2xl bg-muted/50 border border-border rounded-bl-md">
              <div className="flex gap-1.5">
                <span className="w-2 h-2 rounded-full bg-accent/60 animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-2 h-2 rounded-full bg-accent/60 animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-2 h-2 rounded-full bg-accent/60 animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 bg-card border-t border-border">
        <div className="flex items-center gap-2">
          <div className="flex-1 relative">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Digite sua mensagem..."
              className="w-full px-4 py-3 rounded-xl bg-muted/30 border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-accent/50 focus:ring-2 focus:ring-accent/10 transition-all"
            />
          </div>
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="w-11 h-11 rounded-xl bg-gradient-to-br from-accent to-accent/80 hover:from-accent hover:to-accent flex items-center justify-center transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-accent/20 hover:shadow-accent/30 hover:scale-105 disabled:hover:scale-100"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 text-background animate-spin" />
            ) : (
              <Send className="w-5 h-5 text-background" />
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
