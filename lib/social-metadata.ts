export interface SocialMetadata {
  title?: string;
  description?: string;
  image?: string;
  authorName?: string;
  providerName?: string;
  thumbnailUrl?: string;
  html?: string;
  type: 'video' | 'photo' | 'rich' | 'link';
  url: string;
  platform: string;
  videoId?: string;
}

const PLATFORM_PATTERNS: Record<string, RegExp> = {
  youtube: /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$/,
  twitter: /^(https?:\/\/)?(www\.)?(twitter\.com|x\.com)\/.+$/,
  instagram: /^(https?:\/\/)?(www\.)?instagram\.com\/.+$/,
  tiktok: /^(https?:\/\/)?(www\.)?tiktok\.com\/.+$/,
  facebook: /^(https?:\/\/)?(www\.)?facebook\.com\/.+$/,
  linkedin: /^(https?:\/\/)?(www\.)?linkedin\.com\/.+$/,
  discord: /^(https?:\/\/)?(www\.)?discord\.(com|gg)\/.+$/,
  github: /^(https?:\/\/)?(www\.)?github\.com\/.+$/,
  bluesky: /^(https?:\/\/)?(www\.)?bsky\.app\/.+$/,
  quora: /^(https?:\/\/)?(www\.)?quora\.com\/.+$/,
  reddit: /^(https?:\/\/)?(www\.)?reddit\.com\/.+$/,
  threads: /^(https?:\/\/)?(www\.)?threads\.net\/.+$/,
  spotify: /^(https?:\/\/)?(open\.spotify\.com)\/.+$/,
};

export const getPlatformFromUrl = (url: string): string | null => {
  for (const [platform, pattern] of Object.entries(PLATFORM_PATTERNS)) {
    if (pattern.test(url)) return platform;
  }
  return null;
};

export const getYoutubeVideoId = (url: string): string | null => {
  const regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
  const match = url.match(regExp);
  if (match && match[7].length === 11) return match[7];
  
  // Handle shorts
  const shortsMatch = url.match(/\/shorts\/([a-zA-Z0-9_-]{11})/);
  if (shortsMatch) return shortsMatch[1];
  
  return null;
};

const fetchOEmbed = async (url: string, endpoint: string): Promise<Partial<SocialMetadata> | null> => {
  try {
    const response = await fetch(`${endpoint}?url=${encodeURIComponent(url)}&format=json`);
    if (!response.ok) return null;
    const data = await response.json();
    return {
      title: data.title,
      authorName: data.author_name,
      providerName: data.provider_name,
      thumbnailUrl: data.thumbnail_url,
      image: data.thumbnail_url,
      html: data.html,
      type: data.type || 'link',
    };
  } catch (error) {
    console.error('oEmbed fetch error:', error);
    return null;
  }
};

const fetchOGMetadata = async (url: string): Promise<Partial<SocialMetadata> | null> => {
  try {
    // Note: This might be blocked by some sites due to bot protection or CORS in a web environment.
    // In React Native (mobile), CORS is usually not an issue for fetch.
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; GopxBot/1.0; +https://gopx.drive)',
      },
    });
    if (!response.ok) return null;
    const html = await response.text();

    const getMeta = (property: string) => {
      const regex = new RegExp(`<meta[^>]+(?:property|name)=["']${property}["'][^>]+content=["']([^"']+)["']`, 'i');
      const match = html.match(regex);
      if (match) return match[1];
      
      // Try alternative order of attributes
      const regexAlt = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${property}["']`, 'i');
      const matchAlt = html.match(regexAlt);
      return matchAlt ? matchAlt[1] : null;
    };

    const getTitle = () => {
      const match = html.match(/<title>([^<]+)<\/title>/i);
      return match ? match[1] : null;
    };

    const title = getMeta('og:title') || getMeta('twitter:title') || getTitle() || '';
    const description = getMeta('og:description') || getMeta('twitter:description') || getMeta('description') || '';
    const image = getMeta('og:image') || getMeta('twitter:image') || '';

    return {
      title: title.trim(),
      description: description.trim(),
      image,
      type: 'link',
    };
  } catch (error) {
    console.error('OG fetch error:', error);
    return null;
  }
};

export const fetchSocialMetadata = async (url: string): Promise<SocialMetadata> => {
  const platform = getPlatformFromUrl(url) || 'generic';
  let metadata: Partial<SocialMetadata> = {};

  if (platform === 'youtube') {
    const videoId = getYoutubeVideoId(url);
    const oEmbed = await fetchOEmbed(url, 'https://www.youtube.com/oembed');
    metadata = { ...oEmbed, platform, videoId, url };
  } else if (platform === 'twitter') {
    const oEmbed = await fetchOEmbed(url, 'https://publish.twitter.com/oembed');
    metadata = { ...oEmbed, platform, url };
  } else if (platform === 'tiktok') {
    const oEmbed = await fetchOEmbed(url, 'https://www.tiktok.com/oembed');
    metadata = { ...oEmbed, platform, url };
  } else if (platform === 'spotify') {
    const oEmbed = await fetchOEmbed(url, 'https://open.spotify.com/oembed');
    metadata = { ...oEmbed, platform, url };
  } else if (platform === 'reddit') {
    const oEmbed = await fetchOEmbed(url, 'https://www.reddit.com/oembed');
    metadata = { ...oEmbed, platform, url };
  } else {
    const og = await fetchOGMetadata(url);
    metadata = { ...og, platform, url };
  }

  return {
    url,
    platform,
    type: metadata.type || 'link',
    ...metadata,
  } as SocialMetadata;
};
