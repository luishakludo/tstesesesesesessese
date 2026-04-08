"use client"

import { useState, useRef, useEffect } from "react"
import { X, Send, Loader2, Minus, Sparkles, HelpCircle, CreditCard, Bot, Zap, Gift, ChevronRight, ArrowLeft } from "lucide-react"
import { cn } from "@/lib/utils"

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: Date
  isCategory?: boolean
}

interface SupportCategory {
  id: string
  icon: React.ReactNode
  title: string
  description: string
  color: string
}

const SUPPORT_CATEGORIES: SupportCategory[] = [
  {
    id: "premium",
    icon: <Sparkles className="w-5 h-5" />,
    title: "Planos Premium",
    description: "Duvidas sobre assinaturas, pagamentos e beneficios",
    color: "from-amber-500 to-orange-500"
  },
  {
    id: "bots",
    icon: <Bot className="w-5 h-5" />,
    title: "Meus Bots",
    description: "Configuracao, erros e funcionamento dos bots",
    color: "from-blue-500 to-cyan-500"
  },
  {
    id: "fluxos",
    icon: <Zap className="w-5 h-5" />,
    title: "Fluxos & Automacoes",
    description: "Criar, editar e problemas com fluxos",
    color: "from-purple-500 to-pink-500"
  },
  {
    id: "pagamentos",
    icon: <CreditCard className="w-5 h-5" />,
    title: "Pagamentos",
    description: "Cobrancas, reembolsos e metodos de pagamento",
    color: "from-emerald-500 to-green-500"
  },
  {
    id: "premiacoes",
    icon: <Gift className="w-5 h-5" />,
    title: "Premiacoes & Sorteios",
    description: "Sistema de premios, rifas e sorteios",
    color: "from-rose-500 to-red-500"
  },
  {
    id: "outro",
    icon: <HelpCircle className="w-5 h-5" />,
    title: "Outra Duvida",
    description: "Nao encontrou sua categoria? Fale conosco",
    color: "from-slate-500 to-slate-600"
  }
]

export function SupportChat() {
  const [isOpen, setIsOpen] = useState(false)
  const [isMinimized, setIsMinimized] = useState(false)
  const [showCategories, setShowCategories] = useState(true)
  const [selectedCategory, setSelectedCategory] = useState<SupportCategory | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
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
    if (isOpen && !isMinimized && !showCategories) {
      inputRef.current?.focus()
    }
  }, [isOpen, isMinimized, showCategories])

  const handleCategorySelect = (category: SupportCategory) => {
    setSelectedCategory(category)
    setShowCategories(false)
    
    // Adicionar mensagem de boas vindas especifica da categoria
    const welcomeMessages: Record<string, string> = {
      premium: "Voce selecionou Planos Premium! Me conte sua duvida sobre assinaturas, beneficios ou upgrades. Estou aqui para ajudar!",
      bots: "Otimo! Vamos resolver sua duvida sobre bots. Me descreva o problema ou configuracao que precisa de ajuda.",
      fluxos: "Perfeito! Fluxos e automacoes sao minha especialidade. Qual sua duvida sobre criar ou configurar fluxos?",
      pagamentos: "Certo! Vou te ajudar com questoes de pagamento. Me conte o que aconteceu ou o que precisa resolver.",
      premiacoes: "Legal! Sistema de premiacoes e sorteios. Como posso te ajudar com rifas, premios ou configuracoes?",
      outro: "Sem problemas! Me conta qual e sua duvida que vou te direcionar para a melhor solucao."
    }
    
    setMessages([{
      id: "welcome-category",
      role: "assistant",
      content: welcomeMessages[category.id] || "Como posso ajudar voce hoje?",
      timestamp: new Date()
    }])
  }

  const handleBackToCategories = () => {
    setShowCategories(true)
    setSelectedCategory(null)
    setMessages([])
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

    // Simular resposta do suporte baseada na categoria
    setTimeout(() => {
      const categoryResponses: Record<string, string[]> = {
        premium: [
          "Entendi! Vou verificar os detalhes do seu plano. Voce pode me informar qual plano esta usando atualmente?",
          "Perfeito! Para upgrades, voce pode acessar a secao 'Minha Assinatura' no menu lateral. Quer que eu explique os beneficios de cada plano?",
          "Certo! Vou analisar sua conta. Em instantes nossa equipe entrara em contato com mais detalhes."
        ],
        bots: [
          "Entendo! Vamos resolver isso. Voce consegue me passar o nome ou ID do bot que esta com problema?",
          "Para configuracoes de bot, recomendo verificar se o token esta correto nas configuracoes. Ja tentou reconectar?",
          "Vou encaminhar para nossa equipe tecnica verificar. Enquanto isso, tente reiniciar o bot pelo painel."
        ],
        fluxos: [
          "Perfeito! Para criar um novo fluxo, va em 'Meus Fluxos' e clique em 'Criar Novo'. Precisa de ajuda com algum no especifico?",
          "Entendi o problema! Verifique se todas as conexoes entre os nos estao corretas. As vezes uma conexao solta causa esse erro.",
          "Vou analisar isso! Me manda um print do fluxo se possivel, para eu entender melhor a situacao."
        ],
        pagamentos: [
          "Certo! Vou verificar o status do seu pagamento. Pode me informar a data aproximada da cobranca?",
          "Para reembolsos, precisamos analisar o caso. Vou abrir um ticket para nossa equipe financeira.",
          "Entendo! Voce pode alterar o metodo de pagamento em 'Configuracoes > Pagamento'. Quer que eu guie voce?"
        ],
        premiacoes: [
          "Legal! Para configurar um sorteio, va em 'Premiacoes' no menu do seu bot. La voce define as regras e premios.",
          "Entendi! Vou verificar as configuracoes da rifa. Me passa o nome ou ID dela?",
          "Perfeito! Os vencedores sao sorteados automaticamente na data configurada. Quer ajuda para definir as regras?"
        ],
        outro: [
          "Obrigado por compartilhar! Vou analisar sua situacao e te direcionar para o melhor atendimento.",
          "Entendo! Essa e uma questao que precisa de atencao especial. Vou encaminhar para nossa equipe.",
          "Certo! Me conta mais detalhes para eu poder te ajudar melhor."
        ]
      }
      
      const responses = selectedCategory 
        ? categoryResponses[selectedCategory.id] || categoryResponses.outro
        : categoryResponses.outro
      
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

  // Botao flutuante fechado
  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-50 group"
        aria-label="Abrir chat de suporte"
      >
        {/* Glow effect */}
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-[#bfff00] to-[#00ff88] blur-xl opacity-40 group-hover:opacity-60 transition-opacity" />
        
        {/* Button */}
        <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-[#1c1c1e] to-[#2a2a2e] border border-[#3a3a3e] shadow-2xl flex items-center justify-center overflow-hidden group-hover:scale-105 transition-transform duration-300">
          {/* Animated gradient border */}
          <div className="absolute inset-[1px] rounded-[14px] bg-[#1c1c1e]" />
          
          {/* Icon container */}
          <div className="relative z-10 w-10 h-10 rounded-xl bg-gradient-to-br from-[#bfff00] to-[#00ff88] flex items-center justify-center">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" className="text-black">
              <path d="M12 2C6.48 2 2 6.48 2 12C2 14.17 2.78 16.17 4.08 17.74L2.26 21.74C2.13 22.03 2.37 22.35 2.68 22.27L7.54 20.95C8.91 21.62 10.42 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2Z" fill="currentColor"/>
              <circle cx="8" cy="12" r="1.5" fill="#1c1c1e"/>
              <circle cx="12" cy="12" r="1.5" fill="#1c1c1e"/>
              <circle cx="16" cy="12" r="1.5" fill="#1c1c1e"/>
            </svg>
          </div>
          
          {/* Notification dot */}
          <div className="absolute top-2 right-2 w-3 h-3 rounded-full bg-[#bfff00] animate-pulse" />
        </div>
        
        {/* Tooltip */}
        <div className="absolute bottom-full right-0 mb-2 px-3 py-1.5 bg-[#1c1c1e] border border-[#3a3a3e] rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
          <span className="text-white text-sm font-medium">Precisa de ajuda?</span>
          <div className="absolute top-full right-4 w-0 h-0 border-l-[6px] border-r-[6px] border-t-[6px] border-transparent border-t-[#3a3a3e]" />
        </div>
      </button>
    )
  }

  // Minimizado
  if (isMinimized) {
    return (
      <button
        onClick={() => setIsMinimized(false)}
        className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3 rounded-2xl bg-gradient-to-r from-[#1c1c1e] to-[#252528] border border-[#3a3a3e] shadow-2xl hover:shadow-[0_0_30px_rgba(191,255,0,0.15)] transition-all duration-300 group"
      >
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#bfff00] to-[#00ff88] flex items-center justify-center">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="text-black">
            <path d="M12 2C6.48 2 2 6.48 2 12C2 14.17 2.78 16.17 4.08 17.74L2.26 21.74C2.13 22.03 2.37 22.35 2.68 22.27L7.54 20.95C8.91 21.62 10.42 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2Z" fill="currentColor"/>
          </svg>
        </div>
        <div className="flex flex-col items-start">
          <span className="text-white text-sm font-semibold">Suporte Dragon</span>
          <span className="text-[10px] text-[#bfff00]">1 conversa ativa</span>
        </div>
        <X 
          className="w-4 h-4 text-gray-500 hover:text-white transition-colors ml-2"
          onClick={(e) => {
            e.stopPropagation()
            setIsOpen(false)
            setIsMinimized(false)
            setShowCategories(true)
            setSelectedCategory(null)
            setMessages([])
          }}
        />
      </button>
    )
  }

  // Chat aberto
  return (
    <div className="fixed bottom-6 right-6 z-50 w-[400px] h-[580px] rounded-3xl shadow-2xl overflow-hidden flex flex-col">
      {/* Gradient border effect */}
      <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-[#bfff00]/20 via-transparent to-[#00ff88]/20 p-[1px]">
        <div className="w-full h-full rounded-3xl bg-[#141416]" />
      </div>
      
      <div className="relative z-10 flex flex-col h-full">
        {/* Header */}
        <div className="relative px-5 py-4 bg-gradient-to-r from-[#1c1c1e] to-[#232326]">
          {/* Background pattern */}
          <div className="absolute inset-0 opacity-5">
            <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '20px 20px' }} />
          </div>
          
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-3">
              {selectedCategory && !showCategories && (
                <button 
                  onClick={handleBackToCategories}
                  className="w-8 h-8 rounded-lg bg-[#2a2a2e] hover:bg-[#3a3a3e] flex items-center justify-center transition-colors"
                >
                  <ArrowLeft className="w-4 h-4 text-gray-400" />
                </button>
              )}
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#bfff00] to-[#00ff88] flex items-center justify-center shadow-lg shadow-[#bfff00]/20">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" className="text-black">
                  <path d="M12 2C6.48 2 2 6.48 2 12C2 14.17 2.78 16.17 4.08 17.74L2.26 21.74C2.13 22.03 2.37 22.35 2.68 22.27L7.54 20.95C8.91 21.62 10.42 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2Z" fill="currentColor"/>
                  <circle cx="8" cy="12" r="1.5" fill="#1c1c1e"/>
                  <circle cx="12" cy="12" r="1.5" fill="#1c1c1e"/>
                  <circle cx="16" cy="12" r="1.5" fill="#1c1c1e"/>
                </svg>
              </div>
              <div>
                <h3 className="text-white font-bold text-base">Suporte Dragon</h3>
                <div className="flex items-center gap-1.5">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#bfff00] opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-[#bfff00]"></span>
                  </span>
                  <span className="text-xs text-[#bfff00] font-medium">Online agora</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setIsMinimized(true)}
                className="w-9 h-9 rounded-xl hover:bg-[#2a2a2e] flex items-center justify-center transition-colors"
                aria-label="Minimizar"
              >
                <Minus className="w-4 h-4 text-gray-400" />
              </button>
              <button
                onClick={() => {
                  setIsOpen(false)
                  setIsMinimized(false)
                  setShowCategories(true)
                  setSelectedCategory(null)
                  setMessages([])
                }}
                className="w-9 h-9 rounded-xl hover:bg-[#2a2a2e] flex items-center justify-center transition-colors"
                aria-label="Fechar"
              >
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>
          </div>
        </div>

        {/* Content Area */}
        {showCategories ? (
          /* Category Selection */
          <div className="flex-1 overflow-y-auto p-5 bg-[#141416]">
            <div className="mb-5">
              <h4 className="text-white font-semibold text-lg mb-1">Como podemos ajudar?</h4>
              <p className="text-gray-400 text-sm">Selecione a categoria da sua duvida para um atendimento mais rapido</p>
            </div>
            
            <div className="grid gap-3">
              {SUPPORT_CATEGORIES.map((category) => (
                <button
                  key={category.id}
                  onClick={() => handleCategorySelect(category)}
                  className="group relative w-full p-4 rounded-2xl bg-[#1c1c1e] border border-[#2a2a2e] hover:border-[#3a3a3e] transition-all duration-300 text-left overflow-hidden"
                >
                  {/* Hover gradient */}
                  <div className={cn(
                    "absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity bg-gradient-to-r",
                    category.color
                  )} />
                  
                  <div className="relative flex items-center gap-4">
                    <div className={cn(
                      "w-12 h-12 rounded-xl bg-gradient-to-br flex items-center justify-center text-white shrink-0",
                      category.color
                    )}>
                      {category.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h5 className="text-white font-semibold text-sm mb-0.5">{category.title}</h5>
                      <p className="text-gray-500 text-xs leading-relaxed">{category.description}</p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-600 group-hover:text-gray-400 group-hover:translate-x-1 transition-all shrink-0" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* Chat Messages */
          <>
            {/* Category badge */}
            {selectedCategory && (
              <div className="px-5 py-2 bg-[#1a1a1c] border-b border-[#2a2a2e]">
                <div className="flex items-center gap-2">
                  <div className={cn(
                    "w-6 h-6 rounded-lg bg-gradient-to-br flex items-center justify-center text-white",
                    selectedCategory.color
                  )}>
                    {selectedCategory.icon}
                  </div>
                  <span className="text-white text-sm font-medium">{selectedCategory.title}</span>
                </div>
              </div>
            )}
            
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-[#141416]">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    "flex gap-3",
                    message.role === "user" ? "justify-end" : "justify-start"
                  )}
                >
                  {message.role === "assistant" && (
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#bfff00] to-[#00ff88] flex items-center justify-center shrink-0">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-black">
                        <path d="M12 2C6.48 2 2 6.48 2 12C2 14.17 2.78 16.17 4.08 17.74L2.26 21.74C2.13 22.03 2.37 22.35 2.68 22.27L7.54 20.95C8.91 21.62 10.42 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2Z" fill="currentColor"/>
                      </svg>
                    </div>
                  )}
                  
                  <div className={cn(
                    "max-w-[75%] relative group",
                    message.role === "user" ? "order-1" : ""
                  )}>
                    <div
                      className={cn(
                        "px-4 py-3 rounded-2xl text-sm leading-relaxed",
                        message.role === "user"
                          ? "bg-gradient-to-r from-[#bfff00] to-[#a8e600] text-black rounded-br-md"
                          : "bg-[#1c1c1e] text-white border border-[#2a2a2e] rounded-bl-md"
                      )}
                    >
                      {message.content}
                    </div>
                    <span className={cn(
                      "text-[10px] text-gray-600 mt-1 block",
                      message.role === "user" ? "text-right" : "text-left"
                    )}>
                      {message.timestamp.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  
                  {message.role === "user" && (
                    <div className="w-8 h-8 rounded-xl bg-[#2a2a2e] flex items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-white">EU</span>
                    </div>
                  )}
                </div>
              ))}
              
              {isLoading && (
                <div className="flex gap-3 justify-start">
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#bfff00] to-[#00ff88] flex items-center justify-center shrink-0">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-black">
                      <path d="M12 2C6.48 2 2 6.48 2 12C2 14.17 2.78 16.17 4.08 17.74L2.26 21.74C2.13 22.03 2.37 22.35 2.68 22.27L7.54 20.95C8.91 21.62 10.42 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2Z" fill="currentColor"/>
                    </svg>
                  </div>
                  <div className="bg-[#1c1c1e] border border-[#2a2a2e] px-4 py-3 rounded-2xl rounded-bl-md">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-[#bfff00] animate-bounce" style={{ animationDelay: "0ms" }}></span>
                      <span className="w-2 h-2 rounded-full bg-[#bfff00] animate-bounce" style={{ animationDelay: "150ms" }}></span>
                      <span className="w-2 h-2 rounded-full bg-[#bfff00] animate-bounce" style={{ animationDelay: "300ms" }}></span>
                    </div>
                  </div>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-4 bg-[#1a1a1c] border-t border-[#2a2a2e]">
              <div className="flex items-center gap-3">
                <div className="flex-1 relative">
                  <input
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Digite sua mensagem..."
                    className="w-full h-12 px-4 bg-[#141416] border border-[#2a2a2e] rounded-xl text-white text-sm placeholder:text-gray-600 focus:outline-none focus:border-[#bfff00]/50 focus:ring-2 focus:ring-[#bfff00]/10 transition-all"
                  />
                </div>
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || isLoading}
                  className="w-12 h-12 rounded-xl bg-gradient-to-r from-[#bfff00] to-[#a8e600] hover:from-[#d4ff4d] hover:to-[#bfff00] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-all shadow-lg shadow-[#bfff00]/20 disabled:shadow-none"
                >
                  {isLoading ? (
                    <Loader2 className="w-5 h-5 text-black animate-spin" />
                  ) : (
                    <Send className="w-5 h-5 text-black" />
                  )}
                </button>
              </div>
              
              {/* Quick tip */}
              <p className="text-[10px] text-gray-600 text-center mt-2">
                Pressione Enter para enviar
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
