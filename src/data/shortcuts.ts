import shortcuts from "./shortcuts.yml";

export interface Shortcut {
  name: string;
  url: string;
  type?: string;
  breakBefore?: boolean;
}

export default shortcuts as Shortcut[];
