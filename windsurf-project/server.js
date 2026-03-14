const express = require('express');
const path = require('path');
const axios = require('axios');
const fs = require('fs');
const crypto = require('crypto');

const { getDownloadUrl } = require('./index.js');

const app = express();

const downloadUrlCache = new Map();
const DOWNLOAD_URL_TTL_MS = 5 * 60 * 1000;

const getCachedDownloadUrl = async (videoUrl) => {
  const now = Date.now();
  const cached = downloadUrlCache.get(videoUrl);
  if (cached && (now - cached.createdAt) < DOWNLOAD_URL_TTL_MS) {
    return cached.downloadUrl;
  }

  const downloadUrl = await getDownloadUrl(videoUrl);
  downloadUrlCache.set(videoUrl, { downloadUrl, createdAt: now });
  return downloadUrl;
};

app.use(express.static(path.join(__dirname, 'public')));

const CACHE_DIR = path.join(__dirname, '.cache');
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

const mp3Cache = new Map();

const cacheKeyForUrl = (videoUrl) => {
  return crypto.createHash('sha1').update(videoUrl).digest('hex');
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const getFileSizeSafe = (p) => {
  try {
    return fs.statSync(p).size;
  } catch (_) {
    return 0;
  }
};

const ensureDownloadStarted = async (videoUrl) => {
  const key = cacheKeyForUrl(videoUrl);
  const filePath = path.join(CACHE_DIR, `${key}.mp3`);

  let entry = mp3Cache.get(key);
  if (!entry) {
    entry = {
      key,
      videoUrl,
      filePath,
      totalSize: null,
      downloading: false,
      done: false,
      error: null,
    };
    mp3Cache.set(key, entry);
  }

  if (entry.downloading || entry.done) {
    return entry;
  }

  entry.downloading = true;
  entry.error = null;

  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    fs.closeSync(fs.openSync(filePath, 'a'));
  } catch (e) {
    entry.error = e;
    entry.downloading = false;
    return entry;
  }

  (async () => {
    try {
      const downloadUrl = await getCachedDownloadUrl(videoUrl);

      const upstream = await axios({
        method: 'GET',
        url: downloadUrl,
        responseType: 'stream',
        timeout: 120000,
        validateStatus: () => true,
      });

      if (upstream.status >= 400) {
        downloadUrlCache.delete(videoUrl);
        throw new Error(`Upstream failed with status ${upstream.status}`);
      }

      const lenHeader = upstream.headers['content-length'];
      if (lenHeader && !Number.isNaN(Number(lenHeader))) {
        entry.totalSize = Number(lenHeader);
      }

      const writer = fs.createWriteStream(filePath);
      upstream.data.pipe(writer);

      await new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
        upstream.data.on('error', reject);
      });

      entry.done = true;
      entry.downloading = false;
    } catch (e) {
      entry.error = e;
      entry.downloading = false;
      entry.done = false;
    }
  })();

  return entry;
};

const waitForAtLeast = async (filePath, minSize, maxWaitMs) => {
  const start = Date.now();
  while (true) {
    const size = getFileSizeSafe(filePath);
    if (size >= minSize) return size;
    if (Date.now() - start > maxWaitMs) return size;
    await sleep(150);
  }
};

const parseRange = (rangeHeader) => {
  if (!rangeHeader) return null;
  const m = /^bytes=(\d+)-(\d+)?$/i.exec(rangeHeader.trim());
  if (!m) return null;
  const start = Number(m[1]);
  const end = m[2] !== undefined ? Number(m[2]) : null;
  if (Number.isNaN(start) || (end !== null && Number.isNaN(end))) return null;
  return { start, end };
};

const streamFileProgressive = async ({ req, res, filePath, start = 0, end = null, totalSize = null }) => {
  const maxWaitMs = 30000;

  const needAtLeast = start + 1;
  const availableSize = await waitForAtLeast(filePath, needAtLeast, maxWaitMs);
  if (availableSize < needAtLeast) {
    res.status(416);
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ error: 'Not enough data downloaded yet' }));
    return;
  }

  let effectiveEnd;
  if (end === null) {
    effectiveEnd = availableSize - 1;
  } else {
    const haveEnough = await waitForAtLeast(filePath, end + 1, maxWaitMs);
    effectiveEnd = Math.min(end, Math.max(haveEnough - 1, start));
  }

  const chunkSize = effectiveEnd - start + 1;

  res.setHeader('content-type', 'audio/mpeg');
  res.setHeader('accept-ranges', 'bytes');
  res.setHeader('cache-control', 'no-store');

  if (totalSize !== null) {
    res.setHeader('content-range', `bytes ${start}-${effectiveEnd}/${totalSize}`);
  } else {
    res.setHeader('content-range', `bytes ${start}-${effectiveEnd}/*`);
  }
  res.setHeader('content-length', chunkSize);
  res.status(206);

  const reader = fs.createReadStream(filePath, { start, end: effectiveEnd });

  req.on('close', () => {
    try {
      reader.destroy();
    } catch (_) {
      // ignore
    }
  });

  reader.pipe(res);
};

app.get('/api/stream', async (req, res) => {
  const videoUrl = req.query.url;

  if (!videoUrl) {
    res.status(400).json({ error: 'Missing url query param' });
    return;
  }

  try {
    const entry = await ensureDownloadStarted(videoUrl);
    if (entry.error) {
      res.status(502).json({ error: 'Failed to download/prepare MP3' });
      return;
    }

    const range = parseRange(req.headers.range);
    if (range) {
      await streamFileProgressive({
        req,
        res,
        filePath: entry.filePath,
        start: range.start,
        end: range.end,
        totalSize: entry.totalSize,
      });
      return;
    }

    res.setHeader('content-type', 'audio/mpeg');
    res.setHeader('accept-ranges', 'bytes');
    res.setHeader('cache-control', 'no-store');

    const initialSize = await waitForAtLeast(entry.filePath, 1, 30000);
    if (initialSize < 1) {
      res.status(503).json({ error: 'MP3 is not ready yet, try again' });
      return;
    }

    res.status(200);

    const reader = fs.createReadStream(entry.filePath, { start: 0 });
    reader.on('error', () => {
      if (!res.headersSent) res.status(502);
      res.end();
    });
    req.on('close', () => {
      try {
        reader.destroy();
      } catch (_) {
        // ignore
      }
    });
    reader.pipe(res);
    return;
  } catch (e) {
    res.status(502).json({ error: 'Failed to fetch download URL from API' });
    return;
  }
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
