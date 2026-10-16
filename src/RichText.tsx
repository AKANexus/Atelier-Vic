import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import {
  Bold,
  Italic,
  Underline,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Pilcrow,
} from "lucide-react";
import { richTextSchema, type RichText } from "./domain";
import {
  richTextTemplates,
  type RichTextTemplateContext,
  type RichTextTemplateName,
} from "./richTextTemplates";

export function normalizeRichText(value: RichText | string): RichText {
  return typeof value === "string"
    ? value
      ? [{ type: "paragraph", spans: [{ text: value }] }]
      : []
    : value;
}

function formatted(spans: RichText[number]["spans"]) {
  return spans.map((span, index) => {
    let text: ReactNode = span.text;
    if (
      span.bold === false ||
      span.italic === false ||
      span.underline === false
    )
      text = (
        <span
          style={{
            fontWeight: span.bold === false ? "normal" : undefined,
            fontStyle: span.italic === false ? "normal" : undefined,
            textDecoration: span.underline === false ? "none" : undefined,
          }}
        >
          {text}
        </span>
      );
    if (span.bold) text = <strong>{text}</strong>;
    if (span.italic) text = <em>{text}</em>;
    if (span.underline) text = <u>{text}</u>;
    return <Fragment key={index}>{text}</Fragment>;
  });
}

function inline(
  spans: RichText[number]["spans"],
  context: RichTextTemplateContext,
) {
  const text = spans.map((span) => span.text).join("");
  function range(start: number, end: number) {
    let offset = 0;
    return spans.flatMap((span) => {
      const from = Math.max(0, start - offset);
      const to = Math.min(span.text.length, end - offset);
      offset += span.text.length;
      return to > from ? [{ ...span, text: span.text.slice(from, to) }] : [];
    });
  }
  const nodes: ReactNode[] = [];
  const pattern =
    /<template=([a-z][a-z0-9_-]*)(?: url=([^<>\s]+))?>([\s\S]*?)<\/template>/g;
  let position = 0;
  for (const match of text.matchAll(pattern)) {
    const start = match.index!;
    const end = start + match[0].length;
    nodes.push(
      <Fragment key={`text-${start}`}>
        {formatted(range(position, start))}
      </Fragment>,
    );
    const name = match[1];
    if (
      Object.hasOwn(richTextTemplates, name) &&
      !match[3].includes("<template=") &&
      (name === "link" ? Boolean(match[2]) : !match[2])
    ) {
      const contentStart = start + match[0].indexOf(">") + 1;
      const children = formatted(
        range(contentStart, contentStart + match[3].length),
      );
      nodes.push(
        <Fragment key={`template-${start}`}>
          {richTextTemplates[name as RichTextTemplateName].render(
            children,
            context,
            match[2],
          )}
        </Fragment>,
      );
    } else
      nodes.push(
        <Fragment key={`literal-${start}`}>
          {formatted(range(start, end))}
        </Fragment>,
      );
    position = end;
  }
  nodes.push(
    <Fragment key="remaining">
      {formatted(range(position, text.length))}
    </Fragment>,
  );
  return nodes;
}

export function RichTextContent({
  value,
  context = {},
}: {
  value: RichText;
  context?: RichTextTemplateContext;
}) {
  const nodes: ReactNode[] = [];
  for (let index = 0; index < value.length; index++) {
    const block = value[index];
    if (block.type === "bullet" || block.type === "number") {
      const Tag = block.type === "bullet" ? "ul" : "ol";
      const items: ReactNode[] = [];
      const key = index;
      do {
        items.push(<li key={index}>{inline(value[index].spans, context)}</li>);
        index++;
      } while (index < value.length && value[index].type === block.type);
      index--;
      nodes.push(<Tag key={key}>{items}</Tag>);
    } else {
      const Tag =
        block.type === "heading"
          ? "h2"
          : block.type === "subheading"
            ? "h3"
            : block.type === "quote"
              ? "blockquote"
              : "p";
      nodes.push(<Tag key={index}>{inline(block.spans, context)}</Tag>);
    }
  }
  return <div className="rich-text-content">{nodes}</div>;
}

// Store only text and explicit formatting. HTML, attributes and embedded media
// never enter the configuration or the public renderer.
export function readRichText(root: HTMLElement): RichText {
  const blocks: RichText = [];
  const forbidden = new Set([
    "SCRIPT",
    "STYLE",
    "IFRAME",
    "OBJECT",
    "IMG",
    "SVG",
    "VIDEO",
    "AUDIO",
  ]);
  const blockTags = new Set([
    "P",
    "DIV",
    "H1",
    "H2",
    "H3",
    "H4",
    "BLOCKQUOTE",
    "UL",
    "OL",
    "LI",
  ]);
  const spans: (
    node: Node,
    marks?: { bold?: boolean; italic?: boolean; underline?: boolean },
  ) => RichText[number]["spans"] = (node, marks = {}) => {
    if (node.nodeType === Node.TEXT_NODE)
      return node.textContent ? [{ text: node.textContent, ...marks }] : [];
    if (!(node instanceof HTMLElement) || forbidden.has(node.tagName))
      return [];
    if (node.tagName === "BR") return [{ text: "\n", ...marks }];
    const next = { ...marks };
    if (["B", "STRONG"].includes(node.tagName)) next.bold = true;
    if (["I", "EM"].includes(node.tagName)) next.italic = true;
    if (node.tagName === "U") next.underline = true;
    if (["bold", "700"].includes(node.style.fontWeight)) next.bold = true;
    if (["normal", "400"].includes(node.style.fontWeight)) next.bold = false;
    if (node.style.fontStyle === "italic") next.italic = true;
    if (node.style.fontStyle === "normal") next.italic = false;
    if (node.style.textDecoration.includes("underline")) next.underline = true;
    if (node.style.textDecoration === "none") next.underline = false;
    return Array.from(node.childNodes).flatMap((child) => spans(child, next));
  };
  function collect(
    parent: HTMLElement,
    inherited: RichText[number]["type"] = "paragraph",
  ) {
    let pending: RichText[number]["spans"] = [];
    function flush() {
      if (pending.length) blocks.push({ type: inherited, spans: pending });
      pending = [];
    }
    for (const child of Array.from(parent.childNodes)) {
      if (child instanceof HTMLElement && blockTags.has(child.tagName)) {
        flush();
        const tag = child.tagName;
        if (tag === "UL" || tag === "OL")
          collect(child, tag === "UL" ? "bullet" : "number");
        else {
          const type = ["H1", "H2"].includes(tag)
            ? "heading"
            : ["H3", "H4"].includes(tag)
              ? "subheading"
              : tag === "BLOCKQUOTE"
                ? "quote"
                : tag === "LI"
                  ? inherited
                  : "paragraph";
          if (
            Array.from(child.children).some((element) =>
              blockTags.has(element.tagName),
            )
          )
            collect(child, type);
          else blocks.push({ type, spans: spans(child) });
        }
      } else pending.push(...spans(child));
    }
    flush();
  }
  collect(root);
  return blocks;
}

function writeRichText(root: HTMLElement, value: RichText) {
  const fragment = document.createDocumentFragment();
  let list: HTMLElement | undefined;
  let listType = "";
  for (const block of value) {
    const isList = block.type === "bullet" || block.type === "number";
    if (!isList || listType !== block.type) {
      list = undefined;
      listType = "";
    }
    if (isList && !list) {
      list = document.createElement(block.type === "bullet" ? "ul" : "ol");
      listType = block.type;
      fragment.appendChild(list);
    }
    const element = document.createElement(
      isList
        ? "li"
        : block.type === "heading"
          ? "h2"
          : block.type === "subheading"
            ? "h3"
            : block.type === "quote"
              ? "blockquote"
              : "p",
    );
    for (const span of block.spans) {
      let node: Node = document.createTextNode(span.text);
      if (
        span.bold === false ||
        span.italic === false ||
        span.underline === false
      ) {
        const reset = document.createElement("span");
        if (span.bold === false) reset.style.fontWeight = "normal";
        if (span.italic === false) reset.style.fontStyle = "normal";
        if (span.underline === false) reset.style.textDecoration = "none";
        reset.appendChild(node);
        node = reset;
      }
      for (const tag of [
        span.bold && "strong",
        span.italic && "em",
        span.underline && "u",
      ]) {
        if (!tag) continue;
        const wrapper = document.createElement(tag);
        wrapper.appendChild(node);
        node = wrapper;
      }
      element.appendChild(node);
    }
    if (!element.childNodes.length)
      element.appendChild(document.createElement("br"));
    (list || fragment).appendChild(element);
  }
  root.replaceChildren(fragment);
}

export function RichTextEditor({
  value,
  onChange,
  disabled = false,
  label = "Texto do processo",
  templates = [],
}: {
  value: RichText;
  onChange: (value: RichText) => void;
  disabled?: boolean;
  label?: string;
  templates?: readonly RichTextTemplateName[];
}) {
  const root = useRef<HTMLDivElement>(null);
  const lastValue = useRef("");
  const selection = useRef<Range | null>(null);
  useEffect(() => {
    const remember = () => {
      const selected = window.getSelection();
      if (selected?.rangeCount) {
        const range = selected.getRangeAt(0);
        if (root.current?.contains(range.commonAncestorContainer))
          selection.current = range.cloneRange();
      }
    };
    document.addEventListener("selectionchange", remember);
    return () => document.removeEventListener("selectionchange", remember);
  }, []);
  const [error, setError] = useState("");
  useEffect(() => {
    const serialized = JSON.stringify(value);
    if (root.current && serialized !== lastValue.current) {
      writeRichText(root.current, value);
      lastValue.current = serialized;
    }
  }, [value]);
  function update() {
    if (!root.current) return;
    const next = readRichText(root.current);
    const result = richTextSchema.safeParse(next);
    setError(
      result.success ? "" : "Use até 10.000 caracteres e 100 blocos de texto.",
    );
    lastValue.current = JSON.stringify(next);
    onChange(next);
  }
  function restoreSelection() {
    const saved = selection.current?.cloneRange();
    root.current?.focus();
    const selected = window.getSelection();
    if (!root.current || !selected) return;
    const range =
      saved && root.current.contains(saved.commonAncestorContainer)
        ? saved
        : document.createRange();
    if (range !== saved) {
      range.selectNodeContents(root.current);
      range.collapse(false);
    }
    selected.removeAllRanges();
    selected.addRange(range);
    return range;
  }
  const commands = [
    { name: "Negrito", icon: Bold, command: "bold" },
    { name: "Itálico", icon: Italic, command: "italic" },
    { name: "Sublinhado", icon: Underline, command: "underline" },
    { name: "Título", icon: Heading2, command: "formatBlock", value: "h2" },
    { name: "Subtítulo", icon: Heading3, command: "formatBlock", value: "h3" },
    { name: "Texto normal", icon: Pilcrow, command: "formatBlock", value: "p" },
    {
      name: "Lista com marcadores",
      icon: List,
      command: "insertUnorderedList",
    },
    { name: "Lista numerada", icon: ListOrdered, command: "insertOrderedList" },
    {
      name: "Citação",
      icon: Quote,
      command: "formatBlock",
      value: "blockquote",
    },
  ];
  return (
    <div className="rich-text-editor">
      <div
        className="rich-text-toolbar"
        role="group"
        aria-label={`Formatação: ${label}`}
      >
        {commands.map((item) => (
          <button
            type="button"
            key={item.name}
            className={
              item.value === "p"
                ? "icon-button rich-text-normal"
                : "icon-button"
            }
            disabled={disabled}
            title={item.name}
            aria-label={item.name}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              restoreSelection();
              document.execCommand("styleWithCSS", false, "false");
              document.execCommand(item.command, false, item.value);
              update();
            }}
          >
            <item.icon size={18} />
            {item.value === "p" && <span>Texto normal</span>}
          </button>
        ))}
      </div>
      {templates.length > 0 && (
        <div
          className="rich-text-toolbar"
          role="group"
          aria-label={`Inserir: ${label}`}
        >
          {templates.map((name) => {
            const template = richTextTemplates[name];
            return (
              <button
                type="button"
                key={name}
                className="icon-button"
                title={template.label}
                aria-label={template.label}
                disabled={disabled}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  const range = restoreSelection();
                  const text = range?.toString() || template.defaultText;
                  document.execCommand(
                    "insertText",
                    false,
                    `${template.openingTag}${text}</template>`,
                  );
                  update();
                }}
              >
                <template.icon size={18} />
              </button>
            );
          })}
        </div>
      )}
      <div
        ref={root}
        className="rich-text-content rich-text-input"
        role="textbox"
        aria-label={label}
        aria-multiline="true"
        contentEditable={!disabled}
        aria-disabled={disabled}
        suppressContentEditableWarning
        onInput={update}
        onPaste={(event) => {
          event.preventDefault();
          document.execCommand(
            "insertText",
            false,
            event.clipboardData.getData("text/plain"),
          );
          update();
        }}
        onDrop={(event) => event.preventDefault()}
      />
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <p className="muted">Até 10.000 caracteres.</p>
    </div>
  );
}
