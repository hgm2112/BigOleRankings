import path from "path"
import { fileURLToPath } from "url"
import sharp from "sharp"

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
