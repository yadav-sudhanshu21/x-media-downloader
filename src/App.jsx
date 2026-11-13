import React, { useState, useRef } from 'react';
import {
  Download,
  Film,
  Image as ImageIcon,
  Sparkles,
  Check,
  Copy,
  ExternalLink,
  AlertCircle,
  Loader2,
  Play,
  ArrowRight,
  Clock,
  ShieldCheck,
  Zap,
  Layers,
  Trash2,
  ChevronRight
} from 'lucide-react';

// Curated Demo Presets so you can test 1-click extraction immediately
const DEMO_PRESETS = [
  {
    label: '4K SpaceX Launch Video',
    url: 'https://x.com/SpaceX/status/1798744462211252512',
    mockData: {
      id: '1798744462211252512',
      authorName: 'SpaceX',
      authorHandle: 'SpaceX',
      authorAvatar: 'https://images.unsplash.com/photo-1517976487468-f20514c4450b?w=120&auto=format&fit=crop&q=80',
      text: 'Liftoff of Starship! Full multi-angle telemetry stream captured from X (Formely Twitter) broadcast.',
      date: '10:42 AM · Jun 6, 2024',
      likes: '148.2K',
      retweets: '31.4K',
      mediaItems: [
        {
          index: 0,
          type: 'video',
          thumbnail: 'https://images.unsplash.com/photo-1517976487468-f20514c4450b?w=1200&auto=format&fit=crop&q=85',
          duration: '0:30',
          previewUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
          qualities: [
            {
              id: 'v-1080p',
              label: '1080p Full HD',
              resolution: '1920x1080',
              bitrate: 8420,
              ext: 'MP4',
              sizeEst: '14.8 MB',
              badge: 'MAX BITRATE',
              url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4'
            },
            {
              id: 'v-720p',
              label: '720p HD',
              resolution: '1280x720',
              bitrate: 3650,
              ext: 'MP4',
              sizeEst: '6.4 MB',
              badge: 'HD',
              url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4'
            },
            {
              id: 'v-480p',
              label: '480p Standard',
              resolution: '854x480',
              bitrate: 1450,
              ext: 'MP4',
              sizeEst: '2.9 MB',
              badge: null,
              url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4'
            },
            {
              id: 'v-360p',
              label: '360p Compact',
              resolution: '640x360',
              bitrate: 820,
              ext: 'MP4',
              sizeEst: '1.5 MB',
              badge: 'FAST',
              url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4'
            }
          ]
        }
      ]
    }
  },
  {
    label: 'ORIG 4K Architecture Gallery',
    url: 'https://x.com/ArchDigest/status/1829104920192849102',
    mockData: {
      id: '1829104920192849102',
      authorName: 'Architectural Studies',
      authorHandle: 'ArchDigest',
      authorAvatar: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=120&auto=format&fit=crop&q=80',
      text: 'Nordic botanical conservatory bathed in morning mist. Shot in uncompressed RAW for X (Formely Twitter).',
      date: '4:15 PM · Aug 29, 2024',
      likes: '62.9K',
      retweets: '9.1K',
      mediaItems: [
        {
          index: 0,
          type: 'photo',
          thumbnail: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1600&auto=format&fit=crop&q=90',
          previewUrl: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1600&auto=format&fit=crop&q=90',
          qualities: [
            {
              id: 'p-orig',
              label: 'ORIG (Uncompressed 4K)',
              resolution: '4096x2731',
              ext: 'JPG',
              sizeEst: '5.2 MB',
              badge: 'LOSSLESS ORIG',
              url: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=2400&auto=format&fit=crop&q=100'
            },
            {
              id: 'p-large',
              label: 'LARGE (2K High-Res)',
              resolution: '2048x1365',
              ext: 'JPG',
              sizeEst: '1.8 MB',
              badge: '2K',
              url: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1600&auto=format&fit=crop&q=90'
            },
            {
              id: 'p-medium',
              label: 'MEDIUM (1200px)',
              resolution: '1200x800',
              ext: 'JPG',
              sizeEst: '690 KB',
              badge: null,
              url: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1200&auto=format&fit=crop&q=80'
            },
            {
              id: 'p-small',
              label: 'SMALL (680px)',
              resolution: '680x453',
              ext: 'JPG',
              sizeEst: '240 KB',
              badge: 'THUMB',
              url: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=680&auto=format&fit=crop&q=75'
            }
          ]
        }
      ]
    }
  }
];

function extractTweetId(input) {
  if (!input) return null;
  const trimmed = input.trim();
  if (/^\d{10,25}$/.test(trimmed)) return trimmed;
  const match = trimmed.match(/(?:twitter\.com|x\.com|vxtwitter\.com|fxtwitter\.com)\/(?:[^/]+\/status|i\/web\/status|status)\/(\d+)/i);
  return match ? match[1] : null;
}

function normalizeImageBaseUrl(rawUrl) {
  if (!rawUrl) return '';
  return rawUrl.split('?')[0].replace(/\.(jpg|jpeg|png|webp)$/i, '');
}

export default function App() {
  const [urlInput, setUrlInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [activeMediaIndex, setActiveMediaIndex] = useState(0);
  const [downloadingId, setDownloadingId] = useState(null);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [copiedId, setCopiedId] = useState(null);
  const [activeNav, setActiveNav] = useState('Downloader');
  const [history, setHistory] = useState([]);

  const extractorRef = useRef(null);
  const howItWorksRef = useRef(null);

  const fetchLiveXMedia = async (tweetId) => {
    let vxData = null;
    let syndicationData = null;

    const [vxRes, synRes] = await Promise.allSettled([
      fetch(`https://api.vxtwitter.com/Twitter/status/${tweetId}`),
      fetch(`https://cdn.syndication.twimg.com/tweet-result?id=${tweetId}&lang=en&token=a`)
    ]);

    if (vxRes.status === 'fulfilled' && vxRes.value.ok) {
      try {
        vxData = await vxRes.value.json();
      } catch (e) {
        // fallback
      }
    }

    if (synRes.status === 'fulfilled' && synRes.value.ok) {
      try {
        syndicationData = await synRes.value.json();
      } catch (e) {
        // fallback
      }
    }

    if (!vxData && !syndicationData) {
      throw new Error(
        'Could not reach this X (Formely Twitter) post. Ensure the post is public and contains video or photo media.'
      );
    }

    const mediaItems = [];
    const synMediaList = syndicationData?.mediaDetails || [];
    const vxMediaList = vxData?.media_extended || [];
    const totalCount = Math.max(synMediaList.length, vxMediaList.length);

    for (let i = 0; i < totalCount; i++) {
      const synItem = synMediaList[i];
      const vxItem = vxMediaList[i];
      const rawType = synItem?.type || vxItem?.type || 'photo';

      if (rawType === 'video' || rawType === 'animated_gif' || rawType === 'gif') {
        const isGif = rawType === 'animated_gif' || rawType === 'gif';
        const variants = synItem?.video_info?.variants || [];
        const mp4Variants = variants
          .filter((v) => v.content_type === 'video/mp4' && v.url)
          .map((v, idx) => {
            const resMatch = v.url.match(/\/(\d+x\d+)\//);
            const resolution = resMatch ? resMatch[1] : idx === 0 ? '1920x1080' : '1280x720';
            const height = resolution.includes('x') ? resolution.split('x')[1] : 'HD';
            const bitrateKbps = v.bitrate ? Math.round(v.bitrate / 1000) : 2500;
            const durationSec =
              (synItem?.video_info?.duration_millis || vxItem?.duration_millis || 15000) / 1000;
            const estMB = ((bitrateKbps * durationSec) / 8 / 1024).toFixed(1);

            return {
              id: `vid-${i}-${idx}`,
              label: isGif ? 'Looping MP4 (GIF)' : `${height}p Quality`,
              resolution,
              bitrate: bitrateKbps,
              ext: 'MP4',
              sizeEst: `${Math.max(0.4, estMB)} MB`,
              url: v.url
            };
          })
          .sort((a, b) => b.bitrate - a.bitrate);

        if (mp4Variants.length === 0 && vxItem?.url) {
          mp4Variants.push({
            id: `vid-${i}-0`,
            label: isGif ? 'Original GIF (MP4)' : 'Original HD Stream',
            resolution: vxItem.size ? `${vxItem.size.width}x${vxItem.size.height}` : '1080p HD',
            bitrate: 4200,
            ext: 'MP4',
            sizeEst: '5.4 MB',
            url: vxItem.url
          });
        }

        const uniqueQualities = [];
        const seenUrls = new Set();
        mp4Variants.forEach((q, idx) => {
          if (!seenUrls.has(q.url)) {
            seenUrls.add(q.url);
            uniqueQualities.push({
              ...q,
              badge: idx === 0 ? 'MAX BITRATE' : idx === 1 ? 'HD' : null
            });
          }
        });

        mediaItems.push({
          index: i,
          type: isGif ? 'gif' : 'video',
          thumbnail:
            synItem?.media_url_https ||
            vxItem?.thumbnail_url ||
            'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800',
          previewUrl: uniqueQualities[0]?.url || vxItem?.url,
          duration:
            synItem?.video_info?.duration_millis
              ? `0:${String(Math.round(synItem.video_info.duration_millis / 1000)).padStart(2, '0')}`
              : 'HD',
          qualities: uniqueQualities
        });
      } else {
        const rawImg = synItem?.media_url_https || vxItem?.url;
        const base = normalizeImageBaseUrl(rawImg);
        const origW = synItem?.original_info?.width || vxItem?.size?.width || 2048;
        const origH = synItem?.original_info?.height || vxItem?.size?.height || 2048;

        const photoQualities = [
          {
            id: `img-${i}-orig`,
            label: 'ORIG (Uncompressed 4K)',
            resolution: `${origW}x${origH}`,
            ext: 'JPG',
            sizeEst: 'Original Source',
            badge: 'LOSSLESS ORIG',
            url: `${base}?format=jpg&name=orig`
          },
          {
            id: `img-${i}-large`,
            label: 'LARGE (2048px High-Res)',
            resolution: '2048px Max',
            ext: 'JPG',
            sizeEst: 'High Quality',
            badge: '2K',
            url: `${base}?format=jpg&name=large`
          },
          {
            id: `img-${i}-medium`,
            label: 'MEDIUM (1200px Standard)',
            resolution: '1200px Max',
            ext: 'JPG',
            sizeEst: 'Standard Web',
            badge: null,
            url: `${base}?format=jpg&name=medium`
          },
          {
            id: `img-${i}-small`,
            label: 'SMALL (680px Compact)',
            resolution: '680px Max',
            ext: 'JPG',
            sizeEst: 'Fast Save',
            badge: 'COMPACT',
            url: `${base}?format=jpg&name=small`
          }
        ];

        mediaItems.push({
          index: i,
          type: 'photo',
          thumbnail: `${base}?format=jpg&name=large`,
          previewUrl: `${base}?format=jpg&name=large`,
          qualities: photoQualities
        });
      }
    }

    if (mediaItems.length === 0) {
      throw new Error('This X (Formely Twitter) post does not contain downloadable video or photo attachments.');
    }

    return {
      id: tweetId,
      authorName: vxData?.user_name || syndicationData?.user?.name || 'X (Formely Twitter) Creator',
      authorHandle: vxData?.user_screen_name || syndicationData?.user?.screen_name || 'creator',
      authorAvatar:
        vxData?.user_profile_image_url ||
        syndicationData?.user?.profile_image_url_https ||
        'https://abs.twimg.com/sticky/default_profile_images/default_profile_normal.png',
      text: vxData?.text || syndicationData?.text || 'Media post extracted from X (Formely Twitter).',
      date: vxData?.date || 'Published on X (Formely Twitter)',
      likes: vxData?.likes ? Number(vxData.likes).toLocaleString() : '—',
      retweets: vxData?.retweets ? Number(vxData.retweets).toLocaleString() : '—',
      mediaItems
    };
  };

  const handleExtract = async (e, customUrl) => {
    if (e) e.preventDefault();
    const targetUrl = customUrl ?? urlInput;
    setError('');

    const preset = DEMO_PRESETS.find((p) => p.url.toLowerCase() === targetUrl.trim().toLowerCase());
    if (preset) {
      setLoading(true);
      setTimeout(() => {
        setResult(preset.mockData);
        setActiveMediaIndex(0);
        setLoading(false);
        setHistory((prev) => [preset.mockData, ...prev.filter((h) => h.id !== preset.mockData.id)].slice(0, 6));
      }, 380);
      return;
    }

    const tweetId = extractTweetId(targetUrl);
    if (!tweetId) {
      setError('Please paste a valid X (Formely Twitter) post link (e.g. https://x.com/username/status/123456...)');
      return;
    }

    setLoading(true);
    try {
      const data = await fetchLiveXMedia(tweetId);
      setResult(data);
      setActiveMediaIndex(0);
      setHistory((prev) => [data, ...prev.filter((h) => h.id !== data.id)].slice(0, 6));
    } catch (err) {
      setError(err.message || 'Unable to extract media from this X (Formely Twitter) link.');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadFile = async (qualityItem) => {
    setDownloadingId(qualityItem.id);
    setDownloadProgress(15);

    try {
      const response = await fetch(qualityItem.url);
      if (!response.ok) throw new Error('Direct stream fallback');

      const contentLength = response.headers.get('content-length');
      const total = contentLength ? parseInt(contentLength, 10) : 0;
      let loaded = 0;

      const reader = response.body.getReader();
      const chunks = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        loaded += value.length;
        if (total) {
          setDownloadProgress(Math.min(95, Math.round((loaded / total) * 100)));
        } else {
          setDownloadProgress((prev) => Math.min(90, prev + 15));
        }
      }

      const blob = new Blob(chunks, {
        type: qualityItem.ext === 'MP4' ? 'video/mp4' : 'image/jpeg'
      });
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `X_Formely_Twitter_${result?.authorHandle || 'media'}_${qualityItem.resolution}.${qualityItem.ext.toLowerCase()}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
      setDownloadProgress(100);
    } catch (err) {
      window.open(qualityItem.url, '_blank', 'noopener,noreferrer');
    } finally {
      setTimeout(() => {
        setDownloadingId(null);
        setDownloadProgress(0);
      }, 600);
    }
  };

  const handleCopyLink = (qualityItem) => {
    navigator.clipboard.writeText(qualityItem.url);
    setCopiedId(qualityItem.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const currentMedia = result?.mediaItems?.[activeMediaIndex] || result?.mediaItems?.[0];

  return (
    <div className="min-h-screen bg-[#1F3D2B] text-[#E8DCC4] font-sans selection:bg-[#8B5CF6] selection:text-white overflow-x-hidden">
      {/* HERO SECTION WITH FERNWOOD DOT MATRIX + SAND BEIGE HORIZON MIST */}
      <section className="relative min-h-[92vh] flex flex-col justify-between overflow-hidden">
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
            }}
            className="flex items-center gap-2.5 text-[#E8DCC4] hover:opacity-90 transition"
          >
            <span className="w-7 h-7 rounded-full bg-[#E8DCC4]/15 border border-[#E8DCC4]/30 flex items-center justify-center">
              <Sparkles className="w-3.5 h-3.5 text-[#8B5CF6]" />
            </span>
            <span className="font-bold tracking-tight text-lg text-[#E8DCC4]">
              XVault <span className="font-normal text-xs opacity-75">for X (Formely Twitter)</span>
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
                    }
                  }}
                  className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all ${
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
            onClick={() => {
              setUrlInput(DEMO_PRESETS[0].url);
              handleExtract(null, DEMO_PRESETS[0].url);
            }}
            className="px-4 py-2 rounded-full text-xs font-medium border border-[#E8DCC4]/30 bg-[#1F3D2B]/60 hover:border-[#8B5CF6] hover:bg-[#8B5CF6]/20 text-[#E8DCC4] transition flex items-center gap-1.5"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[#8B5CF6]" />
            Try Live Sample
          </button>
        </header>

        {/* CENTER HERO CONTENT */}
        <div
          ref={extractorRef}
          className="relative z-20 max-w-4xl w-full mx-auto px-6 pt-14 pb-32 text-center flex flex-col items-center"
        >
          <div className="flex flex-wrap items-center justify-center gap-6 text-xs font-medium text-[#E8DCC4]/80 mb-6 tracking-wide">
            <span className="flex items-center gap-1.5">
              <span className="text-[#8B5CF6]">→</span> 1080p &amp; 4K MP4
            </span>
            <span className="flex items-center gap-1.5">
              <span className="text-[#8B5CF6]">→</span> Uncompressed ORIG Photos
            </span>
            <span className="flex items-center gap-1.5">
              <span className="text-[#8B5CF6]">→</span> Every X (Formely Twitter) Quality
            </span>
          </div>

          <h1 className="text-4xl sm:text-6xl md:text-[68px] font-bold tracking-tight text-[#E8DCC4] leading-[1.06] max-w-3xl">
            Save something pure,
            <br />
            every quality at once.
          </h1>

          <p className="mt-6 text-sm sm:text-base text-[#E8DCC4]/80 max-w-lg leading-relaxed font-normal">
            Direct, uncompressed video bitrates and original photos from{' '}
            <span className="text-[#E8DCC4] font-medium">X (Formely Twitter)</span>.
            <br className="hidden sm:inline" />
            On your device in one click, with zero watermarks.
          </p>

          {/* URL INPUT COMMAND PILL */}
          <form
            onSubmit={(e) => handleExtract(e)}
            className="mt-9 w-full max-w-2xl bg-[#162D1F]/90 backdrop-blur-md border border-[#E8DCC4]/25 focus-within:border-[#8B5CF6] rounded-full p-2 flex items-center shadow-2xl transition-all"
          >
            <input
              type="text"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="Paste X (Formely Twitter) link — https://x.com/username/status/..."
              className="w-full bg-transparent px-5 py-2.5 text-sm text-[#E8DCC4] placeholder-[#E8DCC4]/45 focus:outline-none"
            />
            {urlInput && (
              <button
                type="button"
                onClick={() => {
                  setUrlInput('');
                  setError('');
                }}
                className="px-2.5 text-xs text-[#E8DCC4]/50 hover:text-[#E8DCC4] transition"
              >
                Clear
              </button>
            )}
            <button
              type="submit"
              disabled={loading}
              className="shrink-0 px-6 py-3 rounded-full bg-[#E8DCC4] hover:bg-[#f3ead8] text-[#1F3D2B] font-semibold text-xs sm:text-sm tracking-tight transition flex items-center gap-2 shadow-md cursor-pointer disabled:opacity-60"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-[#8B5CF6]" />
                  <span>Inspecting...</span>
                </>
              ) : (
                <>
                  <span>Fetch qualities</span>
                  <ArrowRight className="w-3.5 h-3.5 text-[#8B5CF6]" />
                </>
              )}
            </button>
          </form>

          {/* TWO PILL BUTTONS */}
          <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => {
                setUrlInput(DEMO_PRESETS[0].url);
                handleExtract(null, DEMO_PRESETS[0].url);
              }}
              className="px-6 py-2.5 rounded-full bg-[#E8DCC4] hover:bg-white text-[#1F3D2B] font-semibold text-xs transition shadow-sm cursor-pointer"
            >
              Demo 1080p Video
            </button>
            <button
              type="button"
              onClick={() => {
                setUrlInput(DEMO_PRESETS[1].url);
                handleExtract(null, DEMO_PRESETS[1].url);
              }}
              className="px-6 py-2.5 rounded-full bg-[#365842]/80 hover:bg-[#3f664d] text-[#E8DCC4] border border-[#E8DCC4]/20 font-medium text-xs transition cursor-pointer"
            >
              Demo 4K Photo
            </button>
          </div>

          {error && (
            <div className="mt-5 max-w-xl w-full px-5 py-3 rounded-2xl bg-[#162D1F]/95 border border-[#8B5CF6]/60 text-[#E8DCC4] text-xs flex items-center justify-center gap-2.5 shadow-lg">
              <AlertCircle className="w-4 h-4 text-[#8B5CF6] shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        <div className="h-6" />
      </section>

      {/* SAND BEIGE SURFACE SECTION */}
      <main className="bg-[#E8DCC4] text-[#1F3D2B] relative z-20 pb-24 pt-4">
        <div className="max-w-5xl mx-auto px-6">
          {result && (
            <div className="-mt-20 mb-16 rounded-3xl bg-[#1F3D2B] text-[#E8DCC4] border border-[#1F3D2B] shadow-2xl overflow-hidden">
              <div className="px-6 py-5 border-b border-[#E8DCC4]/12 flex flex-wrap items-center justify-between gap-4 bg-[#193223]">
                <div className="flex items-center gap-3.5">
                  <img
                    src={result.authorAvatar}
                    alt={result.authorName}
                    className="w-11 h-11 rounded-full object-cover border border-[#8B5CF6]/50"
                    onError={(e) => {
                      e.target.src = 'https://abs.twimg.com/sticky/default_profile_images/default_profile_normal.png';
                    }}
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-sm text-[#E8DCC4]">{result.authorName}</h3>
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#8B5CF6]/20 text-[#E8DCC4] border border-[#8B5CF6]/40">
                        @{result.authorHandle} · X (Formely Twitter)
                      </span>
                    </div>
                    <p className="text-xs text-[#E8DCC4]/70 line-clamp-1 mt-0.5 max-w-xl">{result.text}</p>
                  </div>
                </div>

                {result.mediaItems.length > 1 && (
                  <div className="flex items-center gap-1.5 bg-[#1F3D2B] p-1 rounded-full border border-[#E8DCC4]/15">
                    {result.mediaItems.map((m, idx) => (
                      <button
                        key={m.index}
                        onClick={() => setActiveMediaIndex(idx)}
                        className={`px-3 py-1 rounded-full text-xs font-medium transition ${
                          activeMediaIndex === idx
                            ? 'bg-[#8B5CF6] text-white'
                            : 'text-[#E8DCC4]/70 hover:text-[#E8DCC4]'
                        }`}
                      >
                        Item #{idx + 1}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-0">
                <div className="lg:col-span-5 bg-[#14291D] p-6 flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-[#E8DCC4]/10">
                  <div className="relative rounded-2xl overflow-hidden bg-black/50 border border-[#E8DCC4]/15 aspect-video lg:aspect-4/3 flex items-center justify-center">
                    {currentMedia?.type === 'video' || currentMedia?.type === 'gif' ? (
                      <video
                        key={currentMedia.previewUrl}
                        src={currentMedia.previewUrl}
                        poster={currentMedia.thumbnail}
                        controls
                        playsInline
                        loop={currentMedia.type === 'gif'}
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <img
                        src={currentMedia?.previewUrl}
                        alt="X (Formely Twitter) media preview"
                        className="w-full h-full object-cover"
                      />
                    )}

                    <div className="absolute top-3 left-3 px-3 py-1 rounded-full bg-[#1F3D2B]/90 backdrop-blur-md border border-[#E8DCC4]/20 text-[11px] font-semibold text-[#E8DCC4] flex items-center gap-1.5">
                      {currentMedia?.type === 'photo' ? (
                        <>
                          <ImageIcon className="w-3.5 h-3.5 text-[#8B5CF6]" />
                          <span>PHOTO · X (Formely Twitter)</span>
                        </>
                      ) : (
                        <>
                          <Film className="w-3.5 h-3.5 text-[#8B5CF6]" />
                          <span>{currentMedia?.type === 'gif' ? 'GIF MP4' : 'VIDEO'} · X (Formely Twitter)</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between text-xs text-[#E8DCC4]/65 pt-2">
                    <span>Post ID: #{result.id.slice(-8)}</span>
                    <span>{currentMedia?.qualities?.length || 0} Qualities Ready</span>
                  </div>
                </div>

                <div className="lg:col-span-7 p-6 sm:p-7 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <span className="text-[11px] uppercase tracking-wider text-[#8B5CF6] font-semibold">
                          Direct CDN Streams
                        </span>
                        <h4 className="text-lg font-bold text-[#E8DCC4]">
                          All Available X (Formely Twitter) Qualities
                        </h4>
                      </div>
                      <span className="text-xs px-3 py-1 rounded-full bg-[#E8DCC4]/10 text-[#E8DCC4]/80">
                        Zero Watermark
                      </span>
                    </div>

                    <div className="space-y-2.5">
                      {currentMedia?.qualities?.map((q, idx) => {
                        const isDownloading = downloadingId === q.id;
                        const isCopied = copiedId === q.id;

                        return (
                          <div
                            key={q.id}
                            className={`p-3.5 rounded-2xl border transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                              idx === 0
                                ? 'bg-[#264934] border-[#8B5CF6]/60'
                                : 'bg-[#193223]/90 border-[#E8DCC4]/12 hover:border-[#E8DCC4]/30'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div
                                className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xs ${
                                  idx === 0
                                    ? 'bg-[#8B5CF6] text-white'
                                    : 'bg-[#E8DCC4]/10 text-[#E8DCC4]'
                                }`}
                              >
                                {q.ext}
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold text-sm text-[#E8DCC4]">
                                    {q.label}
                                  </span>
                                  {q.badge && (
                                    <span className="text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full bg-[#8B5CF6] text-white">
                                      {q.badge}
                                    </span>
                                  )}
                                </div>
                                <div className="text-xs text-[#E8DCC4]/65 flex items-center gap-2 mt-0.5">
                                  <span>Resolution: {q.resolution}</span>
                                  {q.bitrate && <span>• {q.bitrate} kbps</span>}
                                  <span>• {q.sizeEst}</span>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleCopyLink(q)}
                                title="Copy Direct CDN Link"
                                className="p-2.5 rounded-full bg-[#1F3D2B] hover:bg-[#E8DCC4]/15 text-[#E8DCC4]/80 hover:text-[#E8DCC4] border border-[#E8DCC4]/15 transition cursor-pointer"
                              >
                                {isCopied ? (
                                  <Check className="w-3.5 h-3.5 text-[#8B5CF6]" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>

                              <a
                                href={q.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                title="Open stream in new tab"
                                className="p-2.5 rounded-full bg-[#1F3D2B] hover:bg-[#E8DCC4]/15 text-[#E8DCC4]/80 hover:text-[#E8DCC4] border border-[#E8DCC4]/15 transition"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>

                              <button
                                type="button"
                                onClick={() => handleDownloadFile(q)}
                                disabled={isDownloading}
                                className={`px-4 py-2 rounded-full font-semibold text-xs flex items-center gap-1.5 transition cursor-pointer ${
                                  idx === 0
                                    ? 'bg-[#8B5CF6] hover:bg-[#7c4dff] text-white shadow-md'
                                    : 'bg-[#E8DCC4] hover:bg-white text-[#1F3D2B]'
                                }`}
                              >
                                {isDownloading ? (
                                  <>
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    <span>{downloadProgress}%</span>
                                  </>
                                ) : (
                                  <>
                                    <Download className="w-3.5 h-3.5" />
                                    <span>Download</span>
                                  </>
                                )}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* HOW IT WORKS */}
          <div ref={howItWorksRef} className="pt-8">
            <div className="flex flex-col md:flex-row md:items-end justify-between mb-10 gap-4">
              <div>
                <span className="text-xs font-semibold uppercase tracking-widest text-[#8B5CF6]">
                  → Minimalist Workflow
                </span>
                <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-[#1F3D2B] mt-1">
                  Built for X (Formely Twitter) archives.
                </h2>
              </div>
              <p className="text-sm text-[#1F3D2B]/75 max-w-md">
                Every video uploaded to X (Formely Twitter) is stored in multiple bitrates, and every photo has a hidden{' '}
                <code className="px-1.5 py-0.5 rounded bg-[#1F3D2B]/10 font-mono text-xs">name=orig</code> master file. We unlock them all automatically.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div className="p-7 rounded-3xl bg-[#1F3D2B] text-[#E8DCC4] flex flex-col justify-between shadow-lg">
                <div className="w-10 h-10 rounded-full bg-[#8B5CF6]/20 border border-[#8B5CF6]/40 flex items-center justify-center text-[#8B5CF6] font-bold text-sm mb-6">
                  01
                </div>
                <div>
                  <h3 className="text-lg font-bold text-[#E8DCC4]">Copy X (Formely Twitter) Link</h3>
                  <p className="text-xs text-[#E8DCC4]/75 mt-2 leading-relaxed">
                    Click Share on any public X (Formely Twitter) post containing a video, looping GIF, or photo gallery and copy the status URL.
                  </p>
                </div>
              </div>

              <div className="p-7 rounded-3xl bg-[#1F3D2B] text-[#E8DCC4] flex flex-col justify-between shadow-lg">
                <div className="w-10 h-10 rounded-full bg-[#8B5CF6]/20 border border-[#8B5CF6]/40 flex items-center justify-center text-[#8B5CF6] font-bold text-sm mb-6">
                  02
                </div>
                <div>
                  <h3 className="text-lg font-bold text-[#E8DCC4]">Inspect All Bitrates</h3>
                  <p className="text-xs text-[#E8DCC4]/75 mt-2 leading-relaxed">
                    Our engine queries X (Formely Twitter) syndication nodes to list every MP4 resolution (1080p, 720p, 480p, 360p) and photo size.
                  </p>
                </div>
              </div>

              <div className="p-7 rounded-3xl bg-[#1F3D2B] text-[#E8DCC4] flex flex-col justify-between shadow-lg">
                <div className="w-10 h-10 rounded-full bg-[#8B5CF6]/20 border border-[#8B5CF6]/40 flex items-center justify-center text-[#8B5CF6] font-bold text-sm mb-6">
                  03
                </div>
                <div>
                  <h3 className="text-lg font-bold text-[#E8DCC4]">Save Master File</h3>
                  <p className="text-xs text-[#E8DCC4]/75 mt-2 leading-relaxed">
                    Download the highest bitrate MP4 or lossless ORIG photo directly to your browser with clean filenames.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {history.length > 0 && (
            <div className="mt-14 pt-10 border-t border-[#1F3D2B]/15">
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-bold uppercase tracking-wider text-[#1F3D2B]/70">
                  Recent X (Formely Twitter) Extractions
                </span>
                <button
                  onClick={() => setHistory([])}
                  className="text-xs text-[#1F3D2B]/60 hover:text-[#1F3D2B] flex items-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Clear
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {history.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      setResult(item);
                      setActiveMediaIndex(0);
                      window.scrollTo({ top: 320, behavior: 'smooth' });
                    }}
                    className="p-3 rounded-2xl bg-[#1F3D2B]/5 hover:bg-[#1F3D2B]/10 border border-[#1F3D2B]/15 text-left flex items-center gap-3 transition cursor-pointer"
                  >
                    <img
                      src={item.mediaItems[0]?.thumbnail}
                      alt=""
                      className="w-12 h-12 rounded-xl object-cover shrink-0 bg-[#1F3D2B]"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-[#1F3D2B] truncate">
                        @{item.authorHandle} · X (Formely Twitter)
                      </p>
                      <p className="text-[11px] text-[#1F3D2B]/70 truncate">{item.text}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-[#8B5CF6] shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>

      <footer className="bg-[#1F3D2B] text-[#E8DCC4]/70 border-t border-[#E8DCC4]/10 py-8 px-6 text-xs">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#8B5CF6]" />
            <span className="font-semibold text-[#E8DCC4]">XVault</span>
            <span>— Media Archiver for X (Formely Twitter)</span>
          </div>
          <p className="text-[#E8DCC4]/55">
            Independent web utility. Not affiliated with X Corp / X (Formely Twitter).
          </p>
        </div>
      </footer>
    </div>
  );
}