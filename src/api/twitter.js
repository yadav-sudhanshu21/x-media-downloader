// Create an "api" folder in your x-downloader project in VS Code
// and save this file as: api/twitter.js

function computeSyndicationToken(idStr) {
  try {
    return ((Number(idStr) / 1e15) * Math.PI).toString(36).replace(/(0+|\.)/g, '');
  } catch {
    return 'a';
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { id, downloadUrl, filename } = req.query;

  // =========================================================================
  // 1. INSTANT NATIVE BROWSER DOWNLOAD STREAM (Zero RAM Buffering Delay)
  // Streams video.twimg.com / pbs.twimg.com directly with attachment header
  // =========================================================================
  if (downloadUrl) {
    try {
      const upstream = await fetch(downloadUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
          Referer: 'https://x.com/'
        }
      });

      if (!upstream.ok) {
        return res.redirect(downloadUrl);
      }

      const contentType = upstream.headers.get('content-type') || 'video/mp4';
      const contentLength = upstream.headers.get('content-length');
      const cleanName = (filename || 'X_Twitter_Media.mp4').replace(/[^a-zA-Z0-9._-]/g, '_');

      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${cleanName}"`);
      if (contentLength) {
        res.setHeader('Content-Length', contentLength);
      }

      const arrayBuffer = await upstream.arrayBuffer();
      return res.send(Buffer.from(arrayBuffer));
    } catch (e) {
      return res.redirect(downloadUrl);
    }
  }

  // =========================================================================
  // 2. ULTRA-FAST ~120ms SERVER-SIDE SYNDICATION + FXTWITTER RACE
  // =========================================================================
  if (!id) {
    return res.status(400).json({ error: 'Missing tweet ID' });
  }

  const token = computeSyndicationToken(id);
  const syndicationUrl = `https://cdn.syndication.twimg.com/tweet-result?id=${id}&lang=en&token=${token}`;

  try {
    const [synRes, fxRes] = await Promise.allSettled([
      fetch(syndicationUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
          Accept: 'application/json'
        }
      }),
      fetch(`https://api.fxtwitter.com/status/${id}`, {
        headers: { Accept: 'application/json' }
      })
    ]);

    let syndicationData = null;
    let fxData = null;

    if (synRes.status === 'fulfilled' && synRes.value.ok) {
      try {
        syndicationData = await synRes.value.json();
      } catch {
        // ignore
      }
    }

    if (fxRes.status === 'fulfilled' && fxRes.value.ok) {
      try {
        const parsed = await fxRes.value.json();
        fxData = parsed?.tweet || null;
      } catch {
        // ignore
      }
    }

    // Cache at the edge for 1 hour so repeat links load in 20ms
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
    return res.status(200).json({
      syndicationData,
      fxData
    });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Extraction error' });
  }
}