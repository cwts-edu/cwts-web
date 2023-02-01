# www.cwts.edu implemented with Astro.build

## TODO

* [x] Setup Netlify deployment: https://cwts-www.netlify.app/
* [ ] Integrate with netlify CMS
* [ ] Multilingual support
* [x] CSS framework
* Components
  * [ ] Header component without navigation
  * [ ] Footer component
  * [ ] Desktop navigation
  * [ ] Mobile navigation
  * [ ] Section page side navigation
* Homepage widgets

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
<dt>public</dt>
<dd>Static files</dd>
</dl>

## Commands

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

The project uses [bootstrap 5.2+](https://getbootstrap.com/docs/5.2/getting-started/introduction) as base of css framework. It is defined as a [global CSS](https://docs.astro.build/en/guides/styling/#global-styles) to define styles for the whole page. Change global styles in `/src/layouts/global.scss`.

Individual components should use [scoped styles](https://docs.astro.build/en/guides/styling/#scoped-styles) if it specific style can not be implemented with bootstrap classes.

## Resources

* [Astro documentation](https://docs.astro.build)
* [Bootstrap 5.2 documentation](https://getbootstrap.com/docs/5.2/getting-started/introduction/)
