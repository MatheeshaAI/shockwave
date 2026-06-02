/**
 * Mention icon resolution.
 *
 * Bridges `MentionIconKey` (a portable string) to the actual React component
 * exported by `./Icons.jsx`. The mention system never imports icon components
 * directly — it goes through `iconForKey` so a new icon kind only needs to
 * land here, not at every call site.
 *
 * `iconKeyForBasename` is the inverse for the file domain: given a file
 * basename, pick the right key based on extension (case-insensitive) and
 * extensionless-name allowlist. Anything we don't recognize falls back to
 * `'file'`.
 */

import type { ComponentType } from 'react'
import { CodeIcon, FileTextIcon, FolderIcon, PageIcon } from './Icons.jsx'
import type { MentionIconKey } from './mentions.js'

export function iconForKey(key: MentionIconKey): ComponentType<{ size?: number }> {
  switch (key) {
    case 'folder':
      return FolderIcon
    case 'code':
    case 'ts':
    case 'tsx':
    case 'js':
    case 'jsx':
    case 'json':
    case 'yaml':
    case 'css':
    case 'html':
    case 'python':
    case 'rust':
    case 'go':
    case 'shell':
      return CodeIcon
    case 'image':
      return PageIcon
    case 'file':
    case 'markdown':
    case 'lock':
    case 'globe':
    case 'chat':
    case 'docs':
    default:
      return FileTextIcon
  }
}

const EXTENSION_KEYS: Record<string, MentionIconKey> = {
  md: 'markdown',
  markdown: 'markdown',
  ts: 'ts',
  tsx: 'tsx',
  js: 'js',
  mjs: 'js',
  cjs: 'js',
  jsx: 'jsx',
  json: 'json',
  jsonc: 'json',
  yaml: 'yaml',
  yml: 'yaml',
  toml: 'yaml',
  css: 'css',
  scss: 'css',
  sass: 'css',
  less: 'css',
  html: 'html',
  htm: 'html',
  xml: 'html',
  svg: 'html',
  py: 'python',
  rs: 'rust',
  go: 'go',
  sh: 'shell',
  bash: 'shell',
  zsh: 'shell',
  fish: 'shell',
  ps1: 'shell',
  png: 'image',
  jpg: 'image',
  jpeg: 'image',
  gif: 'image',
  webp: 'image',
  lock: 'lock',
  gitignore: 'lock',
  env: 'lock',
  gitattributes: 'lock',
  dockerfile: 'lock',
}

const EXTENSIONLESS_KEYS = new Set<string>([
  'Makefile',
  'Dockerfile',
  'README',
  'LICENSE',
  'NOTICE',
  'CHANGELOG',
  'CODEOWNERS',
  'Gemfile',
  'Rakefile',
  'Procfile',
])

function extensionOf(name: string): string {
  if (name.startsWith('.')) {
    const rest = name.slice(1)
    const dot = rest.indexOf('.')
    if (dot < 0) return rest.toLowerCase()
    return rest.slice(dot + 1).toLowerCase()
  }
  const dot = name.lastIndexOf('.')
  if (dot <= 0) return ''
  return name.slice(dot + 1).toLowerCase()
}

export function iconKeyForBasename(name: string): MentionIconKey {
  const ext = extensionOf(name)
  if (ext && EXTENSION_KEYS[ext]) return EXTENSION_KEYS[ext]
  if (EXTENSIONLESS_KEYS.has(name)) return 'code'
  return 'file'
}
