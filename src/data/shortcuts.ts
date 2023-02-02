import shortcuts from "./shortcuts.yml";

export interface Shortcut {
    name: string
    url: string
    type?: string
}

export default shortcuts as Shortcut[];