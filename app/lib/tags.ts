import { execSync } from "child_process";

export interface TrackTags {
  title: string;
  artist: string;
  album: string;
  albumArtist: string;
  year: number;
  trackNumber: number;
  genre: string;
  /** Duration in seconds */
  duration: number;
  /** base64 data URL of album art (JPEG/PNG) */
  coverDataUrl: string | null;
}

const FFPROBE = "/opt/homebrew/bin/ffprobe";

/**
 * Read ID3 tags from an MP3 file using ffprobe.
 * Returns null if file doesn't exist or tags can't be read.
 */
export function readTags(filePath: string): TrackTags | null {
  try {
    const cmd = `${FFPROBE} -v quiet -print_format json -show_format -show_streams ${JSON.stringify(filePath)}`;
    const out = execSync(cmd, { timeout: 5000, encoding: "utf-8" });
    const data = JSON.parse(out);
    const format = data.format?.tags || {};
    const duration = parseFloat(data.format?.duration || "0");

    // Try to extract cover art as base64
    let coverDataUrl: string | null = null;
    try {
      coverDataUrl = readCoverDataUrl(filePath);
    } catch {
      // ignore
    }

    return {
      title: format.title || "",
      artist: format.artist || "",
      album: format.album || "",
      albumArtist: format.album_artist || format.albumartist || "",
      year: parseInt(format.date || format.year || "0", 10) || 0,
      trackNumber: parseInt(format.track || "0", 10) || 0,
      genre: format.genre || "",
      duration: isNaN(duration) ? 0 : duration,
      coverDataUrl,
    };
  } catch {
    return null;
  }
}

/**
 * Extract cover art from MP3 as base64 data URL.
 */
export function readCoverDataUrl(filePath: string): string | null {
  try {
    const cmd = `/opt/homebrew/bin/ffmpeg -v quiet -i ${JSON.stringify(filePath)} -map 0:v -c:v mjpeg -f image2pipe -`;
    const buf = execSync(cmd, { timeout: 5000, maxBuffer: 5 * 1024 * 1024 });
    if (buf.length > 0) {
      return `data:image/jpeg;base64,${buf.toString("base64")}`;
    }
  } catch {
    // ignore
  }
  return null;
}
