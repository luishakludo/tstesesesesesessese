import { NextResponse } from "next/server"
import { getSupabase } from "@/lib/supabase"

/**
 * =====================================================
 * API: ORDER BUMP DE PLANOS - STATUS COMPLETO
 * =====================================================
 * 
 * Endpoint: GET /api/debug/plan-order-bump
 * 
 * NENHUM PARAMETRO NECESSARIO!
 * Puxa TUDO automaticamente do Supabase.
 * 
 * Retorna o fluxo completo:
 * Ver Planos -> Selecionar Plano -> Order Bump -> Prosseguir -> PIX
 * 
 * =====================================================
 */
export async function GET() {
  const supabase = getSupabase()
  const inicio = Date.now()

  try {
    // ========================================
    // 1. BUSCAR TODOS OS BOTS
    // ========================================
    const { data: bots, error: botsError } = await supabase
      .from("bots")
      .select("*")
      .order("created_at", { ascending: false })

    if (botsError) {
      return NextResponse.json({ erro: "Falha ao buscar bots", detalhes: botsError.message }, { status: 500 })
    }

    if (!bots || bots.length === 0) {
      return NextResponse.json({
        status: "VAZIO",
        mensagem: "Nenhum bot cadastrado no sistema",
        solucao: "Cadastre um bot em /bots"
      })
    }

    // ========================================
    // 2. PROCESSAR CADA BOT
    // ========================================
    const resultado = {
      timestamp: new Date().toISOString(),
      tempo_ms: 0,
      
      resumo: {
        bots: bots.length,
        fluxos: 0,
        planos: 0,
        order_bumps_ativos: 0,
        gateways_ok: 0,
        problemas: 0
      },

      dados: [] as Array<{
        bot: {
          id: string
          nome: string
          username: string | null
          telegram_link: string | null
          token_ok: boolean
        }
        gateway: {
          ok: boolean
          nome: string | null
          motivo: string
        }
        fluxo: {
          id: string | null
          nome: string | null
          vinculo: string
        } | null
        planos: Array<{
          id: string
          nome: string
          preco: number
          preco_formatado: string
          callback_telegram: string
        }>
        order_bump: {
          ativo: boolean
          nome: string | null
          preco: number | null
          preco_formatado: string | null
          descricao: string | null
          botao_aceitar: string
          botao_recusar: string
          callbacks: {
            aceitar: string
            recusar: string
          } | null
          problema: string | null
        }
        simulacao_mensagens: Array<{
          etapa: number
          evento: string
          mensagem: string
          botoes?: Array<{ texto: string; acao: string }>
        }>
        problemas: string[]
      }>,

      erros_globais: [] as string[]
    }

    for (const bot of bots) {
      const botInfo = {
        bot: {
          id: bot.id,
          nome: bot.name || "Sem nome",
          username: bot.username,
          telegram_link: bot.username ? `https://t.me/${bot.username}` : null,
          token_ok: !!bot.token
        },
        gateway: {
          ok: false,
          nome: null as string | null,
          motivo: "Nao verificado"
        },
        fluxo: null as {
          id: string | null
          nome: string | null
          vinculo: string
        } | null,
        planos: [] as Array<{
          id: string
          nome: string
          preco: number
          preco_formatado: string
          callback_telegram: string
        }>,
        order_bump: {
          ativo: false,
          nome: null as string | null,
          preco: null as number | null,
          preco_formatado: null as string | null,
          descricao: null as string | null,
          botao_aceitar: "ADICIONAR",
          botao_recusar: "NAO QUERO",
          callbacks: null as { aceitar: string; recusar: string } | null,
          problema: null as string | null
        },
        simulacao_mensagens: [] as Array<{
          etapa: number
          evento: string
          mensagem: string
          botoes?: Array<{ texto: string; acao: string }>
        }>,
        problemas: [] as string[]
      }

      // ========================================
      // 3. BUSCAR GATEWAY
      // ========================================
      const { data: gateway } = await supabase
        .from("user_gateways")
        .select("*")
        .eq("bot_id", bot.id)
        .eq("is_active", true)
        .limit(1)
        .single()

      if (gateway && gateway.access_token) {
        botInfo.gateway = {
          ok: true,
          nome: gateway.gateway_name || "Mercado Pago",
          motivo: "Configurado e ativo"
        }
        resultado.resumo.gateways_ok++
      } else {
        botInfo.gateway = {
          ok: false,
          nome: null,
          motivo: gateway ? "Token nao configurado" : "Nenhum gateway vinculado"
        }
        botInfo.problemas.push("Gateway de pagamento nao configurado - PIX nao vai funcionar!")
      }

      // ========================================
      // 4. BUSCAR FLUXO VINCULADO
      // ========================================
      let fluxo = null

      // Primeiro: via flow_bots
      const { data: flowBot } = await supabase
        .from("flow_bots")
        .select("flow_id")
        .eq("bot_id", bot.id)
        .limit(1)
        .single()

      if (flowBot?.flow_id) {
        const { data: f } = await supabase
          .from("flows")
          .select("*")
          .eq("id", flowBot.flow_id)
          .single()
        
        if (f) {
          fluxo = f
          botInfo.fluxo = {
            id: f.id,
            nome: f.name,
            vinculo: "flow_bots"
          }
        }
      }

      // Fallback: via flow.bot_id
      if (!fluxo) {
        const { data: f } = await supabase
          .from("flows")
          .select("*")
          .eq("bot_id", bot.id)
          .limit(1)
          .single()

        if (f) {
          fluxo = f
          botInfo.fluxo = {
            id: f.id,
            nome: f.name,
            vinculo: "flow.bot_id"
          }
        }
      }

      if (!fluxo) {
        botInfo.problemas.push("Nenhum fluxo vinculado ao bot")
        resultado.dados.push(botInfo)
        continue
      }

      resultado.resumo.fluxos++

      // ========================================
      // 5. BUSCAR PLANOS
      // ========================================
      const { data: planosDb } = await supabase
        .from("flow_plans")
        .select("*")
        .eq("flow_id", fluxo.id)
        .eq("is_active", true)
        .order("position", { ascending: true })

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const config = (fluxo.config || {}) as Record<string, any>
      const planosConfig = config.plans || []

      const planosFinais = (planosDb && planosDb.length > 0)
        ? planosDb
        : planosConfig

      if (planosFinais.length === 0) {
        botInfo.problemas.push("Fluxo nao tem planos configurados")
      }

      for (const p of planosFinais) {
        const preco = Number(p.price) || 0
        const precoCents = Math.round(preco * 100)
        
        botInfo.planos.push({
          id: p.id,
          nome: p.name,
          preco: preco,
          preco_formatado: `R$ ${preco.toFixed(2).replace(".", ",")}`,
          callback_telegram: `plan_${p.id}`
        })
        resultado.resumo.planos++
      }

      // ========================================
      // 6. BUSCAR ORDER BUMP DO PLANO
      // ========================================
      const orderBumpConfig = config.orderBump || {}
      const obInicial = orderBumpConfig.inicial || orderBumpConfig

      const obEnabled = obInicial.enabled === true
      const obPrice = Number(obInicial.price) || 0
      const obAtivo = obEnabled && obPrice > 0

      botInfo.order_bump = {
        ativo: obAtivo,
        nome: obInicial.name || null,
        preco: obPrice || null,
        preco_formatado: obPrice > 0 ? `R$ ${obPrice.toFixed(2).replace(".", ",")}` : null,
        descricao: obInicial.description || null,
        botao_aceitar: obInicial.acceptText || "ADICIONAR",
        botao_recusar: obInicial.rejectText || "NAO QUERO",
        callbacks: null,
        problema: null
      }

      if (!obEnabled) {
        botInfo.order_bump.problema = "Order Bump desabilitado (enabled = false)"
      } else if (obPrice <= 0) {
        botInfo.order_bump.problema = "Preco do Order Bump invalido (0 ou negativo)"
      }

      if (obAtivo) {
        resultado.resumo.order_bumps_ativos++
        
        // Calcular callbacks para cada plano
        if (botInfo.planos.length > 0) {
          const planoExemplo = botInfo.planos[0]
          const planoPriceCents = Math.round(planoExemplo.preco * 100)
          const bumpPriceCents = Math.round(obPrice * 100)
          
          botInfo.order_bump.callbacks = {
            aceitar: `ob_accept_${planoPriceCents}_${bumpPriceCents}`,
            recusar: `ob_decline_${planoPriceCents}_0`
          }
        }
      }

      // ========================================
      // 7. SIMULAR MENSAGENS DO FLUXO
      // ========================================
      if (botInfo.planos.length > 0) {
        const plano = botInfo.planos[0]
        const totalComBump = plano.preco + (obAtivo ? obPrice : 0)

        // Etapa 1: Ver Planos
        botInfo.simulacao_mensagens.push({
          etapa: 1,
          evento: "Usuario clica em 'Ver Planos'",
          mensagem: "Escolha seu plano:",
          botoes: botInfo.planos.map(p => ({
            texto: p.nome,
            acao: p.callback_telegram
          }))
        })

        // Etapa 2: Seleciona Plano
        botInfo.simulacao_mensagens.push({
          etapa: 2,
          evento: `Usuario seleciona "${plano.nome}"`,
          mensagem: obAtivo 
            ? (botInfo.order_bump.descricao || `Aproveite! Adicione ${botInfo.order_bump.nome} por apenas ${botInfo.order_bump.preco_formatado}!`)
            : `Voce selecionou: ${plano.nome}\nValor: ${plano.preco_formatado}`,
          botoes: obAtivo 
            ? [
                { texto: botInfo.order_bump.botao_aceitar, acao: botInfo.order_bump.callbacks?.aceitar || "ob_accept" },
                { texto: botInfo.order_bump.botao_recusar, acao: botInfo.order_bump.callbacks?.recusar || "ob_decline" }
              ]
            : [
                { texto: `PROSSEGUIR - ${plano.preco_formatado}`, acao: "proceed_payment" }
              ]
        })

        if (obAtivo) {
          // Etapa 3: Aceita Order Bump
          botInfo.simulacao_mensagens.push({
            etapa: 3,
            evento: `Usuario clica em "${botInfo.order_bump.botao_aceitar}"`,
            mensagem: `Adicionado!\n\nResumo do Pedido:\n${plano.nome}: ${plano.preco_formatado}\n${botInfo.order_bump.nome}: ${botInfo.order_bump.preco_formatado}\n\nEscolha um dos produtos acima ou continue com o conteudo principal`,
            botoes: [
              { texto: `PROSSEGUIR - R$ ${totalComBump.toFixed(2).replace(".", ",")}`, acao: "proceed_payment" }
            ]
          })

          // Etapa 4: Prosseguir
          botInfo.simulacao_mensagens.push({
            etapa: 4,
            evento: "Usuario clica em 'PROSSEGUIR'",
            mensagem: botInfo.gateway.ok 
              ? "Gerando PIX... (QR Code seria enviado aqui)"
              : "Erro ao processar. Tente novamente. (Gateway nao configurado!)"
          })
        } else {
          // Etapa 3: Prosseguir (sem order bump)
          botInfo.simulacao_mensagens.push({
            etapa: 3,
            evento: "Usuario clica em 'PROSSEGUIR'",
            mensagem: botInfo.gateway.ok 
              ? "Gerando PIX... (QR Code seria enviado aqui)"
              : "Erro ao processar. Tente novamente. (Gateway nao configurado!)"
          })
        }
      }

      // Contabilizar problemas
      resultado.resumo.problemas += botInfo.problemas.length

      resultado.dados.push(botInfo)
    }

    resultado.tempo_ms = Date.now() - inicio

    return NextResponse.json(resultado, { status: 200 })

  } catch (error) {
    return NextResponse.json({
      erro: true,
      mensagem: error instanceof Error ? error.message : "Erro desconhecido",
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}
