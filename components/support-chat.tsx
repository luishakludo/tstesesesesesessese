"use client"

import { useState, useRef, useEffect } from "react"
import { MessageCircle, X, Send, Loader2, Minimize2 } from "lucide-react"

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: Date
}

export function SupportChat() {
  const [isOpen, setIsOpen] = useState(false)
  const [isMinimized, setIsMinimized] = useState(false)
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "Ola! Sou o assistente de suporte da Dragon. Como posso ajudar voce hoje?",
      timestamp: new Date()
    }
  ])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
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

    // Simular resposta do suporte (pode ser integrado com API real depois)
    setTimeout(() => {
      const responses = [
        "Entendi sua duvida! Vou verificar isso para voce. Pode me dar mais detalhes?",
        "Obrigado por entrar em contato! Estamos analisando sua solicitacao.",
        "Certo! Para resolver isso, voce pode acessar as configuracoes do seu bot e verificar as opcoes disponiveis.",
        "Boa pergunta! Nossa equipe esta sempre disponivel para ajudar. Deixe-me verificar isso.",
        "Perfeito! Vou encaminhar sua solicitacao para nossa equipe tecnica."
      ]
      
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: responses[Math.floor(Math.random() * responses.length)],
        timestamp: new Date()
      }

      setMessages(prev => [...prev, assistantMessage])
      setIsLoading(false)
    }, 1000 + Math.random() * 1000)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-[#bfff00] hover:bg-[#a8e600] shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center group"
        aria-label="Abrir chat de suporte"
      >
        <MessageCircle className="w-6 h-6 text-black" />
        {/* Pulse animation */}
        <span className="absolute w-full h-full rounded-full bg-[#bfff00] animate-ping opacity-30"></span>
      </button>
    )
  }

  if (isMinimized) {
    return (
      <button
        onClick={() => setIsMinimized(false)}
        className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-full bg-[#1c1c1e] border border-[#2a2a2e] shadow-lg hover:shadow-xl transition-all duration-300"
      >
        <div className="w-8 h-8 rounded-full bg-[#bfff00] flex items-center justify-center">
          <MessageCircle className="w-4 h-4 text-black" />
        </div>
        <span className="text-white text-sm font-medium">Suporte</span>
        <X 
          className="w-4 h-4 text-gray-400 hover:text-white transition-colors"
          onClick={(e) => {
            e.stopPropagation()
            setIsOpen(false)
            setIsMinimized(false)
          }}
        />
      </button>
    )
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 w-[360px] h-[500px] bg-[#1c1c1e] rounded-2xl shadow-2xl border border-[#2a2a2e] flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-[#141416] border-b border-[#2a2a2e]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-[#bfff00] flex items-center justify-center">
            <MessageCircle className="w-4 h-4 text-black" />
          </div>
          <div>
            <h3 className="text-white font-semibold text-sm">Suporte Dragon</h3>
            <p className="text-[10px] text-green-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400"></span>
              Online agora
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsMinimized(true)}
            className="w-8 h-8 rounded-lg hover:bg-[#2a2a2e] flex items-center justify-center transition-colors"
            aria-label="Minimizar"
          >
            <Minimize2 className="w-4 h-4 text-gray-400" />
          </button>
          <button
            onClick={() => {
              setIsOpen(false)
              setIsMinimized(false)
            }}
            className="w-8 h-8 rounded-lg hover:bg-[#2a2a2e] flex items-center justify-center transition-colors"
            aria-label="Fechar"
          >
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm ${
                message.role === "user"
                  ? "bg-[#bfff00] text-black rounded-br-md"
                  : "bg-[#2a2a2e] text-white rounded-bl-md"
              }`}
            >
              {message.content}
            </div>
          </div>
        ))}
        
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-[#2a2a2e] px-4 py-3 rounded-2xl rounded-bl-md">
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-gray-500 animate-bounce" style={{ animationDelay: "0ms" }}></span>
                <span className="w-2 h-2 rounded-full bg-gray-500 animate-bounce" style={{ animationDelay: "150ms" }}></span>
                <span className="w-2 h-2 rounded-full bg-gray-500 animate-bounce" style={{ animationDelay: "300ms" }}></span>
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-[#2a2a2e] bg-[#141416]">
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Digite sua mensagem..."
            className="flex-1 h-10 px-4 bg-[#2a2a2e] border-0 rounded-xl text-white text-sm placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-[#bfff00]/30"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="w-10 h-10 rounded-xl bg-[#bfff00] hover:bg-[#a8e600] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 text-black animate-spin" />
            ) : (
              <Send className="w-4 h-4 text-black" />
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
