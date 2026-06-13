import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'

function readText(filePath) {
  return readFileSync(filePath, 'utf8').trim()
}

function getGitDir() {
  const gitPath = path.join(process.cwd(), '.git')
  if (statSync(gitPath).isDirectory()) {
    return gitPath
  }

  const gitFile = readText(gitPath)

  if (gitFile.startsWith('gitdir:')) {
    return path.resolve(process.cwd(), gitFile.replace('gitdir:', '').trim())
  }

  return gitPath
}

function getGitHash() {
  const gitDir = getGitDir()
  const head = readText(path.join(gitDir, 'HEAD'))

  if (!head.startsWith('ref:')) {
    return head.slice(0, 7)
  }

  const ref = head.replace('ref:', '').trim()
  const refPath = path.join(gitDir, ref)

  try {
    return readText(refPath).slice(0, 7)
  } catch {
    const packedRefs = readText(path.join(gitDir, 'packed-refs'))
    const packedRef = packedRefs
      .split('\n')
      .find((line) => line.endsWith(` ${ref}`))

    return packedRef?.split(' ')[0].slice(0, 7)
  }
}

function getBuildVersion() {
  if (process.env.VITE_BUILD_VERSION) {
    return process.env.VITE_BUILD_VERSION
  }

  try {
    return getGitHash()
  } catch {
    return undefined
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    __APP_BUILD_VERSION__: JSON.stringify(getBuildVersion() ?? ''),
  },
})
