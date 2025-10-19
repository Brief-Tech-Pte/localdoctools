import express from 'express'
import { mkdir, writeFile } from 'fs/promises'
import { fileURLToPath } from 'url'
import path from 'path'
import process from 'process'
import { randomFillSync } from 'crypto'
import { PDFDocument, StandardFonts } from 'pdf-lib'
import { PNG } from 'pngjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, '..')
const tmpDir = path.join(projectRoot, 'tmp')
const pdfFilename = 'test-pdf.pdf'
const pdfPath = path.join(tmpDir, pdfFilename)
const pageCount = 100
const pageTargetSizeBytes = 500 * 1024 // 500 KiB

await ensureLargePdf(pdfPath, pageCount, pageTargetSizeBytes)

const app = express()
app.disable('x-powered-by')

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Methods', 'GET,HEAD,OPTIONS')
  res.header('Access-Control-Allow-Headers', 'Origin,Accept,Range,Content-Type,If-Range')
  res.header('Access-Control-Expose-Headers', 'Accept-Ranges, Content-Length, Content-Range')
  res.header('Accept-Ranges', 'bytes')
  if (req.method === 'OPTIONS') {
    res.sendStatus(204)
    return
  }
  next()
})

app.get('/healthz', (_req, res) => {
  res.json({ status: 'ok' })
})

app.use(
  express.static(tmpDir, {
    fallthrough: true,
    setHeaders(res, servedPath) {
      if (servedPath === pdfPath) {
        res.type('application/pdf')
      }
    },
  })
)

app.get('/', (_req, res) => {
  res.type('text/plain').send(
    [
      'Local Doc Tools PDF test server',
      `Serving synthetic PDF: http://localhost:${getPort()}/${pdfFilename}`,
      'Range requests are supported by Express static middleware.',
    ].join('\n')
  )
})

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' })
})

const port = getPort()
app.listen(port, () => {
  console.log(`PDF server listening on http://localhost:${port}/${pdfFilename}`)
})

function getPort() {
  const value = process.env.PDF_SERVER_PORT ?? '3100'
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 3100
}

async function ensureLargePdf(filePath, pages, perPageSize) {
  await mkdir(path.dirname(filePath), { recursive: true })
  console.log(`Generating synthetic PDF at ${filePath}…`)
  const pdfBytes = await buildLargePdf(pages, perPageSize)
  await writeFile(filePath, pdfBytes)
  console.log(`Generated PDF (${formatBytes(pdfBytes.length)})`)
}

async function buildLargePdf(pages, perPageSize) {
  const pdfDoc = await PDFDocument.create()
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const pageSize = [595, 842]

  for (let i = 0; i < pages; i += 1) {
    const page = pdfDoc.addPage(pageSize)
    const { height } = page.getSize()
    page.drawText('Local Doc Tools range test PDF', { x: 50, y: height - 80, size: 24, font })
    page.drawText(`Page ${i + 1} of ${pages}`, { x: 50, y: height - 120, size: 14, font })
    page.drawText('Generated for pdf.js range streaming tests.', { x: 50, y: height - 160, size: 12, font })

    const imageBytes = generateImageBytes(perPageSize)
    const image = await pdfDoc.embedPng(imageBytes)
    const maxWidth = pageSize[0] - 100
    const maxHeight = pageSize[1] - 220
    const scale = Math.min(maxWidth / image.width, maxHeight / image.height, 1)
    const imageWidth = image.width * scale
    const imageHeight = image.height * scale
    page.drawImage(image, {
      x: (pageSize[0] - imageWidth) / 2,
      y: 80,
      width: imageWidth,
      height: imageHeight,
    })
  }

  const pdfBytes = await pdfDoc.save({ useObjectStreams: false })
  return pdfBytes
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const value = bytes / 1024 ** exponent
  return `${value.toFixed(exponent === 0 ? 0 : 2)} ${units[exponent]}`
}

function generateImageBytes(targetSize) {
  let dimension = Math.max(128, Math.ceil(Math.sqrt(targetSize / 4)))
  dimension = Math.ceil(dimension / 16) * 16
  let attempt = 0
  let buffer = null
  while (attempt < 20) {
    const png = new PNG({ width: dimension, height: dimension })
    randomFillSync(png.data)
    buffer = PNG.sync.write(png)
    if (buffer.length >= targetSize * 0.9) {
      break
    }
    dimension = Math.min(dimension + 64, 4096)
    attempt += 1
  }
  return buffer
}
