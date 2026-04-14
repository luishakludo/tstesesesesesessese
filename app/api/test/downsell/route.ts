import { getSupabaseAdmin } from "@/lib/supabase"
import { NextResponse } from "next/server"

// GET /api/test/downsell - PUXA TUDO E TESTA TUDO AUTOMATICO
export async function GET() {
  const supabase = getSupabaseAdmin()
  const agora = new Date()

  try {
    // 1. Buscar TODOS os bots
    const { data: bots } = await supabase.from("bots").select("*")

    // 2. Buscar TODOS os fluxos
    const { data: flows } = await supabase.from("flows").select("*")

    // 3. Buscar mensagens pendentes
    const { data: pendentes } = await supabase
      .from("scheduled_messages")
      .select("*")
      .eq("status", "pending")
      .eq("message_type", "downsell")

    // 4. Analisar cada fluxo
    const analise = []

    for (const flow of flows || []) {
      const config = (flow.config as Record<string, unknown>) || {}
      const downsell = config.downsell as {
        enabled?: boolean
        sequences?: Array<{
          id: string
          message: string
          medias?: string[]
          sendDelayValue?: number
          sendDelayUnit?: string
          plans?: Array<{ id: string; buttonText: string; price: number }>
        }>
      } | undefined

      const bot = bots?.find(b => b.id === flow.bot_id)

      // Problemas
      const problemas = []
      if (!flow.bot_id) problemas.push("SEM BOT VINCULADO")
      else if (!bot) problemas.push("BOT NAO EXISTE")
      else if (!bot.token) problemas.push("BOT SEM TOKEN")
      if (!downsell?.enabled) problemas.push("DOWNSELL DESATIVADO")
      if (!downsell?.sequences?.length) problemas.push("SEM SEQUENCIAS")

      // Sequencias
      const seqs = []
      for (const seq of downsell?.sequences || []) {
        let delayMin = seq.sendDelayValue || 1
        if (seq.sendDelayUnit === "hours") delayMin *= 60
        if (seq.sendDelayUnit === "days") delayMin *= 1440

        const envioEm = new Date(agora.getTime() + delayMin * 60000)

        seqs.push({
          id: seq.id,
          msg: seq.message?.substring(0, 50) || "(vazio)",
          delay: `${seq.sendDelayValue || 1} ${seq.sendDelayUnit || "min"}`,
          delay_minutos: delayMin,
          enviaria_em: envioEm.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }),
          tem_midia: (seq.medias?.length || 0) > 0,
          planos: seq.plans?.length || 0
        })
      }

      analise.push({
        fluxo: flow.name,
        fluxo_id: flow.id,
        status: flow.status,
        bot: bot?.name || "NENHUM",
        bot_id: flow.bot_id,
        downsell_on: downsell?.enabled || false,
        sequencias: seqs.length,
        detalhe_sequencias: seqs,
        problemas,
        ok: problemas.length === 0
      })
    }

    // Separar
    const funcionando = analise.filter(a => a.ok)
    const comProblema = analise.filter(a => !a.ok)

    return NextResponse.json({
      hora: agora.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }),
      
      resumo: {
        bots: bots?.length || 0,
        fluxos: flows?.length || 0,
        funcionando: funcionando.length,
        com_problema: comProblema.length,
        msgs_pendentes: pendentes?.length || 0
      },

      bots: bots?.map(b => ({ 
        id: b.id, 
        nome: b.name, 
        token: b.token ? "OK" : "FALTA" 
      })),

      funcionando,
      com_problema: comProblema,

      msgs_pendentes: pendentes?.map(p => ({
        id: p.id,
        user: p.telegram_user_id,
        enviar_em: new Date(p.scheduled_for).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }),
        passou: new Date(p.scheduled_for) < agora
      }))
    })

  } catch (err) {
    return NextResponse.json({ 
      erro: err instanceof Error ? err.message : "Erro" 
    }, { status: 500 })
  }
}
