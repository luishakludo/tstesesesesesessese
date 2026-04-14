import { NextRequest, NextResponse } from "next/server"
import { getSupabase } from "@/lib/supabase"

/**
 * API de Fluxo Especifico
 * 
 * Endpoint: GET /api/fluxo/{flowId}
 * 
 * Retorna dados COMPLETOS e ATUAIS do fluxo especifico:
 * - Informacoes do fluxo
 * - Planos disponiveis (fonte: database ou config)
 * - Order Bumps configurados (inicial, packs, upsell, downsell)
 * - Packs disponiveis
 * - Vinculo com bot
 * - Simulacao de callbacks do Telegram
 * 
 * Exemplo: /api/fluxo/56a5b1f3-2b54-4f8f-b9ec-77a2acc491f3
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ flowId: string }> }
) {
  const { flowId } = await params
  const supabase = getSupabase()

  if (!flowId) {
    return NextResponse.json({
      erro: "Flow ID e obrigatorio",
      exemplo: "/api/fluxo/56a5b1f3-2b54-4f8f-b9ec-77a2acc491f3"
    }, { status: 400 })
  }

  try {
    // ===============================================
    // BUSCAR FLUXO
    // ===============================================
    const { data: flow, error: flowError } = await supabase
      .from("flows")
      .select("id, name, config, status, bot_id, user_id, created_at, updated_at")
      .eq("id", flowId)
      .single()

    if (flowError || !flow) {
      return NextResponse.json({
        erro: "Fluxo nao encontrado",
        flow_id: flowId,
        detalhes: flowError?.message || "Flow inexistente"
      }, { status: 404 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const config = (flow.config || {}) as Record<string, any>

    // ===============================================
    // BUSCAR PLANOS DO BANCO (flow_plans)
    // ===============================================
    const { data: dbPlans } = await supabase
      .from("flow_plans")
      .select("*")
      .eq("flow_id", flowId)
      .eq("is_active", true)
      .order("position", { ascending: true })

    // Planos do config (fallback)
    const configPlans = config.plans || []

    // Usar planos do banco se existirem, senao do config
    const planosFinais = (dbPlans && dbPlans.length > 0)
      ? dbPlans.map(p => ({
          id: p.id,
          name: p.name,
          price: p.price,
          description: p.description,
          is_active: p.is_active,
          position: p.position,
          fonte: "database (flow_plans)",
          created_at: p.created_at
        }))
      : configPlans.map((p: { id: string; name: string; price: number; description?: string }, index: number) => ({
          id: p.id || `config_plan_${index}`,
          name: p.name,
          price: p.price,
          description: p.description || null,
          is_active: true,
          position: index,
          fonte: "config JSON"
        }))

    // ===============================================
    // BUSCAR BOT VINCULADO
    // ===============================================
    let botInfo = null
    let tipoVinculo = "NENHUM"

    // Verificar vinculo direto (flow.bot_id)
    if (flow.bot_id) {
      const { data: bot } = await supabase
        .from("bots")
        .select("id, name, username, telegram_bot_id, status")
        .eq("id", flow.bot_id)
        .single()
      
      if (bot) {
        botInfo = bot
        tipoVinculo = "direto (flow.bot_id)"
      }
    }

    // Se nao tem vinculo direto, verificar flow_bots
    if (!botInfo) {
      const { data: flowBot } = await supabase
        .from("flow_bots")
        .select("bot_id")
        .eq("flow_id", flowId)
        .limit(1)
        .single()

      if (flowBot?.bot_id) {
        const { data: bot } = await supabase
          .from("bots")
          .select("id, name, username, telegram_bot_id, status")
          .eq("id", flowBot.bot_id)
          .single()

        if (bot) {
          botInfo = bot
          tipoVinculo = "indireto (flow_bots)"
        }
      }
    }

    // ===============================================
    // PROCESSAR ORDER BUMPS
    // ===============================================
    const orderBump = config.orderBump || {}
    
    // Order Bump Inicial pode estar em diferentes lugares:
    // 1. config.orderBump.inicial (nova estrutura)
    // 2. config.orderBump direto com enabled/name/price (estrutura intermediaria)
    // 3. dentro de cada plano (estrutura legada)
    
    let orderBumpInicial = orderBump.inicial || null
    
    // Se nao tem inicial mas tem dados no orderBump raiz, usar esses
    if (!orderBumpInicial && (orderBump.enabled !== undefined || orderBump.name || orderBump.price > 0)) {
      orderBumpInicial = {
        enabled: orderBump.enabled || false,
        name: orderBump.name || "",
        price: orderBump.price || 0,
        description: orderBump.description || "",
        acceptText: orderBump.acceptText || "ADICIONAR",
        rejectText: orderBump.rejectText || "NAO QUERO",
        medias: orderBump.medias || []
      }
    }
    
    const orderBumpPacks = orderBump.packs || null
    const upsell = config.upsell || null
    const downsell = config.downsell || null

    // Calcular callbacks simulados para cada plano
    const planosComCallbacks = planosFinais.map(plano => {
      const planoPriceCents = Math.round(plano.price * 100)
      const bumpPriceCents = orderBumpInicial?.price ? Math.round(orderBumpInicial.price * 100) : 0

      return {
        ...plano,
        telegram: {
          botao_selecionar: {
            text: plano.name,
            callback_data: `plan_${plano.id}`
          },
          // Se tiver order bump, esses sao os callbacks que serao gerados
          order_bump_callbacks: orderBumpInicial?.enabled && orderBumpInicial?.price > 0 ? {
            aceitar: {
              callback_data: `ob_accept_${planoPriceCents}_${bumpPriceCents}`,
              valor_total: plano.price + orderBumpInicial.price,
              descricao: `${plano.name} + ${orderBumpInicial.name}`
            },
            recusar: {
              callback_data: `ob_decline_${planoPriceCents}_0`,
              valor_total: plano.price,
              descricao: plano.name
            }
          } : null
        }
      }
    })

    // ===============================================
    // PROCESSAR ORDER BUMP INICIAL
    // ===============================================
    
    // Verificar se o order bump esta realmente ativo
    const obInicialEnabled = orderBumpInicial?.enabled === true
    const obInicialPrice = orderBumpInicial?.price || 0
    const obInicialVaiMostrar = obInicialEnabled && obInicialPrice > 0
    
    const orderBumpInicialProcessado = {
      // Dados RAW (como esta salvo)
      raw_config: orderBump,
      raw_inicial: orderBumpInicial,
      
      // Dados processados
      configurado: !!orderBumpInicial,
      enabled: obInicialEnabled,
      name: orderBumpInicial?.name || "",
      price: obInicialPrice,
      description: orderBumpInicial?.description || "",
      acceptText: orderBumpInicial?.acceptText || "ADICIONAR",
      rejectText: orderBumpInicial?.rejectText || "NAO QUERO",
      medias: orderBumpInicial?.medias || [],
      
      // Analise detalhada
      analise: {
        vai_mostrar: obInicialVaiMostrar,
        checklist: {
          "1_tem_orderBump_no_config": !!orderBump && Object.keys(orderBump).length > 0,
          "2_tem_inicial": !!orderBumpInicial,
          "3_enabled_true": obInicialEnabled,
          "4_price_maior_que_zero": obInicialPrice > 0,
          "5_tem_nome": !!(orderBumpInicial?.name),
        },
        motivo: !orderBumpInicial 
          ? "PROBLEMA: orderBump.inicial nao existe no config"
          : !obInicialEnabled 
            ? "PROBLEMA: Order Bump desabilitado (enabled = false). Va em /fluxos/{id} e ative o Order Bump."
            : obInicialPrice <= 0 
              ? "PROBLEMA: Preco invalido (price <= 0). Configure um preco maior que zero."
              : !orderBumpInicial?.name
                ? "AVISO: Nome nao configurado, mas vai funcionar."
                : "OK: Order Bump configurado corretamente! Sera exibido apos selecao de plano."
      },
      
      // Exemplo de como vai aparecer
      exemplo_mensagem: obInicialVaiMostrar ? {
        texto: orderBumpInicial?.description || `Aproveite! Adicione ${orderBumpInicial?.name} por apenas R$ ${obInicialPrice.toFixed(2).replace(".", ",")}!`,
        botoes: [
          { text: orderBumpInicial?.acceptText || "ADICIONAR", callback_data: "ob_accept_{plan_price}_{bump_price}" },
          { text: orderBumpInicial?.rejectText || "NAO QUERO", callback_data: "ob_decline_{plan_price}_0" }
        ]
      } : null,
      
      // INSTRUCOES PARA CORRIGIR
      como_ativar: !obInicialVaiMostrar ? {
        passo_1: "Acesse /fluxos/" + flowId,
        passo_2: "Va na aba 'Order Bump'",
        passo_3: "Ative o switch 'Habilitar Order Bump'",
        passo_4: "Configure nome, preco e descricao",
        passo_5: "Clique em 'Salvar Alteracoes'"
      } : null
    }

    // ===============================================
    // PROCESSAR ORDER BUMP PACKS
    // ===============================================
    const orderBumpPacksProcessado = orderBumpPacks ? {
      configurado: true,
      enabled: orderBumpPacks.enabled,
      name: orderBumpPacks.name,
      price: orderBumpPacks.price,
      description: orderBumpPacks.description,
      acceptText: orderBumpPacks.acceptText || "ADICIONAR",
      rejectText: orderBumpPacks.rejectText || "NAO QUERO",
      medias: orderBumpPacks.medias || [],
      analise: {
        vai_mostrar: orderBumpPacks.enabled && orderBumpPacks.price > 0,
        motivo: !orderBumpPacks.enabled 
          ? "Order Bump Packs desabilitado" 
          : !orderBumpPacks.price || orderBumpPacks.price <= 0 
            ? "Preco invalido" 
            : "Configuracao OK - Sera exibido apos selecao de pack"
      }
    } : {
      configurado: false,
      enabled: false,
      analise: {
        vai_mostrar: false,
        motivo: "Order Bump Packs nao configurado"
      }
    }

    // ===============================================
    // PROCESSAR PACKS
    // ===============================================
    const packs = config.packs || {}
    const packsEnabled = packs.enabled === true
    const packsList = (packs.list || []).filter((p: { active?: boolean }) => p.active !== false)

    const packsProcessados = {
      enabled: packsEnabled,
      buttonText: packs.buttonText || "Ver Packs",
      total: packsList.length,
      lista: packsList.map((pack: { id: string; name: string; price: number; emoji?: string; description?: string; previewMedias?: string[] }) => {
        const packPriceCents = Math.round(pack.price * 100)
        const bumpPacksPriceCents = orderBumpPacks?.price ? Math.round(orderBumpPacks.price * 100) : 0

        return {
          id: pack.id,
          name: pack.name,
          price: pack.price,
          emoji: pack.emoji,
          description: pack.description,
          previewMedias: pack.previewMedias || [],
          telegram: {
            botao_comprar: {
              text: `${pack.emoji || ""} ${pack.name} - R$ ${pack.price.toFixed(2).replace(".", ",")}`,
              callback_data: `buy_pack_${pack.id}_${pack.price}`
            },
            order_bump_callbacks: orderBumpPacks?.enabled && orderBumpPacks?.price > 0 ? {
              aceitar: {
                callback_data: `ob_pack_accept_${packPriceCents}_${bumpPacksPriceCents}`,
                valor_total: pack.price + orderBumpPacks.price
              },
              recusar: {
                callback_data: `ob_pack_decline_${packPriceCents}_0`,
                valor_total: pack.price
              }
            } : null
          }
        }
      })
    }

    // ===============================================
    // PROCESSAR UPSELL/DOWNSELL
    // ===============================================
    const upsellProcessado = upsell ? {
      configurado: true,
      enabled: upsell.enabled,
      sequences: (upsell.sequences || []).map((seq: { id: string; name: string; price: number; triggerAfterMinutes?: number }) => ({
        id: seq.id,
        name: seq.name,
        price: seq.price,
        triggerAfterMinutes: seq.triggerAfterMinutes
      })),
      total_sequences: (upsell.sequences || []).length
    } : {
      configurado: false,
      enabled: false
    }

    const downsellProcessado = downsell ? {
      configurado: true,
      enabled: downsell.enabled,
      name: downsell.name,
      price: downsell.price,
      description: downsell.description
    } : {
      configurado: false,
      enabled: false
    }

    // ===============================================
    // MONTAR RESPOSTA FINAL
    // ===============================================
    const response = {
      titulo: "Dados Completos do Fluxo",
      timestamp: new Date().toISOString(),
      
      // Informacoes do fluxo
      fluxo: {
        id: flow.id,
        name: flow.name,
        status: flow.status || "active",
        created_at: flow.created_at,
        updated_at: flow.updated_at
      },

      // Vinculo com bot
      bot: {
        vinculado: !!botInfo,
        tipo_vinculo: tipoVinculo,
        dados: botInfo ? {
          id: botInfo.id,
          name: botInfo.name,
          username: botInfo.username,
          telegram_bot_id: botInfo.telegram_bot_id,
          status: botInfo.status
        } : null,
        problema: !botInfo ? "ATENCAO: Este fluxo NAO esta vinculado a nenhum bot! O Order Bump NAO funcionara no Telegram." : null,
        como_vincular: !botInfo ? {
          passo_1: "Acesse /bots",
          passo_2: "Crie ou selecione um bot",
          passo_3: "No bot, vincule este fluxo (flow_id: " + flowId + ")",
          alternativa: "Ou acesse /fluxos/" + flowId + " e selecione um bot na configuracao"
        } : null
      },

      // Planos
      planos: {
        fonte: (dbPlans && dbPlans.length > 0) ? "database (flow_plans)" : "config JSON",
        total: planosComCallbacks.length,
        lista: planosComCallbacks
      },

      // Order Bumps
      order_bumps: {
        inicial: orderBumpInicialProcessado,
        packs: orderBumpPacksProcessado,
        upsell: upsellProcessado,
        downsell: downsellProcessado,
        // Resumo rapido
        resumo: {
          order_bump_inicial_ativo: orderBumpInicialProcessado.analise?.vai_mostrar || false,
          order_bump_packs_ativo: orderBumpPacksProcessado.analise?.vai_mostrar || false,
          upsell_ativo: upsellProcessado.enabled || false,
          downsell_ativo: downsellProcessado.enabled || false
        }
      },

      // Packs
      packs: packsProcessados,

      // Entrega
      entrega: {
        delivery_legado: config.delivery || null,
        deliverables: config.deliverables || [],
        mainDeliverableId: config.mainDeliverableId || null
      },

      // Fluxo completo simulado (como o bot se comportara)
      simulacao_fluxo: {
        passo_1_inicio: {
          descricao: "Usuario envia /start ou mensagem inicial",
          acao: "Bot mostra mensagem de boas vindas"
        },
        passo_2_ver_planos: {
          descricao: "Usuario clica em Ver Planos",
          callback: "ver_planos",
          resposta: {
            tipo: "MESSAGE_WITH_INLINE_KEYBOARD",
            botoes: planosComCallbacks.map(p => ({
              text: p.name,
              callback_data: p.telegram.botao_selecionar.callback_data
            }))
          }
        },
        passo_3_selecionar_plano: {
          descricao: "Usuario seleciona um plano",
          order_bump_sera_mostrado: orderBumpInicialProcessado.analise?.vai_mostrar || false,
          se_order_bump_ativo: orderBumpInicialProcessado.analise?.vai_mostrar ? {
            passo: "3a - Mostrar Order Bump",
            mensagem: orderBumpInicialProcessado.exemplo_mensagem
          } : {
            passo: "3a - Gerar PIX direto",
            descricao: "Sem order bump, vai direto para pagamento"
          }
        },
        passo_4_pagamento: {
          descricao: "Gerar PIX e aguardar pagamento",
          acao: "Bot envia QR Code e codigo copia-cola"
        },
        passo_5_confirmacao: {
          descricao: "Webhook do Mercado Pago confirma pagamento",
          acao: "Bot envia mensagem de sucesso e deliverables"
        }
      },

      // Debug info
      debug: {
        config_keys: Object.keys(config),
        total_planos_config: configPlans.length,
        total_planos_db: dbPlans?.length || 0
      },
      
      // ===============================================
      // DIAGNOSTICO RAPIDO
      // ===============================================
      diagnostico: {
        status_geral: (!!botInfo && obInicialVaiMostrar) ? "OK" : "PROBLEMAS_DETECTADOS",
        problemas: [
          ...(!botInfo ? ["FLUXO_SEM_BOT: Este fluxo nao esta vinculado a nenhum bot. Vincule um bot primeiro."] : []),
          ...(!obInicialVaiMostrar ? ["ORDER_BUMP_INATIVO: Order Bump esta desativado ou sem preco. Configure e ative o Order Bump."] : []),
        ],
        checklist: {
          "fluxo_existe": true,
          "fluxo_ativo": flow.status === "active" || flow.status === "ativo" || !flow.status,
          "tem_planos": planosComCallbacks.length > 0,
          "bot_vinculado": !!botInfo,
          "order_bump_enabled": obInicialEnabled,
          "order_bump_price_ok": obInicialPrice > 0,
          "order_bump_vai_funcionar": !!botInfo && obInicialVaiMostrar
        },
        proximos_passos: [
          ...(!botInfo ? ["1. Vincular um bot: Acesse /bots e vincule este fluxo"] : []),
          ...(!obInicialVaiMostrar ? ["2. Ativar Order Bump: Acesse /fluxos/" + flowId + ", va em Order Bump e ative"] : []),
          ...(!!botInfo && obInicialVaiMostrar ? ["Tudo OK! Teste o bot no Telegram."] : [])
        ]
      }
    }

    return NextResponse.json(response, { status: 200 })

  } catch (error) {
    console.error("[API /api/fluxo] Erro:", error)
    return NextResponse.json({
      erro: "Erro interno ao processar fluxo",
      detalhes: error instanceof Error ? error.message : "Erro desconhecido"
    }, { status: 500 })
  }
}
