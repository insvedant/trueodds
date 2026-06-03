// Geo-redirect: detects user country and redirects to correct domain
// CA site (trueodds.ca) redirects US visitors to trueodds.us
// US site (trueodds.us) redirects CA visitors to trueodds.ca

const CA_DOMAIN = 'https://trueodds.ca'
const US_DOMAIN = 'https://trueodds.us'
const STORAGE_KEY = 'to_geo_dismissed'
const CACHE_KEY   = 'to_geo_country'
const CACHE_TTL   = 1000 * 60 * 60 * 24 // 24 hours

export async function detectAndRedirect(): Promise<void> {
  if (typeof window === 'undefined') return

  const hostname = window.location.hostname
  const isUSDomain = hostname.includes('trueodds.us')
  const isCADomain = hostname.includes('trueodds.ca')

  // Only run on production domains
  if (!isUSDomain && !isCADomain) return

  // Don't redirect if user already dismissed or came back intentionally
  const dismissed = sessionStorage.getItem(STORAGE_KEY)
  if (dismissed) return

  // Use cached country if available and fresh
  let country: string | null = null
  try {
    const cached = localStorage.getItem(CACHE_KEY)
    if (cached) {
      const { code, ts } = JSON.parse(cached)
      if (Date.now() - ts < CACHE_TTL) country = code
    }
  } catch {}

  // Fetch country if not cached
  if (!country) {
    try {
      // Use Cloudflare's free geo endpoint first (fast, no rate limit)
      const r = await fetch('https://cloudflare.com/cdn-cgi/trace', { signal: AbortSignal.timeout(3000) })
      const text = await r.text()
      const match = text.match(/loc=([A-Z]{2})/)
      country = match?.[1] || null
    } catch {}

    // Fallback to ipapi.co
    if (!country) {
      try {
        const r = await fetch('https://ipapi.co/country/', { signal: AbortSignal.timeout(3000) })
        country = (await r.text()).trim().toUpperCase()
      } catch {}
    }

    // Cache the result
    if (country) {
      try { localStorage.setItem(CACHE_KEY, JSON.stringify({ code: country, ts: Date.now() })) } catch {}
    }
  }

  if (!country) return

  // Redirect logic
  if (isCADomain && country === 'US') {
    window.location.href = `${US_DOMAIN}?ref=geo`
  } else if (isUSDomain && country !== 'US') {
    window.location.href = `${CA_DOMAIN}?ref=geo`
  }
}

// Call this to mark user as intentionally staying (e.g. they clicked "stay on CA site")
export function dismissRedirect(): void {
  try { sessionStorage.setItem(STORAGE_KEY, '1') } catch {}
}

// Clear cached country (e.g. for testing)
export function clearGeoCache(): void {
  try { localStorage.removeItem(CACHE_KEY); sessionStorage.removeItem(STORAGE_KEY) } catch {}
}
