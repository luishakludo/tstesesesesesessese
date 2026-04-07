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
  Zap,
  Home,
} from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"

interface AdminSession {
  email: string
  loggedAt: string
  expiresAt: string
}

const menuSections = [
  {
    title: "Usuarios",
    items: [
      { icon: Users, label: "Usuarios", href: "/dragonadm/users" },
      { icon: Bot, label: "Bots", href: "/dragonadm/bots" },
    ]
  },
  {
    title: "Principal",
    items: [
      { icon: BarChart3, label: "Dashboard", href: "/dragonadm" },
      { icon: TrendingUp, label: "Analytics", href: "/dragonadm/analytics" },
    ]
  },
  {
    title: "Financeiro",
    items: [
      { icon: CreditCard, label: "Pagamentos", href: "/dragonadm/payments" },
      { icon: DollarSign, label: "Saques Afiliados", href: "/dragonadm/saques-afiliados" },
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
      <div className="min-h-screen admin-theme flex items-center justify-center" style={{ background: '#050505' }}>
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-12 h-12 rounded-xl bg-[#95e468]/10 flex items-center justify-center">
              <Zap className="w-6 h-6 text-[#95e468] animate-pulse" />
            </div>
            <div className="absolute inset-0 rounded-xl bg-[#95e468]/20 blur-xl animate-pulse" />
          </div>
          <p className="text-sm text-[#666666]">Carregando...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen admin-theme flex" style={{ background: '#050505' }}>
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
          "fixed inset-y-0 left-0 z-50 w-72 transform transition-all duration-300 lg:translate-x-0 lg:static",
          "admin-sidebar",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
        style={{ 
          background: 'linear-gradient(180deg, #0a0a0a 0%, #050505 100%)',
          borderRight: '1px solid rgba(255,255,255,0.06)'
        }}
      >
        <div className="flex flex-col h-full">
          {/* Logo Header */}
          <div className="h-20 flex items-center justify-between px-6" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#95e468]/20 to-[#8b5cf6]/10 flex items-center justify-center border border-[#95e468]/20">
                  <Sparkles className="w-5 h-5 text-[#95e468]" />
                </div>
                <div className="absolute -inset-1 rounded-xl bg-[#95e468]/10 blur-lg -z-10" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-white tracking-tight">Dragon</h1>
                <p className="text-[10px] text-[#666666] uppercase tracking-widest">Admin Panel</p>
              </div>
            </div>
            <button
              className="lg:hidden p-2 rounded-lg hover:bg-white/5 text-[#666666] hover:text-white transition-colors"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Menu Navigation */}
          <ScrollArea className="flex-1 py-6">
            <nav className="px-4 space-y-6">
              {menuSections.map((section) => (
                <div key={section.title}>
                  <p className="px-3 mb-3 text-[10px] font-semibold text-[#444444] uppercase tracking-[0.2em]">
                    {section.title}
                  </p>
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
                            "group flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 relative",
                            isActive
                              ? "text-[#050505]"
                              : "text-[#a1a1a1] hover:text-white hover:bg-white/[0.03]"
                          )}
                          style={isActive ? {
                            background: 'linear-gradient(135deg, #95e468 0%, #7bc752 100%)',
                            boxShadow: '0 0 20px rgba(149, 228, 104, 0.3), inset 0 1px 0 rgba(255,255,255,0.2)'
                          } : {}}
                        >
                          {isActive && (
                            <div 
                              className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 w-1 h-8 rounded-r-full"
                              style={{ background: '#95e468', boxShadow: '0 0 10px #95e468' }}
                            />
                          )}
                          <item.icon className={cn(
                            "h-[18px] w-[18px] transition-transform duration-200",
                            !isActive && "group-hover:scale-110"
                          )} />
                          <span>{item.label}</span>
                          {isActive && (
                            <div className="ml-auto w-1.5 h-1.5 rounded-full bg-[#050505]/30" />
                          )}
                        </Link>
                      )
                    })}
                  </div>
                </div>
              ))}
            </nav>
          </ScrollArea>

          {/* User Profile & Logout */}
          <div className="p-4" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            {/* User Info */}
            <div className="flex items-center gap-3 p-3 rounded-xl mb-3" style={{ background: 'rgba(255,255,255,0.02)' }}>
              <div 
                className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold"
                style={{ 
                  background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.2), rgba(149, 228, 104, 0.1))',
                  border: '1px solid rgba(255,255,255,0.06)'
                }}
              >
                <span className="text-white">
                  {session?.email?.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">
                  {session?.email}
                </p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#22c55e] admin-pulse" />
                  <p className="text-[11px] text-[#666666]">Administrador</p>
                </div>
              </div>
            </div>

            {/* Logout Button */}
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 text-[#a1a1a1] hover:text-[#ef4444]"
              style={{ 
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.06)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'
                e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.2)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.02)'
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'
              }}
            >
              <LogOut className="h-4 w-4" />
              <span>Sair da Conta</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header Bar */}
        <header 
          className="h-20 flex items-center justify-between px-6 lg:px-8 sticky top-0 z-30"
          style={{ 
            background: 'rgba(5, 5, 5, 0.8)',
            backdropFilter: 'blur(12px)',
            borderBottom: '1px solid rgba(255,255,255,0.06)'
          }}
        >
          {/* Mobile Menu Button */}
          <button
            className="lg:hidden p-2.5 rounded-xl text-[#a1a1a1] hover:text-white transition-colors"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </button>

          {/* Right Side */}
          <div className="flex items-center gap-4 ml-auto">
            {/* Voltar ao Dashboard Button */}
            <Link
              href="/"
              className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-full text-white transition-all duration-200 hover:scale-105"
              style={{ 
                background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.2), rgba(149, 228, 104, 0.2))',
                border: '1px solid rgba(149, 228, 104, 0.3)'
              }}
            >
              <Home className="w-4 h-4 text-[#95e468]" />
              <span className="text-xs font-medium">Voltar ao Dashboard</span>
            </Link>

            {/* Status Indicator */}
            <div 
              className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-full"
              style={{ background: 'rgba(34, 197, 94, 0.1)', border: '1px solid rgba(34, 197, 94, 0.2)' }}
            >
              <div className="w-2 h-2 rounded-full bg-[#22c55e] admin-pulse" />
              <span className="text-xs text-[#22c55e] font-medium">Sistema Online</span>
            </div>

            {/* User Badge */}
            <div 
              className="flex items-center gap-3 px-4 py-2 rounded-xl"
              style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}
            >
              <div 
                className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold"
                style={{ 
                  background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.2), rgba(149, 228, 104, 0.1))',
                }}
              >
                <span className="text-white">{session?.email?.charAt(0).toUpperCase()}</span>
              </div>
              <div className="hidden sm:block">
                <p className="text-sm font-medium text-white">{session?.email?.split('@')[0]}</p>
                <p className="text-[10px] text-[#666666]">Admin</p>
              </div>
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
