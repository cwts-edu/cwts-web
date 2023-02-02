import menu from "./menu.yml";

export interface MenuItem {
    name: string;
    url?: string;
    children?: MenuItem[];
}

export default menu as MenuItem[];