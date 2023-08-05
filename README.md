# [CWTS](https://www.cwts.edu) implemented with [Astro](https://astro.build/)

Read [Wiki](https://github.com/cwts-edu/cwts-web/wiki) for how to setup dev environment and edit the content.

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

## Known issue

- Added svgo 2.8.0 dependency manually due to [a bug in astro-icon](https://github.com/natemoo-re/astro-icon/issues/65)
