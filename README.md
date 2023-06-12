# PostCSS Merge At Rules

[PostCSS]: https://github.com/postcss/postcss
[MIT]: https://github.com/yunusga/postcss-merge-at-rules/blob/master/LICENSE
[official docs]: https://github.com/postcss/postcss#usage
[Releases history]: https://github.com/vis97c/postcss-merge-at-rules/blob/master/CHANGELOG.md

[![npm](https://img.shields.io/npm/v/postcss-merge-at-rules.svg)](https://www.npmjs.com/package/postcss-merge-at-rules)
[![CircleCI](https://dl.circleci.com/status-badge/img/gh/vis97c/postcss-merge-at-rules/tree/master.svg?style=svg)](https://dl.circleci.com/status-badge/redirect/gh/vis97c/postcss-merge-at-rules/tree/master)
![license](https://img.shields.io/badge/License-MIT-orange.svg)
[![npm](https://img.shields.io/npm/dt/postcss-merge-at-rules.svg)](https://www.npmjs.com/package/postcss-merge-at-rules)

[PostCSS] plugin for merging and nesting CSS at rules.

> Refer to [postcss-sort-media-queries](https://github.com/yunusga/postcss-sort-media-queries) for sorting

## Table of Contents

-   [Example](#examples)
-   [Install](#install)
-   [Usage](#usage)
-   [Options](#options)
    -   [sort](#sort)
    -   [Custom sort function](#custom-sort-function)
    -   [Sort configuration](#sort-configuration)
    -   [Only Top Level](#only-top-level)
-   [Changelog](#changelog)
-   [License](#license)
-   [Other PostCSS plugins](#other-postcss-plugins)
-   [Thanks 💪](#thanks)

## Example

**before**

```css
@media screen and (width < 640px) {
	.header {
		color: #cdcdcd;
	}
}
@media screen and (min-width: 760px) {
	.desktop-first {
		color: #cdcdcd;
	}
}
@media screen and (width < 640px) {
	.main {
		color: #cdcdcd;
	}
}
@media screen and (min-width: 1280px) {
	.desktop-first {
		color: #cdcdcd;
	}
}
@media screen and (max-width: 760px) {
	.footer {
		color: #cdcdcd;
	}
}
@media screen and (max-width: 640px) {
	.footer {
		color: #cdcdcd;
	}
}
```

**after**

```css
@media screen and (max-width: 760px) {
	.footer {
		color: #cdcdcd;
	}
}
@media screen and (width < 640px) {
	/* combined */
	.header {
		color: #cdcdcd;
	}
	.main {
		color: #cdcdcd;
	}
	.footer {
		color: #cdcdcd;
	}
}
@media screen and (min-width: 760px) {
	.desktop-first {
		color: #cdcdcd;
	}
}
@media screen and (min-width: 1280px) {
	.desktop-first {
		color: #cdcdcd;
	}
}
```

## Install

First thing's, install the module:

```
npm install postcss postcss-merge-at-rules --save-dev
```

## Usage

Check you project for existed PostCSS config: `postcss.config.js`
in the project root, `"postcss"` section in `package.json`
or `postcss` in bundle config.

If you already use PostCSS, add the plugin to plugins list:

```diff
module.exports = {
  plugins: [
+   require('postcss-merge-at-rules')({
+     sort: 'mobile-first', // default value
+   }),
    require('autoprefixer')
  ]
}
```

or with custom sort function

```diff
module.exports = {
  plugins: [
+   require('postcss-merge-at-rules')({
+     sort: function(a, b) {
+        // custom sorting function
+     }
+   }),
    require('autoprefixer')
  ]
}
```

If you do not use PostCSS, add it according to [official docs]
and set this plugin in settings.

## Options

> Sorting works based on [dutchenkoOleg/sort-css-media-queries](https://github.com/dutchenkoOleg/sort-css-media-queries) function.

### sort

This option support **string** or **function** values.

-   `{string}` `'mobile-first'` - (default) mobile first sorting
-   `{string}` `'desktop-first'` - desktop first sorting
-   `{function}` your own sorting function

#### `'mobile-first'`

```js
postcss([
	sortMediaQueries({
		sort: "mobile-first", // default
	}),
]).process(css);
```

#### `'desktop-first'`

```js
postcss([
	sortMediaQueries({
		sort: "desktop-first",
	}),
]).process(css);
```

### Custom sort function

```js
postcss([
	sortMediaQueries({
		function(a, b) {
			return a.localeCompare(b);
		},
	}),
]).process(css);
```

In this example, all your media queries will sort by A-Z order.

This sorting function is directly passed to Array#sort() method of an array of all your media queries.

### Sort configuration

By this configuration you can control sorting behaviour.

```js
postcss([
	sortMediaQueries({
		configuration: {
			unitlessMqAlwaysFirst: true, // or false
		},
	}),
]).process(css);
```

Or alternatively create a `sort-css-mq.config.json` file in the root of your project. Or add property `sortCssMQ: {}` in your `package.json`.

### Only Top Level

Sort only top level media queries to prevent eject nested media queries from parent node

```js
postcss([
	sortMediaQueries({
		onlyTopLevel: true,
	}),
]).process(css);
```

### Cascade Layer, Scope & Supports

Merge (without sorting) cascade layers, scope and support rules as well.

```js
postcss([
	sortMediaQueries({
		mergeAtRules: true,
	}),
]).process(css);
```

This will only merge the ones that are not nested within selectors

### Nest media queries

Nest compatible top level media queries.

```js
postcss([
	sortMediaQueries({
		nested: true,
	}),
]).process(css);
```

---

## Changelog

See [Releases history]

## License

[MIT]

## Thanks

-   Yunus Gaziyev [@yunusga](https://github.com/yunusga)
-   Oleh Dutchenko [@dutchenkoOleg](https://github.com/dutchenkoOleg)
