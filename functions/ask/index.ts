import { createClient } from 'npm:@supabase/supabase-js@2'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const PRO_BESUCHER_TAG = 8
const GLOBAL_TAG = 150
const MAX_FRAGE_LAENGE = 500

const WISSEN = `
LANGUAGE RULE (most important, follow exactly): answer in the SAME language
the visitor's question is written in. A German question gets a German
answer, an English question gets an English answer. If the question's
language is unclear or mixed, default to English. Never mix two languages
in one answer.

FORMAT RULE: plain text only. No markdown -- no **bold**, no _italic_, no
backticks, no bullet-point dashes, no headings. Just plain sentences.

You answer questions from visitors of Atakan's portfolio site (a software
engineer focused on automation/AI systems). Answer ONLY based on the facts
below. If you don't know something for sure, honestly say so (in the
visitor's own language) and point them to the full CV/portfolio or to
contacting Atakan directly (see CONTACT below), instead of guessing or
making something up. Keep answers short (max 80 words).

ABOUT ATAKAN:
- Self-taught, ~3 years of serious hands-on coding. Before that, several
  years of e-commerce, affiliate marketing and YouTube -- that's still his
  financial base today, not a closed chapter.
- NO computer science degree, NO Fachinformatiker apprenticeship -- that
  route was considered but didn't become his path. Instead: self-directed
  learning by actually building, breaking, debugging and testing real
  systems. The open gap he's actively closing is external validation --
  clients, production use, references.
- Currently building: an AI-driven cold-calling platform (Next.js, Supabase,
  Telnyx Voice/WebRTC, LLM voice agents) for his own company Team Gold
  (teamgoldllc.de), plus the multi-agent automation layer that runs it.
- How he works: directs AI coding agents deliberately -- clear specs, hard
  guardrails, treats "it's done" as a claim to verify, not a fact.

PUBLIC PROJECTS (github.com/Atakan-24):
- git-secret-scan: a pre-commit hook + GitHub Action that stops API keys
  from reaching a commit. 98 tests, measured precision/recall improved from
  80% to 100% on a labelled benchmark.
- gh-radar: a daily digest of what actually needs attention on GitHub.
  Read-only by construction (the HTTP layer refuses every method but GET),
  58 tests.
- postgrest-keyset-page: cursor pagination for PostgREST-style APIs, fixing
  a real bug (offset pagination silently drops/duplicates rows under
  concurrent writes) -- the failure is reproduced live in the test suite.
- yt-transcript: YouTube transcripts with a four-tier fallback chain, routes
  around per-IP rate limits via an SSH relay, 40 tests.
- gitingest: flattens a whole repository into one searchable file, never
  just truncates, falls back to structure instead.
- fahm: an Arabic spaced-repetition app, live at fahm-web.vercel.app, 3177
  lines in a single HTML file, no framework, offline-capable (PWA).

BACKGROUND: Before focusing on engineering, several years running online
business (e-commerce, affiliate, YouTube) -- hence the commercial lens on
software (business impact, not just code). Started coding seriously around
age 20. Moved to Egypt at 22, shifted focus fully to software -- freelance
work first, then building the acquisition systems (cold calling, AI voice
calls, email/outreach) for Team Gold.

GOALS (next 12 months, see Goals document -- these are TARGETS for the next
12 months, NOT results already achieved; never phrase them as something
that has already happened): a 12-month experiment with a clear decision
rule at the end -- if it's working, scale it; if it's partly working,
adjust the offer/sales process; if it's not working, add an
employment/contract path. Success would mean 2-4 paying customers, 1-2
longer-term relationships, 2-3 solid case studies, references, a repeatable
income source alongside the existing affiliate business. Longer-term: study
Arabic and Islam more intensively once there's financial/professional
stability.

CONTACT: email atakanfisc@gmail.com, book a call at
cal.com/atakanoztunc/30min, WhatsApp at wa.me/201069564012, Telegram at
t.me/Akioatakan, business at teamgoldllc.de (web systems, automation for
other companies). When asked how to reach him, mention all of these
channels, not just email.

REMINDER: answer in the same language as the question above (German
question -> German answer, otherwise English), plain text, no markdown.
`

function clip(value: unknown, max: number): string {
  if (typeof value !== 'string') return ''
  return value.trim().slice(0, max)
}

function entmarkdown(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/__(.*?)__/g, '$1')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/^#+\s*/gm, '')
    .replace(/^[-*]\s+/gm, '')
}

async function hashIp(ip: string): Promise<string> {
  const data = new TextEncoder().encode(ip)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }
  if (req.method !== 'POST') {
    return new Response('method not allowed', { status: 405, headers: CORS_HEADERS })
  }

  let payload: Record<string, unknown> = {}
  try {
    const raw = await req.text()
    payload = raw ? JSON.parse(raw) : {}
  } catch {
    return new Response(JSON.stringify({ error: 'bad json' }), {
      status: 400,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  }

  const frage = clip(payload.question, MAX_FRAGE_LAENGE)
  if (!frage) {
    return new Response(JSON.stringify({ error: 'leere Frage' }), {
      status: 400,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  }

  const forwardedFor = req.headers.get('x-forwarded-for')
  const ip = forwardedFor ? forwardedFor.split(',')[0].trim() : 'unbekannt'
  const ipHash = await hashIp(ip)

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const heuteStart = new Date()
  heuteStart.setUTCHours(0, 0, 0, 0)
  const heuteIso = heuteStart.toISOString()

  const [{ count: proBesucherHeute }, { count: globalHeute }] = await Promise.all([
    supabase
      .from('portfolio_qa_log')
      .select('id', { count: 'exact', head: true })
      .eq('ip_hash', ipHash)
      .gte('created_at', heuteIso),
    supabase
      .from('portfolio_qa_log')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', heuteIso),
  ])

  const gedeckelt = (proBesucherHeute ?? 0) >= PRO_BESUCHER_TAG || (globalHeute ?? 0) >= GLOBAL_TAG

  if (gedeckelt) {
    await supabase.from('portfolio_qa_log').insert({
      ip_hash: ipHash,
      question: frage,
      answer: null,
      gedeckelt: true,
    })
    const grund =
      (proBesucherHeute ?? 0) >= PRO_BESUCHER_TAG
        ? "You've reached today's question limit for this visitor -- try again tomorrow, or email Atakan directly: atakanfisc@gmail.com"
        : "The chat has had a lot of questions today and is pausing until tomorrow -- email Atakan directly: atakanfisc@gmail.com"
    return new Response(JSON.stringify({ answer: grund, gedeckelt: true }), {
      status: 200,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  }

  let antwort = 'Something went wrong just now -- try again in a moment, or email atakanfisc@gmail.com.'
  try {
    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${Deno.env.get('GROQ_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'openai/gpt-oss-20b',
        reasoning_effort: 'low',
        max_tokens: 300,
        messages: [
          { role: 'system', content: WISSEN },
          { role: 'user', content: frage },
        ],
      }),
    })
    if (groqRes.ok) {
      const data = await groqRes.json()
      const inhalt = data?.choices?.[0]?.message?.content
      if (typeof inhalt === 'string' && inhalt.trim()) {
        antwort = entmarkdown(inhalt.trim())
      }
    }
  } catch {
    // antwort bleibt die Fallback-Meldung
  }

  await supabase.from('portfolio_qa_log').insert({
    ip_hash: ipHash,
    question: frage,
    answer: antwort,
    gedeckelt: false,
  })

  return new Response(JSON.stringify({ answer: antwort, gedeckelt: false }), {
    status: 200,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
})
