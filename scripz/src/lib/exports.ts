import jsPDF from "jspdf";

export interface Cue {
  time: string;
  text: string;
  seconds: number;
}

const LINE_REGEX = /^\s*\[?(\d{1,2}:\d{2}(?::\d{2})?)\]?\s*[-:]?\s*(.+)$/;

export function parseTimestamp(ts: string): number | null {
  const parts = ts.split(":").map((p) => parseInt(p, 10));
  if (parts.some(isNaN)) return null;
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return null;
}

export function parseCues(timestampedTranscript?: string): Cue[] {
  if (!timestampedTranscript) return [];
  const cues: Cue[] = [];
  for (const rawLine of timestampedTranscript.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const m = line.match(LINE_REGEX);
    if (!m) continue;
    const seconds = parseTimestamp(m[1]);
    if (seconds === null) continue;
    cues.push({ time: m[1], text: m[2].trim(), seconds });
  }
  return cues;
}

function formatSrtTime(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);
  const ms = Math.floor((totalSeconds - Math.floor(totalSeconds)) * 1000);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")},${String(ms).padStart(3, "0")}`;
}

export function buildSrt(transcript: string, timestampedTranscript?: string): string {
  let cues = parseCues(timestampedTranscript).map((c) => ({ start: c.seconds, text: c.text }));

  if (cues.length === 0) {
    const sentences = transcript
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter(Boolean);
    const SECS_PER_CUE = 4;
    cues = sentences.map((sentence, i) => ({ start: i * SECS_PER_CUE, text: sentence }));
  }

  return cues
    .map((cue, i) => {
      const end = i < cues.length - 1 ? cues[i + 1].start : cue.start + 3;
      return `${i + 1}\n${formatSrtTime(cue.start)} --> ${formatSrtTime(end)}\n${cue.text}\n`;
    })
    .join("\n");
}

export function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function downloadTxt(transcript: string, filename = "scripz-transcript.txt") {
  triggerDownload(new Blob([transcript], { type: "text/plain;charset=utf-8" }), filename);
}

export function downloadSrt(transcript: string, timestampedTranscript?: string, filename = "scripz-transcript.srt") {
  triggerDownload(new Blob([buildSrt(transcript, timestampedTranscript)], { type: "text/plain;charset=utf-8" }), filename);
}

export function downloadPdf(transcript: string, filename = "scripz-transcript.pdf") {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const margin = 54;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const usableWidth = pageWidth - margin * 2;

  const wordCount = transcript.split(/\s+/).filter(Boolean).length;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("Transcript", margin, margin);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(120);
  doc.text(`${wordCount} words · ${transcript.length} characters · ${new Date().toLocaleDateString()}`, margin, margin + 18);
  doc.setTextColor(0);

  doc.setFontSize(11);
  const lines = doc.splitTextToSize(transcript.replace(/\r\n/g, "\n"), usableWidth);
  let cursorY = margin + 44;
  const lineHeight = 15;

  for (const line of lines) {
    if (cursorY + lineHeight > pageHeight - margin) {
      doc.addPage();
      cursorY = margin;
    }
    doc.text(line, margin, cursorY);
    cursorY += lineHeight;
  }

  doc.save(filename);
}

export function downloadTranscriptImage(transcript: string, filename = "scripz-transcript.png") {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const padding = 60;
  const lineHeight = 28;
  const fontSize = 16;
  const maxWidth = 900;

  ctx.font = `${fontSize}px Monaco, Menlo, Courier New, monospace`;

  const words = transcript.split(" ");
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    if (ctx.measureText(testLine).width > maxWidth - padding * 2) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) lines.push(currentLine);

  canvas.width = maxWidth;
  canvas.height = padding * 2 + lines.length * lineHeight + 60;

  ctx.fillStyle = "#0a0a0a";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#2dd4bf";
  ctx.font = "bold 20px Inter, system-ui, sans-serif";
  ctx.fillText("Scripz", padding, 44);

  ctx.fillStyle = "#d4d4d4";
  ctx.font = `${fontSize}px Monaco, Menlo, Courier New, monospace`;
  lines.forEach((line, index) => {
    ctx.fillText(line, padding, 90 + index * lineHeight);
  });

  const link = document.createElement("a");
  link.download = filename;
  link.href = canvas.toDataURL("image/png");
  link.click();
}
