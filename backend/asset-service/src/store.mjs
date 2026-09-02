import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const dataPath = resolve(root, 'data/jobs.json')

async function ensureStore() {
  await mkdir(dirname(dataPath), { recursive: true })
  try {
    await readFile(dataPath, 'utf8')
  } catch {
    await writeFile(dataPath, '[]\n', 'utf8')
  }
}

export async function listJobs() {
  await ensureStore()
  return JSON.parse(await readFile(dataPath, 'utf8'))
}

export async function saveJobs(jobs) {
  await ensureStore()
  await writeFile(dataPath, JSON.stringify(jobs, null, 2) + '\n', 'utf8')
}

export async function createJob(input) {
  const jobs = await listJobs()
  const now = new Date().toISOString()
  const job = {
    id: crypto.randomUUID(),
    assetId: input.assetId,
    assetType: input.assetType,
    promptTemplate: input.promptTemplate,
    promptVariables: input.promptVariables ?? {},
    ageBands: input.ageBands ?? [],
    gameTags: input.gameTags ?? [],
    generationStatus: 'queued',
    reviewStatus: 'not_ready',
    candidateFiles: [],
    approvedFile: '',
    reviewNotes: '',
    createdAt: now,
    updatedAt: now
  }
  jobs.unshift(job)
  await saveJobs(jobs)
  return job
}

export async function updateJob(id, changes) {
  const jobs = await listJobs()
  const index = jobs.findIndex((job) => job.id === id)
  if (index < 0) return null
  jobs[index] = { ...jobs[index], ...changes, updatedAt: new Date().toISOString() }
  await saveJobs(jobs)
  return jobs[index]
}
