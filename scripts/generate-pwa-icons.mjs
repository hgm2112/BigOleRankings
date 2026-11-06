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

// Notification badge (96x96) - white background with star from badge1 transparent, centered
const BADGE_SRC = path.join(root, "public", "icons", "notification-badge.svg")
const badgeSize = 96
const starSize = 55  // fits nicely inside the circle
const circleRadius = 42
const circleSvg = `<svg width="${badgeSize}" height="${badgeSize}"><circle cx="${badgeSize/2}" cy="${badgeSize/2}" r="${circleRadius}" fill="white"/></svg>`
const circleBuffer = Buffer.from(circleSvg)
const starBuffer = await sharp(BADGE_SRC).resize(starSize, starSize).png().toBuffer()
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
console.log(`wrote ${path.relative(root, "public/icons/notification-badge.png")} (96x96, white circle + transparent star)`)
