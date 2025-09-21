#!/usr/bin/env node
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { access } from 'node:fs/promises'
import { spawn } from 'node:child_process'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.join(__dirname, '..')
const publicDir = path.join(rootDir, 'public')
const svgPath = path.join(publicDir, 'localdoctools.svg')
const pngPath = path.join(publicDir, 'localdoctools.png')

async function main() {
  await ensureSvgExists()
  await ensureCliTools()
  await exportPng()
  await runIconGenie()
}

async function ensureSvgExists() {
  try {
    await access(svgPath)
  } catch (error) {
    console.error(`Base SVG not found at ${path.relative(rootDir, svgPath)}`)
    throw error
  }
}

async function ensureCliTools() {
  await ensureCli('rsvg-convert', ['--version'], 'librsvg (rsvg-convert)')
  await ensureCli('icongenie', ['--version'], 'Quasar IconGenie CLI')
}

async function ensureCli(command, args, friendlyName) {
  try {
    await spawnAsync(command, args, { stdio: 'ignore' })
  } catch (error) {
    console.error(
      `Required tool not found: ${friendlyName}. Ensure '${command}' is installed and on PATH.`
    )
    throw error
  }
}

async function exportPng() {
  console.log('• Converting SVG to PNG...')
  // Use rsvg-convert to render the SVG directly to a 1024x1024 PNG.
  // Note: rsvg-convert renders based on the SVG's viewBox. If the SVG is not square,
  // specify both width and height to target a 1024x1024 canvas. Force an opaque white background.
  await spawnAsync('rsvg-convert', [
    '-w',
    '1024',
    '-h',
    '1024',
    '--background-color=white',
    '-f',
    'png',
    '-o',
    pngPath,
    svgPath,
  ])
  console.log(`  → Wrote ${path.relative(rootDir, pngPath)}`)
}

async function runIconGenie() {
  console.log('• Running icongenie...')
  await spawnAsync('icongenie', ['generate', '-i', pngPath, '--skip-trim'])
}

function spawnAsync(command, args, extraOptions = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: rootDir,
      shell: false,
      stdio: 'inherit',
      ...extraOptions,
    })

    child.on('exit', (code) => {
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(`${command} ${args.join(' ')} exited with code ${code}`))
      }
    })

    child.on('error', (error) => {
      reject(error)
    })
  })
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
