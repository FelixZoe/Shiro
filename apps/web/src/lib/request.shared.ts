import { RequestError } from '@mx-space/api-client-v5'
import type { FetchError } from 'ofetch'

export const getErrorMessageFromRequestError = (error: RequestError) => {
  if (!(error instanceof RequestError)) return (error as Error).message

  const fetchError = error.raw as FetchError
  const payload = fetchError.response?._data as
    | {
        error?: { message?: string | string[] }
        message?: string | string[]
      }
    | undefined
  const messagesOrMessage = payload?.error?.message ?? payload?.message
  const bizMessage =
    typeof messagesOrMessage === 'string'
      ? messagesOrMessage
      : Array.isArray(messagesOrMessage)
        ? messagesOrMessage[0]
        : undefined

  return bizMessage || error.message || fetchError.message
}
