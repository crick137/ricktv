/** 本地字幕：srt/ass/vtt → VTT Blob URL */

import { getSubtitlePrefs, shiftVttTimestamps } from '@/lib/subtitlePrefs';

export function srtToVtt(srt: string): string {
  const body = srt
    .replace(/\r+/g, '')
    .replace(/^\uFEFF/, '')
    .replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2');
  return `WEBVTT\n\n${body}`;
}

/** 极简 ASS：只抽 Dialogue 时间与文本 */
export function assToVtt(ass: string): string {
  const lines: string[] = ['WEBVTT', ''];
  const re =
    /^Dialogue:\s*\d+,(\d+:\d+:\d+\.\d+),(\d+:\d+:\d+\.\d+),[^,]*,[^,]*,[^,]*,[^,]*,[^,]*,[^,]*,(.*)$/gm;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(ass))) {
    i += 1;
    const start = m[1].replace(/^(\d):/, (_, h) =>
      String(h).padStart(2, '0') + ':'
    );
    const end = m[2].replace(/^(\d):/, (_, h) =>
      String(h).padStart(2, '0') + ':'
    );
    const text = m[3]
      .replace(/\{[^}]*\}/g, '')
      .replace(/\\N/g, '\n')
      .trim();
    if (!text) continue;
    lines.push(String(i), `${start} --> ${end}`, text, '');
  }
  return lines.join('\n');
}

export async function fileToVttUrl(file: File): Promise<{
  url: string;
  label: string;
}> {
  const text = await file.text();
  const name = file.name.toLowerCase();
  let vtt: string;
  if (name.endsWith('.vtt')) {
    vtt = text.startsWith('WEBVTT') ? text : `WEBVTT\n\n${text}`;
  } else if (name.endsWith('.ass') || name.endsWith('.ssa')) {
    vtt = assToVtt(text);
  } else {
    vtt = srtToVtt(text);
  }
  const { offsetSec } = getSubtitlePrefs();
  if (offsetSec) vtt = shiftVttTimestamps(vtt, offsetSec);
  const blob = new Blob([vtt], { type: 'text/vtt' });
  return { url: URL.createObjectURL(blob), label: file.name };
}
