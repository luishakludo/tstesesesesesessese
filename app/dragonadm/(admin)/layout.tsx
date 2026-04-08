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
          <div className="h-16 flex items-center justify-between px-6" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#95e468] flex items-center justify-center">
                <Zap className="w-4 h-4 text-black" />
              </div>
              <span className="text-base font-bold text-white">Dragon Admin</span>
            </div>
            <button
              className="lg:hidden p-2 rounded-lg hover:bg-white/5 text-[#666666] hover:text-white transition-colors"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Menu Navigation */}
          <ScrollArea className="flex-1 py-4">
            <nav className="px-3 space-y-6">
              {menuSections.map((section) => (
                <div key={section.title}>
                  <p className="px-3 mb-2 text-[10px] font-medium text-[#555] uppercase tracking-wider">
                    {section.title}
                  </p>
                  <div className="space-y-0.5">
                    {section.items.map((item) => {
                      const isActive = pathname === item.href || 
                        (item.href !== "/dragonadm" && pathname.startsWith(item.href))
                      
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setSidebarOpen(false)}
                          className={cn(
                            "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                            isActive
                              ? "bg-[#95e468] text-black"
                              : "text-[#888] hover:text-white hover:bg-white/5"
                          )}
                        >
                          <item.icon className="h-4 w-4" />
                          <span>{item.label}</span>
                        </Link>
                      )
                    })}
                  </div>
                </div>
              ))}
            </nav>
          </ScrollArea>

          {/* Logout */}
          <div className="p-3" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium text-[#888] hover:text-red-500 hover:bg-red-500/10 transition-all"
            >
              <LogOut className="h-4 w-4" />
              <span>Sair</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header Bar */}
        <header 
          className="h-14 flex items-center justify-between px-4 lg:px-6 sticky top-0 z-30 bg-[#0a0a0a]/90 backdrop-blur-sm"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}
        >
          {/* Mobile Menu Button */}
          <button
            className="lg:hidden p-2 rounded-lg text-[#888] hover:text-white hover:bg-white/5 transition-colors"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </button>

          {/* Right Side */}
          <div className="flex items-center gap-3 ml-auto">
            <Link
              href="/"
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-[#888] hover:text-white hover:bg-white/5 transition-all"
            >
              <Home className="w-4 h-4" />
              <span className="hidden sm:inline">Dashboard</span>
            </Link>

            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#95e468]/10">
              <div className="w-2 h-2 rounded-full bg-[#95e468]" />
              <span className="text-xs text-[#95e468] font-medium">Online</span>
            </div>

            <div className="w-8 h-8 rounded-lg bg-[#95e468] flex items-center justify-center text-xs font-bold text-black">
              {session?.email?.charAt(0).toUpperCase()}
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
