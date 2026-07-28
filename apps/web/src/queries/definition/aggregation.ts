import type { AggregateRoot } from '@mx-space/api-client'
import { isServer } from '@tanstack/react-query'

import { apiClient } from '~/lib/request'

import { defineQuery } from '../helper'

export const aggregation = {
  root: () =>
    defineQuery({
      queryKey: ['aggregation'],
      queryFn: async () => {
        const [aggregateResponse, pageResponse] = await Promise.all([
          apiClient.aggregate.getAggregateData('shiro'),
          apiClient.page.getList(1, 100, {
            sortBy: 'order',
            sortOrder: 1,
          }),
        ])
        const data = aggregateResponse.$serialized ?? aggregateResponse

        return {
          ...(data as AggregateRoot & { theme: AppThemeConfig }),
          pageMeta: (pageResponse?.data ?? []).map((page: any) => ({
            id: page.id,
            title: page.title,
            slug: page.slug,
            subtitle: page.subtitle,
          })),
        }
      },
      gcTime: 1000 * 60 * 10,
      staleTime: isServer ? 1000 * 60 * 10 : undefined,
    }),
}
