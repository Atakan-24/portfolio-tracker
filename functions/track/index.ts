import { createClient } from 'npm:@supabase/supabase-js@2'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function clip(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  return trimmed.slice(0, max)
}

async function lookupGeo(ip: string | null): Promise<{ country: string | null; region: string | null }> {
  if (!ip || ip === '127.0.0.1') return { country: null, region: null }
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 1500)
    const res = await fetch(
      `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,countryCode,regionName`,
      { signal: controller.signal }
    )
    clearTimeout(timeout)
    if (!res.ok) return { country: null, region: null }
    const data = await res.json()
    if (data.status !== 'success') return { country: null, region: null }
    return { country: data.countryCode ?? null, region: data.regionName ?? null }
  } catch {
    return { country: null, region: null }
  }
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
    return new Response('bad json', { status: 400, headers: CORS_HEADERS })
  }

  const eventType = payload.type === 'click' ? 'click' : payload.type === 'pageview' ? 'pageview' : null
  if (!eventType) {
    return new Response('bad event_type', { status: 400, headers: CORS_HEADERS })
  }

  const path = clip(payload.path, 300)
  const referrer = clip(payload.referrer, 500)
  const clickTarget = eventType === 'click' ? clip(payload.target, 500) : null

  // IP wird nur transient fuer die Geo-Abfrage benutzt, nie gespeichert.
  const forwardedFor = req.headers.get('x-forwarded-for')
  const ip = forwardedFor ? forwardedFor.split(',')[0].trim() : null
  const { country, region } = await lookupGeo(ip)

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const { error } = await supabase.from('portfolio_visits').insert({
    event_type: eventType,
    path,
    referrer,
    click_target: clickTarget,
    country,
    region,
  })

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  }

  return new Response(null, { status: 204, headers: CORS_HEADERS })
})
