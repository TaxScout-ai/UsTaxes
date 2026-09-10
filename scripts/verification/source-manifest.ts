import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'

export function sourceManifest() {
  const names = execFileSync(
    'git',
    [
      'ls-files',
      '--cached',
      '--others',
      '--exclude-standard',
      '-z',
      '--',
      'src',
      'server',
      'scripts/verification',
      'public/forms/Y2025',
      'package.json',
      'package-lock.json',
      'tsconfig.json',
      'tsconfig.server.json'
    ],
    { encoding: 'utf8' }
  )
    .split('\0')
    .filter(Boolean)
  for (const path of [
    'src/core/data/validate-fns.js',
    'src/core/data/validate-fns.d.ts'
  ])
    if (existsSync(path)) names.push(path)
  const files = [...new Set(names)]
    .sort()
    .filter(existsSync)
    .map((path) => ({
      path,
      sha256: createHash('sha256').update(readFileSync(path)).digest('hex')
    }))
  return {
    head: execFileSync('git', ['rev-parse', 'HEAD'], {
      encoding: 'utf8'
    }).trim(),
    treeSha256: createHash('sha256')
      .update(JSON.stringify(files))
      .digest('hex'),
    node: process.version,
    files
  }
}
