import type { ReactNode } from "react";
import { Mail } from "lucide-react";
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
};
export type RichTextTemplateName = keyof typeof richTextTemplates;
