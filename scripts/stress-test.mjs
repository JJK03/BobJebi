import { performance } from 'node:perf_hooks'

const DEFAULT_URL = 'http://127.0.0.1:4173'
const DEFAULT_PATHS = ['/']
const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '[::1]'])
const REMOTE_LIMITS = {
  concurrency: 5,
  durationSeconds: 30,
  requests: 100,
  paths: 5,
  responseBytes: 10 * 1024 * 1024,
  receivedBytes: 50 * 1024 * 1024,
}

function hasFlag(name) {
  return process.argv.slice(2).includes(`--${name}`)
}

function readOption(name, fallback) {
  const prefix = `--${name}=`
  const option = process.argv.slice(2).find((argument) => argument.startsWith(prefix))
  return option ? option.slice(prefix.length) : fallback
}

function readPositiveInteger(name, fallback, maximum) {
  const value = Number(readOption(name, fallback))

  if (!Number.isInteger(value) || value <= 0 || value > maximum) {
    throw new Error(`--${name} must be an integer between 1 and ${maximum}.`)
  }

  return value
}

function readNonNegativeInteger(name, fallback, maximum) {
  const value = Number(readOption(name, fallback))

  if (!Number.isInteger(value) || value < 0 || value > maximum) {
    throw new Error(`--${name} must be an integer between 0 and ${maximum}.`)
  }

  return value
}

function percentile(sortedValues, ratio) {
  if (sortedValues.length === 0) return 0
  const index = Math.min(sortedValues.length - 1, Math.ceil(sortedValues.length * ratio) - 1)
  return sortedValues[index]
}

function summarize(samples, elapsedSeconds) {
  const latencies = samples.map(({ latency }) => latency).sort((a, b) => a - b)
  const bytes = samples.reduce((total, sample) => total + sample.bytes, 0)

  return {
    requests: samples.length,
    requestsPerSecond: samples.length / elapsedSeconds,
    megabytes: bytes / 1024 / 1024,
    average: latencies.reduce((total, latency) => total + latency, 0) / latencies.length,
    p50: percentile(latencies, 0.5),
    p95: percentile(latencies, 0.95),
    p99: percentile(latencies, 0.99),
    maximum: latencies.at(-1) ?? 0,
  }
}

function formatNumber(value, digits = 1) {
  return Number.isFinite(value) ? value.toFixed(digits) : '-'
}

const baseUrl = new URL(readOption('url', DEFAULT_URL))
const concurrency = readPositiveInteger('concurrency', 10, 200)
const durationSeconds = readPositiveInteger('duration', 15, 300)
const timeoutMilliseconds = readPositiveInteger('timeout', 10_000, 60_000)
const maximumRequests = readNonNegativeInteger('requests', 0, 1_000_000)
const paths = readOption('paths', DEFAULT_PATHS.join(','))
  .split(',')
  .map((path) => path.trim())
  .filter(Boolean)

if (paths.length === 0) {
  throw new Error('--paths must contain at least one path.')
}

if (!['http:', 'https:'].includes(baseUrl.protocol)) {
  throw new Error('--url must use http or https.')
}

const isRemote = !LOCAL_HOSTNAMES.has(baseUrl.hostname)
const allowRemote = hasFlag('allow-remote')

for (const path of paths) {
  const targetUrl = new URL(path, baseUrl)

  if (!path.startsWith('/') || targetUrl.origin !== baseUrl.origin) {
    throw new Error('--paths may only contain paths from the target URL origin.')
  }
}

if (isRemote) {
  if (!allowRemote) {
    throw new Error('Remote load tests are disabled. Pass --allow-remote to confirm an authorized test.')
  }

  if (maximumRequests === 0) {
    throw new Error('Remote load tests require an explicit --requests limit.')
  }

  if (maximumRequests > REMOTE_LIMITS.requests) {
    throw new Error(`Remote --requests cannot exceed ${REMOTE_LIMITS.requests}.`)
  }

  if (paths.length > REMOTE_LIMITS.paths) {
    throw new Error(`Remote --paths cannot contain more than ${REMOTE_LIMITS.paths} paths.`)
  }

  if (maximumRequests < paths.length) {
    throw new Error('Remote --requests must be at least the number of warm-up paths.')
  }

  if (concurrency > REMOTE_LIMITS.concurrency) {
    throw new Error(`Remote --concurrency cannot exceed ${REMOTE_LIMITS.concurrency}.`)
  }

  if (durationSeconds > REMOTE_LIMITS.durationSeconds) {
    throw new Error(`Remote --duration cannot exceed ${REMOTE_LIMITS.durationSeconds} seconds.`)
  }
}

let remoteBytesReceived = 0

async function readResponseBody(response) {
  const declaredLength = Number(response.headers.get('content-length'))

  if (isRemote && Number.isFinite(declaredLength) && declaredLength > REMOTE_LIMITS.responseBytes) {
    await response.body?.cancel()
    throw new Error('Remote response exceeds the 10 MB per-response safety limit.')
  }

  const body = await response.arrayBuffer()

  if (isRemote) {
    remoteBytesReceived += body.byteLength

    if (body.byteLength > REMOTE_LIMITS.responseBytes) {
      throw new Error('Remote response exceeds the 10 MB per-response safety limit.')
    }

    if (remoteBytesReceived > REMOTE_LIMITS.receivedBytes) {
      throw new Error('Remote responses exceeded the 50 MB total safety limit.')
    }
  }

  return body
}

for (const path of paths) {
  const response = await fetch(new URL(path, baseUrl), {
    signal: AbortSignal.timeout(timeoutMilliseconds),
    redirect: 'error',
  })

  await readResponseBody(response)

  if (!response.ok) {
    throw new Error(`Warm-up request failed: ${path} (${response.status})`)
  }
}

const samples = []
const errors = []
const statusCounts = new Map()
const deadline = performance.now() + durationSeconds * 1000
let nextPathIndex = 0
let claimedRequests = isRemote ? paths.length : 0

function claimRequest() {
  if (maximumRequests > 0 && claimedRequests >= maximumRequests) return false
  if (isRemote && remoteBytesReceived >= REMOTE_LIMITS.receivedBytes) return false
  claimedRequests += 1
  return true
}

async function worker() {
  while (performance.now() < deadline && claimRequest()) {
    const path = paths[nextPathIndex % paths.length]
    nextPathIndex += 1
    const startedAt = performance.now()

    try {
      const response = await fetch(new URL(path, baseUrl), {
        signal: AbortSignal.timeout(timeoutMilliseconds),
        redirect: 'error',
      })
      const body = await readResponseBody(response)
      const latency = performance.now() - startedAt

      statusCounts.set(response.status, (statusCounts.get(response.status) ?? 0) + 1)
      samples.push({ path, latency, bytes: body.byteLength, ok: response.ok })

      if (!response.ok) errors.push(`${path}: HTTP ${response.status}`)
    } catch (error) {
      errors.push(`${path}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
}

console.log('Starting static resource load test.')
console.log(`Target: ${baseUrl.href}`)
console.log(`Concurrency: ${concurrency}, duration: ${durationSeconds}s`)
if (maximumRequests > 0) console.log(`Request cap: ${maximumRequests}`)
if (isRemote) console.log(`Remote receive cap: ${REMOTE_LIMITS.receivedBytes / 1024 / 1024} MB`)
console.log(`Paths: ${paths.join(', ')}`)

const startedAt = performance.now()
await Promise.all(Array.from({ length: concurrency }, () => worker()))
const elapsedSeconds = (performance.now() - startedAt) / 1000
const successfulSamples = samples.filter(({ ok }) => ok)
const total = summarize(successfulSamples, elapsedSeconds)

console.log('\nResult')
console.log(`Successful: ${successfulSamples.length}, failed: ${errors.length}`)
console.log(`Throughput: ${formatNumber(total.requestsPerSecond)} requests/s`)
console.log(`Received: ${formatNumber(total.megabytes, 2)} MB`)
console.log(
  `Latency: avg ${formatNumber(total.average)}ms, p50 ${formatNumber(total.p50)}ms, ` +
    `p95 ${formatNumber(total.p95)}ms, p99 ${formatNumber(total.p99)}ms, max ${formatNumber(total.maximum)}ms`,
)
console.log(`Status: ${[...statusCounts].map(([status, count]) => `${status}=${count}`).join(', ') || '-'}`)

console.log('\nBy path')
for (const path of paths) {
  const pathSamples = successfulSamples.filter((sample) => sample.path === path)
  const result = summarize(pathSamples, elapsedSeconds)
  console.log(
    `${path}: ${result.requests} requests, p95 ${formatNumber(result.p95)}ms, ` +
      `${formatNumber(result.megabytes, 2)} MB`,
  )
}

if (errors.length > 0) {
  console.error('\nSample errors')
  for (const error of errors.slice(0, 5)) console.error(`- ${error}`)
  process.exitCode = 1
}
