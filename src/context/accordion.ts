import { createContext } from '@astropub/context'

export const [AccordionProvider, getAccordionContext] = createContext<{
  name: string;
  summaryClassNames?: string[];
  detailsClassNames?: string[];
}>();
