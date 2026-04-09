"use client"

import { useState, useRef, useEffect } from "react"
import { X, Send, Loader2, Minus, ArrowUpRight } from "lucide-react"
import { cn } from "@/lib/utils"
import Image from "next/image"

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: Date
  showCategories?: boolean
}

const CATEGORIES = [
  { id: "premium", label: "Planos" },
  { id: "bots", label: "Bots" },
  { id: "fluxos", label: "Fluxos" },
  { id: "pagamentos", label: "Pagamentos" },
  { id: "outro", label: "Outro" },
]

// Avatar do atendente - usando inicial estilizada
function AgentAvatar({ size = "md" }: { size?: "sm" | "md" }) {
  const sizeClasses = size === "sm" ? "w-7 h-7 text-xs" : "w-10 h-10 text-sm"
  return (
    <div className={cn(
      sizeClasses,
      "rounded-xl bg-gradient-to-br from-neutral-700 to-neutral-800 flex items-center justify-center font-semibold text-white border border-neutral-600/50 shrink-0"
    )}>
      D
    </div>
  )
}

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

  // Botao flutuante - Design premium com borda sutil
  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-50 group"
        aria-label="Abrir chat de suporte"
      >
        <div className="relative flex items-center gap-3 px-4 py-3 rounded-2xl bg-[#0a0a0a] border border-neutral-800 hover:border-[#bfff00]/40 transition-all duration-300 shadow-xl">
          <AgentAvatar />
          <div className="text-left pr-1">
            <span className="text-white text-sm font-medium block">Precisa de ajuda?</span>
            <span className="text-neutral-500 text-xs">Fale com a gente</span>
          </div>
          <ArrowUpRight className="w-4 h-4 text-neutral-500 group-hover:text-[#bfff00] transition-colors" />
        </div>
      </button>
    )
  }

  // Minimizado
  if (isMinimized) {
    return (
      <button
        onClick={() => setIsMinimized(false)}
        className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl bg-[#0a0a0a] border border-neutral-800 hover:border-neutral-700 transition-all shadow-xl"
      >
        <AgentAvatar />
        <div className="text-left">
          <span className="text-white text-sm font-medium block">Suporte Dragon</span>
          <span className="text-[#bfff00] text-xs">1 conversa ativa</span>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation()
            handleClose()
          }}
          className="ml-2 w-6 h-6 rounded-lg flex items-center justify-center text-neutral-500 hover:text-white hover:bg-white/5 transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </button>
    )
  }

  // Chat aberto - Design inspirado em Linear/Vercel
  return (
    <div className="fixed bottom-6 right-6 z-50 w-[380px] h-[520px] rounded-2xl bg-[#0a0a0a] border border-neutral-800 shadow-2xl overflow-hidden flex flex-col">
      {/* Header */}
      <div className="px-5 py-4 border-b border-neutral-800/80 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative">
            <AgentAvatar />
            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-[#22c55e] rounded-full border-2 border-[#0a0a0a]" />
          </div>
          <div>
            <h3 className="text-white font-medium text-sm">Suporte Dragon</h3>
            <span className="text-neutral-500 text-xs">Normalmente responde em minutos</span>
          </div>
        </div>
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => setIsMinimized(true)}
            className="w-8 h-8 rounded-lg hover:bg-white/5 flex items-center justify-center transition-colors"
          >
            <Minus className="w-4 h-4 text-neutral-500" />
          </button>
          <button
            onClick={handleClose}
            className="w-8 h-8 rounded-lg hover:bg-white/5 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4 text-neutral-500" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center -mt-4">
            <div className="relative mb-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-neutral-800 to-neutral-900 flex items-center justify-center border border-neutral-700/50">
                <span className="text-2xl font-semibold text-white">D</span>
              </div>
              <span className="absolute -bottom-1 -right-1 w-5 h-5 bg-[#22c55e] rounded-lg border-2 border-[#0a0a0a] flex items-center justify-center">
                <span className="w-2 h-2 bg-white rounded-full" />
              </span>
            </div>
            <h4 className="text-white font-medium mb-1">Oi! Sou do time Dragon</h4>
            <p className="text-neutral-500 text-sm max-w-[240px]">Envia uma mensagem e vou te ajudar o mais rapido possivel.</p>
          </div>
        )}

        {messages.map((message) => (
          <div key={message.id}>
            <div
              className={cn(
                "flex gap-3",
                message.role === "user" ? "justify-end" : "justify-start"
              )}
            >
              {message.role === "assistant" && (
                <AgentAvatar size="sm" />
              )}
              
              <div className={cn(
                "max-w-[75%] px-4 py-2.5 text-sm leading-relaxed",
                message.role === "user"
                  ? "bg-[#bfff00] text-[#0a0a0a] rounded-2xl rounded-br-md font-medium"
                  : "bg-neutral-800/60 text-neutral-200 rounded-2xl rounded-bl-md border border-neutral-700/40"
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
                    className="px-3.5 py-2 rounded-xl text-xs font-medium bg-neutral-800/40 border border-neutral-700/50 text-neutral-300 hover:bg-[#bfff00] hover:text-[#0a0a0a] hover:border-[#bfff00] transition-all duration-200"
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}

        {isLoading && (
          <div className="flex gap-3 justify-start">
            <AgentAvatar size="sm" />
            <div className="px-4 py-3 rounded-2xl bg-neutral-800/60 border border-neutral-700/40 rounded-bl-md">
              <div className="flex gap-1.5">
                <span className="w-2 h-2 rounded-full bg-neutral-500 animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-2 h-2 rounded-full bg-neutral-500 animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-2 h-2 rounded-full bg-neutral-500 animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-neutral-800/80">
        <div className="flex items-center gap-3">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Escreva sua mensagem..."
            className="flex-1 px-4 py-3 rounded-xl bg-neutral-900 border border-neutral-800 text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-neutral-700 transition-colors"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="w-11 h-11 rounded-xl bg-[#bfff00] hover:bg-[#d4ff4d] flex items-center justify-center transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 text-[#0a0a0a] animate-spin" />
            ) : (
              <Send className="w-5 h-5 text-[#0a0a0a]" />
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
