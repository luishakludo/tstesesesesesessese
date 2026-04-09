"use client"

import { useState, useRef, useEffect } from "react"
import { X, Send, Loader2, Minus, MessageSquare } from "lucide-react"
import { cn } from "@/lib/utils"

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
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-[#bfff00] hover:bg-[#d4ff4d] flex items-center justify-center shadow-lg transition-all hover:scale-105"
        aria-label="Abrir chat de suporte"
      >
        <MessageSquare className="w-6 h-6 text-neutral-900" />
      </button>
    )
  }

  // Minimizado
  if (isMinimized) {
    return (
      <button
        onClick={() => setIsMinimized(false)}
        className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-2.5 rounded-full bg-neutral-900 border border-neutral-800 shadow-lg hover:bg-neutral-800 transition-colors"
      >
        <div className="w-8 h-8 rounded-full bg-[#bfff00] flex items-center justify-center">
          <MessageSquare className="w-4 h-4 text-neutral-900" />
        </div>
        <span className="text-white text-sm font-medium">Suporte</span>
        <button
          onClick={(e) => {
            e.stopPropagation()
            handleClose()
          }}
          className="ml-1 text-neutral-500 hover:text-white"
        >
          <X className="w-4 h-4" />
        </button>
      </button>
    )
  }

  // Chat aberto
  return (
    <div className="fixed bottom-6 right-6 z-50 w-[360px] h-[500px] rounded-2xl bg-neutral-900 border border-neutral-800 shadow-2xl overflow-hidden flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 bg-neutral-950 border-b border-neutral-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-[#bfff00] flex items-center justify-center">
            <MessageSquare className="w-5 h-5 text-neutral-900" />
          </div>
          <div>
            <h3 className="text-white font-semibold text-sm">Suporte</h3>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#bfff00]" />
              <span className="text-xs text-[#bfff00]">Online</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsMinimized(true)}
            className="w-8 h-8 rounded-lg hover:bg-white/10 flex items-center justify-center transition-colors"
          >
            <Minus className="w-4 h-4 text-neutral-400" />
          </button>
          <button
            onClick={handleClose}
            className="w-8 h-8 rounded-lg hover:bg-white/10 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4 text-neutral-400" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-neutral-900">
        {messages.length === 0 && (
          <div className="text-center py-8">
            <div className="w-12 h-12 rounded-full bg-[#bfff00]/20 flex items-center justify-center mx-auto mb-3">
              <MessageSquare className="w-6 h-6 text-[#bfff00]" />
            </div>
            <p className="text-neutral-400 text-sm">Envie uma mensagem para iniciar</p>
          </div>
        )}

        {messages.map((message) => (
          <div key={message.id}>
            <div
              className={cn(
                "flex gap-2",
                message.role === "user" ? "justify-end" : "justify-start"
              )}
            >
              {message.role === "assistant" && (
                <div className="w-7 h-7 rounded-full bg-[#bfff00] flex items-center justify-center shrink-0">
                  <MessageSquare className="w-3.5 h-3.5 text-neutral-900" />
                </div>
              )}
              
              <div className={cn(
                "max-w-[80%] px-3 py-2 rounded-2xl text-sm",
                message.role === "user"
                  ? "bg-[#bfff00] text-neutral-900 rounded-br-sm"
                  : "bg-neutral-800 text-neutral-100 rounded-bl-sm"
              )}>
                {message.content}
              </div>
            </div>

            {/* Category buttons */}
            {message.showCategories && !selectedCategory && (
              <div className="flex flex-wrap gap-2 mt-2 ml-9">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => handleCategoryClick(cat.id)}
                    className="px-3 py-1.5 rounded-full text-xs font-medium bg-neutral-800 text-neutral-300 hover:bg-[#bfff00] hover:text-neutral-900 transition-colors"
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}

        {isLoading && (
          <div className="flex gap-2 justify-start">
            <div className="w-7 h-7 rounded-full bg-[#bfff00] flex items-center justify-center shrink-0">
              <MessageSquare className="w-3.5 h-3.5 text-neutral-900" />
            </div>
            <div className="px-4 py-3 rounded-2xl bg-neutral-800 rounded-bl-sm">
              <div className="flex gap-1">
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
      <div className="p-3 bg-neutral-950 border-t border-neutral-800">
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Digite sua mensagem..."
            className="flex-1 px-4 py-2.5 rounded-full bg-neutral-800 border-none text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-[#bfff00]/50"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="w-10 h-10 rounded-full bg-[#bfff00] hover:bg-[#d4ff4d] flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 text-neutral-900 animate-spin" />
            ) : (
              <Send className="w-4 h-4 text-neutral-900" />
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
