#!/usr/bin/env node
/**
 * 확장 배포용 zip 만들기.
 *
 * 크롬 웹 스토어 등록은 아직 못 한다(만 18세는 개발자 약관상 미성년자다).
 * 그래서 1차 배포는 GitHub Releases에 올리는 zip이고, 받는 사람은
 * `chrome://extensions → 압축해제된 확장 프로그램을 로드`로 설치한다.
 *
 * 의존성을 더하지 않으려고 zip 포맷을 직접 쓴다 —
 * 무압축(stored) 엔트리만 쓰면 규격이 짧고, 어차피 큰 파일은 이미 압축된 WASM·모델이다.
 *
 *   node scripts/pack.mjs
 */

import { createWriteStream } from 'node:fs'
import { readFileSync, readdirSync, statSync, mkdirSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { deflateRawSync, crc32 } from 'node:zlib'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DIST = resolve(ROOT, 'dist')
const OUT_DIR = resolve(ROOT, 'release')

function walk(dir) {
  const found = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) found.push(...walk(full))
    else found.push(full)
  }
  return found
}

/** zip은 날짜를 DOS 형식으로 담는다. 재현 가능한 산출물을 위해 고정값을 쓴다. */
const DOS_TIME = 0
const DOS_DATE = 0x2821 // 2000-01-01

function entry(name, data) {
  const compressed = deflateRawSync(data, { level: 9 })
  const useDeflate = compressed.length < data.length
  const body = useDeflate ? compressed : data
  const nameBytes = Buffer.from(name, 'utf8')

  const local = Buffer.alloc(30)
  local.writeUInt32LE(0x04034b50, 0)
  local.writeUInt16LE(20, 4) // version needed
  local.writeUInt16LE(0x0800, 6) // UTF-8 이름 플래그
  local.writeUInt16LE(useDeflate ? 8 : 0, 8)
  local.writeUInt16LE(DOS_TIME, 10)
  local.writeUInt16LE(DOS_DATE, 12)
  local.writeUInt32LE(crc32(data), 14)
  local.writeUInt32LE(body.length, 18)
  local.writeUInt32LE(data.length, 22)
  local.writeUInt16LE(nameBytes.length, 26)

  return {
    name: nameBytes,
    local: Buffer.concat([local, nameBytes, body]),
    crc: crc32(data),
    compressedSize: body.length,
    size: data.length,
    method: useDeflate ? 8 : 0,
  }
}

const files = walk(DIST).sort()
const entries = []
const chunks = []
let offset = 0

for (const file of files) {
  const name = relative(DIST, file).split(sep).join('/')
  const built = entry(name, readFileSync(file))
  built.offset = offset
  offset += built.local.length
  chunks.push(built.local)
  entries.push(built)
}

const central = []
for (const built of entries) {
  const header = Buffer.alloc(46)
  header.writeUInt32LE(0x02014b50, 0)
  header.writeUInt16LE(20, 4)
  header.writeUInt16LE(20, 6)
  header.writeUInt16LE(0x0800, 8)
  header.writeUInt16LE(built.method, 10)
  header.writeUInt16LE(DOS_TIME, 12)
  header.writeUInt16LE(DOS_DATE, 14)
  header.writeUInt32LE(built.crc, 16)
  header.writeUInt32LE(built.compressedSize, 20)
  header.writeUInt32LE(built.size, 24)
  header.writeUInt16LE(built.name.length, 28)
  header.writeUInt32LE(built.offset, 42)
  central.push(Buffer.concat([header, built.name]))
}

const centralBuffer = Buffer.concat(central)
const end = Buffer.alloc(22)
end.writeUInt32LE(0x06054b50, 0)
end.writeUInt16LE(entries.length, 8)
end.writeUInt16LE(entries.length, 10)
end.writeUInt32LE(centralBuffer.length, 12)
end.writeUInt32LE(offset, 16)

const { version } = JSON.parse(readFileSync(resolve(DIST, 'manifest.json'), 'utf8'))
mkdirSync(OUT_DIR, { recursive: true })
const outFile = resolve(OUT_DIR, `gochim-extension-v${version}.zip`)
const stream = createWriteStream(outFile)
for (const chunk of chunks) stream.write(chunk)
stream.write(centralBuffer)
stream.write(end)
stream.end()

stream.on('finish', () => {
  const size = statSync(outFile).size
  console.log(`\n${outFile}`)
  console.log(`  파일 ${entries.length}개 · ${(size / 1024 / 1024).toFixed(2)} MB`)
  console.log('\nGitHub Releases에 올리고, 받는 사람은 압축을 푼 뒤')
  console.log("chrome://extensions → 개발자 모드 → '압축해제된 확장 프로그램을 로드'로 설치합니다.")
})
