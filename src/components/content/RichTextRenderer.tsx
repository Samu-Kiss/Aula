interface Props {
  body: Record<string, unknown>;
}

export function RichTextRenderer({ body }: Props) {
  const doc = body?.doc as { content?: TiptapNode[] } | undefined;
  if (!doc?.content) return null;

  return (
    <div className="prose-aula">
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
            el = (
              <a href={mark.attrs?.href as string} target="_blank" rel="noopener noreferrer">
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
