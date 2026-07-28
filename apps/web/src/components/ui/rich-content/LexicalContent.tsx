'use client'

import '@haklex/rich-kit-shiro/style.css'

import type {
  EnhancedLinkCardProps,
  LinkCardFetchContext,
  PresentDialogFn,
  RendererConfig,
  RichEditorVariant,
} from '@haklex/rich-kit-shiro'
import {
  createMxSpacePlugin,
  createThemeStyle,
  LinkCardFetchProvider,
  LinkCardRenderer,
  PresentDialogProvider,
} from '@haklex/rich-kit-shiro'
import { ShiroRenderer } from '@haklex/rich-kit-shiro/renderer'
import clsx from 'clsx'
import type { SerializedEditorState } from 'lexical'
import { useCallback, useMemo } from 'react'

import { getWebUrl } from '~/atoms'
import { useModalStack } from '~/components/ui/modal/stacked/provider'
import { API_URL } from '~/constants/env'
import { useIsDark } from '~/hooks/common/use-is-dark'
import { fetchGitHubApi } from '~/lib/github'

const fallbackSansFont =
  "var(--app-font-sans, system-ui), -apple-system, 'PingFang SC', 'Microsoft YaHei', 'Segoe UI', Roboto, Helvetica, 'noto sans sc', 'hiragino sans gb', sans-serif, Apple Color Emoji, Segoe UI Emoji, Not Color Emoji"
const fallbackSerifFont =
  "'Noto Serif CJK SC', 'Noto Serif SC', var(--app-font-serif, 'Source Han Serif SC'), 'Source Han Serif SC', 'Source Han Serif', source-han-serif-sc, SongTi SC, SimSum, 'Hiragino Sans GB', system-ui, -apple-system, Segoe UI, Roboto, Helvetica, 'Microsoft YaHei', 'WenQuanYi Micro Hei', sans-serif"
const fallbackMonoFont =
  "'OperatorMonoSSmLig Nerd Font', 'Cascadia Code PL', 'FantasqueSansMono Nerd Font', 'operator mono', JetBrainsMono, 'Fira code Retina', 'Fira code', Consolas, Monaco, 'Hannotate SC', monospace, -apple-system"

const linkCardFetchContext: LinkCardFetchContext = {
  adapters: {
    github: {
      request: fetchGitHubApi,
    },
    tmdb: {
      request: async (url) => {
        const u = new URL(url)
        const path = u.pathname.replace(/^\/3\//, '')
        const r = await fetch(`/api/tmdb/${path}${u.search}`)
        return await r.json()
      },
    },
    bangumi: {
      request: async (url) => {
        const u = new URL(url)
        const path = u.pathname.replace(/^\/v0\//, '')
        const r = await fetch(`/api/bangumi/${path}`)
        return await r.json()
      },
    },
    leetcode: {
      request: async (_url, init) => {
        const r = await fetch('/api/leetcode', init)
        return await r.json()
      },
    },
    'netease-music': {
      request: async (url) => {
        const songId = new URL(url).pathname.split('/').pop()
        const r = await fetch('/api/music/netease', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ songId }),
        })
        return await r.json()
      },
    },
    'qq-music': {
      request: async (url) => {
        const songId = new URL(url).pathname.split('/').pop()
        const r = await fetch('/api/music/tencent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ songId }),
        })
        return await r.json()
      },
    },
    'mx-space': {
      request: async (path) => {
        const apiBase = API_URL.replace(/\/$/, '')
        const normalizedPath = path.replace(/^\/+/, '')
        const r = await fetch(`${apiBase}/${normalizedPath}`)
        return await r.json()
      },
    },
  },
}

function LinkCardWithMxSpace(props: EnhancedLinkCardProps) {
  const webUrl = getWebUrl()
  const plugins = useMemo(() => {
    if (!webUrl) return
    return [createMxSpacePlugin({ webUrl })]
  }, [webUrl])
  return <LinkCardRenderer {...props} plugins={plugins} />
}

const customRendererConfig: Partial<RendererConfig> = {
  LinkCard: LinkCardWithMxSpace,
}

export interface LexicalContentProps {
  className?: string
  content: string
  variant?: RichEditorVariant
}

export function LexicalContent({
  content,
  variant,
  className,
}: LexicalContentProps) {
  const isDark = useIsDark()
  const { present } = useModalStack()
  const presentDialog = useCallback<PresentDialogFn>(
    (content, options) => {
      present({
        content,
        title: options?.title,
        clickOutsideToDismiss: true,
      })
    },
    [present],
  )
  const parsedContent = useMemo(
    () => JSON.parse(content) as SerializedEditorState,
    [content],
  )

  const themeStyle = useMemo(
    () =>
      createThemeStyle({
        fonts: {
          sans: fallbackSansFont,
          serif: fallbackSerifFont,
          mono: fallbackMonoFont,
        },
      }),
    [],
  )

  return (
    <PresentDialogProvider value={presentDialog}>
      <LinkCardFetchProvider value={linkCardFetchContext}>
        <div className={clsx(className, themeStyle.className)}>
          <ShiroRenderer
            editorState={parsedContent}
            variant={variant}
            theme={isDark ? 'dark' : 'light'}
            config={customRendererConfig}
          />
        </div>
      </LinkCardFetchProvider>
    </PresentDialogProvider>
  )
}
