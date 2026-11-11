// GET /api/photo?id=<player id>&v=<photoV>  -> the photo of a player added in the Match Centre.
// The v in the URL changes whenever the photo does, so the response can be cached for good.
const { configured, redis, KEY_PHOTO } = require('./_store');

module.exports = async (req, res) => {
  const id = String(req.query.id || '');
  if (!configured() || !/^x-[a-z0-9]{1,20}$/.test(id)) return res.status(404).end();
  try {
    const [dataUrl] = await redis([['GET', KEY_PHOTO + id]]);
    const m = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/.exec(dataUrl || '');
    if (!m) return res.status(404).end();
    res.setHeader('Content-Type', m[1]);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    return res.status(200).send(Buffer.from(m[2], 'base64'));
  } catch (e) {
    return res.status(500).end();
  }
};
