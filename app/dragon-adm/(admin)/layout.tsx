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
  Gift,
  Ticket,
  LayoutTemplate,
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
      { icon: BarChart3, label: "Dashboard", href: "/dragon-adm" },
      { icon: TrendingUp, label: "Analytics", href: "/dragon-adm/analytics" },
    ]
  },
  {
    title: "Usuarios",
    items: [
      { icon: Users, label: "Usuarios", href: "/dragon-adm/users" },
      { icon: Bot, label: "Bots", href: "/dragon-adm/bots" },
    ]
  },
  {
    title: "Financeiro",
    items: [
      { icon: CreditCard, label: "Pagamentos", href: "/dragon-adm/payments" },
      { icon: DollarSign, label: "Saques", href: "/dragon-adm/saques" },
      { icon: DollarSign, label: "Saques Afiliados", href: "/dragon-adm/saques-afiliados" },
      { icon: Gift, label: "Premiacoes", href: "/dragon-adm/premiacoes" },
    ]
  },
  {
    title: "Conteudo",
    items: [
      { icon: LayoutTemplate, label: "Templates", href: "/dragon-adm/templates" },
      { icon: Ticket, label: "Cupons", href: "/dragon-adm/cupons" },
    ]
  },
  {
    title: "Sistema",
    items: [
      { icon: MessageSquare, label: "Suporte", href: "/dragon-adm/suporte" },
      { icon: FileText, label: "Termos", href: "/dragon-adm/termos" },
      { icon: Settings, label: "Configuracoes", href: "/dragon-adm/settings" },
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
      router.push("/dragon-adm/login")
      return
    }

    try {
      const parsed = JSON.parse(storedSession) as AdminSession
      const expiresAt = new Date(parsed.expiresAt)
      
      if (expiresAt < new Date()) {
        localStorage.removeItem("dragon_adm_session")
        router.push("/dragon-adm/login")
        return
      }

      setSession(parsed)
    } catch {
      localStorage.removeItem("dragon_adm_session")
      router.push("/dragon-adm/login")
      return
    }

    setIsLoading(false)
  }, [router])

  const handleLogout = () => {
    localStorage.removeItem("dragon_adm_session")
    router.push("/dragon-adm/login")
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-accent border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex">
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 bg-card border-r border-border transform transition-transform duration-200 lg:translate-x-0 lg:static",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="h-16 flex items-center justify-between px-4 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-accent/10 flex items-center justify-center">
                <Shield className="h-5 w-5 text-accent" />
              </div>
              <span className="font-bold text-foreground">Dragon ADM</span>
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
                  <p className="px-3 mb-1 text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider">
                    {section.title}
                  </p>
                  <div className="space-y-0.5">
                    {section.items.map((item) => {
                      const isActive = pathname === item.href || 
                        (item.href !== "/dragon-adm" && pathname.startsWith(item.href))
                      
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setSidebarOpen(false)}
                          className={cn(
                            "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                            isActive
                              ? "bg-accent/10 text-accent"
                              : "text-muted-foreground hover:text-foreground hover:bg-secondary"
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
          <div className="p-4 border-t border-border">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-full bg-accent/10 flex items-center justify-center">
                <span className="text-sm font-bold text-accent">
                  {session?.email?.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {session?.email}
                </p>
                <p className="text-xs text-muted-foreground">Administrador</p>
              </div>
            </div>
            <Button
              variant="outline"
              className="w-full justify-start text-muted-foreground hover:text-destructive hover:border-destructive/50"
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
        <header className="h-16 flex items-center justify-between px-4 border-b border-border bg-card lg:px-6">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>

          <div className="flex items-center gap-2 ml-auto">
            <span className="text-xs text-muted-foreground hidden sm:block">
              Logado como <span className="text-foreground font-medium">{session?.email}</span>
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
