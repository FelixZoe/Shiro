import legacyCreateClient, {
  allControllers as legacyControllers,
} from '@mx-space/api-client'
import type { IRequestAdapter } from '@mx-space/api-client-v5'
import { allControllers } from '@mx-space/api-client-v5'
import { createLegacyApiClient } from '@mx-space/api-client-v5/legacy'
import type { $fetch } from 'ofetch'

import { API_URL } from '~/constants/env'

type FetchType = typeof $fetch
export const createFetchAdapter = (
  $fetch: FetchType,
): IRequestAdapter<typeof $fetch> => ({
  default: $fetch,
  get(url: string, options) {
    const { params, ...rest } = options || {}
    return $fetch(url, {
      ...rest,
      method: 'GET',
      query: params,
    })
  },
  post(url: string, options) {
    const { params, data, ...rest } = options || {}
    return $fetch(url, {
      ...rest,
      method: 'post',
      query: params,
      body: data,
    })
  },
  put(url: string, options) {
    const { params, data, ...rest } = options || {}
    return $fetch(url, {
      ...rest,
      method: 'put',
      query: params,
      body: data,
    })
  },
  patch(url: string, options) {
    const { params, data, ...rest } = options || {}
    return $fetch(url, {
      ...rest,
      method: 'patch',
      query: params,
      body: data,
    })
  },
  delete(url: string, options) {
    const { params, data, ...rest } = options || {}
    return $fetch(url, {
      ...rest,
      method: 'delete',
      query: params,
      body: data,
    })
  },
})

// This factory is used only to preserve Shiro's original v2 controller types.
// The exported client below is a v5 instance at runtime.
const createLegacyTypedClient = (
  fetchAdapter: ReturnType<typeof createFetchAdapter>,
) =>
  legacyCreateClient(fetchAdapter as any)(API_URL, {
    controllers: legacyControllers,
    getDataFromResponse(response) {
      return response as any
    },
  })

type ShiroApiClient = ReturnType<typeof createLegacyTypedClient>

const normalizeLegacyFields = (value: any): any => {
  if (Array.isArray(value)) return value.map(normalizeLegacyFields)
  if (!value || typeof value !== 'object') return value

  const next = Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      normalizeLegacyFields(item),
    ]),
  ) as Record<string, any>

  if (next.created === undefined && next.createdAt !== undefined) {
    next.created = next.createdAt
  }
  if (next.modified === undefined && next.modifiedAt !== undefined) {
    next.modified = next.modifiedAt
  }
  if (
    next.count === undefined &&
    (next.readCount !== undefined || next.likeCount !== undefined)
  ) {
    next.count = {
      read: next.readCount ?? 0,
      like: next.likeCount ?? 0,
    }
  }
  // Core 13 removed the per-document switch. Global comment settings remain
  // authoritative, while legacy Shiro expects this field on content models.
  if (
    next.allowComment === undefined &&
    typeof next.id === 'string' &&
    (typeof next.text === 'string' || typeof next.content === 'string')
  ) {
    next.allowComment = true
  }

  return next
}

const shiroCompatibilityAdapter = {
  transformData(data: any) {
    return normalizeLegacyFields(data)
  },
}

export const createApiClient = (
  fetchAdapter: ReturnType<typeof createFetchAdapter>,
): ShiroApiClient =>
  createLegacyApiClient(fetchAdapter)(API_URL, {
    controllers: allControllers,
    responseAdapter: shiroCompatibilityAdapter,
  }) as unknown as ShiroApiClient
