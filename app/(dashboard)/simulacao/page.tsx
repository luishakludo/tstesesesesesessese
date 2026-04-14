"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, MessageCircle, Plus, Check, X } from "lucide-react"
import Link from "next/link"

// Dados simulados de planos
const MOCK_PLANS = [
  {
    id: "plan_1",
    name: "Plano Basico",
    price: 29.90,
    description: "Acesso basico ao conteudo",
    order_bumps: [
      {
        id: "ob_1",
        name: "Bonus Extra",
        price: 19.90,
        description: "Adicione o Bonus Extra por apenas R$ 19,90 e tenha acesso a conteudos exclusivos!",
        acceptText: "ADICIONAR",
        rejectText: "NAO QUERO"
      }
    ]
  },
  {
    id: "plan_2",
    name: "Plano Premium",
    price: 59.90,
    description: "Acesso completo + bonus",
    order_bumps: [
      {
        id: "ob_2",
        name: "Mentoria Individual",
        price: 99.90,
        description: "Adicione 1 hora de mentoria individual por apenas R$ 99,90!",
        acceptText: "QUERO SIM",
        rejectText: "AGORA NAO"
      },
      {
        id: "ob_3",
        name: "Grupo VIP",
        price: 49.90,
        description: "Acesso ao grupo VIP no Telegram por apenas R$ 49,90!",
        acceptText: "ADICIONAR",
        rejectText: "NAO QUERO"
      }
    ]
  },
  {
    id: "plan_3",
    name: "Plano VIP",
    price: 149.90,
    description: "Tudo incluido + suporte prioritario",
    order_bumps: [
      {
        id: "ob_4",
        name: "Consultoria 1:1",
        price: 199.90,
        description: "Sessao de consultoria personalizada por apenas R$ 199,90!",
        acceptText: "ADICIONAR",
        rejectText: "NAO QUERO"
      },
      {
        id: "ob_5",
        name: "Acesso Vitalicio",
        price: 299.90,
        description: "Acesso vitalicio a todos os conteudos por apenas R$ 299,90!",
        acceptText: "QUERO",
        rejectText: "PULAR"
      },
      {
        id: "ob_6",
        name: "Certificado Premium",
        price: 29.90,
        description: "Certificado premium personalizado por apenas R$ 29,90!",
        acceptText: "ADICIONAR",
        rejectText: "NAO QUERO"
      }
    ]
  }
]

type Step = "idle" | "plans" | "order_bumps" | "summary" | "payment" | "success"

interface Message {
  id: string
  type: "bot" | "user" | "system"
  content: string
  buttons?: Array<{
    text: string
    action: string
    variant?: "default" | "destructive" | "outline"
  }>
  image?: string
}

export default function SimulacaoPage() {
  const [step, setStep] = useState<Step>("idle")
  const [messages, setMessages] = useState<Message[]>([])
  const [selectedPlan, setSelectedPlan] = useState<typeof MOCK_PLANS[0] | null>(null)
  const [selectedBumps, setSelectedBumps] = useState<string[]>([])
  const [currentBumpIndex, setCurrentBumpIndex] = useState(0)
  const [totalAmount, setTotalAmount] = useState(0)

  const addMessage = (message: Omit<Message, "id">) => {
    setMessages(prev => [...prev, { ...message, id: `msg_${Date.now()}_${Math.random()}` }])
  }

  const handleStart = () => {
    setStep("plans")
    setMessages([])
    setSelectedPlan(null)
    setSelectedBumps([])
    setCurrentBumpIndex(0)
    setTotalAmount(0)

    addMessage({
      type: "bot",
      content: "Bem-vindo! Escolha um dos planos disponiveis:",
      buttons: MOCK_PLANS.map(plan => ({
        text: `${plan.name} - R$ ${plan.price.toFixed(2).replace(".", ",")}`,
        action: `select_plan_${plan.id}`
      }))
    })
  }

  const handleSelectPlan = (planId: string) => {
    const plan = MOCK_PLANS.find(p => p.id === planId)
    if (!plan) return

    setSelectedPlan(plan)
    setTotalAmount(plan.price)
    setStep("order_bumps")
    setCurrentBumpIndex(0)
    setSelectedBumps([])

    addMessage({
      type: "user",
      content: `Selecionei: ${plan.name}`
    })

    // Se tem order bumps, mostrar
    if (plan.order_bumps.length > 0) {
      const hasMultiple = plan.order_bumps.length > 1

      // Enviar cada order bump como mensagem separada
      plan.order_bumps.forEach((bump, index) => {
        const buttons: Message["buttons"] = [
          { text: bump.acceptText, action: `add_bump_${bump.id}` }
        ]
        
        // Se tem apenas 1 order bump, mostrar botao de recusar
        if (!hasMultiple) {
          buttons.push({ text: bump.rejectText, action: `decline_bump_${bump.id}`, variant: "outline" })
        }

        addMessage({
          type: "bot",
          content: bump.description,
          buttons
        })
      })

      // Mensagem de resumo
      addMessage({
        type: "bot",
        content: `*Resumo do Pedido:*\n\n${plan.name}: R$ ${plan.price.toFixed(2).replace(".", ",")}\n\n_Clique nos adicionais acima para incluir no pedido_`,
        buttons: [
          { text: `PROSSEGUIR - R$ ${plan.price.toFixed(2).replace(".", ",")}`, action: "proceed" }
        ]
      })
    } else {
      // Sem order bumps, ir direto para pagamento
      handleProceed()
    }
  }

  const handleAddBump = (bumpId: string) => {
    if (!selectedPlan) return

    const bump = selectedPlan.order_bumps.find(b => b.id === bumpId)
    if (!bump || selectedBumps.includes(bumpId)) return

    setSelectedBumps(prev => [...prev, bumpId])
    const newTotal = totalAmount + bump.price
    setTotalAmount(newTotal)

    // Atualizar a mensagem do bump para mostrar "ADICIONADO"
    setMessages(prev => prev.map(msg => {
      if (msg.buttons?.some(b => b.action === `add_bump_${bumpId}`)) {
        return {
          ...msg,
          content: `${bump.description}\n\n*ADICIONADO* (+R$ ${bump.price.toFixed(2).replace(".", ",")})`,
          buttons: undefined // Remove os botoes
        }
      }
      return msg
    }))

    // Atualizar a mensagem de resumo
    setMessages(prev => prev.map(msg => {
      if (msg.buttons?.some(b => b.action === "proceed")) {
        const allSelectedBumps = [...selectedBumps, bumpId]
        let resumoText = `*Resumo do Pedido:*\n\n${selectedPlan.name}: R$ ${selectedPlan.price.toFixed(2).replace(".", ",")}`
        
        allSelectedBumps.forEach(id => {
          const b = selectedPlan.order_bumps.find(ob => ob.id === id)
          if (b) {
            resumoText += `\n+ ${b.name}: R$ ${b.price.toFixed(2).replace(".", ",")}`
          }
        })
        
        resumoText += `\n\n*TOTAL: R$ ${newTotal.toFixed(2).replace(".", ",")}*`

        return {
          ...msg,
          content: resumoText,
          buttons: [
            { text: `PROSSEGUIR - R$ ${newTotal.toFixed(2).replace(".", ",")}`, action: "proceed" }
          ]
        }
      }
      return msg
    }))
  }

  const handleDeclineBump = (bumpId: string) => {
    if (!selectedPlan) return

    const bump = selectedPlan.order_bumps.find(b => b.id === bumpId)
    if (!bump) return

    // Atualizar a mensagem do bump para mostrar "RECUSADO"
    setMessages(prev => prev.map(msg => {
      if (msg.buttons?.some(b => b.action === `add_bump_${bumpId}`)) {
        return {
          ...msg,
          content: `${bump.description}\n\n_Recusado_`,
          buttons: undefined
        }
      }
      return msg
    }))

    // Ir para pagamento
    handleProceed()
  }

  const handleProceed = () => {
    if (!selectedPlan) return

    setStep("payment")

    addMessage({
      type: "user",
      content: "Prosseguir"
    })

    addMessage({
      type: "bot",
      content: `*Gerando pagamento PIX...*\n\nValor: R$ ${totalAmount.toFixed(2).replace(".", ",")}`
    })

    // Simular geracao do PIX
    setTimeout(() => {
      addMessage({
        type: "bot",
        content: `*PIX Gerado com Sucesso!*\n\nValor: R$ ${totalAmount.toFixed(2).replace(".", ",")}\n\nChave PIX:\n\`00020126580014br.gov.bcb.pix0136${Math.random().toString(36).substring(7)}5204000053039865802BR5925SIMULACAO6009SAO PAULO62070503***6304\`\n\n_Copie a chave acima e pague no seu banco_`,
        buttons: [
          { text: "COPIAR CHAVE PIX", action: "copy_pix" },
          { text: "JA PAGUEI", action: "confirm_payment" }
        ]
      })
    }, 1500)
  }

  const handleConfirmPayment = () => {
    setStep("success")

    addMessage({
      type: "user",
      content: "Ja paguei"
    })

    addMessage({
      type: "bot",
      content: `*Pagamento Confirmado!*\n\nObrigado pela sua compra!\n\nResumo:\n- ${selectedPlan?.name}: R$ ${selectedPlan?.price.toFixed(2).replace(".", ",")}\n${selectedBumps.map(id => {
        const bump = selectedPlan?.order_bumps.find(b => b.id === id)
        return bump ? `- ${bump.name}: R$ ${bump.price.toFixed(2).replace(".", ",")}` : ""
      }).join("\n")}\n\n*Total: R$ ${totalAmount.toFixed(2).replace(".", ",")}*`
    })
  }

  const handleButtonClick = (action: string) => {
    if (action.startsWith("select_plan_")) {
      const planId = action.replace("select_plan_", "")
      handleSelectPlan(planId)
    } else if (action.startsWith("add_bump_")) {
      const bumpId = action.replace("add_bump_", "")
      handleAddBump(bumpId)
    } else if (action.startsWith("decline_bump_")) {
      const bumpId = action.replace("decline_bump_", "")
      handleDeclineBump(bumpId)
    } else if (action === "proceed") {
      handleProceed()
    } else if (action === "confirm_payment") {
      handleConfirmPayment()
    } else if (action === "copy_pix") {
      addMessage({ type: "system", content: "Chave PIX copiada!" })
    }
  }

  const handleReset = () => {
    setStep("idle")
    setMessages([])
    setSelectedPlan(null)
    setSelectedBumps([])
    setCurrentBumpIndex(0)
    setTotalAmount(0)
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Link href="/fluxos">
              <Button variant="outline" size="icon">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold">Simulacao do Fluxo Telegram</h1>
              <p className="text-muted-foreground text-sm">Teste a interacao com planos e order bumps</p>
            </div>
          </div>
          {step !== "idle" && (
            <Button variant="outline" onClick={handleReset}>
              Reiniciar
            </Button>
          )}
        </div>

        {/* Info sobre navegacao */}
        <Card className="mb-6 border-amber-500/30 bg-amber-500/5">
          <CardContent className="pt-4">
            <p className="text-sm text-amber-600 dark:text-amber-400">
              Para editar os planos e order bumps, acesse:{" "}
              <Link href="/fluxos" className="underline font-medium">
                /fluxos
              </Link>
              {" "}e selecione o fluxo desejado.
            </p>
          </CardContent>
        </Card>

        {/* Area do chat simulado */}
        <Card className="bg-[#0e1621] border-neutral-800">
          <CardHeader className="border-b border-neutral-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center">
                <MessageCircle className="h-5 w-5 text-white" />
              </div>
              <div>
                <CardTitle className="text-white text-base">Bot de Vendas</CardTitle>
                <p className="text-neutral-400 text-xs">Simulacao</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {/* Mensagens */}
            <div className="h-[500px] overflow-y-auto p-4 space-y-4">
              {step === "idle" && (
                <div className="flex flex-col items-center justify-center h-full gap-4">
                  <p className="text-neutral-400 text-center">
                    Clique em START para iniciar a simulacao do fluxo de compra
                  </p>
                  <Button onClick={handleStart} className="bg-blue-600 hover:bg-blue-700">
                    START
                  </Button>
                </div>
              )}

              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.type === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] rounded-lg p-3 ${
                      msg.type === "user"
                        ? "bg-blue-600 text-white"
                        : msg.type === "system"
                        ? "bg-neutral-700 text-neutral-300 text-sm"
                        : "bg-neutral-800 text-white"
                    }`}
                  >
                    <p className="whitespace-pre-wrap text-sm">
                      {msg.content.split(/(\*[^*]+\*|_[^_]+_|`[^`]+`)/).map((part, i) => {
                        if (part.startsWith("*") && part.endsWith("*")) {
                          return <strong key={i}>{part.slice(1, -1)}</strong>
                        }
                        if (part.startsWith("_") && part.endsWith("_")) {
                          return <em key={i} className="text-neutral-400">{part.slice(1, -1)}</em>
                        }
                        if (part.startsWith("`") && part.endsWith("`")) {
                          return <code key={i} className="bg-neutral-700 px-1 rounded text-xs break-all">{part.slice(1, -1)}</code>
                        }
                        return part
                      })}
                    </p>

                    {msg.buttons && msg.buttons.length > 0 && (
                      <div className="mt-3 space-y-2">
                        {msg.buttons.map((btn, idx) => (
                          <Button
                            key={idx}
                            variant={btn.variant === "outline" ? "outline" : "default"}
                            className={`w-full text-sm ${
                              btn.variant === "outline"
                                ? "border-neutral-600 text-neutral-300 hover:bg-neutral-700"
                                : "bg-purple-600 hover:bg-purple-700 text-white"
                            }`}
                            onClick={() => handleButtonClick(btn.action)}
                          >
                            {btn.text}
                          </Button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Estado atual */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-base">Estado Atual</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Step</p>
                <Badge variant="outline">{step}</Badge>
              </div>
              <div>
                <p className="text-muted-foreground">Plano</p>
                <p className="font-medium">{selectedPlan?.name || "-"}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Bumps Adicionados</p>
                <p className="font-medium">{selectedBumps.length}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Total</p>
                <p className="font-medium text-green-600">R$ {totalAmount.toFixed(2).replace(".", ",")}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Links para fluxos */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-base">Links Uteis</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Link href="/fluxos" className="block">
                <Button variant="outline" className="w-full justify-start">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Ver todos os fluxos
                </Button>
              </Link>
              <p className="text-xs text-muted-foreground mt-2">
                Para editar um fluxo especifico, acesse: <code className="bg-muted px-1 rounded">/fluxos/[id]</code>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
