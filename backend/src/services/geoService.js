// Resolves a public IP address to city/region/country using ip-api.com (free, no key, ~45 req/min).
// Never throws — always resolves to a safe fallback object so it can't break signup/subscribe flows.

const PRIVATE_IP_PATTERNS = [
  /^127\./, /^10\./, /^192\.168\./, /^172\.(1[6-9]|2\d|3[0-1])\./, /^::1$/, /^::ffff:127\./,
]

function isPrivateIp(ip) {
  if (!ip) return true
  return PRIVATE_IP_PATTERNS.some(re => re.test(ip))
}

async function getLocationFromIp(rawIp) {
  const fallback = { ip: rawIp || null, city: null, region: null, country: null, timezone: null }

  // Strip the ::ffff: prefix Node sometimes adds for IPv4-mapped addresses
  const ip = rawIp?.replace(/^::ffff:/, '')

  if (isPrivateIp(ip)) {
    return { ...fallback, ip, city: 'Local/Private', country: null }
  }

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 3000)

    const res = await fetch(
      `http://ip-api.com/json/${ip}?fields=status,message,city,regionName,country,countryCode,timezone`,
      { signal: controller.signal }
    )
    clearTimeout(timeout)

    if (!res.ok) return fallback
    const data = await res.json()
    if (data.status !== 'success') return fallback

    return {
      ip,
      city:    data.city || null,
      region:  data.regionName || null,
      country: data.country || null,
      countryCode: data.countryCode || null,
      timezone: data.timezone || null,
    }
  } catch (err) {
    console.warn('[Geo] Lookup failed:', err.message)
    return fallback
  }
}

module.exports = { getLocationFromIp, isPrivateIp }
