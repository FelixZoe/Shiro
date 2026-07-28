import { API_URL, GATEWAY_URL } from '~/constants/env'

export const dynamic = 'force-dynamic'
export const revalidate = 3600

function resolveCoreRoot() {
  if (/^https?:\/\//.test(API_URL)) {
    return API_URL.replace(/\/api\/v3\/?$/, '').replace(/\/$/, '')
  }
  if (/^https?:\/\//.test(GATEWAY_URL)) {
    return GATEWAY_URL.replace(/\/$/, '')
  }
  return 'http://localhost:2333'
}

export async function GET() {
  const response = await fetch(`${resolveCoreRoot()}/sitemap`, {
    next: { revalidate },
  })

  if (!response.ok) {
    return new Response(`Core request failed: ${response.status}`, {
      status: 502,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
  }

  return new Response(await response.text(), {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': `max-age=60, s-maxage=${revalidate}`,
    },
  })
}
