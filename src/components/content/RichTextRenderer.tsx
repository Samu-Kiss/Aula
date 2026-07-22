import { accentHex } from "@/lib/accentColors";

interface Props {
  body: Record<string, unknown>;
  accent?: string | null;
}

/**
 * Only allow safe URL schemes for links authored in the rich-text editor.
 * The content body is stored as free-form JSON, so a link `href` could be
 * `javascript:...` (or `data:`/`vbscript:`), which would run as XSS when a
 * student clicks it. Anything not clearly http(s)/mailto/tel/relative is
 * dropped (rendered as a non-navigating anchor).
 */
function safeHref(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const href = value.trim();
  if (href === "") return undefined;
  // Relative or anchor/protocol-relative links are safe.
  if (/^(\/|#|\.|\?)/.test(href)) return href;
  if (/^(https?:|mailto:|tel:)/i.test(href)) return href;
  // Reject javascript:, data:, vbscript:, and any other scheme.
  return undefined;
}

export function RichTextRenderer({ body, accent }: Props) {
  const doc = body?.doc as { content?: TiptapNode[] } | undefined;
  if (!doc?.content) return null;

  const hex = accentHex(accent);

  return (
    <div
      className="prose-aula"
      style={hex ? ({ "--link-color": hex } as React.CSSProperties) : undefined}
    >
      {doc.content.map((node, i) => (
        <TiptapNode key={i} node={node} />
      ))}
    </div>
  );
}

interface TiptapNode {
  type: string;
  content?: TiptapNode[];
  text?: string;
  marks?: { type: string; attrs?: Record<string, unknown> }[];
  attrs?: Record<string, unknown>;
}

function TiptapNode({ node, inList }: { node: TiptapNode; inList?: boolean }) {
  const children = node.content?.map((n, i) => (
    <TiptapNode
      key={i}
      node={n}
      inList={node.type === "listItem" || inList}
    />
  ));

  switch (node.type) {
    case "paragraph":
      // Inside list items, avoid extra <p> wrapper — renders inline
      if (inList) return <>{children}</>;
      return <p>{children}</p>;

    case "heading": {
      const level = (node.attrs?.level as number) ?? 2;
      if (level === 1) return <h1>{children}</h1>;
      if (level === 2) return <h2>{children}</h2>;
      return <h3>{children}</h3>;
    }

    case "bulletList":
      return <ul>{children}</ul>;

    case "orderedList":
      return <ol>{children}</ol>;

    case "listItem":
      return <li>{children}</li>;

    case "blockquote":
      return <blockquote>{children}</blockquote>;

    case "codeBlock":
      return (
        <pre>
          <code>{children}</code>
        </pre>
      );

    case "hardBreak":
      return <br />;

    case "horizontalRule":
      return <hr />;

    case "image":
      return (
        <img
          src={node.attrs?.src as string}
          alt={(node.attrs?.alt as string) ?? ""}
          title={(node.attrs?.title as string) ?? undefined}
          className="max-w-full rounded-[8px] my-2"
        />
      );

    case "text": {
      let el: React.ReactNode = node.text ?? "";
      if (node.marks) {
        for (const mark of node.marks) {
          if (mark.type === "bold") el = <strong>{el}</strong>;
          else if (mark.type === "italic") el = <em>{el}</em>;
          else if (mark.type === "underline") el = <u>{el}</u>;
          else if (mark.type === "strike") el = <s>{el}</s>;
          else if (mark.type === "code") el = <code>{el}</code>;
          else if (mark.type === "link") {
            const href = safeHref(mark.attrs?.href);
            el = (
              <a href={href} target="_blank" rel="noopener noreferrer nofollow">
                {el}
              </a>
            );
          }
        }
      }
      return <>{el}</>;
    }

    default:
      return <>{children}</>;
  }
}
