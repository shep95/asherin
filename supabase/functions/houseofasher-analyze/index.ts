// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { getCorsHeaders } from "../_shared/cors.ts";

// Forward list lives in HOA_FORWARD_EMAILS (comma-separated). Never inline —
// these are real inboxes and this file is committed.
const FORWARD_EMAILS = (Deno.env.get('HOA_FORWARD_EMAILS') || '')
  .split(',')
  .map((e) => e.trim())
  .filter(Boolean)

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')!

const SYSTEM_PROMPT = `You are ZOPHIEL, the venture analysis core of HouseOfAsher. Apply the Aureon multi-phase workflow (Ingestion → Entity Resolution → Linguistic/Psychological Forensics → Financial Thermodynamics → Market & Product Physics → Team Avatar Theory → Predictive Trajectory → Recommendation).

You MUST return STRICT JSON only — no prose, no markdown fences. Schema:
{
  "executive_summary": string (<=400 chars),
  "composite_score": number 0-100,
  "success_probability": number 0-100,
  "deception_probability": number 0-100,
  "financial_entropy": number 0-100,
  "innovation_index": number 0-100,
  "execution_confidence": number 0-100,
  "strengths": string[] (3-5 items, quantified where possible),
  "weaknesses": string[] (3-5 items),
  "red_flags": string[] (0-5 items — fraud signals, vague answers, AI-generated boilerplate, unsubstantiated claims, future-tense hedging),
  "decision": "advance" | "reject",
  "recommendation": "Strong Buy" | "Buy" | "Monitor" | "Pass",
  "rejection_reason": string (only if decision == reject, <=600 chars, blunt and specific)
}

DECISION RULES:
- decision = "advance" ONLY if composite_score >= 70 AND success_probability >= 60 AND deception_probability <= 25 AND red_flags.length <= 1.
- Otherwise decision = "reject".
- Vague language, marketing rhetoric, missing quantification → drive composite_score down and red_flags up.
- Be unforgiving. The bar is investor-grade.`

async function analyzeWithGemini(payload: Record<string, any>) {
  const body = {
    systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents: [{ role: 'user', parts: [{ text: 'APPLICATION:\n' + JSON.stringify(payload, null, 2) }] }],
    generationConfig: { responseMimeType: 'application/json', temperature: 0.2 },
  }
  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${GEMINI_API_KEY}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
  )
  if (!r.ok) throw new Error(`Gemini ${r.status}: ${await r.text()}`)
  const j = await r.json()
  const text = j?.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}'
  return JSON.parse(text)
}

async function sendEmail(supabase: any, templateName: string, recipientEmail: string, templateData: any, idempotencyKey: string) {
  try {
    const { error } = await supabase.functions.invoke('send-transactional-email', {
      body: { templateName, recipientEmail, templateData, idempotencyKey },
    })
    if (error) console.error('email error:', recipientEmail, error)
  } catch (e) {
    console.error('email exception:', recipientEmail, e)
  }
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const body = await req.json()
    const { companyName, founderName, founderEmail, website, answers } = body
    if (!companyName || !founderName || !founderEmail || !answers) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE)

    // 1. persist initial record
    const { data: row, error: insErr } = await supabase
      .from('houseofasher_applications')
      .insert({
        company_name: companyName,
        founder_name: founderName,
        founder_email: founderEmail,
        website: website || null,
        answers,
        status: 'analyzing',
      })
      .select('id')
      .single()
    if (insErr) throw insErr

    // 2. Aureon analysis
    let analysis: any
    try {
      analysis = await analyzeWithGemini({ companyName, founderName, founderEmail, website, answers })
    } catch (e) {
      await supabase.from('houseofasher_applications').update({ status: 'error', rejection_reason: String(e) }).eq('id', row.id)
      throw e
    }

    const approved = analysis.decision === 'advance'

    // 3. persist analysis
    await supabase.from('houseofasher_applications').update({
      status: approved ? 'approved' : 'rejected',
      decision: analysis.decision,
      composite_score: analysis.composite_score,
      success_probability: analysis.success_probability,
      analysis,
      rejection_reason: approved ? null : (analysis.rejection_reason || null),
    }).eq('id', row.id)

    // 4. notify applicant
    await sendEmail(supabase, 'vc-application-decision', founderEmail, {
      founderName, companyName, approved,
      rationale: approved ? null : (analysis.rejection_reason || analysis.executive_summary),
    }, `hoa-decision-${row.id}`)

    // 5. if approved → forward Senate briefing to all admin emails
    if (approved) {
      const forwardData = {
        companyName, founderName, founderEmail, website,
        compositeScore: analysis.composite_score,
        successProbability: analysis.success_probability,
        executiveSummary: analysis.executive_summary,
        strengths: analysis.strengths || [],
        weaknesses: analysis.weaknesses || [],
        redFlags: analysis.red_flags || [],
        recommendation: analysis.recommendation,
        applicationId: row.id,
        fullAnswers: answers,
      }
      await Promise.all(FORWARD_EMAILS.map((email) =>
        sendEmail(supabase, 'vc-application-forward', email, forwardData, `hoa-forward-${row.id}-${email}`),
      ))
    }

    return new Response(JSON.stringify({
      applicationId: row.id,
      approved,
      compositeScore: analysis.composite_score,
      successProbability: analysis.success_probability,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (e) {
    console.error('houseofasher-analyze error:', e)
    return new Response(JSON.stringify({ error: String(e?.message || e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
