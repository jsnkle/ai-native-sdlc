import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Tasks } from '../types'

const tasks = atom({ plugin: 'tasks-band', key: 'tasks' } as const, null)

const ITEM = /^\s*(?:[-*+]|\d+[.)])\s+\[([ xX])\](?:\s+(.*))?$/
const BAR_MAX = 10

export const register: Register = (on, options) => {
  const file = String(options.file || 'TASKS.md')

  on('session.start', async ($, e, next) => {
    await refresh($, file)

    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const result = await next(e)

    if (!e.agentId) {
      await refresh($, file)
    }

    return result
  })

  on('tool.call', { tool: /^(Edit|Write)$/ }, async ($, e, next) => {
    const result = await next(e)
    const target = 'file_path' in e ? e.file_path : ''
    const path = String(target).replace(/\\/g, '/')

    if (result.deny === undefined && (path === file || path.endsWith('/' + file))) {
      await refresh($, file)
    }

    return result
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const counts = await read($, tasks)

    if (e.props.hasSurvey || counts === null) {
      return next(e)
    }

    const { Box, Text } = $.ui.resolve(e)
    const { done, total } = counts
    const width = Math.min(total, BAR_MAX)
    let filled = Math.round((done / total) * width)
    // Never draw 1/100 as empty or 99/100 as full.
    if (done > 0) filled = Math.max(1, filled)
    if (done < total) filled = Math.min(width - 1, filled)
    const head = `TASKS ${done}/${total} `
    const lead = '  next: '
    // One column of padding each side, so the budget is two less than the band.
    const room = e.props.bodyColumns - 2 - head.length - width - lead.length
    const shown = counts.next === null || room < 2 ? '' : truncate(counts.next, room)

    return (
      <Box paddingX={1}>
        <Text bold>{head}</Text>
        <Text color="success">{'▓'.repeat(filled)}</Text>
        <Text dimColor>{'░'.repeat(width - filled)}</Text>
        {shown !== '' && (
          <Text dimColor wrap="truncate-end">
            {lead + shown}
          </Text>
        )}
      </Box>
    )
  })
}

async function refresh($: EngineInterface, file: string) {
  let text = ''

  try {
    text = await $.fs.read(file)
  } catch {
    // No file: the band draws nothing.
  }

  let done = 0
  let total = 0
  let next: string | null = null

  for (const line of text.split(/\r?\n/)) {
    const item = ITEM.exec(line)

    if (item === null) continue

    total += 1

    if (item[1] === ' ') {
      const label = clean(item[2] ?? '')
      if (label !== '') next ??= label
    } else {
      done += 1
    }
  }

  const value: Tasks | null = total === 0 ? null : { done, total, next }
  await update($, tasks, () => value)
}

// Plain, single-line text: markdown marks and control characters would
// otherwise be drawn as written (or refused by the engine).
function clean(text: string) {
  return text
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/`|\*\*|~~/g, '')
    .replace(/[\u0000-\u001f\u007f-\u009f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// Cut by code point, so a surrogate pair is never split.
function truncate(text: string, room: number) {
  const chars = [...text]

  return chars.length > room ? chars.slice(0, room - 1).join('') + '…' : text
}
