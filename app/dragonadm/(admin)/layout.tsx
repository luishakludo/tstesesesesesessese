"use client"

import { useEffect, useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import Link from "next/link"
import { cn } from "@/lib/utils"
import {
  Shield,
  Users,
  Bot,
  CreditCard,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  X,
  ChevronRight,
  DollarSign,
  MessageSquare,
  FileText,
  TrendingUp,
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
    // Verificar sessao do admin
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
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-white border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex admin-theme">
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/70 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 bg-zinc-900 border-r border-zinc-800 transform transition-transform duration-200 lg:translate-x-0 lg:static",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="h-16 flex items-center justify-between px-4 border-b border-zinc-800">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
                <Shield className="h-5 w-5 text-white" />
              </div>
              <span className="font-bold text-white">Dragon ADM</span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Menu */}
          <ScrollArea className="flex-1 py-2">
            <nav className="px-3 space-y-4">
              {menuSections.map((section) => (
                <div key={section.title}>
                  <p className="px-3 mb-1 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
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
                            "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                            isActive
                              ? "bg-white text-zinc-900"
                              : "text-zinc-400 hover:text-white hover:bg-zinc-800"
                          )}
                        >
                          <item.icon className="h-4 w-4" />
                          {item.label}
                          {isActive && (
                            <ChevronRight className="h-4 w-4 ml-auto" />
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
          <div className="p-4 border-t border-zinc-800">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center">
                <span className="text-sm font-bold text-white">
                  {session?.email?.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">
                  {session?.email}
                </p>
                <p className="text-xs text-zinc-500">Administrador</p>
              </div>
            </div>
            <Button
              variant="outline"
              className="w-full justify-start text-zinc-400 border-zinc-700 hover:text-red-400 hover:border-red-500/50 hover:bg-red-500/10"
              onClick={handleLogout}
            >
              <LogOut className="h-4 w-4 mr-2" />
              Sair
            </Button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <header className="h-16 flex items-center justify-between px-4 border-b border-zinc-800 bg-zinc-900 lg:px-6">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden text-white hover:bg-zinc-800"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>

          <div className="flex items-center gap-2 ml-auto">
            <span className="text-xs text-zinc-500 hidden sm:block">
              Logado como <span className="text-white font-medium">{session?.email}</span>
            </span>
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
