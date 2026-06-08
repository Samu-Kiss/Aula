interface Props {
  body: Record<string, unknown> | null;
}

function toEmbedUrl(url: string): string | null {
  const ytMatch = url.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}`;
  const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
  if (vimeoMatch) return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
  return null;
}

export function VideoRenderer({ body }: Props) {
  const url = body?.url as string | undefined;
  if (!url) {
    return <p className="text-body text-ink-soft">Video no configurado.</p>;
  }

  const embedUrl = toEmbedUrl(url);
  if (!embedUrl) {
    return <p className="text-body text-ink-soft">URL de video no válida.</p>;
  }

  return (
    <div
      className="relative w-full rounded-[12px] overflow-hidden shadow-sm"
      style={{ paddingBottom: "56.25%" }}
    >
      <iframe
        src={embedUrl}
        className="absolute inset-0 w-full h-full"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        title="Video"
      />
    </div>
  );
}
