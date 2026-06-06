interface Props {
  body: Record<string, unknown>;
}

// Renderizador básico de Tiptap JSON — se expandirá en F1-08 con el editor completo
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
  marks?: { type: string }[];
  attrs?: Record<string, unknown>;
}

function TiptapNode({ node }: { node: TiptapNode }) {
  const children = node.content?.map((n, i) => <TiptapNode key={i} node={n} />);

  switch (node.type) {
    case "paragraph":
      return <p className="text-body text-ink mb-4 leading-relaxed">{children}</p>;
    case "heading": {
      const level = (node.attrs?.level as number) ?? 2;
      if (level === 1) return <h1 className="text-h1 text-ink mt-8 mb-4">{children}</h1>;
      if (level === 2) return <h2 className="text-h2 text-ink mt-6 mb-3">{children}</h2>;
      return <h3 className="text-h2 text-ink-soft mt-4 mb-2">{children}</h3>;
    }
    case "bulletList":
      return <ul className="list-disc pl-5 mb-4 space-y-1">{children}</ul>;
    case "orderedList":
      return <ol className="list-decimal pl-5 mb-4 space-y-1">{children}</ol>;
    case "listItem":
      return <li className="text-body text-ink">{children}</li>;
    case "blockquote":
      return (
        <blockquote className="border-l-2 border-ink-mute pl-4 my-4 text-body text-ink-soft italic">
          {children}
        </blockquote>
      );
    case "codeBlock":
      return (
        <pre className="bg-surface-alt rounded-[8px] p-4 mb-4 overflow-x-auto">
          <code className="text-mono text-ink">{children}</code>
        </pre>
      );
    case "horizontalRule":
      return <hr className="border-[rgba(0,0,0,0.08)] my-6" />;
    case "text": {
      let el: React.ReactNode = node.text ?? "";
      if (node.marks) {
        for (const mark of node.marks) {
          if (mark.type === "bold") el = <strong className="font-semibold">{el}</strong>;
          if (mark.type === "italic") el = <em>{el}</em>;
          if (mark.type === "code") el = <code className="text-mono bg-surface-alt px-1 rounded">{el}</code>;
        }
      }
      return <>{el}</>;
    }
    default:
      return <>{children}</>;
  }
}
