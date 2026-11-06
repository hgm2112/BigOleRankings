import path from "path"
import { fileURLToPath } from "url"
import sharp from "sharp"
import fs from "fs"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const SRC = path.join(root, "public", "icons", "icon.svg")
const BRAND = "#5C00C6"

async function render(file, size) {
  await sharp(SRC).resize(size, size).png().toFile(file)
  console.log(`wrote ${path.relative(root, file)} (${size}x${size})`)
}

async function renderMaskable(file, size) {
  const inner = Math.round(size * 0.8)
  const logo = await sharp(SRC).resize(inner, inner).png().toBuffer()
  await sharp({
    create: { width: size, height: size, channels: 4, background: BRAND },
  })
    .composite([{ input: logo, gravity: "centre" }])
    .png()
    .toFile(file)
  console.log(`wrote ${path.relative(root, file)} (${size}x${size}, maskable)`)
}

await render(path.join(root, "public", "icons", "icon-192.png"), 192)
await render(path.join(root, "public", "icons", "icon-512.png"), 512)
await renderMaskable(path.join(root, "public", "icons", "icon-512-maskable.png"), 512)
await render(path.join(root, "src", "app", "apple-icon.png"), 180)
await render(path.join(root, "src", "app", "icon.png"), 192)

// Notification icon (used for push notifications) - large icon from logo1
const NOTIF_SRC = path.join(root, "public", "icons", "notification-icon.svg")
await sharp(NOTIF_SRC).resize(192, 192).png().toFile(path.join(root, "public", "icons", "notification-icon-192.png"))
console.log(`wrote ${path.relative(root, "public/icons/notification-icon-192.png")} (192x192)`)
await sharp(NOTIF_SRC).resize(512, 512).png().toFile(path.join(root, "public", "icons", "notification-icon-512.png"))
console.log(`wrote ${path.relative(root, "public/icons/notification-icon-512.png")} (512x512)`)

// Small icon (for PWA manifest / right small icon in notifications) from small1, recolored to live app colors
const SMALL_SRC = path.join(root, "public", "icons", "notification-small.svg")
let smallContent = fs.readFileSync(SMALL_SRC, 'utf8')
smallContent = smallContent.replace(/#4802CE/g, '#5C00C6').replace(/#C9C9C9/g, '#FFFFFF')
await sharp(Buffer.from(smallContent)).resize(192, 192).png().toFile(path.join(root, "public", "icons", "notification-small-192.png"))
console.log(`wrote ${path.relative(root, "public/icons/notification-small-192.png")} (192x192, recolored to live purple)`)

// --- Badge helper: extract ONLY the star polygons from badge1.svg
// Builds a minimal clean SVG containing *just* the star (no "BIG" letters or other elements).
async function extractStarOnly(svgContent, targetSize) {
  const polyRegex = /points="([^"]+)"/g
  const starPolys = []
  let match
  while ((match = polyRegex.exec(svgContent)) !== null) {
    const raw = match[1].trim().split(/\s+/).map(s => {
      const [x, y] = s.split(',').map(Number)
      return { x, y }
    }).filter(p => Number.isFinite(p.x) && Number.isFinite(p.y))

    if (raw.length === 0) continue
    const minX = Math.min(...raw.map(p => p.x))
    // Only the main star cluster (very negative coords, no letter paths)
    if (minX < -1200) {
      starPolys.push(raw)
    }
  }

  if (starPolys.length === 0) {
    console.warn('No star polygons found — falling back to raw render')
    return await sharp(Buffer.from(svgContent)).resize(targetSize, targetSize).png().toBuffer()
  }

  // Build a brand new minimal SVG containing ONLY the star polygons
  let polyTags = ''
  for (const poly of starPolys) {
    const minX = Math.min(...poly.map(p => p.x))
    const minY = Math.min(...poly.map(p => p.y))
    const maxX = Math.max(...poly.map(p => p.x))
    const maxY = Math.max(...poly.map(p => p.y))
    const w = maxX - minX
    const h = maxY - minY
    const scale = targetSize / Math.max(w, h)
    const offset = (targetSize - Math.max(w, h) * scale) / 2

    const pts = poly.map(p => {
      const sx = (p.x - minX) * scale + offset
      const sy = (p.y - minY) * scale + offset
      return `${sx.toFixed(2)},${sy.toFixed(2)}`
    }).join(' ')

    polyTags += `<polygon points="${pts}" fill="#000"/>`
  }

  const cleanSvg = `<svg width="${targetSize}" height="${targetSize}" viewBox="0 0 ${targetSize} ${targetSize}" xmlns="http://www.w3.org/2000/svg">${polyTags}</svg>`
  return await sharp(Buffer.from(cleanSvg)).png().toBuffer()
}

// Notification badge (96x96) - white circle + star from badge1.svg made transparent (centered)
const BADGE_SRC = path.join(root, "public", "icons", "notification-badge.svg")
const badgeSize = 96
const starSize = 50   // the star itself (tuned for good padding inside the circle)
const circleRadius = 43
const circleSvg = `<svg width="${badgeSize}" height="${badgeSize}"><circle cx="${badgeSize/2}" cy="${badgeSize/2}" r="${circleRadius}" fill="white"/></svg>`
const circleBuffer = Buffer.from(circleSvg)

let starRendered = await extractStarOnly(fs.readFileSync(BADGE_SRC, 'utf8'), starSize)
if (!starRendered) {
  starRendered = await sharp(BADGE_SRC).resize(starSize, starSize).png().toBuffer()
}
const starBuffer = await sharp(starRendered).png().toBuffer()

const left = Math.round((badgeSize - starSize) / 2)
const top = Math.round((badgeSize - starSize) / 2)
await sharp({
  create: { width: badgeSize, height: badgeSize, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } }
})
  .composite([
    { input: circleBuffer, left: 0, top: 0 },
    { input: starBuffer, left, top, blend: 'dest-out' }
  ])
  .png()
  .toFile(path.join(root, "public", "icons", "notification-badge.png"))
console.log(`wrote ${path.relative(root, "public/icons/notification-badge.png")} (96x96, white circle + transparent star from badge1.svg)`)
