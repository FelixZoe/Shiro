import type { AggregateRoot } from '@mx-space/api-client'

import { defaultThemeConfig } from '~/app.default.theme-config'
import { appStaticConfig } from '~/app.static.config'
import { attachServerFetch } from '~/lib/attach-fetch'
import { deepMerge } from '~/lib/lodash'
import { getQueryClient } from '~/lib/query-client.server'
import { apiClient } from '~/lib/request'

const cacheTime = appStaticConfig.cache.enabled
  ? appStaticConfig.cache.ttl.aggregation
  : 1

export const fetchAggregationData = async () => {
  await attachServerFetch()
  const queryClient = getQueryClient()
  const fetcher = async () => {
    const [aggregateResponse, pageResponse] = await Promise.all([
      apiClient.aggregate.getAggregateData('shiro'),
      apiClient.page.getList(1, 100, {
        sortBy: 'order',
        sortOrder: 1,
      }),
    ])

    const data = (aggregateResponse.$serialized ?? aggregateResponse) as
      | (AggregateRoot & { theme?: AppThemeConfig })
      | undefined
    const pages = pageResponse?.data ?? []

    return {
      ...data,
      // Core 11+ removed pageMeta from /aggregate; rebuild the small
      // navigation projection from the canonical page list endpoint.
      pageMeta: pages.map((page: any) => ({
        id: page.id,
        title: page.title,
        slug: page.slug,
        subtitle: page.subtitle,
      })),
      theme: data?.theme
        ? deepMerge(defaultThemeConfig, data.theme)
        : defaultThemeConfig,
    }
  }

  return queryClient.fetchQuery({
    queryKey: ['aggregate', 'shiro'],
    queryFn: fetcher,
    staleTime: cacheTime,
    gcTime: cacheTime,
  })
}
