"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"

import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog"
import { NoBotSelected } from "@/components/no-bot-selected"
import { useBots } from "@/lib/bot-context"
import { useAuth } from "@/lib/auth-context"
import { ArrowRight, Edit3, ExternalLink, Copy, MoreHorizontal, Trash2, Loader2 } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { toast } from "sonner"

type PageType = "presell" | "conversion" | "dragonbio" | "checkout" | null
type PresellType = "age-verification" | "thank-you" | "redirect" | null



const pageTypes = [
  {
    id: "presell" as const,
    name: "Presell",
    description: "Paginas de pre-venda para aquecer o lead",
    gradient: "from-orange-500 to-amber-400",
    iconBg: "bg-orange-500/10",
    iconColor: "text-orange-500",
  },
  {
    id: "conversion" as const,
    name: "Privacy",
    description: "Pagina estilo perfil para conteudo exclusivo",
    gradient: "from-orange-400 to-orange-300",
    iconBg: "bg-orange-400/10",
    iconColor: "text-orange-400",
  },
  {
    id: "dragonbio" as const,
    name: "Dragon Bio",
    description: "Sua pagina de links na bio",
    gradient: "from-violet-500 to-purple-400",
    iconBg: "bg-violet-500/10",
    iconColor: "text-violet-500",
  },
  {
    id: "checkout" as const,
    name: "Checkout",
    description: "Pagina de checkout para vendas",
    gradient: "from-blue-500 to-cyan-400",
    iconBg: "bg-blue-500/10",
    iconColor: "text-blue-500",
  },
]

export type DragonBioSite = {
  id: string
  user_id: string
  nome: string
  slug: string
  template: string
  profile_name: string
  profile_bio: string
  profile_image: string | null
  colors: any
  published: boolean
  views: number
  created_at: string
  updated_at: string
  dragon_bio_links?: any[]
  page_type?: "presell" | "conversion" | "dragonbio" | "checkout"
}

// Funcao para determinar o tipo da pagina pelo slug ou page_type
function getPageTypeFromSite(site: DragonBioSite): "presell" | "conversion" | "dragonbio" | "checkout" {
  // Primeiro verifica se tem page_type definido
  if (site.page_type) return site.page_type
  
  // Fallback: determinar pelo slug
  if (site.slug.startsWith("presell-")) return "presell"
  if (site.slug.startsWith("conversion-")) return "conversion"
  if (site.slug.startsWith("checkout-")) return "checkout"
  return "dragonbio"
}

// Configuracao visual para cada tipo de pagina
function getPageTypeConfig(pageType: string) {
  switch (pageType) {
    case "presell":
      return {
        gradient: "from-orange-500 to-amber-400",
        icon: (
          <svg viewBox="0 0 24 24" className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="16" y1="13" x2="8" y2="13"/>
            <line x1="16" y1="17" x2="8" y2="17"/>
          </svg>
        )
      }
    case "conversion":
      return {
        gradient: "from-emerald-500 to-green-400",
        icon: (
          <svg viewBox="0 0 24 24" className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/>
            <circle cx="12" cy="12" r="6"/>
            <circle cx="12" cy="12" r="2"/>
          </svg>
        )
      }
    case "checkout":
      return {
        gradient: "from-blue-500 to-cyan-400",
        icon: (
          <svg viewBox="0 0 24 24" className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="9" cy="21" r="1"/>
            <circle cx="20" cy="21" r="1"/>
            <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
          </svg>
        )
      }
    default:
      return {
        gradient: "from-violet-500 to-purple-400",
        icon: (
          <svg viewBox="0 0 24 24" className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
          </svg>
        )
      }
  }
}

export default function BioLinkPage() {
  const { selectedBot } = useBots()
  const { session } = useAuth()
  const router = useRouter()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [presellDialogOpen, setPresellDialogOpen] = useState(false)
  const [checkoutDialogOpen, setCheckoutDialogOpen] = useState(false)
  const [sites, setSites] = useState<DragonBioSite[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)

  // Carregar sites do banco
  useEffect(() => {
    if (session?.userId) {
      fetchSites()
    }
  }, [session?.userId])
  
  const fetchSites = async () => {
    if (!session?.userId) return
    
    try {
      setLoading(true)
      const res = await fetch(`/api/dragon-bio?userId=${session.userId}`)
      const data = await res.json()
      
      if (data.sites) {
        setSites(data.sites)
      }
    } catch (error) {
      console.error("Erro ao carregar sites:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleSelectType = async (type: PageType) => {
    if (!session?.userId || !type) return
    
    // Se for presell, abre o dialog de selecao de tipo
    if (type === "presell") {
      setDialogOpen(false)
      setPresellDialogOpen(true)
      return
    }
    
    // Se for checkout, abre o dialog de selecao de tipo
    if (type === "checkout") {
      setDialogOpen(false)
      setCheckoutDialogOpen(true)
      return
    }
    
    setCreating(true)
    setDialogOpen(false)
    
    // Gerar nome e slug automaticos
    const timestamp = Date.now()
    const autoName = `${type === "dragonbio" ? "Dragon Bio" : "Privacy"} ${new Date().toLocaleDateString("pt-BR")}`
    const autoSlug = `${type}-${timestamp}`
    
    try {
      const res = await fetch("/api/dragon-bio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: session.userId,
          userEmail: session.email,
          userName: session.name,
          nome: autoName,
          slug: autoSlug,
          template: "buttons",
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error || "Erro ao criar site")
        setCreating(false)
        return
      }

      // Redirecionar diretamente para o editor apropriado
      if (type === "dragonbio") {
        router.push(`/biolink-editor/${data.site.id}`)
      } else if (type === "conversion") {
        router.push(`/conversion-editor/${data.site.id}`)
      }
    } catch (error) {
      console.error("Erro ao criar site:", error)
      toast.error("Erro ao criar site")
      setCreating(false)
    }
  }
  
  const handleSelectCheckoutType = async (checkoutType: "direto" | "normal") => {
    if (!session?.userId) return
    
    setCreating(true)
    setCheckoutDialogOpen(false)
    
    const timestamp = Date.now()
    const typeNames = {
      "direto": "Checkout Direto",
      "normal": "Checkout"
    }
    const autoName = `${typeNames[checkoutType]} ${new Date().toLocaleDateString("pt-BR")}`
    const autoSlug = `checkout-${checkoutType}-${timestamp}`
    
    try {
      const res = await fetch("/api/dragon-bio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: session.userId,
          userEmail: session.email,
          userName: session.name,
          nome: autoName,
          slug: autoSlug,
          template: "buttons",
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error || "Erro ao criar site")
        setCreating(false)
        return
      }

      // Redirecionar para o editor correto
      if (checkoutType === "direto") {
        router.push(`/checkout-direto-editor/${data.site.id}`)
      } else {
        router.push(`/checkout-editor/${data.site.id}`)
      }
    } catch (error) {
      console.error("Erro ao criar site:", error)
      toast.error("Erro ao criar site")
      setCreating(false)
    }
  }

  const handleSelectPresellType = async (presellType: PresellType) => {
    if (!session?.userId || !presellType) return
    
    setCreating(true)
    setPresellDialogOpen(false)
    
    const timestamp = Date.now()
    const typeNames: Record<string, string> = {
      "age-verification": "Verificacao de Idade",
      "thank-you": "Pagina de Obrigado",
      "redirect": "Redirecionamento"
    }
    const autoName = `${typeNames[presellType]} ${new Date().toLocaleDateString("pt-BR")}`
    const autoSlug = `presell-${presellType}-${timestamp}`
    
    try {
      const res = await fetch("/api/dragon-bio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: session.userId,
          userEmail: session.email,
          userName: session.name,
          nome: autoName,
          slug: autoSlug,
          template: "buttons",
          presell_type: presellType,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error || "Erro ao criar site")
        setCreating(false)
        return
      }

      // Redirecionar para o editor especifico do tipo de presell
      router.push(`/presell-editor/${data.site.id}?type=${presellType}`)
    } catch (error) {
      console.error("Erro ao criar site:", error)
      toast.error("Erro ao criar site")
      setCreating(false)
    }
  }

  const handleDialogChange = (open: boolean) => {
    setDialogOpen(open)
  }

  const handleEditPage = (site: DragonBioSite) => {
    const pageType = getPageTypeFromSite(site)
    if (pageType === "presell") {
      router.push(`/presell-editor/${site.id}`)
    } else if (pageType === "conversion") {
      router.push(`/conversion-editor/${site.id}`)
    } else if (pageType === "checkout") {
      // Detectar se e checkout direto ou normal pelo slug
      if (site.slug?.includes("checkout-direto")) {
        router.push(`/checkout-direto-editor/${site.id}`)
      } else {
        router.push(`/checkout-editor/${site.id}`)
      }
    } else {
      router.push(`/biolink-editor/${site.id}`)
    }
  }

  const handleCopyLink = (slug: string) => {
    const baseUrl = window.location.origin
    navigator.clipboard.writeText(`${baseUrl}/s/${slug}`)
    toast.success("Link copiado!")
  }

  const handleDeletePage = async (id: string) => {
    try {
      const res = await fetch(`/api/dragon-bio?siteId=${id}`, {
        method: "DELETE",
      })

      if (!res.ok) {
        toast.error("Erro ao excluir site")
        return
      }

      toast.success("Site excluido com sucesso!")
      setSites(sites.filter(s => s.id !== id))
    } catch (error) {
      console.error("Erro ao excluir site:", error)
      toast.error("Erro ao excluir site")
    }
  }

  if (!selectedBot) {
    return (
      <>
        
        <NoBotSelected />
      </>
    )
  }

  const dragonBioSites = sites
  const hasPages = dragonBioSites.length > 0
  const totalPages = dragonBioSites.length
  const totalVisitas = dragonBioSites.reduce((acc, s) => acc + (s.views || 0), 0)

  if (loading) {
    return (
      <>
        
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </>
    )
  }

  return (
    <>
      
      <ScrollArea className="flex-1">
        <div className="p-4 md:p-8 bg-[#f5f5f7] min-h-full">
          <div className="max-w-5xl mx-auto">
            
            {!hasPages ? (
              /* Estado Vazio - Layout Inovador */
              <div className="flex flex-col gap-8">
                
                {/* Hero Module - Card Principal Escuro */}
                <div className="bg-[#1c1c1e] rounded-[24px] p-8 md:p-10 relative overflow-hidden">
                  {/* Glows decorativos */}
                  <div className="absolute -top-20 -right-20 w-60 h-60 bg-[#bfff00] opacity-10 blur-[80px] rounded-full pointer-events-none"></div>
                  <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-[#bfff00] opacity-5 blur-[60px] rounded-full pointer-events-none"></div>
                  
                  <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                    {/* Texto e CTA */}
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-xl bg-[#bfff00]/20 flex items-center justify-center">
                          <svg viewBox="0 0 24 24" className="w-5 h-5 text-[#bfff00]" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                          </svg>
                        </div>
                        <span className="text-[#bfff00] text-xs font-bold uppercase tracking-wider">Dragon Sites</span>
                      </div>
                      
                      <h1 className="text-2xl md:text-3xl font-bold text-white mb-3">
                        Crie paginas de alta conversao
                      </h1>
                      <p className="text-gray-400 text-sm md:text-base max-w-md">
                        Construa presells, paginas de vendas, checkouts e links na bio em minutos. Tudo otimizado para converter.
                      </p>
                    </div>
                    
                    {/* Stats Preview - Mini Widgets */}
                    <div className="flex gap-3">
                      <div className="bg-[#2a2a2e] rounded-2xl p-4 border border-[#3a3a3e] min-w-[100px]">
                        <div className="text-2xl font-bold text-white mb-1">0</div>
                        <div className="text-[10px] text-gray-400 uppercase tracking-wide">Paginas</div>
                      </div>
                      <div className="bg-[#2a2a2e] rounded-2xl p-4 border border-[#3a3a3e] min-w-[100px]">
                        <div className="text-2xl font-bold text-white mb-1">0</div>
                        <div className="text-[10px] text-gray-400 uppercase tracking-wide">Visitas</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Section Title */}
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-foreground">Escolha um tipo de pagina</h2>
                    <p className="text-sm text-muted-foreground">Selecione o modelo ideal para seu objetivo</p>
                  </div>
                </div>

                {/* Grid de Tipos - Cards Horizontais */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {pageTypes.map((type) => (
                    <button 
                      key={type.id}
                      onClick={() => handleSelectType(type.id)}
                      disabled={creating}
                      className="group bg-[#1c1c1e] rounded-[20px] p-5 border border-[#3a3a3e] hover:border-[#bfff00]/50 hover:shadow-lg transition-all duration-300 text-left flex items-center gap-4 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {/* Icon com gradiente */}
                      <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${type.gradient} flex items-center justify-center flex-shrink-0 shadow-lg group-hover:scale-105 transition-transform`}>
                        {type.id === "presell" && (
                          <svg viewBox="0 0 24 24" className="w-6 h-6 text-white" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
                            <polyline points="14 2 14 8 20 8"/>
                            <line x1="16" y1="13" x2="8" y2="13"/>
                            <line x1="16" y1="17" x2="8" y2="17"/>
                          </svg>
                        )}
                        {type.id === "conversion" && (
                          <svg viewBox="0 0 24 24" className="w-6 h-6 text-white" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="10"/>
                            <circle cx="12" cy="12" r="6"/>
                            <circle cx="12" cy="12" r="2"/>
                          </svg>
                        )}
                        {type.id === "dragonbio" && (
                          <svg viewBox="0 0 24 24" className="w-6 h-6 text-white" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                          </svg>
                        )}
                        {type.id === "checkout" && (
                          <svg viewBox="0 0 24 24" className="w-6 h-6 text-white" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="9" cy="21" r="1"/>
                            <circle cx="20" cy="21" r="1"/>
                            <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
                          </svg>
                        )}
                      </div>
                      
                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-white mb-1 group-hover:text-[#bfff00] transition-colors">
                          {type.name}
                        </h3>
                        <p className="text-sm text-gray-400 line-clamp-1">
                          {type.description}
                        </p>
                      </div>
                      
                      {/* Arrow or Loading */}
                      <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center group-hover:bg-[#bfff00] transition-colors flex-shrink-0">
                        {creating ? (
                          <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                        ) : (
                          <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-[#1c1c1e] transition-colors" />
                        )}
                      </div>
                    </button>
                  ))}
                </div>

                {/* Tip Module - Footer */}
                <div className="rounded-[20px] bg-[#1c1c1e] p-5">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-[#bfff00]/20 flex items-center justify-center flex-shrink-0">
                      <svg viewBox="0 0 24 24" className="w-4 h-4 text-[#bfff00]" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10"/>
                        <path d="M12 16v-4M12 8h.01"/>
                      </svg>
                    </div>
                    <p className="text-sm text-gray-400">
                      <span className="text-white font-medium">Dica:</span> Comece com uma pagina de Presell para aquecer seus leads antes de enviar para a oferta principal.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              /* Estado Com Paginas */
              <div className="flex flex-col gap-6">
                
                {/* Hero Stats Module */}
                <div className="bg-[#1c1c1e] rounded-[24px] p-6 md:p-8 relative overflow-hidden">
                  <div className="absolute -top-20 -right-20 w-60 h-60 bg-[#bfff00] opacity-10 blur-[80px] rounded-full pointer-events-none"></div>
                  
                  <div className="relative z-10">
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-[#bfff00]/20 flex items-center justify-center">
                          <svg viewBox="0 0 24 24" className="w-5 h-5 text-[#bfff00]" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                          </svg>
                        </div>
                        <div>
                          <h2 className="text-white font-semibold">Seus Dragon Sites</h2>
                          <p className="text-gray-400 text-xs">Performance geral das suas paginas</p>
                        </div>
                      </div>
                      
                      <Dialog open={dialogOpen} onOpenChange={handleDialogChange}>
                        <DialogTrigger asChild>
                          <Button className="bg-[#bfff00] text-[#1c1c1e] hover:bg-[#d4ff4d] rounded-xl h-10 px-5 font-bold" disabled={creating}>
                            {creating ? (
                              <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Criando...
                              </>
                            ) : (
                              "Criar Site"
                            )}
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="bg-[#1c1c1e] border-0 sm:max-w-lg rounded-[24px] p-0 overflow-hidden">
                          <div className="p-5 pb-4 border-b border-white/10">
                            <DialogHeader>
                              <DialogTitle className="text-white text-center text-lg font-bold">
                                Escolha o tipo de pagina
                              </DialogTitle>
                              <p className="text-sm text-gray-400 text-center">
                                Selecione o modelo ideal para seu objetivo
                              </p>
                            </DialogHeader>
                          </div>
                          <div className="p-5">
                            <div className="grid grid-cols-2 gap-3">
                              {pageTypes.map((type) => (
                                <button
                                  key={type.id}
                                  onClick={() => handleSelectType(type.id)}
                                  disabled={creating}
                                  className="group flex flex-col items-center gap-3 p-5 rounded-2xl border border-[#3a3a3e] bg-[#2a2a2e] hover:border-[#bfff00]/50 hover:shadow-md transition-all text-center disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${type.gradient} flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform`}>
                                    {type.id === "presell" && (
                                      <svg viewBox="0 0 24 24" className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
                                      </svg>
                                    )}
                                    {type.id === "conversion" && (
                                      <svg viewBox="0 0 24 24" className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth="2">
                                        <circle cx="12" cy="12" r="10"/>
                                        <circle cx="12" cy="12" r="2"/>
                                      </svg>
                                    )}
                                    {type.id === "dragonbio" && (
                                      <svg viewBox="0 0 24 24" className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                                      </svg>
                                    )}
                                    {type.id === "checkout" && (
                                      <svg viewBox="0 0 24 24" className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth="2">
                                        <circle cx="9" cy="21" r="1"/>
                                        <circle cx="20" cy="21" r="1"/>
                                        <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
                                      </svg>
                                    )}
                                  </div>
                                  <div>
                                    <h3 className="text-sm font-semibold text-white mb-0.5">
                                      {type.name}
                                    </h3>
                                    <p className="text-xs text-gray-400 line-clamp-2">
                                      {type.description}
                                    </p>
                                  </div>
                                </button>
                              ))}
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </div>
                    
                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-[#2a2a2e] rounded-2xl p-4 border border-[#3a3a3e]">
                        <div className="flex items-center gap-2 text-gray-400 text-xs mb-2">
                          <div className="w-2 h-2 rounded-full bg-[#bfff00]"></div>
                          Paginas Ativas
                        </div>
                        <div className="text-2xl font-bold text-white">{totalPages}</div>
                      </div>
                      <div className="bg-[#2a2a2e] rounded-2xl p-4 border border-[#3a3a3e]">
                        <div className="flex items-center gap-2 text-gray-400 text-xs mb-2">
                          <div className="w-2 h-2 rounded-full bg-[#bfff00]"></div>
                          Visitas Totais
                        </div>
                        <div className="text-2xl font-bold text-white">{totalVisitas.toLocaleString('pt-BR')}</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Pages List */}
                <div className="bg-[#1c1c1e] rounded-[24px] border border-[#3a3a3e]">
                  <div className="p-5 border-b border-[#3a3a3e]">
                    <h3 className="font-semibold text-white">Suas Paginas</h3>
                  </div>
                  <div className="divide-y divide-[#3a3a3e]">
                    {dragonBioSites.map((site) => {
                      const pageType = getPageTypeFromSite(site)
                      const typeConfig = getPageTypeConfig(pageType)
                      return (
                        <div key={site.id} className="p-5 flex items-center justify-between hover:bg-[#2a2a2e] transition-colors">
                          <div className="flex items-center gap-4">
                            <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${typeConfig.gradient} flex items-center justify-center shadow-sm`}>
                              {typeConfig.icon}
                            </div>
                            <div>
                              <div className="flex items-center gap-2 mb-0.5">
                                <h4 className="font-medium text-white">{site.nome}</h4>
                                <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${site.published ? 'bg-[#bfff00]/20 text-[#bfff00]' : 'bg-white/10 text-gray-400'}`}>
                                  {site.published ? 'Publicado' : 'Rascunho'}
                                </span>
                              </div>
                              <p className="text-xs text-gray-400">/s/{site.slug} • {site.views || 0} visitas</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditPage(site)}
                              className="h-9 px-3 rounded-lg bg-white/10 text-white hover:bg-[#bfff00] hover:text-[#1c1c1e]"
                            >
                              <Edit3 className="w-4 h-4 mr-2" />
                              Editar
                            </Button>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-9 w-9 rounded-lg bg-white/10 text-gray-400 hover:bg-white/20 hover:text-white"
                                >
                                  <MoreHorizontal className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-48">
                                <DropdownMenuItem onClick={() => handleCopyLink(site.slug)}>
                                  <Copy className="w-4 h-4 mr-2" />
                                  Copiar Link
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => window.open(`/s/${site.slug}`, '_blank')}>
                                  <ExternalLink className="w-4 h-4 mr-2" />
                                  Abrir Pagina
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  onClick={() => handleDeletePage(site.id)}
                                  className="text-red-600 focus:text-red-600"
                                >
                                  <Trash2 className="w-4 h-4 mr-2" />
                                  Excluir
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </ScrollArea>

      {/* Dialog de Selecao de Tipo de Presell */}
      <Dialog open={presellDialogOpen} onOpenChange={setPresellDialogOpen}>
        <DialogContent className="bg-[#1c1c1e] border-0 sm:max-w-lg rounded-[24px] p-0 overflow-hidden">
          <div className="p-5 pb-4 border-b border-white/10">
            <DialogHeader>
              <DialogTitle className="text-white text-center text-lg font-bold">
                Escolha o tipo de Presell
              </DialogTitle>
              <p className="text-sm text-gray-400 text-center">
                Selecione o modelo de pagina que deseja criar
              </p>
            </DialogHeader>
          </div>
          
          <div className="p-5 flex flex-col gap-3">
            {/* Verificacao de Idade (+18) */}
            <button 
              onClick={() => handleSelectPresellType("age-verification")}
              disabled={creating}
              className="group bg-[#2a2a2e] rounded-[16px] p-4 border border-[#3a3a3e] hover:border-[#bfff00]/50 hover:shadow-lg transition-all duration-300 text-left flex items-center gap-4 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center flex-shrink-0 shadow-lg group-hover:scale-105 transition-transform">
                <svg viewBox="0 0 24 24" className="w-6 h-6 text-white" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-white mb-0.5 group-hover:text-[#bfff00] transition-colors">
                  Verificacao de Idade
                </h3>
                <p className="text-xs text-gray-400">
                  Pagina +18 com botoes de confirmacao
                </p>
              </div>
              <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-[#bfff00] transition-colors" />
            </button>

            {/* Pagina de Obrigado */}
            <button 
              onClick={() => handleSelectPresellType("thank-you")}
              disabled={creating}
              className="group bg-[#2a2a2e] rounded-[16px] p-4 border border-[#3a3a3e] hover:border-[#bfff00]/50 hover:shadow-lg transition-all duration-300 text-left flex items-center gap-4 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center flex-shrink-0 shadow-lg group-hover:scale-105 transition-transform">
                <svg viewBox="0 0 24 24" className="w-6 h-6 text-white" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M5 13l4 4L19 7"/>
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-white mb-0.5 group-hover:text-[#bfff00] transition-colors">
                  Pagina de Obrigado
                </h3>
                <p className="text-xs text-gray-400">
                  Thank you page com mensagem de sucesso
                </p>
              </div>
              <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-[#bfff00] transition-colors" />
            </button>

            {/* Redirecionamento */}
            <button 
              onClick={() => handleSelectPresellType("redirect")}
              disabled={creating}
              className="group bg-[#2a2a2e] rounded-[16px] p-4 border border-[#3a3a3e] hover:border-[#bfff00]/50 hover:shadow-lg transition-all duration-300 text-left flex items-center gap-4 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center flex-shrink-0 shadow-lg group-hover:scale-105 transition-transform">
                <svg viewBox="0 0 24 24" className="w-6 h-6 text-white" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                  <polyline points="15 3 21 3 21 9"/>
                  <line x1="10" y1="14" x2="21" y2="3"/>
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-white mb-0.5 group-hover:text-[#bfff00] transition-colors">
                  Redirecionamento
                </h3>
                <p className="text-xs text-gray-400">
                  Pagina com redirect automatico
                </p>
              </div>
              <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-[#bfff00] transition-colors" />
            </button>
          </div>

          {creating && (
            <div className="flex items-center justify-center gap-2 pb-5 text-gray-400">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">Criando pagina...</span>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog de Selecao de Tipo de Checkout */}
      <Dialog open={checkoutDialogOpen} onOpenChange={setCheckoutDialogOpen}>
        <DialogContent className="bg-[#1c1c1e] border-0 sm:max-w-lg rounded-[24px] p-0 overflow-hidden">
          <div className="p-5 pb-4 border-b border-white/10">
            <DialogHeader>
              <DialogTitle className="text-white text-center text-lg font-bold">
                Escolha o tipo de Checkout
              </DialogTitle>
              <p className="text-sm text-gray-400 text-center">
                Selecione o modelo de pagamento que deseja criar
              </p>
            </DialogHeader>
          </div>
          
          <div className="p-5 flex flex-col gap-3">
            {/* Checkout Direto */}
            <button 
              onClick={() => handleSelectCheckoutType("direto")}
              disabled={creating}
              className="group bg-[#2a2a2e] rounded-[16px] p-4 border border-[#3a3a3e] hover:border-[#bfff00]/50 hover:shadow-lg transition-all duration-300 text-left flex items-center gap-4 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-green-500 flex items-center justify-center flex-shrink-0 shadow-lg group-hover:scale-105 transition-transform">
                <svg viewBox="0 0 24 24" className="w-6 h-6 text-white" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="2"/>
                  <path d="M7 7h10v10H7z"/>
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-white mb-0.5 group-hover:text-[#bfff00] transition-colors">
                  Checkout Direto
                </h3>
                <p className="text-xs text-gray-400">
                  QR Code PIX direto, sem formulario
                </p>
              </div>
              <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-[#bfff00] transition-colors" />
            </button>

            {/* Checkout Normal */}
            <button 
              onClick={() => handleSelectCheckoutType("normal")}
              disabled={creating}
              className="group bg-[#2a2a2e] rounded-[16px] p-4 border border-[#3a3a3e] hover:border-[#bfff00]/50 hover:shadow-lg transition-all duration-300 text-left flex items-center gap-4 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center flex-shrink-0 shadow-lg group-hover:scale-105 transition-transform">
                <svg viewBox="0 0 24 24" className="w-6 h-6 text-white" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="4" width="18" height="18" rx="2"/>
                  <line x1="3" y1="10" x2="21" y2="10"/>
                  <line x1="8" y1="15" x2="8" y2="15.01"/>
                  <line x1="12" y1="15" x2="16" y2="15"/>
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-white mb-0.5 group-hover:text-[#bfff00] transition-colors">
                  Checkout com Formulario
                </h3>
                <p className="text-xs text-gray-400">
                  Coleta dados (email, nome, CPF) antes do PIX
                </p>
              </div>
              <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-[#bfff00] transition-colors" />
            </button>
          </div>

          {creating && (
            <div className="flex items-center justify-center gap-2 pb-5 text-gray-400">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">Criando pagina...</span>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
