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

-   [Example](#example)
-   [Install](#install)
-   [Usage](#usage)
-   [Options](#options)
    -   [At Rule Pattern](#at-rule-pattern)
    -   [Merge](#merge)
    -   [Nest](#nest)
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
	@layer defaults {
		.header {
			color: #1c1c1c;
		}
	}
}
@layer reset {
	@media screen {
		.picture {
			display: block;
		}
	}
}
@media screen and (min-width: 760px) {
	.button {
		color: #cdcdcd;
	}
}
@media screen and (width < 640px) {
	.main {
		color: #cdcdcd;
	}
	@layer defaults {
		.main {
			color: #1c1c1c;
		}
	}
}
@media screen and (min-width: 1280px) {
	.button {
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
@media screen {
	@layer reset {
		.picture {
			display: block;
		}
	}
}
@media screen and (width < 640px) {
	/* combined */
	.header {
		color: #cdcdcd;
	}
	@layer defaults {
		.header {
			color: #1c1c1c;
		}
		.main {
			color: #1c1c1c;
		}
	}
	.main {
		color: #cdcdcd;
	}
	.footer {
		color: #cdcdcd;
	}
}
@media screen and (min-width: 760px) {
	.button {
		color: #cdcdcd;
	}
}
@media screen and (min-width: 1280px) {
	.button {
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
+     nest: true,
+   }),
    require('autoprefixer')
  ]
}
```

or with custom at rule matching

```diff
module.exports = {
  plugins: [
+   require('postcss-merge-at-rules')({
+     atRulePattern: 'layer'
+   }),
    require('autoprefixer')
  ]
}
```

If you do not use PostCSS, add it according to [official docs]
and set this plugin in settings.

## Options

### At Rule Pattern

String or regex expresion to math CSS at rules

```js
require("postcss")([
	require("postcss-merge-at-rules")({
		atRulePattern: /(media|layer|supports)/im, // default value
	}),
]).process(css);
```

### Flatten

Flatten (without sorting) any valid CSS at rule. media at rules take precedence

```js
require("postcss")([
	require("postcss-merge-at-rules")({
		flatten: true, // default value
	}),
]).process(css);
```

### Merge

Merge (without sorting) any valid CSS at rule.

```js
require("postcss")([
	require("postcss-merge-at-rules")({
		merge: true, // default value
	}),
]).process(css);
```

### Nest

Nest compatible CSS at rules (media, container) within each other when possible.

```js
require("postcss")([
	require("postcss-merge-at-rules")({
		nest: true, // false by default
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
