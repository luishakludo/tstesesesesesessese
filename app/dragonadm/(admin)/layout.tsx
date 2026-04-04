"use client"

import { useEffect, useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { cn } from "@/lib/utils"
import {
  Users,
  Bot,
  CreditCard,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  X,
  DollarSign,
  MessageSquare,
  FileText,
  TrendingUp,
  Sparkles,
  Tag,
  Trophy,
  Banknote,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"

interface AdminSession {
  email: string
  loggedAt: string
  expiresAt: string
}

const menuSections = [
  {
    title: "Principal",
    items: [
      { icon: BarChart3, label: "Dashboard", href: "/dragonadm" },
      { icon: TrendingUp, label: "Analytics", href: "/dragonadm/analytics" },
    ]
  },
  {
    title: "Usuarios",
    items: [
      { icon: Users, label: "Usuarios", href: "/dragonadm/users" },
      { icon: Bot, label: "Bots", href: "/dragonadm/bots" },
    ]
  },
  {
    title: "Financeiro",
    items: [
      { icon: CreditCard, label: "Pagamentos", href: "/dragonadm/payments" },
      { icon: Banknote, label: "Saques", href: "/dragonadm/saques" },
      { icon: DollarSign, label: "Saques Afiliados", href: "/dragonadm/saques-afiliados" },
      { icon: Tag, label: "Cupons", href: "/dragonadm/cupons" },
      { icon: Trophy, label: "Premiacoes", href: "/dragonadm/premiacoes" },
    ]
  },
  {
    title: "Sistema",
    items: [
      { icon: MessageSquare, label: "Suporte", href: "/dragonadm/suporte" },
      { icon: FileText, label: "Termos", href: "/dragonadm/termos" },
      { icon: Settings, label: "Configuracoes", href: "/dragonadm/settings" },
    ]
  },
]

export default function DragonAdmLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [session, setSession] = useState<AdminSession | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    const storedSession = localStorage.getItem("dragon_adm_session")
    
    if (!storedSession) {
      router.push("/dragonadm/login")
      return
    }

    try {
      const parsed = JSON.parse(storedSession) as AdminSession
      const expiresAt = new Date(parsed.expiresAt)
      
      if (expiresAt < new Date()) {
        localStorage.removeItem("dragon_adm_session")
        router.push("/dragonadm/login")
        return
      }

      setSession(parsed)
    } catch {
      localStorage.removeItem("dragon_adm_session")
      router.push("/dragonadm/login")
      return
    }

    setIsLoading(false)
  }, [router])

  const handleLogout = () => {
    localStorage.removeItem("dragon_adm_session")
    router.push("/dragonadm/login")
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <div className="relative">
          <div className="animate-spin h-10 w-10 border-2 border-emerald-500/20 border-t-emerald-500 rounded-full" />
          <div className="absolute inset-0 blur-xl bg-emerald-500/20 rounded-full" />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#050505] flex admin-theme">
      {/* Gradient overlay for depth */}
      <div className="fixed inset-0 admin-gradient-overlay pointer-events-none" />
      
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-[280px] bg-[#0a0a0a] border-r border-white/[0.06] transform transition-transform duration-300 lg:translate-x-0 lg:static flex flex-col",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Logo Section */}
        <div className="h-20 flex items-center justify-between px-6 border-b border-white/[0.06]">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Image
                src="/images/logo-dragon.png"
                alt="Dragon"
                width={140}
                height={40}
                className="h-9 w-auto"
              />
              <div className="absolute -inset-2 bg-emerald-500/10 blur-xl rounded-full -z-10" />
            </div>
            <span className="text-[10px] font-bold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full uppercase tracking-wider">
              Admin
            </span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden text-white/60 hover:text-white hover:bg-white/5"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Menu */}
        <ScrollArea className="flex-1 py-6">
          <nav className="px-4 space-y-8">
            {menuSections.map((section) => (
              <div key={section.title}>
                <div className="flex items-center gap-2 px-3 mb-3">
                  <span className="text-[10px] font-semibold text-white/30 uppercase tracking-[0.2em]">
                    {section.title}
                  </span>
                  <div className="flex-1 h-px bg-gradient-to-r from-white/[0.06] to-transparent" />
                </div>
                <div className="space-y-1">
                  {section.items.map((item) => {
                    const isActive = pathname === item.href || 
                      (item.href !== "/dragonadm" && pathname.startsWith(item.href))
                    
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setSidebarOpen(false)}
                        className={cn(
                          "group relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-300",
                          isActive
                            ? "text-white"
                            : "text-white/50 hover:text-white/90"
                        )}
                      >
                        {/* Active background glow */}
                        {isActive && (
                          <>
                            <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-emerald-500/20 via-emerald-500/10 to-transparent" />
                            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 rounded-r-full bg-emerald-500 shadow-[0_0_12px_2px_rgba(16,185,129,0.6)]" />
                          </>
                        )}
                        
                        {/* Icon with glow on active */}
                        <div className={cn(
                          "relative z-10 flex items-center justify-center w-9 h-9 rounded-lg transition-all duration-300",
                          isActive 
                            ? "bg-emerald-500/20 text-emerald-400" 
                            : "bg-white/[0.03] text-white/40 group-hover:bg-white/[0.06] group-hover:text-white/70"
                        )}>
                          <item.icon className="h-[18px] w-[18px]" />
                          {isActive && (
                            <div className="absolute inset-0 rounded-lg bg-emerald-500/20 blur-md -z-10" />
                          )}
                        </div>
                        
                        <span className="relative z-10">{item.label}</span>
                        
                        {/* Hover sparkle indicator */}
                        {!isActive && (
                          <Sparkles className="absolute right-3 h-3.5 w-3.5 text-emerald-500/50 opacity-0 group-hover:opacity-100 transition-opacity" />
                        )}
                      </Link>
                    )
                  })}
                </div>
              </div>
            ))}
          </nav>
        </ScrollArea>

        {/* User & Logout */}
        <div className="p-4 border-t border-white/[0.06]">
          <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.04]">
            <div className="flex items-center gap-3 mb-4">
              <div className="relative">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                  <span className="text-sm font-bold text-white">
                    {session?.email?.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-[#0a0a0a]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white truncate">
                  {session?.email?.split("@")[0]}
                </p>
                <p className="text-xs text-white/40">Administrador</p>
              </div>
            </div>
            <Button
              variant="ghost"
              className="w-full justify-start text-white/50 hover:text-red-400 hover:bg-red-500/10 rounded-xl h-10 transition-all duration-300"
              onClick={handleLogout}
            >
              <LogOut className="h-4 w-4 mr-2" />
              Sair da conta
            </Button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <header className="h-16 flex items-center justify-between px-4 lg:px-8 border-b border-white/[0.06] bg-[#050505]/80 backdrop-blur-xl sticky top-0 z-30">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden text-white/60 hover:text-white hover:bg-white/5"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>

          <div className="flex items-center gap-4 ml-auto">
            <div className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.03] border border-white/[0.06]">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs text-white/50">
                Logado como <span className="text-white font-medium">{session?.email?.split("@")[0]}</span>
              </span>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
