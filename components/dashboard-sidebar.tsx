"use client"

import { useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  LayoutDashboard,
  DollarSign,
  Bot,
  GitBranch,
  Megaphone,
  CreditCard,
  LinkIcon,
  Gift,
  Trophy,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Sparkles,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { BotSwitcher } from "@/components/bot-switcher"
import { useAuth } from "@/lib/auth-context"

type NavItem = {
  label: string
  description: string
  href: string
  icon: LucideIcon
  locked?: boolean
}

type NavSection = {
  category: string
  items: NavItem[]
}

const navSections: NavSection[] = [
  {
    category: "MENU",
    items: [
      { label: "Dashboard", description: "Visao geral", href: "/", icon: LayoutDashboard },
      { label: "Vendas", description: "Vendas e transacoes", href: "/payments", icon: DollarSign },
    ],
  },
  {
    category: "AUTOMACOES",
    items: [
      { label: "Meus Robos", description: "Gerenciar bots", href: "/bots", icon: Bot },
      { label: "Meus Fluxos", description: "Fluxos de venda", href: "/fluxos", icon: GitBranch },
      { label: "Remarketing", description: "Campanhas", href: "/campaigns", icon: Megaphone },
    ],
  },
  {
    category: "INTEGRACOES",
    items: [
      { label: "Gateways", description: "Pagamentos PIX", href: "/gateways", icon: CreditCard },
      { label: "Dragon Sites", description: "Crie paginas de conversao", href: "/biolink", icon: LinkIcon },
    ],
  },
  {
    category: "RECOMPENSAS",
    items: [
      { label: "Indique e Ganhe", description: "Convide amigos", href: "/referral", icon: Gift },
      { label: "Premiacoes", description: "Conquistas e premios", href: "/rewards", icon: Trophy },
    ],
  },
]

interface DashboardSidebarProps {
  onNavigate?: () => void
  defaultCollapsed?: boolean
}

export function DashboardSidebar({ onNavigate, defaultCollapsed = false }: DashboardSidebarProps) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(defaultCollapsed)
  const { session, logout } = useAuth()

  const userInitial = session?.name
    ? session.name.charAt(0).toUpperCase()
    : session?.email
      ? session.email.charAt(0).toUpperCase()
      : "U"

  const userName = session?.name || session?.email?.split("@")[0] || "Usuario"

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          "flex h-screen flex-col bg-sidebar-background border-r border-sidebar-border transition-all duration-300 relative",
          collapsed ? "w-[72px]" : "w-[260px]"
        )}
      >
        {/* Subtle gradient overlay for depth */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/20 pointer-events-none" />

        {/* Logo */}
        <div className="relative flex items-center justify-center pt-7 pb-5 px-4">
          <div className={cn(
            "relative",
            !collapsed && "after:absolute after:-bottom-3 after:left-1/2 after:-translate-x-1/2 after:w-16 after:h-px after:bg-gradient-to-r after:from-transparent after:via-accent/30 after:to-transparent"
          )}>
            <Image
              src="/images/logo-dragon.png"
              alt="Dragon"
              width={160}
              height={45}
              className={cn(
                "object-contain drop-shadow-[0_0_20px_rgba(34,197,94,0.15)]",
                collapsed ? "h-8 w-8" : "h-10 w-auto max-w-[160px]"
              )}
            />
          </div>
        </div>

        {/* User Profile + Bot Switcher */}
        <div className={cn("relative px-4 pt-3 pb-3", collapsed && "px-2")}>
          <div className={cn(
            "rounded-2xl bg-secondary/50 backdrop-blur-sm border border-border/50 p-3.5 flex flex-col gap-3",
            collapsed && "items-center p-2.5 gap-2"
          )}>
            {/* Profile row */}
            {collapsed ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link
                    href="/settings"
                    onClick={onNavigate}
                    className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-accent to-accent/80 text-accent-foreground text-sm font-bold transition-all hover:scale-105 hover:shadow-[0_0_20px_rgba(34,197,94,0.4)]"
                  >
                    {userInitial}
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="right" className="bg-card text-foreground border border-border">
                  {userName}
                </TooltipContent>
              </Tooltip>
            ) : (
              <div className="flex items-center gap-3">
                <Link
                  href="/settings"
                  onClick={onNavigate}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-accent to-accent/80 text-accent-foreground text-sm font-bold transition-all hover:scale-105 hover:shadow-[0_0_20px_rgba(34,197,94,0.4)]"
                >
                  {userInitial}
                </Link>
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="text-sm font-semibold text-foreground truncate">
                    {userName}
                  </span>
                  <span className="text-xs text-muted-foreground truncate">
                    {session?.email || ""}
                  </span>
                </div>
                <button
                  onClick={logout}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-all hover:text-red-400 hover:bg-red-500/10 hover:scale-105"
                  aria-label="Sair"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            )}

            {/* Bot Switcher */}
            <BotSwitcher collapsed={collapsed} />
          </div>
        </div>

        {/* Navigation */}
        <ScrollArea className="relative flex-1 py-2">
          <nav className={cn("flex flex-col gap-6", collapsed ? "px-2" : "px-3")}>
            {navSections.map((section) => (
              <div key={section.category} className="flex flex-col gap-1">
                {/* Category label */}
                {!collapsed ? (
                  <div className="flex items-center gap-2 px-3 pb-2 pt-1">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground/70">
                      {section.category}
                    </span>
                    <div className="flex-1 h-px bg-gradient-to-r from-border/50 to-transparent" />
                  </div>
                ) : (
                  <div className="flex justify-center py-2">
                    <div className="h-px w-6 bg-gradient-to-r from-transparent via-border to-transparent" />
                  </div>
                )}

                {/* Items */}
                {section.items.map((item) => {
                  const isActive =
                    pathname === item.href ||
                    (item.href !== "/" && pathname.startsWith(item.href))

                  if (item.locked) {
                    const lockedContent = (
                      <span
                        key={item.href}
                        className={cn(
                          "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 opacity-30 cursor-not-allowed select-none",
                          collapsed && "justify-center px-0"
                        )}
                      >
                        <span className={cn(
                          "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                          collapsed ? "h-10 w-10" : ""
                        )}>
                          <item.icon className="h-[18px] w-[18px]" />
                        </span>
                        {!collapsed && (
                          <span className="text-sm font-medium text-foreground/60 truncate">
                            {item.label}
                          </span>
                        )}
                      </span>
                    )

                    if (collapsed) {
                      return (
                        <Tooltip key={item.href}>
                          <TooltipTrigger asChild>{lockedContent}</TooltipTrigger>
                          <TooltipContent side="right" className="bg-card text-foreground border border-border shadow-xl">
                            <p className="font-medium">{item.label}</p>
                            <p className="text-xs text-muted-foreground">Em breve</p>
                          </TooltipContent>
                        </Tooltip>
                      )
                    }

                    return lockedContent
                  }

                  const linkContent = (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onNavigate}
                      className={cn(
                        "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all duration-300",
                        collapsed && "justify-center px-0 py-3",
                        isActive
                          ? "bg-accent text-accent-foreground shadow-[0_0_30px_-5px_rgba(34,197,94,0.5),inset_0_1px_0_rgba(255,255,255,0.1)]"
                          : "text-muted-foreground hover:text-foreground hover:bg-secondary/80"
                      )}
                    >
                      {/* Glow effect for active item */}
                      {isActive && (
                        <div className="absolute inset-0 rounded-xl bg-accent/20 blur-xl -z-10" />
                      )}
                      
                      {/* Left accent bar for active */}
                      {isActive && !collapsed && (
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-r-full bg-accent-foreground/30" />
                      )}

                      <span className={cn(
                        "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-all duration-300",
                        collapsed ? "h-10 w-10" : "",
                        isActive
                          ? "text-accent-foreground"
                          : "text-muted-foreground group-hover:text-foreground group-hover:scale-110"
                      )}>
                        <item.icon className={cn(
                          "h-[18px] w-[18px] transition-all",
                          isActive && "drop-shadow-[0_0_8px_rgba(0,0,0,0.3)]"
                        )} />
                      </span>

                      {!collapsed && (
                        <span className={cn(
                          "text-sm font-medium truncate transition-all duration-300",
                          isActive
                            ? "text-accent-foreground font-semibold"
                            : "text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5"
                        )}>
                          {item.label}
                        </span>
                      )}

                      {/* Hover indicator */}
                      {!isActive && !collapsed && (
                        <div className="absolute right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Sparkles className="h-3 w-3 text-accent/50" />
                        </div>
                      )}
                    </Link>
                  )

                  if (collapsed) {
                    return (
                      <Tooltip key={item.href}>
                        <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
                        <TooltipContent side="right" className="bg-card text-foreground border border-border shadow-xl">
                          <p className="font-medium">{item.label}</p>
                          <p className="text-xs text-muted-foreground">{item.description}</p>
                        </TooltipContent>
                      </Tooltip>
                    )
                  }

                  return linkContent
                })}
              </div>
            ))}
          </nav>
        </ScrollArea>

        {/* Collapse toggle */}
        <div className={cn("relative px-4 pb-5 pt-2", collapsed && "px-2")}>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCollapsed(!collapsed)}
            className="hidden md:flex w-full justify-center text-muted-foreground hover:text-foreground hover:bg-secondary/80 h-9 rounded-xl border border-transparent hover:border-border/50 transition-all"
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </Button>
        </div>
      </aside>
    </TooltipProvider>
  )
}
