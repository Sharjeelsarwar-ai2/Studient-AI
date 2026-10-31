export default function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'METHOD_NOT_ALLOWED' })
  return res.status(200).json({ ok: true, configured: Boolean(process.env.GROQ_API_KEY), stub: process.env.STUDIENT_STUB_GROQ === '1' })
}
