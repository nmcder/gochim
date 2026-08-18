#!/usr/bin/env node
/**
 * 확장 아이콘 생성기.
 *
 * 크롬 확장 아이콘은 PNG여야 한다(SVG 불가). 이미지 라이브러리를 하나 더 얹는 대신
 * 픽셀을 직접 찍고 zlib으로 PNG를 만든다 — 의존성 0개, 결과는 재현 가능하다.
 *
 * 그림: 글줄 세 개, 마지막 줄 아래에 물결 밑줄. 16px에서도 무엇인지 읽힌다.
 *
 *   node scripts/make-icons.mjs
 */

import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = resolve(ROOT, 'public/icons')

const INK = [0x16, 0x15, 0x0f, 0xff]
const PAPER = [0xf7, 0xf5, 0xef, 0xff]
const RED = [0xe0, 0x5b, 0x41, 0xff]

function crc32(buffer) {
  let crc = ~0
  for (const byte of buffer) {
    crc ^= byte
    for (let i = 0; i < 8; i += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1))
  }
  return ~crc >>> 0
}

function chunk(type, data) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([length, body, crc])
}

/** RGBA 픽셀 배열을 PNG 바이트로 만든다. */
function encodePng(size, pixels) {
  const header = Buffer.alloc(13)
  header.writeUInt32BE(size, 0)
  header.writeUInt32BE(size, 4)
  header[8] = 8 // bit depth
  header[9] = 6 // RGBA
  // 각 줄 앞에 필터 바이트 0을 붙인다 (필터 없음).
  const raw = Buffer.alloc(size * (size * 4 + 1))
  for (let y = 0; y < size; y += 1) {
    raw[y * (size * 4 + 1)] = 0
    pixels.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4)
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

function draw(size) {
  const pixels = Buffer.alloc(size * size * 4)
  const put = (x, y, color) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return
    const at = (y * size + x) * 4
    pixels[at] = color[0]
    pixels[at + 1] = color[1]
    pixels[at + 2] = color[2]
    pixels[at + 3] = color[3]
  }

  // 배경 — 모서리를 살짝 깎은 사각형
  const radius = Math.round(size * 0.22)
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const dx = Math.max(radius - x, x - (size - 1 - radius), 0)
      const dy = Math.max(radius - y, y - (size - 1 - radius), 0)
      if (dx * dx + dy * dy <= radius * radius) put(x, y, INK)
    }
  }

  // 글줄 세 개
  const margin = Math.round(size * 0.22)
  const lineHeight = Math.max(1, Math.round(size * 0.075))
  const gap = Math.round(size * 0.17)
  const widths = [0.56, 0.44, 0.5]
  widths.forEach((width, index) => {
    const top = margin + index * gap
    const right = margin + Math.round((size - margin * 2) * width)
    for (let y = top; y < top + lineHeight; y += 1) {
      for (let x = margin; x < right; x += 1) put(x, y, PAPER)
    }
  })

  // 마지막 줄 아래 물결 밑줄
  const waveTop = margin + 2 * gap + lineHeight + Math.max(1, Math.round(size * 0.05))
  const amplitude = Math.max(1, Math.round(size * 0.035))
  const period = Math.max(3, Math.round(size * 0.16))
  const waveRight = margin + Math.round((size - margin * 2) * widths[2])
  const thickness = Math.max(1, Math.round(size * 0.06))
  for (let x = margin; x < waveRight; x += 1) {
    const phase = ((x - margin) % period) / period
    const offset = Math.round(Math.sin(phase * Math.PI * 2) * amplitude)
    for (let t = 0; t < thickness; t += 1) put(x, waveTop + offset + t, RED)
  }

  return encodePng(size, pixels)
}

mkdirSync(OUT, { recursive: true })
for (const size of [16, 48, 128]) {
  const file = resolve(OUT, `icon${size}.png`)
  writeFileSync(file, draw(size))
  console.log(`아이콘 생성: ${file}`)
}
