# www.cwts.edu implemented with Astro.build

## TODO

- [x] Setup Netlify deployment: https://cwts-www.netlify.app/
- [x] Integrate with netlify CMS
- [x] Multilingual support
- [x] CSS framework
- Components
  - [x] Header component without navigation
  - [x] Footer component
  - [x] Desktop navigation
  - [x] Mobile navigation
  - [x] Section page breadcrumbs
  - [x] Section page listing
- Homepage widgets
  - [x] Latest news
  - [x] Degree information
  - [ ] Faculty
  - [ ] Videos
  - [ ] Vision and mission
  - [ ] Icons
- Special section pages
  - [ ] Programs and degrees
  - [ ] Job listing
  - [ ] Faculty
- Content component
  - [ ] Video Embedding
  - [ ] PDF Embedding
  - [ ] Buttons
- Content management
  - [ ] Refactor the code to load from data files
  - [ ] Define schema for data files

## Project Structure

<dl>
<dt>src/pages</dt>
<dd>Static routing and dynamic routing, e.g. homepage</dd>
<dt>src/layouts</dt>
<dd>Page template components</dd>
<dt>src/components</dt>
<dd>Reusable components used in pages and layouts</dd>
<dt>src/content</dt>
<dd>Content collections, e.g. sub-section pages, faculty bio</dd>
<dt>src/data</dt>
<dd>Data files to config various parts of the site</dd>
<dt>src/scripts</dt>
<dd>Client-side scripts</dd>
<dt>src/libs</dt>
<dd>Server-side scripts</dd>
<dt>src/icons</dt>
<dd>Icon svg files used by Icon component. They are included in html inline.</dd>
<dt>src/assets</dt>
<dd>Images and CSS imported by Astro. They will be optimized by Astro.</dd>
<dt>public</dt>
<dd>Static files</dd>
</dl>

## Development environment

### Prerequisites

- [Nodejs](https://nodejs.org/)
- [VS Code](https://code.visualstudio.com/) or any other text editors
- [GitHub Desktop](https://desktop.github.com/)

### First time setup

1. Install Nodejs
2. Use Github Desktop to clone the [repo](https://github.com/saintfish/cwts-www)
3. Open the project directory in VS Code
4. In VS Code terminal, run `npm install` under project directory

### Run dev server for the first time

1. Run `npm run dev` to start the dev server
2. Click the link `http://localhost:3000/` in the terminal output
3. Press ctrl+c to stop the server

The first few steps only need to be done once. Running the `npm` command to start the development.

### Commands

All commands are run from the root of the project, from a terminal:

| Command                | Action                                           |
| :--------------------- | :----------------------------------------------- |
| `npm install`          | Installs dependencies                            |
| `npm run dev`          | Starts local dev server at `localhost:3000`      |
| `npm run build`        | Build your production site to `./dist/`          |
| `npm run preview`      | Preview your build locally, before deploying     |
| `npm run astro ...`    | Run CLI commands like `astro add`, `astro check` |
| `npm run astro --help` | Get help using the Astro CLI                     |

## Styling

The project uses [tailwind CSS](https://tailwindcss.com/) as base of css framework. Try to avoid defining component specific styles but use utility classes to apply styles.

## Section Pages

Section pages are defined in 2 parts:

- `src/content/pages`: Markdown files that defines the content and path
- `src/pages/[...slug].astro`: Read the content of content pages, apply the layout template
- `src/pages/other/path.astro`: Apply page specific layout template to specific page

To create a new page, create a new Markdown or MDX file in `src/content/pages`. It will generate a new page in corresponding place. If special style is needed:

- Add HTML code into Markdown. Tailwind classes are available for styling;
- Use MDX which can import custom component;
- Create a new page in `src/pages` in corresponding path to apply a different layout template.

## Menu

Menu items are defined in `src/data/menu.yml`. An item can be specified in 2 ways.

First referring to a page:

```yaml
page: path/to/the/page
noUrl: true # Optionally create a non-clickable menu item
```

The value of `page` field is the path under `src/content/pages` without file extension name. The page title is used as the menu item name, and the page URL is the target of the menu link.

Build will fail if a menu item refers to an non-existing page. So it is perfered way to link to internal pages.

The second way is setting the menu item name and URL directly:

```yaml
name: Menu Item Name
url: /path/to/the/url
```

The `url` can be anything, even to external sites. If `url` is missing, the menu item is not clickable.

Both menu items can have children menu. The UI component, namely `src/components/header/MobileNavbar.astro` and `src/components/header/Navbar.astro`, will choose the right style to render the children. Currently we render up to 3 levels of menu items.

## Resources

- [Astro documentation](https://docs.astro.build)
- [tailwind CSS](https://tailwindcss.com/)

## Known issue

- Added svgo 2.8.0 dependency manually due to [a bug in astro-icon](https://github.com/natemoo-re/astro-icon/issues/72#issuecomment-1369597045)
