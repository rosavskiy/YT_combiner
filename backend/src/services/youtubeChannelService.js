import axios from 'axios';

const YT_API_BASE = 'https://www.googleapis.com/youtube/v3';

function parseISO8601Duration(duration) {
  // PT#M#S, PT#S, PT#M, PT#H#M#S etc.
  const match = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/.exec(duration);
  if (!match) return 0;
  const hours = parseInt(match[1] || '0', 10);
  const minutes = parseInt(match[2] || '0', 10);
  const seconds = parseInt(match[3] || '0', 10);
  return hours * 3600 + minutes * 60 + seconds;
}

function extractFromUrl(input) {
  try {
    const url = new URL(input);
    const path = url.pathname;
    if (path.includes('/channel/')) {
      const id = path.split('/channel/')[1].split('/')[0];
      if (id && id.startsWith('UC')) return { channelId: id, hint: 'channelId' };
    }
    if (path.includes('/@')) {
      const handle = path.split('/@')[1].split('/')[0];
      return { handle: '@' + handle };
    }
    if (path.includes('/user/')) {
      const user = path.split('/user/')[1].split('/')[0];
      return { username: user };
    }
    if (path.includes('/c/')) {
      const custom = path.split('/c/')[1].split('/')[0];
      return { customName: custom };
    }
  } catch (e) {
    // not a URL, could be raw id or handle
  }
  if (/^UC[\w-]{22}$/.test(input)) {
    return { channelId: input };
  }
  if (input.startsWith('@')) {
    return { handle: input };
  }
  return { query: input };
}

export async function resolveChannel(input, apiKey) {
  const hint = extractFromUrl(input);
  if (!apiKey) throw new Error('YouTube API key is required');

  if (hint.channelId) {
    const { data } = await axios.get(`${YT_API_BASE}/channels`, {
      params: { part: 'snippet', id: hint.channelId, key: apiKey }
    });
    const item = data.items?.[0];
    if (!item) throw new Error('Канал не найден');
    return {
      channelId: item.id,
      title: item.snippet?.title,
      url: `https://www.youtube.com/channel/${item.id}`,
    };
  }

  // Try search by handle or query
  const q = hint.handle ? hint.handle.replace(/^@/, '') : (hint.username || hint.customName || hint.query);
  const { data } = await axios.get(`${YT_API_BASE}/search`, {
    params: {
      part: 'snippet',
      q,
      type: 'channel',
      maxResults: 1,
      key: apiKey
    }
  });
  const item = data.items?.[0];
  if (!item?.snippet) throw new Error('Канал не найден');
  const channelId = item.id?.channelId;
  return {
    channelId,
    title: item.snippet.title,
    url: `https://www.youtube.com/channel/${channelId}`,
  };
}

async function getVideoDetails(ids, apiKey) {
  if (!ids.length) return {};
  const { data } = await axios.get(`${YT_API_BASE}/videos`, {
    params: {
      part: 'contentDetails,snippet,statistics',
      id: ids.join(','),
      key: apiKey
    }
  });
  const map = {};
  for (const item of data.items || []) {
    const sec = parseISO8601Duration(item.contentDetails?.duration || 'PT0S');
    map[item.id] = {
      durationSec: sec,
      isShort: sec > 0 && sec <= 60,
      title: item.snippet?.title,
      views: Number(item.statistics?.viewCount || 0),
      likes: Number(item.statistics?.likeCount || 0),
      comments: Number(item.statistics?.commentCount || 0),
    };
  }
  return map;
}

export async function fetchLatestActivities(channelIds, apiKey, limit = 10) {
  if (!Array.isArray(channelIds) || channelIds.length === 0) return [];
  const perChannel = Math.max(1, Math.ceil(limit / channelIds.length));
  const all = [];

  for (const cid of channelIds) {
    const { data } = await axios.get(`${YT_API_BASE}/search`, {
      params: {
        part: 'snippet',
        channelId: cid,
        order: 'date',
        type: 'video',
        maxResults: Math.min(10, perChannel),
        key: apiKey
      }
    });
    for (const item of data.items || []) {
      all.push({
        channelId: cid,
        channelTitle: item.snippet?.channelTitle,
        videoId: item.id?.videoId,
        title: item.snippet?.title,
        publishedAt: item.snippet?.publishedAt,
        url: `https://www.youtube.com/watch?v=${item.id?.videoId}`,
        type: 'video'
      });
    }
  }

  // Sort by publish time and trim
  all.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
  const top = all.slice(0, limit);

  // Enrich with duration to detect shorts
  const ids = top.map(i => i.videoId).filter(Boolean);
  const details = await getVideoDetails(ids, apiKey);
  return top.map(it => ({
    ...it,
    type: details[it.videoId]?.isShort ? 'short' : 'video',
    views: details[it.videoId]?.views ?? 0,
    likes: details[it.videoId]?.likes ?? 0,
    comments: details[it.videoId]?.comments ?? 0,
  }));
}
