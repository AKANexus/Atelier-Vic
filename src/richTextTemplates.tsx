import type { ReactNode } from "react";
import { Link, Mail } from "lucide-react";
import { z } from "zod";

export interface RichTextTemplateContext {
  contactEmail?: string;
}

// Templates resolve site data at render time; saved rich text contains only text.
export const richTextTemplates = {
  contato: {
    label: "Inserir link de contato",
    defaultText: "Fale comigo por e-mail",
    icon: Mail,
    openingTag: "<template=contato>",
    render(children: ReactNode, context: RichTextTemplateContext): ReactNode {
      const email = z.email().safeParse(context.contactEmail);
      return email.success ? (
        <a className="rich-text-template-link" href={`mailto:${email.data}`}>
          <Mail size={18} aria-hidden="true" />
          <span>{children}</span>
        </a>
      ) : (
        children
      );
    },
  },
  link: {
    label: "Inserir link",
    defaultText: "Texto do Link",
    icon: Link,
    openingTag: "<template=link url=https://seusite.com>",
    render(
      children: ReactNode,
      _context: RichTextTemplateContext,
      url?: string,
    ): ReactNode {
      try {
        const parsed = new URL(url || "");
        if (!["https:", "http:"].includes(parsed.protocol)) return children;
        return (
          <a className="rich-text-template-link" href={parsed.href}>
            {children}
          </a>
        );
      } catch {
        return children;
      }
    },
  },
};
export type RichTextTemplateName = keyof typeof richTextTemplates;
