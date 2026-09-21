const API_BASE = 'https://equran.id/api/v2'
const DOA_API_BASE = 'https://equran.id/api'

async function request(path) {
  const response = await fetch(`${API_BASE}${path}`)
  if (!response.ok) throw new Error('Data belum dapat dimuat. Coba lagi sebentar.')
  const payload = await response.json()
  if (payload.code && payload.code >= 400) throw new Error(payload.message || 'Terjadi kesalahan pada API.')
  return payload.data
}

export const getSurahs = () => request('/surat')
export const getSurah = (number) => request(`/surat/${number}`)
export const getJuz = (number) => request(`/juz/${number}/1/300`)

export async function getDoas() {
  const response = await fetch(`${DOA_API_BASE}/doa`)
  if (!response.ok) throw new Error('Data doa belum dapat dimuat. Coba lagi sebentar.')
  const payload = await response.json()
  if (payload.code && payload.code >= 400) throw new Error(payload.message || 'Terjadi kesalahan pada API doa.')
  return payload.data || payload
}