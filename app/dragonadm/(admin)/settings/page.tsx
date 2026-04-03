"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Settings, Shield, Bell, Database } from "lucide-react"

export default function SettingsPage() {
  return (
    <ScrollArea className="flex-1">
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Configuracoes</h1>
          <p className="text-sm text-zinc-400">
            Configuracoes gerais do painel administrativo
          </p>
        </div>

        <div className="grid gap-6">
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                  <Shield className="h-5 w-5 text-white" />
                </div>
                <div>
                  <CardTitle className="text-white">Seguranca</CardTitle>
                  <CardDescription className="text-zinc-400">
                    Configuracoes de acesso ao painel
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="text-zinc-300">Email do Admin</Label>
                <Input 
                  value="admin@dragon.com" 
                  disabled 
                  className="bg-zinc-800 border-zinc-700 text-zinc-400"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-zinc-300">Alterar Senha</Label>
                <Input 
                  type="password" 
                  placeholder="Nova senha" 
                  className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500"
                />
              </div>
              <Button className="bg-white text-zinc-900 hover:bg-zinc-200">
                Atualizar Senha
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                  <Bell className="h-5 w-5 text-white" />
                </div>
                <div>
                  <CardTitle className="text-white">Notificacoes</CardTitle>
                  <CardDescription className="text-zinc-400">
                    Configurar alertas e notificacoes
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Bell className="h-12 w-12 text-zinc-700 mb-4" />
                <p className="text-sm text-zinc-400">
                  Configuracoes de notificacoes em desenvolvimento
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                  <Database className="h-5 w-5 text-white" />
                </div>
                <div>
                  <CardTitle className="text-white">Sistema</CardTitle>
                  <CardDescription className="text-zinc-400">
                    Informacoes do sistema
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between py-2 border-b border-zinc-800">
                <span className="text-zinc-400">Versao</span>
                <span className="text-white font-mono">1.0.0</span>
              </div>
              <div className="flex justify-between py-2 border-b border-zinc-800">
                <span className="text-zinc-400">Ambiente</span>
                <span className="text-white font-mono">Production</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-zinc-400">Database</span>
                <span className="text-emerald-400 font-mono">Connected</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </ScrollArea>
  )
}
