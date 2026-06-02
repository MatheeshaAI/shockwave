/**
 * Mention dropdown position computation.
 *
 * `computeMentionPosition` is a pure function: given a target rect (the @
 * character's screen position), the desired panel size, and the viewport,
 * return the final `{ top, left, placement, fullyVisible }`.
 *
 * The placement heuristic is "try below first, fall back to above, and if
 * neither fits perfectly, pick whichever side has more room". We always
 * clamp to the viewport edges, so the returned coords are always safe to
 * paint at — `fullyVisible` reflects whether we hit a perfect fit without
 * having to clamp (false means the panel was forced against an edge).
 *
 * `useMentionPosition` wraps the function for React callers. It re-runs the
 * computation on every render, plus on window scroll/resize (rAF-throttled),
 * so the dropdown tracks the @ position smoothly even when the user scrolls
 * the chat while the picker is open.
 */

import { useEffect, useMemo, useState } from 'react'

export type Placement = 'below' | 'above'

export interface PositionResult {
  top: number
  left: number
  placement: Placement
  fullyVisible: boolean
}

const GAP = 6
const VIEWPORT_PAD = 8

export function computeMentionPosition(
  targetRect: { top: number; left: number; bottom: number; right: number; height: number },
  panelSize: { width: number; height: number },
  viewport: { width: number; height: number } = { width: window.innerWidth, height: window.innerHeight }
): PositionResult {
  const { width: vw, height: vh } = viewport
  const { width: pw, height: ph } = panelSize

  const belowTop = targetRect.bottom + GAP
  const belowFits = belowTop + ph <= vh - VIEWPORT_PAD

  const aboveTop = targetRect.top - GAP - ph
  const aboveFits = aboveTop >= VIEWPORT_PAD

  let top: number
  let placement: Placement
  let fullyVisible: boolean

  if (belowFits) {
    top = belowTop
    placement = 'below'
    fullyVisible = true
  } else if (aboveFits) {
    top = aboveTop
    placement = 'above'
    fullyVisible = true
  } else {
    const belowRoom = (vh - VIEWPORT_PAD) - belowTop
    const aboveRoom = targetRect.top - GAP - VIEWPORT_PAD
    if (belowRoom >= aboveRoom) {
      placement = 'below'
      top = Math.max(VIEWPORT_PAD, belowTop)
    } else {
      placement = 'above'
      top = Math.max(VIEWPORT_PAD, aboveTop)
    }
    fullyVisible = false
  }

  let left = targetRect.left
  if (left + pw > vw - VIEWPORT_PAD) left = vw - pw - VIEWPORT_PAD
  if (left < VIEWPORT_PAD) left = VIEWPORT_PAD

  return { top, left, placement, fullyVisible }
}

export function useMentionPosition(
  targetRect: { top: number; left: number; bottom: number; right: number; height: number } | null,
  panelSize: { width: number; height: number },
  deps: any[] = []
): PositionResult | null {
  const [, setTick] = useState(0)

  useEffect(() => {
    let raf = 0
    const schedule = () => {
      if (raf) cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => setTick((t) => t + 1))
    }
    window.addEventListener('scroll', schedule, true)
    window.addEventListener('resize', schedule)
    return () => {
      if (raf) cancelAnimationFrame(raf)
      window.removeEventListener('scroll', schedule, true)
      window.removeEventListener('resize', schedule)
    }
  }, [])

  const { width, height } = panelSize
  return useMemo(() => {
    if (!targetRect) return null
    return computeMentionPosition(targetRect, panelSize)
    // panelSize is a fresh object on most renders; destructure its scalars
    // into deps so the memo doesn't invalidate on identity churn.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetRect, width, height, ...deps])
}
