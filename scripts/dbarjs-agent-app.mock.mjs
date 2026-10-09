// A mock of the GitHub endpoints dbarjs-agent-app.sh calls, for
// dbarjs-agent-app.test.sh. It checks every JWT against the key it handed
// out, logs each request to MOCK_LOG, and prints its port on stdout.
//
// MOCK_INSTALL_AFTER  installation lookups answered 404 before it's installed (1)
// MOCK_SELECTION      the installation's repository_selection (selected)
// MOCK_REPOS          comma-separated repos an installation token reaches
// MOCK_PERMISSIONS    JSON permissions of the installation
// MOCK_PUBLIC         set to make the App public

import { generateKeyPairSync, verify } from 'node:crypto'
import { appendFileSync, writeFileSync } from 'node:fs'
import http from 'node:http'

const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs1', format: 'pem' },
})

const env = process.env
const app = {
  id: 4242,
  slug: 'dbarjs-agent',
  client_id: 'Iv23liMockClientId',
  name: 'dbarjs-agent',
  owner: { login: 'dbarjs' },
  events: [],
}
const installation = {
  id: 777,
  account: { login: 'dbarjs' },
  repository_selection: env.MOCK_SELECTION ?? 'selected',
  permissions: JSON.parse(
    env.MOCK_PERMISSIONS ??
      '{"metadata":"read","contents":"write","issues":"write","pull_requests":"write","workflows":"write"}',
  ),
}
const repos = (env.MOCK_REPOS ?? 'dbarjs/hero-synergy').split(',')
const installAfter = Number(env.MOCK_INSTALL_AFTER ?? 1)
const token = 'ghs_mockInstallationToken'
let installLookups = 0

if (env.MOCK_LOG) writeFileSync(`${env.MOCK_LOG}.pem`, privateKey)

function jwtValid(auth) {
  const match = /^Bearer ([\w-]+)\.([\w-]+)\.([\w-]+)$/.exec(auth ?? '')
  if (!match) return false
  const [, head, claims, sig] = match
  const header = JSON.parse(Buffer.from(head, 'base64url').toString())
  const body = JSON.parse(Buffer.from(claims, 'base64url').toString())
  const now = Math.floor(Date.now() / 1000)
  return (
    header.alg === 'RS256' &&
    verify(
      'RSA-SHA256',
      Buffer.from(`${head}.${claims}`),
      publicKey,
      Buffer.from(sig, 'base64url'),
    ) &&
    body.iss === app.client_id &&
    body.iat <= now &&
    body.exp > now &&
    body.exp - body.iat <= 600
  )
}

function authKind(auth) {
  if (!auth) return 'none'
  if (auth === `Bearer ${token}`) return 'installation-token'
  if (jwtValid(auth)) return 'jwt'
  return 'other'
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost')
  const path = decodeURIComponent(url.pathname)
  const auth = authKind(req.headers.authorization)
  if (env.MOCK_LOG) {
    appendFileSync(env.MOCK_LOG, `${JSON.stringify({ method: req.method, path, auth })}\n`)
  }
  const send = (status, body) => {
    res.writeHead(status, { 'Content-Type': 'application/json' })
    res.end(body === undefined ? '' : JSON.stringify(body))
  }
  const route = `${req.method} ${path}`

  if (route === 'POST /app-manifests/mock-code/conversions' && auth === 'none') {
    return send(201, {
      ...app,
      client_secret: 'mock-client-secret',
      webhook_secret: 'mock-webhook-secret',
      pem: privateKey,
    })
  }
  if (route.startsWith('POST /app-manifests/')) return send(404, { message: 'Not Found' })

  if (route === 'GET /apps/dbarjs-agent') {
    return env.MOCK_PUBLIC || auth !== 'none' ? send(200, app) : send(404, { message: 'Not Found' })
  }
  if (route === 'GET /users/dbarjs-agent[bot]') {
    return send(200, { login: 'dbarjs-agent[bot]', id: 999, type: 'Bot' })
  }

  if (route === 'GET /app' || route.startsWith('GET /repos/') || route.startsWith('POST /app/')) {
    if (auth !== 'jwt') return send(401, { message: 'A JSON web token could not be decoded' })
    if (route === 'GET /app') return send(200, app)
    if (route === 'GET /repos/dbarjs/hero-synergy/installation') {
      installLookups += 1
      return installLookups > installAfter
        ? send(200, installation)
        : send(404, { message: 'Not Found' })
    }
    if (route === 'POST /app/installations/777/access_tokens') {
      return send(201, { token, permissions: installation.permissions })
    }
    return send(404, { message: 'Not Found' })
  }

  if (route === 'GET /installation/repositories' || route === 'DELETE /installation/token') {
    if (auth !== 'installation-token') return send(401, { message: 'Bad credentials' })
    if (req.method === 'DELETE') return send(204)
    return send(200, {
      total_count: repos.length,
      repositories: repos.map((full_name) => ({ full_name })),
    })
  }

  send(404, { message: 'Not Found' })
})

server.listen(0, '127.0.0.1', () => {
  console.log(server.address().port)
})
