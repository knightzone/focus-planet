import { createServer } from 'node:http'
import { createJob, listJobs, updateJob } from './store.mjs'

const port = Number(process.env.ASSET_SERVICE_PORT ?? 4310)
const allowedTypes = new Set([
  'mascot', 'single_object', 'object_pack', 'scene',
  'spot_difference_pair', 'sequence', 'reward'
])

function send(response, status, body) {
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': 'http://localhost:5173',
    'access-control-allow-headers': 'content-type',
    'access-control-allow-methods': 'GET,POST,OPTIONS'
  })
  response.end(JSON.stringify(body))
}

async function readJson(request) {
  let body = ''
  for await (const chunk of request) {
    body += chunk
    if (body.length > 1024 * 1024) throw new Error('request_too_large')
  }
  return body.length === 0 ? {} : JSON.parse(body)
}

function validateJob(input) {
  if (typeof input.assetId !== 'string' || input.assetId.length < 3) return 'assetId is required'
  if (!allowedTypes.has(input.assetType)) return 'assetType is invalid'
  if (typeof input.promptTemplate !== 'string' || input.promptTemplate.length < 3) return 'promptTemplate is required'
  return ''
}

const server = createServer(async (request, response) => {
  try {
    if (request.method === 'OPTIONS') return send(response, 204, {})
    const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`)

    if (request.method === 'GET' && url.pathname === '/health') {
      return send(response, 200, { ok: true, provider: 'not_configured' })
    }
    if (request.method === 'GET' && url.pathname === '/admin/assets/generation-jobs') {
      return send(response, 200, { jobs: await listJobs() })
    }
    if (request.method === 'POST' && url.pathname === '/admin/assets/generation-jobs') {
      const input = await readJson(request)
      const error = validateJob(input)
      if (error) return send(response, 400, { error })
      return send(response, 201, { job: await createJob(input) })
    }

    const actionMatch = url.pathname.match(/^\/admin\/assets\/generation-jobs\/([^/]+)\/(approve|reject)$/)
    if (request.method === 'POST' && actionMatch) {
      const input = await readJson(request)
      const approved = actionMatch[2] === 'approve'
      if (approved && (typeof input.approvedFile !== 'string' || input.approvedFile.length === 0)) {
        return send(response, 400, { error: 'approvedFile is required' })
      }
      const job = await updateJob(actionMatch[1], {
        reviewStatus: approved ? 'approved' : 'rejected',
        approvedFile: approved ? input.approvedFile : '',
        reviewNotes: typeof input.reviewNotes === 'string' ? input.reviewNotes : ''
      })
      return job == null ? send(response, 404, { error: 'job_not_found' }) : send(response, 200, { job })
    }

    return send(response, 404, { error: 'not_found' })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown_error'
    return send(response, message === 'request_too_large' ? 413 : 500, { error: message })
  }
})

server.listen(port, '127.0.0.1', () => {
  console.log(`Focus Planet asset service: http://127.0.0.1:${port}`)
})
