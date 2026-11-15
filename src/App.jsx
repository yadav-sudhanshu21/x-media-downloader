import React, { useState, useRef } from 'react';
import {
  Download,
  Sparkles,
  AlertCircle,
  Loader2,
  ClipboardPaste,
  RotateCcw,
  ShieldCheck,
  X,
  ChevronDown,
  Smartphone,
  Monitor,
  CheckCircle2,
  HelpCircle
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

const FAQ_ITEMS = [
  {
    q: 'Is Free Twitter Video Downloader completely free to use?',
    a: 'Yes, our tool is 100% free with no hidden subscriptions, daily limits, or registration requirements. You can save as many public Twitter (X) videos, looping GIFs, and high-resolution images as you need.'
  },
  {
    q: 'How do I download Twitter videos on iPhone or iPad (iOS)?',
    a: 'Open the X (Twitter) app on your iPhone, tap the Share icon beneath the video post, and choose Copy Link. Open Safari or Chrome, visit freetwittervideodownloader.com, tap Paste link, and press Download. The MP4 file will save directly to your iOS Downloads folder, where you can tap "Save Video" to move it to your Photos app.'
  },
  {
    q: 'What video resolution does this downloader provide?',
    a: 'Our extraction engine automatically inspects every video variant hosted on the official CDN and selects the highest original resolution uploaded by the creator—up to Full HD 1080p MP4 with original audio intact and zero watermarks.'
  },
  {
    q: 'Can I save posts that contain multiple videos or photos?',
    a: 'Absolutely. If a single Twitter post or thread card contains up to four videos, GIFs, or photos, our tool automatically detects every item in the post and displays individual preview cards with dedicated one-click download buttons.'
  },
  {
    q: 'Why does the tool convert Twitter GIFs into MP4 files?',
    a: 'Twitter (X) encodes all uploaded animated GIFs as high-efficiency looping MP4 video streams to preserve frame rate and color accuracy. Downloading them in MP4 format ensures smooth playback across all phones, messaging apps, and video editors.'
  },
  {
    q: 'Can I download videos from private or protected accounts?',
    a: 'No. Out of respect for user privacy and platform security policies, our tool only indexes public posts. Protected tweets or private account media cannot be accessed.'
  },
  {
    q: 'Do you store downloaded videos or track my link history?',
    a: 'Never. We operate strictly as a real-time client-side media indexer. We do not host or archive copies of any videos on our servers—every file streams directly from Twitter’s public content delivery network (CDN) to your device.'
  }
];

export default function App() {
  const [urlInput, setUrlInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [downloadingId, setDownloadingId] = useState(null);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [activeModal, setActiveModal] = useState(null); // 'privacy' | 'about' | null
  const [openFaqIndex, setOpenFaqIndex] = useState(0);

  const extractorRef = useRef(null);
  const resultSectionRef = useRef(null);
  const howItWorksRef = useRef(null);
  const inputRef = useRef(null);

  // ==========================================
  // MULTI-SOURCE X / TWITTER ENGINE (Serverless /api/twitter + FXTwitter + VXTwitter)
  // ==========================================
  const fetchLiveXMedia = async (tweetId) => {
    let vxData = null;
    let fxData = null;
    let syndicationData = null;

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
        'Could not reach this Twitter post. Ensure the post is public and contains video or photo media.'
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

        const combinedRawVariants = [
          ...(synItem?.video_info?.variants || []),
          ...(syndicationData?.video?.variants || []),
          ...(fxItem?.variants || []),
          ...(fxItem?.formats || []),
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

            const dims = resolution.includes('x') ? resolution.split('x').map(Number) : [0, 0];
            const pixelArea = (dims[0] || 0) * (dims[1] || 0);
            const bitrateKbps = v.bitrate ? Math.round(v.bitrate / 1000) : Math.round(pixelArea / 500) || (4 - idx) * 500;

            return {
              id: `vid-${i}-${idx}`,
              label: 'DOWNLOAD',
              resolution,
              pixelArea,
              bitrate: bitrateKbps,
              ext: 'MP4',
              url: v.url
            };
          })
          .sort((a, b) => (b.pixelArea - a.pixelArea) || (b.bitrate - a.bitrate));

        const uniqueQualities = [];
        const seenResolutions = new Set();
        mp4Variants.forEach((q) => {
          const cleanUrl = q.url.split('?')[0];
          const key = q.resolution || cleanUrl;
          if (!seenResolutions.has(key)) {
            seenResolutions.add(key);
            uniqueQualities.push(q);
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

        mediaItems.push({
          index: i,
          type: 'photo',
          thumbnail: `${base}?format=jpg&name=large`,
          previewUrl: `${base}?format=jpg&name=large`,
          bestQuality: {
            id: `img-${i}-orig`,
            label: 'DOWNLOAD',
            resolution: `${origW}x${origH}`,
            ext: 'JPG',
            url: `${base}?format=jpg&name=orig`
          }
        });
      }
    }

    if (mediaItems.length === 0) {
      throw new Error('This Twitter post does not contain downloadable video or photo media.');
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
      setError('Please paste a valid Twitter link (e.g. https://x.com/username/status/123456...)');
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
      setError(err.message || 'Unable to extract media from this Twitter link.');
    } finally {
      setLoading(false);
    }
  };

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

  const handleDownloadFile = async (qualityItem) => {
    if (!qualityItem?.url) return;
    setDownloadingId(qualityItem.id);
    setDownloadProgress(15);

    const cleanFilename = `Free_Twitter_Video_${result?.authorHandle || 'media'}_${qualityItem.resolution || 'HD'}.${(
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
      <section className="relative min-h-[82vh] flex flex-col justify-between overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0 opacity-25"
          style={{
            backgroundImage: 'radial-gradient(#E8DCC4 1.15px, transparent 1.15px)',
            backgroundSize: '20px 20px'
          }}
        />

        <div
          className="pointer-events-none absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[560px] h-[260px] rounded-full blur-[130px] opacity-20"
          style={{ background: '#8B5CF6' }}
        />

        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-72"
          style={{
            background:
              'linear-gradient(to bottom, rgba(31, 61, 43, 0) 0%, rgba(139, 146, 118, 0.42) 52%, #E8DCC4 100%)'
          }}
        />

        {/* CLEAN TOP HEADER */}
        <header className="relative z-20 max-w-6xl w-full mx-auto px-6 pt-7 flex items-center justify-between">
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
              Free Twitter Video Downloader
            </span>
          </a>

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
              placeholder="Paste Twitter link here..."
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
      {/* SAND BEIGE SURFACE SECTION: MEDIA CARD, WORKFLOW, SEO GUIDE & FAQ */}
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
                          alt="Free Twitter Video Download media"
                          className="w-full h-full object-contain"
                        />
                      )}
                    </div>

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
                  Steps for Free Twitter Video Download.
                </h2>
              </div>
              <p className="text-sm text-[#1F3D2B]/75 max-w-md">
                Original quality without watermark. Save videos, GIFs, and photos in highest resolution directly to your device.
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
                    Click Share on any public Twitter post and copy the link.
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

          {/* ================================================================= */}
          {/* COMPREHENSIVE SEO GUIDE & DEVICE COMPATIBILITY (AdSense Approved) */}
          {/* ================================================================= */}
          <section className="mt-20 pt-14 border-t border-[#1F3D2B]/15">
            <div className="max-w-3xl">
              <span className="text-xs font-semibold uppercase tracking-widest text-[#8B5CF6]">
                → Complete Platform Guide
              </span>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#1F3D2B] mt-1">
                Fast, Lossless Twitter (X) Media Extraction Across Every Device.
              </h2>
              <p className="mt-4 text-sm text-[#1F3D2B]/80 leading-relaxed">
                Twitter (now known as X) hosts millions of breaking news clips, tutorials, sports highlights, and creative animations every day, but the native app does not include a built-in button to save videos offline without a paid subscription. <strong>Free Twitter Video Downloader</strong> bridges that gap with an instant browser-based utility that extracts the raw MP4 video stream directly from official CDN servers.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
              {/* Mobile Guide Card */}
              <div className="p-7 rounded-3xl bg-[#1F3D2B]/5 border border-[#1F3D2B]/15 space-y-3">
                <div className="w-10 h-10 rounded-2xl bg-[#1F3D2B] text-[#E8DCC4] flex items-center justify-center">
                  <Smartphone className="w-5 h-5 text-[#8B5CF6]" />
                </div>
                <h3 className="text-lg font-bold text-[#1F3D2B]">
                  Saving Videos on iPhone (iOS) &amp; Android
                </h3>
                <p className="text-xs text-[#1F3D2B]/80 leading-relaxed">
                  Whether you use Safari on iPhone or Chrome on Android, our auto-submit clipboard detector eliminates extra taps. Simply copy any public status link from the X app, tap our <strong>Paste link</strong> button, and press <strong>Download</strong>. Your video saves straight to your phone&apos;s Gallery or Files app in its highest available resolution.
                </p>
              </div>

              {/* Desktop Guide Card */}
              <div className="p-7 rounded-3xl bg-[#1F3D2B]/5 border border-[#1F3D2B]/15 space-y-3">
                <div className="w-10 h-10 rounded-2xl bg-[#1F3D2B] text-[#E8DCC4] flex items-center justify-center">
                  <Monitor className="w-5 h-5 text-[#8B5CF6]" />
                </div>
                <h3 className="text-lg font-bold text-[#1F3D2B]">
                  Saving Full HD Clips on Windows, Mac &amp; Linux
                </h3>
                <p className="text-xs text-[#1F3D2B]/80 leading-relaxed">
                  On desktop browsers, right-clicking a video on X.com won&apos;t let you save the file because videos are streamed in segmented containers. Pasting the post URL into our tool reconstructs the highest-bitrate single MP4 file—up to 1080p Full HD—along with uncompressed original (`orig`) resolution photos for multi-media tweets.
                </p>
              </div>
            </div>

            {/* Key Features Pill List */}
            <div className="mt-6 p-7 rounded-3xl bg-[#1F3D2B] text-[#E8DCC4] shadow-xl">
              <h3 className="text-base font-bold text-[#E8DCC4] mb-4">
                Why Creators &amp; Researchers Prefer Free Twitter Video Downloader
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs text-[#E8DCC4]/85">
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-[#8B5CF6] shrink-0 mt-0.5" />
                  <span><strong>Automatic Highest Bitrate Selection:</strong> Always grabs the top resolution (`1080p` / `720p` MP4 or `orig` JPG) automatically.</span>
                </div>
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-[#8B5CF6] shrink-0 mt-0.5" />
                  <span><strong>Multi-Media Carousel Support:</strong> Extracts all 2, 3, or 4 videos and photos from complex thread posts at once.</span>
                </div>
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-[#8B5CF6] shrink-0 mt-0.5" />
                  <span><strong>Zero Watermarks or Re-Encoding:</strong> Delivers the untouched source stream straight from the CDN without quality loss.</span>
                </div>
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-[#8B5CF6] shrink-0 mt-0.5" />
                  <span><strong>Instant Auto-Submit Workflow:</strong> Starts loading your preview the moment a valid `x.com` or `twitter.com` link is pasted.</span>
                </div>
              </div>
            </div>
          </section>

          {/* ================================================================= */}
          {/* INTERACTIVE FAQ ACCORDION SECTION                                 */}
          {/* ================================================================= */}
          <section className="mt-16 pt-12 border-t border-[#1F3D2B]/15">
            <div className="flex items-center gap-2.5 mb-2">
              <HelpCircle className="w-4 h-4 text-[#8B5CF6]" />
              <span className="text-xs font-semibold uppercase tracking-widest text-[#8B5CF6]">
                Frequently Asked Questions
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#1F3D2B] mb-8">
              Everything You Need to Know.
            </h2>

            <div className="space-y-3">
              {FAQ_ITEMS.map((item, idx) => {
                const isOpen = openFaqIndex === idx;
                return (
                  <div
                    key={idx}
                    className="rounded-2xl bg-[#1F3D2B] text-[#E8DCC4] overflow-hidden shadow-md border border-[#1F3D2B]"
                  >
                    <button
                      type="button"
                      onClick={() => setOpenFaqIndex(isOpen ? -1 : idx)}
                      className="w-full px-6 py-4 text-left flex items-center justify-between gap-4 hover:bg-[#264934] transition cursor-pointer"
                    >
                      <span className="font-bold text-sm text-[#E8DCC4]">{item.q}</span>
                      <ChevronDown
                        className={`w-4 h-4 text-[#8B5CF6] shrink-0 transition-transform duration-200 ${
                          isOpen ? 'rotate-180' : ''
                        }`}
                      />
                    </button>
                    {isOpen && (
                      <div className="px-6 pb-5 pt-1 text-xs text-[#E8DCC4]/80 leading-relaxed border-t border-[#E8DCC4]/10">
                        {item.a}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </main>

      {/* ================================================================= */}
      {/* PROFESSIONAL GLOBAL-BRAND FOOTER & AD-READY LEGAL COMPLIANCE      */}
      {/* ================================================================= */}
      <footer className="bg-[#1F3D2B] text-[#E8DCC4]/80 border-t border-[#E8DCC4]/15 pt-14 pb-10 px-6 text-xs">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-10 pb-10 border-b border-[#E8DCC4]/10">
            {/* Brand & CDN Disclaimer Column */}
            <div className="md:col-span-6 space-y-3">
              <div className="flex items-center gap-2.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#8B5CF6]" />
                <span className="font-bold text-base text-[#E8DCC4]">
                  Free Twitter Video Downloader
                </span>
              </div>
              <p className="text-[#E8DCC4]/65 leading-relaxed max-w-md">
                Our platform operates strictly as a client-side media indexing tool. We never store, archive, or host third-party videos or images on our infrastructure—every file is fetched in real time directly from official public content delivery networks (CDNs) to your device.
              </p>
              <p className="text-[#E8DCC4]/50 text-[11px]">
                &copy; {new Date().getFullYear()} Free Twitter Video Downloader. All rights reserved.
              </p>
            </div>

            {/* Links Column */}
            <div className="md:col-span-3 space-y-2.5">
              <h4 className="font-bold text-[#E8DCC4] uppercase tracking-wider text-[11px]">
                Links
              </h4>
              <ul className="space-y-2 text-[#E8DCC4]/70">
                <li>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveModal(null);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="hover:text-[#E8DCC4] transition cursor-pointer"
                  >
                    Home
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => setActiveModal('about')}
                    className="hover:text-[#E8DCC4] transition cursor-pointer"
                  >
                    About
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => setActiveModal('privacy')}
                    className="hover:text-[#E8DCC4] transition cursor-pointer"
                  >
                    Privacy Policy
                  </button>
                </li>
              </ul>
            </div>

            {/* Related Sites Column (Cross-Links Your Instagram Site!) */}
            <div className="md:col-span-3 space-y-2.5">
              <h4 className="font-bold text-[#E8DCC4] uppercase tracking-wider text-[11px]">
                Related Sites
              </h4>
              <ul className="space-y-2 text-[#E8DCC4]/70">
                <li>
                  <a
                    href="https://insta-reel-downloader-five.vercel.app"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-[#8B5CF6] transition flex items-center gap-1.5"
                  >
                    <span>Instagram Reel Downloader</span>
                  </a>
                </li>
              </ul>
            </div>
          </div>

          <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-[#E8DCC4]/50 text-[11px]">
            <span>Independent web utility. Not affiliated with X Corp.</span>
            <button
              type="button"
              onClick={() => setActiveModal('privacy')}
              className="hover:text-[#E8DCC4] underline transition cursor-pointer"
            >
              View Full Privacy Policy &amp; Terms
            </button>
          </div>
        </div>
      </footer>

      {/* ================================================================= */}
      {/* CLEAN PRIVACY POLICY & ABOUT MODAL (AdSense / Monetag Compliant)  */}
      {/* ================================================================= */}
      {activeModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#1F3D2B] border border-[#E8DCC4]/25 text-[#E8DCC4] rounded-3xl max-w-2xl w-full max-h-[82vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="px-6 py-4 bg-[#162D1F] border-b border-[#E8DCC4]/15 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#8B5CF6]" />
                <h3 className="font-bold text-sm sm:text-base">
                  {activeModal === 'privacy' ? 'Privacy Policy & Terms of Use' : 'About Free Twitter Video Downloader'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="p-1.5 rounded-full hover:bg-[#E8DCC4]/10 text-[#E8DCC4]/70 hover:text-[#E8DCC4] transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 text-xs leading-relaxed text-[#E8DCC4]/80">
              {activeModal === 'privacy' ? (
                <>
                  <p>
                    This Privacy &amp; Data Protection Notice explains how <strong>Free Twitter Video Downloader</strong> handles visitor data when you access or use our web application.
                  </p>

                  <h4 className="font-bold text-sm text-[#E8DCC4] pt-2">1. Anonymous Technical Telemetry</h4>
                  <p>
                    We do not require user registration or collect personal identity details. When you visit our website, standard non-identifiable technical metadata—such as device category, browser version, operating system, and general regional analytics—may be processed automatically to maintain server speed and reliability.
                  </p>

                  <h4 className="font-bold text-sm text-[#E8DCC4] pt-2">2. Cookies &amp; Advertising Partners</h4>
                  <p>
                    Our web application may utilize essential browser storage and third-party advertising cookies to keep the service free of charge. You can disable or clear cookies at any time through your browser settings without losing access to our core download tools.
                  </p>

                  <h4 className="font-bold text-sm text-[#E8DCC4] pt-2">3. Purpose of Data Processing</h4>
                  <ul className="list-disc pl-5 space-y-1.5">
                    <li>
                      <strong>Service Delivery:</strong> Processing public post links you submit in real time to locate direct media streams.
                    </li>
                    <li>
                      <strong>Performance Optimization:</strong> Monitoring error rates and load times to keep media extraction fast across mobile and desktop devices.
                    </li>
                  </ul>

                  <h4 className="font-bold text-sm text-[#E8DCC4] pt-2">4. Intellectual Property &amp; Direct CDN Streaming</h4>
                  <p>
                    We do not host, cache, or redistribute copyrighted media on our servers. All video and photo streams are delivered directly from the original platform&apos;s public CDN servers to the end user&apos;s browser. Users are solely responsible for ensuring they have the right to save and use any downloaded content for personal or authorized purposes.
                  </p>

                  <h4 className="font-bold text-sm text-[#E8DCC4] pt-2">5. Consent to Terms</h4>
                  <p>
                    By using this web tool, you agree to the practices described in this notice and our terms of service. If you do not agree, please discontinue use of the website.
                  </p>
                </>
              ) : (
                <>
                  <p>
                    <strong>Free Twitter Video Downloader</strong> is an independent web utility built to help users save public videos, looping GIFs, and high-resolution images in their original unwatermarked quality.
                  </p>
                  <p>
                    We never store media on our servers or require account logins—every download streams directly from the source CDN to your device.
                  </p>
                </>
              )}
            </div>

            <div className="px-6 py-3.5 bg-[#162D1F] border-t border-[#E8DCC4]/15 flex justify-end">
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="px-5 py-2 rounded-full bg-[#8B5CF6] text-white font-semibold text-xs hover:bg-[#7c4dff] transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}