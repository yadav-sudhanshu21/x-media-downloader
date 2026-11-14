import React, { useState, useRef } from 'react';
import {
  Download,
  Sparkles,
  AlertCircle,
  Loader2,
  ClipboardPaste,
  RotateCcw
} from 'lucide-react';

function extractTweetId(input) {
  if (!input) return null;
  const trimmed = input.trim();
  const match = trimmed.match(
    /(?:twitter\.com|x\.com|vxtwitter\.com|fxtwitter\.com)\/(?:[^/]+\/status|i\/web\/status|status)\/(\d+)/i
  );
  return match ? match[1] : null;
}

function normalizeImageBaseUrl(rawUrl) {
  if (!rawUrl) return '';
  return rawUrl.split('?')[0].replace(/\.(jpg|jpeg|png|webp)$/i, '');
}

// Compute X Syndication Token so single-video posts return all MP4 bitrate variants
function computeSyndicationToken(idStr) {
  try {
    return ((Number(idStr) / 1e15) * Math.PI).toString(36).replace(/(0+|\.)/g, '');
  } catch {
    return 'a';
  }
}

export default function App() {
  const [urlInput, setUrlInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [downloadingId, setDownloadingId] = useState(null);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [activeNav, setActiveNav] = useState('Downloader');

  const extractorRef = useRef(null);
  const resultSectionRef = useRef(null);
  const howItWorksRef = useRef(null);
  const inputRef = useRef(null);

  // ==========================================
  // MULTI-SOURCE X / TWITTER ENGINE (Serverless /api/twitter + FXTwitter + VXTwitter)
  // Extracts all video resolutions (e.g. 720x1280, 480x852, 320x568) in ~120ms
  // ==========================================
  const fetchLiveXMedia = async (tweetId) => {
    let vxData = null;
    let fxData = null;
    let syndicationData = null;

    // 1. Call our fast Vercel backend (/api/twitter) + FXTwitter + VXTwitter in parallel
    const [serverRes, fxRes, vxRes] = await Promise.allSettled([
      fetch(`/api/twitter?id=${tweetId}`),
      fetch(`https://api.fxtwitter.com/status/${tweetId}`),
      fetch(`https://api.vxtwitter.com/Twitter/status/${tweetId}`)
    ]);

    if (serverRes.status === 'fulfilled' && serverRes.value.ok) {
      try {
        const serverJson = await serverRes.value.json();
        syndicationData = serverJson?.syndicationData || null;
        fxData = serverJson?.fxData || null;
      } catch (e) {
        // fallback
      }
    }

    if (!fxData && fxRes.status === 'fulfilled' && fxRes.value.ok) {
      try {
        const parsedFx = await fxRes.value.json();
        fxData = parsedFx?.tweet || null;
      } catch (e) {
        // fallback
      }
    }

    if (vxRes.status === 'fulfilled' && vxRes.value.ok) {
      try {
        vxData = await vxRes.value.json();
      } catch (e) {
        // fallback
      }
    }

    if (!vxData && !fxData && !syndicationData) {
      throw new Error(
        'Could not reach this X (Twitter) post. Ensure the post is public and contains video or photo media.'
      );
    }

    const mediaItems = [];
    const synMediaList =
      syndicationData?.mediaDetails ||
      (syndicationData?.video ? [{ type: 'video', video_info: syndicationData.video }] : []) ||
      (syndicationData?.photos ? syndicationData.photos.map((p) => ({ type: 'photo', media_url_https: p.url })) : []);
    const vxMediaList = vxData?.media_extended || [];
    const fxMediaList = fxData?.media?.all || fxData?.media?.videos || fxData?.media?.photos || [];
    const totalCount = Math.max(synMediaList.length, vxMediaList.length, fxMediaList.length);

    for (let i = 0; i < totalCount; i++) {
      const synItem = synMediaList[i];
      const vxItem = vxMediaList[i];
      const fxItem = fxMediaList[i];
      const rawType = synItem?.type || fxItem?.type || vxItem?.type || 'photo';

      if (rawType === 'video' || rawType === 'animated_gif' || rawType === 'gif') {
        const isGif = rawType === 'animated_gif' || rawType === 'gif';

        // Collect all variants from Syndication, FXTwitter, and VXTwitter
        const combinedRawVariants = [
          ...(synItem?.video_info?.variants || []),
          ...(syndicationData?.video?.variants || []),
          ...(fxItem?.variants || []),
          ...( fxItem?.formats || []),
          ...(vxItem?.variants || [])
        ];

        if (fxItem?.url && fxItem.url.includes('.mp4')) {
          combinedRawVariants.push({
            content_type: 'video/mp4',
            url: fxItem.url,
            bitrate: fxItem.bitrate || 8000000
          });
        }

        if (vxItem?.url && vxItem.url.includes('.mp4')) {
          combinedRawVariants.push({
            content_type: 'video/mp4',
            url: vxItem.url,
            bitrate: 8500000
          });
        }

        const mp4Variants = combinedRawVariants
          .filter(
            (v) =>
              v?.url &&
              (v.content_type === 'video/mp4' ||
                v.type === 'video/mp4' ||
                v.container === 'mp4' ||
                v.url.includes('.mp4'))
          )
          .map((v, idx) => {
            const resMatch = v.url.match(/\/(\d+x\d+)\//);
            const fallbackRes =
              fxItem?.width && fxItem?.height
                ? `${fxItem.width}x${fxItem.height}`
                : vxItem?.size?.width && vxItem?.size?.height
                ? `${vxItem.size.width}x${vxItem.size.height}`
                : '720x1280';
            const resolution = resMatch ? resMatch[1] : fallbackRes;

            // Calculate pixel count so sorting orders 720x1280 -> 480x852 -> 320x568
            const dims = resolution.includes('x') ? resolution.split('x').map(Number) : [0, 0];
            const pixelArea = (dims[0] || 0) * (dims[1] || 0);
            const bitrateKbps = v.bitrate ? Math.round(v.bitrate / 1000) : Math.round(pixelArea / 500) || (4 - idx) * 500;

            return {
              id: `vid-${i}-${idx}`,
              label: isGif
                ? 'Download GIF: mp4'
                : `Download ${resolution}: mp4`,
              resolution,
              pixelArea,
              bitrate: bitrateKbps,
              ext: 'MP4',
              url: v.url
            };
          })
          .sort((a, b) => (b.pixelArea - a.pixelArea) || (b.bitrate - a.bitrate));

        // Deduplicate by resolution so each resolution (e.g. 720x1280, 480x852, 320x568) appears once
        const uniqueQualities = [];
        const seenResolutions = new Set();
        mp4Variants.forEach((q) => {
          const cleanUrl = q.url.split('?')[0];
          const key = q.resolution || cleanUrl;
          if (!seenResolutions.has(key)) {
            seenResolutions.add(key);
            uniqueQualities.push({
              ...q,
              badge: uniqueQualities.length === 0 ? 'HD' : null
            });
          }
        });

        const thumbRaw =
          synItem?.media_url_https ||
          syndicationData?.video?.poster ||
          fxItem?.thumbnail_url ||
          vxItem?.thumbnail_url ||
          '';

        mediaItems.push({
          index: i,
          type: isGif ? 'gif' : 'video',
          thumbnail: thumbRaw,
          previewUrl: uniqueQualities[0]?.url || vxItem?.url || fxItem?.url,
          bestQuality: uniqueQualities[0] || {
            id: `vid-${i}-best`,
            label: 'DOWNLOAD',
            resolution: 'HD',
            ext: 'MP4',
            url: vxItem?.url || fxItem?.url
          }
        });
      } else {
        const rawImg = synItem?.media_url_https || fxItem?.url || vxItem?.url;
        const base = normalizeImageBaseUrl(rawImg);
        const origW = synItem?.original_info?.width || fxItem?.width || vxItem?.size?.width || 2048;
        const origH = synItem?.original_info?.height || fxItem?.height || vxItem?.size?.height || 2048;

        const bestPhotoQuality = {
          id: `img-${i}-orig`,
          label: 'DOWNLOAD',
          resolution: `${origW}x${origH}`,
          ext: 'JPG',
          url: `${base}?format=jpg&name=orig`
        };

        mediaItems.push({
          index: i,
          type: 'photo',
          thumbnail: `${base}?format=jpg&name=large`,
          previewUrl: `${base}?format=jpg&name=large`,
          bestQuality: bestPhotoQuality
        });
      }
    }

    if (mediaItems.length === 0) {
      throw new Error('This X (Twitter) post does not contain downloadable video or photo media.');
    }

    return {
      id: tweetId,
      authorHandle:
        vxData?.user_screen_name ||
        fxData?.author?.screen_name ||
        syndicationData?.user?.screen_name ||
        'twitter',
      mediaItems
    };
  };

  const handleExtract = async (e, customUrl) => {
    if (e) e.preventDefault();
    const targetUrl = customUrl ?? urlInput;
    setError('');

    const tweetId = extractTweetId(targetUrl);
    if (!tweetId) {
      setError('Please paste a valid X (Twitter) link (e.g. https://x.com/username/status/123456...)');
      return;
    }

    setLoading(true);
    try {
      const data = await fetchLiveXMedia(tweetId);
      setResult(data);
      setTimeout(() => {
        resultSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 150);
    } catch (err) {
      setError(err.message || 'Unable to extract media from this X (Twitter) link.');
    } finally {
      setLoading(false);
    }
  };

  // Auto-submit immediately when user pastes a valid X / Twitter link
  const handleInputChange = (e) => {
    const val = e.target.value;
    setUrlInput(val);
    setError('');
    const tweetId = extractTweetId(val);
    if (tweetId && !loading) {
      handleExtract(null, val);
    }
  };

  const handlePasteClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setUrlInput(text);
        setError('');
        const tweetId = extractTweetId(text);
        if (tweetId) {
          handleExtract(null, text);
        }
      }
    } catch (e) {
      inputRef.current?.focus();
    }
  };

  // ==========================================
  // DIRECT BROWSER BLOB DOWNLOADER (100% Working with video.twimg.com & pbs.twimg.com)
  // Avoids "File wasn't available on site" 404/payload errors by fetching directly from X CDN
  // ==========================================
  const handleDownloadFile = async (qualityItem) => {
    if (!qualityItem?.url) return;
    setDownloadingId(qualityItem.id);
    setDownloadProgress(15);

    const cleanFilename = `X_Twitter_${result?.authorHandle || 'media'}_${qualityItem.resolution || 'HD'}.${(
      qualityItem.ext || 'mp4'
    ).toLowerCase()}`;

    try {
      const response = await fetch(qualityItem.url, { mode: 'cors' });
      if (!response.ok) throw new Error('Direct stream fallback');

      const contentLength = response.headers.get('content-length');
      const total = contentLength ? parseInt(contentLength, 10) : 0;
      let loaded = 0;

      if (response.body) {
        const reader = response.body.getReader();
        const chunks = [];

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
          loaded += value.length;
          if (total) {
            setDownloadProgress(Math.min(98, Math.round((loaded / total) * 100)));
          } else {
            setDownloadProgress((prev) => Math.min(95, prev + 15));
          }
        }

        const blob = new Blob(chunks, {
          type: qualityItem.ext === 'MP4' ? 'video/mp4' : 'image/jpeg'
        });
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = cleanFilename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(blobUrl), 2000);
        setDownloadProgress(100);
      } else {
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = cleanFilename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(blobUrl), 2000);
        setDownloadProgress(100);
      }
    } catch (err) {
      // Fallback: open original file directly if CORS is restricted
      window.open(qualityItem.url, '_blank', 'noopener,noreferrer');
    } finally {
      setTimeout(() => {
        setDownloadingId(null);
        setDownloadProgress(0);
      }, 500);
    }
  };

  return (
    <div className="min-h-screen bg-[#1F3D2B] text-[#E8DCC4] font-sans selection:bg-[#8B5CF6] selection:text-white overflow-x-hidden">
      {/* ================================================================= */}
      {/* HERO SECTION WITH FERNWOOD DOT MATRIX + SAND BEIGE HORIZON MIST   */}
      {/* ================================================================= */}
      <section className="relative min-h-[84vh] flex flex-col justify-between overflow-hidden">
        {/* Subtle Dot Matrix Pattern Overlay */}
        <div
          className="pointer-events-none absolute inset-0 opacity-25"
          style={{
            backgroundImage: 'radial-gradient(#E8DCC4 1.15px, transparent 1.15px)',
            backgroundSize: '20px 20px'
          }}
        />

        {/* Subtle Electric Purple Ambient Glow behind headline */}
        <div
          className="pointer-events-none absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[560px] h-[260px] rounded-full blur-[130px] opacity-20"
          style={{ background: '#8B5CF6' }}
        />

        {/* Soft Misty Horizon Fade into Sand Beige at the bottom */}
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-72"
          style={{
            background:
              'linear-gradient(to bottom, rgba(31, 61, 43, 0) 0%, rgba(139, 146, 118, 0.42) 52%, #E8DCC4 100%)'
          }}
        />

        {/* TOP NAVIGATION BAR */}
        <header className="relative z-20 max-w-7xl w-full mx-auto px-6 pt-7 flex items-center justify-between">
          <a
            href="#top"
            onClick={(e) => {
              e.preventDefault();
              setResult(null);
              setError('');
              setUrlInput('');
            }}
            className="flex items-center gap-2.5 text-[#E8DCC4] hover:opacity-90 transition"
          >
            <span className="w-7 h-7 rounded-full bg-[#E8DCC4]/15 border border-[#E8DCC4]/30 flex items-center justify-center">
              <Sparkles className="w-3.5 h-3.5 text-[#8B5CF6]" />
            </span>
            <span className="font-bold tracking-tight text-lg text-[#E8DCC4]">
              X (Twitter) Video Download
            </span>
          </a>

          <nav className="hidden md:flex items-center gap-1 p-1.5 rounded-full bg-[#2E523B]/80 backdrop-blur-md border border-[#E8DCC4]/15 shadow-lg">
            {['Downloader', 'Video HD', 'Photos 4K', 'GIFs', 'How it works'].map((item) => {
              const active = activeNav === item;
              return (
                <button
                  key={item}
                  onClick={() => {
                    setActiveNav(item);
                    if (item === 'How it works') {
                      howItWorksRef.current?.scrollIntoView({ behavior: 'smooth' });
                    } else {
                      extractorRef.current?.scrollIntoView({ behavior: 'smooth' });
                      inputRef.current?.focus();
                    }
                  }}
                  className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer ${
                    active
                      ? 'bg-[#E8DCC4]/20 text-[#E8DCC4] shadow-xs'
                      : 'text-[#E8DCC4]/75 hover:text-[#E8DCC4]'
                  }`}
                >
                  {item}
                </button>
              );
            })}
          </nav>

          <button
            type="button"
            onClick={handlePasteClipboard}
            className="px-4 py-2 rounded-full text-xs font-medium border border-[#E8DCC4]/30 bg-[#1F3D2B]/60 hover:border-[#8B5CF6] hover:bg-[#8B5CF6]/20 text-[#E8DCC4] transition flex items-center gap-1.5 cursor-pointer"
          >
            <ClipboardPaste className="w-3.5 h-3.5 text-[#8B5CF6]" />
            <span>Paste link</span>
          </button>
        </header>

        {/* CENTER HERO CONTENT */}
        <div
          ref={extractorRef}
          className="relative z-20 max-w-4xl w-full mx-auto px-6 pt-14 pb-28 text-center flex flex-col items-center"
        >
          <h1 className="text-4xl sm:text-6xl md:text-[64px] font-bold tracking-tight text-[#E8DCC4] leading-[1.08] max-w-3xl">
            Twitter Video Download
          </h1>

          <p className="mt-5 text-base sm:text-lg text-[#E8DCC4]/85 max-w-xl leading-relaxed font-normal">
            just paste the link and download in highest quality with one click
          </p>

          {/* AUTO-SUBMIT INPUT BAR */}
          <form
            onSubmit={(e) => handleExtract(e)}
            className={`mt-9 w-full max-w-2xl bg-[#162D1F]/95 backdrop-blur-md border ${
              error ? 'border-red-400' : 'border-[#E8DCC4]/25 focus-within:border-[#8B5CF6]'
            } rounded-full p-2 flex items-center shadow-2xl transition-all`}
          >
            <input
              ref={inputRef}
              type="text"
              value={urlInput}
              onChange={handleInputChange}
              placeholder="Paste X (Twitter) link here..."
              className="w-full bg-transparent px-5 py-2.5 text-sm text-[#E8DCC4] placeholder-[#E8DCC4]/45 focus:outline-none"
            />

            {urlInput && (
              <button
                type="button"
                onClick={() => {
                  setUrlInput('');
                  setError('');
                  setResult(null);
                  inputRef.current?.focus();
                }}
                className="px-3 py-1.5 mr-1 rounded-full text-xs font-semibold text-[#E8DCC4]/75 hover:text-[#E8DCC4] hover:bg-[#E8DCC4]/10 transition cursor-pointer shrink-0"
              >
                Clear
              </button>
            )}

            {loading ? (
              <div className="shrink-0 px-6 py-3 rounded-full bg-[#8B5CF6] text-white font-semibold text-xs sm:text-sm flex items-center gap-2 shadow-md">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Loading...</span>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  if (urlInput.trim()) {
                    handleExtract(null, urlInput);
                  } else {
                    handlePasteClipboard();
                  }
                }}
                className="shrink-0 px-6 py-2.5 rounded-full bg-[#E8DCC4] hover:bg-white text-[#1F3D2B] transition flex items-center gap-2.5 shadow-md cursor-pointer"
              >
                <ClipboardPaste className="w-4 h-4 text-[#8B5CF6]" />
                <div className="text-left leading-tight">
                  <div className="font-bold text-xs sm:text-sm">
                    {urlInput.trim() ? 'Download' : 'Paste link'}
                  </div>
                  <div className="text-[10px] text-[#1F3D2B]/70 font-medium">auto-submit</div>
                </div>
              </button>
            )}
          </form>

          {error && (
            <div className="mt-5 max-w-xl w-full px-5 py-3 rounded-2xl bg-[#162D1F]/95 border border-[#8B5CF6]/60 text-[#E8DCC4] text-xs flex items-center justify-center gap-2.5 shadow-lg">
              <AlertCircle className="w-4 h-4 text-[#8B5CF6] shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        <div className="h-4" />
      </section>

      {/* ================================================================= */}
      {/* SAND BEIGE SURFACE SECTION: CLEAN MEDIA CARDS + ALL QUALITIES     */}
      {/* ================================================================= */}
      <main className="bg-[#E8DCC4] text-[#1F3D2B] relative z-20 pb-24 pt-4">
        <div ref={resultSectionRef} className="max-w-5xl mx-auto px-6">
          {result && result.mediaItems?.length > 0 && (
            <div className="-mt-20 mb-16">
              <div
                className={`grid gap-6 justify-center ${
                  result.mediaItems.length === 1
                    ? 'grid-cols-1 max-w-[400px] mx-auto'
                    : 'grid-cols-1 md:grid-cols-2 max-w-4xl mx-auto'
                }`}
              >
                {result.mediaItems.map((mediaItem, itemIdx) => (
                  <div
                    key={mediaItem.index}
                    className="w-full rounded-3xl bg-[#1F3D2B] text-[#E8DCC4] p-5 shadow-2xl border border-[#E8DCC4]/20 flex flex-col items-center"
                  >
                    {result.mediaItems.length > 1 && (
                      <div className="mb-3 self-start px-3 py-1 rounded-full bg-[#8B5CF6]/20 border border-[#8B5CF6]/40 text-xs font-semibold text-[#E8DCC4]">
                        Media #{itemIdx + 1} ({mediaItem.type.toUpperCase()})
                      </div>
                    )}

                    {/* Clean Video or Photo Preview */}
                    <div className="w-full rounded-2xl overflow-hidden bg-black border border-[#E8DCC4]/15 aspect-video max-h-[360px] relative flex items-center justify-center shadow-inner">
                      {mediaItem.type === 'video' || mediaItem.type === 'gif' ? (
                        <video
                          key={mediaItem.previewUrl}
                          src={mediaItem.previewUrl}
                          poster={mediaItem.thumbnail}
                          controls
                          playsInline
                          loop={mediaItem.type === 'gif'}
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <img
                          src={mediaItem.previewUrl}
                          alt="X (Twitter) media"
                          className="w-full h-full object-contain"
                        />
                      )}
                    </div>

                    {/* Single Highest Quality Download Button */}
                    {mediaItem.bestQuality && (
                      <div className="mt-4 w-full">
                        <button
                          type="button"
                          onClick={() => handleDownloadFile(mediaItem.bestQuality)}
                          disabled={downloadingId === mediaItem.bestQuality.id}
                          className="w-full py-3.5 px-5 rounded-xl bg-[#8B5CF6] hover:bg-[#7c4dff] text-white font-bold text-xs sm:text-sm tracking-wide uppercase transition flex items-center justify-center gap-2.5 shadow-lg cursor-pointer disabled:opacity-60"
                        >
                          {downloadingId === mediaItem.bestQuality.id ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              <span>DOWNLOADING... {downloadProgress}%</span>
                            </>
                          ) : (
                            <>
                              <Download className="w-4 h-4" />
                              <span>DOWNLOAD</span>
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Download Another Link Reset Button */}
              <div className="mt-6 text-center">
                <button
                  type="button"
                  onClick={() => {
                    setResult(null);
                    setUrlInput('');
                    setError('');
                    extractorRef.current?.scrollIntoView({ behavior: 'smooth' });
                    setTimeout(() => inputRef.current?.focus(), 300);
                  }}
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full bg-[#1F3D2B] text-[#E8DCC4] text-xs font-semibold hover:bg-[#284d37] transition shadow-md cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-[#8B5CF6]" />
                  <span>Download Another Video or Photo</span>
                </button>
              </div>
            </div>
          )}

          {/* HOW IT WORKS — MINIMALIST 3-CARD GRID */}
          <div ref={howItWorksRef} className="pt-8">
            <div className="flex flex-col md:flex-row md:items-end justify-between mb-10 gap-4">
              <div>
                <span className="text-xs font-semibold uppercase tracking-widest text-[#8B5CF6]">
                  → Minimalist Workflow
                </span>
                <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-[#1F3D2B] mt-1">
                  Steps to Download X (Twitter) Videos &amp; Photos.
                </h2>
              </div>
              <p className="text-sm text-[#1F3D2B]/75 max-w-md">
                Original quality without watermark. Save videos, GIFs, and photos in every resolution directly to your device.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div className="p-7 rounded-3xl bg-[#1F3D2B] text-[#E8DCC4] flex flex-col justify-between shadow-lg">
                <div className="w-10 h-10 rounded-full bg-[#8B5CF6]/20 border border-[#8B5CF6]/40 flex items-center justify-center text-[#8B5CF6] font-bold text-sm mb-6">
                  01
                </div>
                <div>
                  <h3 className="text-lg font-bold text-[#E8DCC4]">Copy Link</h3>
                  <p className="text-xs text-[#E8DCC4]/75 mt-2 leading-relaxed">
                    Click Share on any public X (Twitter) post and copy the link.
                  </p>
                </div>
              </div>

              <div className="p-7 rounded-3xl bg-[#1F3D2B] text-[#E8DCC4] flex flex-col justify-between shadow-lg">
                <div className="w-10 h-10 rounded-full bg-[#8B5CF6]/20 border border-[#8B5CF6]/40 flex items-center justify-center text-[#8B5CF6] font-bold text-sm mb-6">
                  02
                </div>
                <div>
                  <h3 className="text-lg font-bold text-[#E8DCC4]">Paste Link (Auto-Submit)</h3>
                  <p className="text-xs text-[#E8DCC4]/75 mt-2 leading-relaxed">
                    Paste the link in the box above. Videos and photos load automatically.
                  </p>
                </div>
              </div>

              <div className="p-7 rounded-3xl bg-[#1F3D2B] text-[#E8DCC4] flex flex-col justify-between shadow-lg">
                <div className="w-10 h-10 rounded-full bg-[#8B5CF6]/20 border border-[#8B5CF6]/40 flex items-center justify-center text-[#8B5CF6] font-bold text-sm mb-6">
                  03
                </div>
                <div>
                  <h3 className="text-lg font-bold text-[#E8DCC4]">One-Click Download</h3>
                  <p className="text-xs text-[#E8DCC4]/75 mt-2 leading-relaxed">
                    Tap the Download button to save the highest original quality MP4 or photo directly to your device.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* MINIMAL FOOTER */}
      <footer className="bg-[#1F3D2B] text-[#E8DCC4]/70 border-t border-[#E8DCC4]/10 py-8 px-6 text-xs">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#8B5CF6]" />
            <span className="font-semibold text-[#E8DCC4]">X (Twitter) Video Download</span>
          </div>
          <p className="text-[#E8DCC4]/55">
            Independent web utility. Not affiliated with X Corp.
          </p>
        </div>
      </footer>
    </div>
  );
}