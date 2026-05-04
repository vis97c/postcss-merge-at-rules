// @ts-check

/**
 * @typedef {import('postcss/lib/postcss').Plugin} Plugin
 * @typedef {import('postcss/lib/postcss').Root} Root
 * @typedef {import('postcss/lib/postcss').AtRule} AtRule
 * @typedef {import('postcss/lib/postcss').Helpers} Helpers
 */

/**
 * @typedef {object} pluginOptions
 * @property {string|RegExp=} atRulePattern The string or regex pattern to match atRules. Defaults to: /(media|layer|supports)/im
 * @property {boolean=} flatten Whether to flatten the atRules or not, media atRules will be moved to the root to facilitate sorting, "atRulePattern" is required. Defaults to true.
 * @property {boolean=} merge Whether to merge the atRules or not, "atRulePattern" is required. Defaults to true.
 * @property {boolean=} nest Whether to nest the atRules or not, "atRulePattern" is required. Defaults to false.
 */

// ---------------------------------------------------------------------------
// Constants hoisted out of the hot dedupe path
// (were re-created on every reduce element call in the original)
// ---------------------------------------------------------------------------
const MIN_EXTENDED = [" > ", ">=", "min-"];
const MAX_EXTENDED = [" < ", "<=", "max-"];
const MIN_MAX_EXTENDED = [...MIN_EXTENDED, ...MAX_EXTENDED];

// ---------------------------------------------------------------------------
// Per-run memoisation caches
// Caches store frozen arrays so mutation at call sites cannot corrupt them.
// Callers that need to mutate (shift/sort) work on a copy.
// ---------------------------------------------------------------------------

/** @type {Map<string, ReadonlyArray<string>>} */
let _paramsCache;
/** @type {Map<string, ReadonlyArray<string>>} */
let _sortedParamsCache;
/** @type {Map<string, string>} */
let _joinCache;
/** @type {Map<string, ReadonlyArray<number>>} */
let _numValuesCache;

/**
 * Reset all caches.
 */
function resetCaches() {
	_paramsCache = new Map();
	_sortedParamsCache = new Map();
	_joinCache = new Map();
	_numValuesCache = new Map();
}

// ---------------------------------------------------------------------------
// Core helpers
// ---------------------------------------------------------------------------

/**
 * Get AtRule params array
 * Splits a query string on " and ", deduplicates, trims.
 * Returns a FROZEN array — callers that need mutation must copy first.
 * @param {string} query - AtRule params
 * @returns {ReadonlyArray<string>} AtRule params array
 */
function getParams(query) {
	let cachedResult = _paramsCache.get(query);

	if (cachedResult) return cachedResult;

	cachedResult = Object.freeze([...new Set(query.split(" and ").map((q) => q.trim()))]);
	_paramsCache.set(query, cachedResult);

	return cachedResult;
}

/**
 * Get param value
 * Extract numeric values from a param string.
 * @param {string} param - The queries
 * @returns {ReadonlyArray<number>} - querie values
 */
function getNumValues(param) {
	let cachedResult = _numValuesCache.get(param);

	if (cachedResult) return cachedResult;

	/** @type {number[]} */
	const values = [];

	for (const token of param.split(" ")) {
		const num = parseFloat(token.replace(/\D/g, ""));

		if (!isNaN(num)) values.push(num);
	}

	cachedResult = Object.freeze(values);
	_numValuesCache.set(param, cachedResult);

	return cachedResult;
}

/**
 * string includes one or more of
 * @param {string} value - the value
 * @param {string[]} toCompare - to compare values
 * @returns {boolean} - result
 */
function includes(value, toCompare) {
	for (let i = 0; i < toCompare.length; i++) if (value.includes(toCompare[i])) return true;

	return false;
}

/**
 * replace on string
 * @param {string} value - the value
 * @param {ReadonlyArray<string|number>} toReplace - to replace values
 * @param {ReadonlyArray<string|number>} toReplaceWith - to replace with values
 * @returns {string} result
 */
function replaceAllOf(value, toReplace, toReplaceWith = []) {
	for (let i = 0; i < toReplace.length; i++) {
		value = value.replace(String(toReplace[i]), String(toReplaceWith[i] || ""));
	}

	return value;
}

/**
 * Dedupe reducer for joinParams.
 * Extracted to module level so it is not reallocated on every joinParams call.
 * @param {string[]} acc - The array of queries
 * @param {string} current - Current querie
 * @returns {string[]} - Reduced array
 */
function dedupe(acc, current) {
	const previous = acc[acc.length - 1];

	if (!previous) return [current];
	if (!includes(previous, MIN_MAX_EXTENDED) || !includes(current, MIN_MAX_EXTENDED)) {
		return [...acc, current];
	}

	const previousValues = getNumValues(previous);
	const currentValues = getNumValues(current);

	if (!previousValues.length || !currentValues.length) return [...acc, current];

	if (includes(previous, MIN_EXTENDED)) {
		if (previousValues.length === 2 && currentValues.length === 2) {
			if (previousValues[1] > currentValues[0] || currentValues[1] > previousValues[0]) {
				throw new Error("Min, empty intersection");
			}

			const newValues = [
				Math.max(previousValues[0], currentValues[0]),
				Math.min(previousValues[1], currentValues[1]),
			];

			return [...acc.slice(0, -1), replaceAllOf(previous, previousValues, newValues)];
		}
		if (includes(current, MIN_EXTENDED)) {
			return previousValues[0] > currentValues[0] ? acc : [...acc.slice(0, -1), current];
		} else if (previousValues[0] >= currentValues[0]) {
			throw new Error("Min vs max, invalid range");
		}
	} else if (includes(previous, MAX_EXTENDED)) {
		if (previousValues.length === 2 && currentValues.length === 2) {
			if (previousValues[0] > currentValues[1] || currentValues[0] > previousValues[1]) {
				throw new Error("Max, empty intersection");
			}

			const newValues = [
				Math.min(previousValues[0], currentValues[0]),
				Math.max(previousValues[1], currentValues[1]),
			];

			return [...acc.slice(0, -1), replaceAllOf(previous, previousValues, newValues)];
		}
		if (includes(current, MAX_EXTENDED)) {
			return previousValues[0] < currentValues[0] ? acc : [...acc.slice(0, -1), current];
		} else if (previousValues[0] <= currentValues[0]) {
			throw new Error("Max vs min, invalid range");
		}
	}

	return [...acc, current];
}

/**
 * Join params array into a query string, with range deduplication.
 * Cached by the serialised key of paramsArr + name.
 * @param {ReadonlyArray<string>} paramsArr - AtRule params array
 * @param {string} name - AtRule name ("media"|"layer")
 * @returns {string} Joined query string
 */
function joinParams(paramsArr, name = "media") {
	const key = name + "|" + paramsArr.join("\0");
	let cachedResult = _joinCache.get(key);

	if (cachedResult !== undefined) return cachedResult;

	const flat = [...new Set(paramsArr.flatMap((p) => getParams(p)))];
	const params = flat.reduce(dedupe, /** @type {string[]} */ ([]));

	cachedResult = name === "layer" ? params.join(".") : params.join(" and ");
	_joinCache.set(key, cachedResult);

	return cachedResult;
}

/**
 * Sort AtRule params, to get better matches so numeric ones come last.
 * Returns a FROZEN array — callers that need to mutate must copy first.
 * @param {string} params - AtRule params to sort
 * @returns {ReadonlyArray<string>} Sorted array of query strings
 */
function sortParams(params) {
	let cachedResult = _sortedParamsCache.get(params);

	if (cachedResult) return cachedResult;

	// Slice to avoid mutating the getParams cache entry before sorting.
	cachedResult = Object.freeze(
		getParams(params)
			.slice()
			.sort((a, b) => (/\d/.test(a) ? 1 : /\d/.test(b) ? -1 : 0))
	);
	_sortedParamsCache.set(params, cachedResult);

	return cachedResult;
}

/**
 * Test an atRule name against a string or RegExp pattern.
 * Resets lastIndex before testing to handle global/sticky regexes correctly
 * (repeated .test() calls on a global regex advance lastIndex and alternate
 * between true/false, causing intermittent misses on large files).
 * @param {string} name - atRule name
 * @param {string|RegExp} pattern - pattern to test against
 * @returns {boolean} - true if matched
 */
function matchesPattern(name, pattern) {
	if (typeof pattern === "string") return name === pattern;
	if (pattern.global || pattern.sticky) pattern.lastIndex = 0;

	return pattern.test(name);
}

/**
 * Recursively flatten atRules
 * @template {AtRule|Root} T
 * @param {T} localRoot - Root or atRule instance
 * @param {string|RegExp} atRulePattern - atRuleMathing string or regex pattern
 * @param {Helpers} helpers - postcss helpers
 */
function recursivelyFlattenAtRules(localRoot, atRulePattern, helpers) {
	const root = localRoot.root();

	localRoot.walkAtRules(atRulePattern, (atRule) => {
		const atRuleIndex = localRoot.index(atRule);

		// AtRule exists
		if (atRuleIndex === -1 || !atRule.params || !atRule.nodes) return;

		// flatten inner rules first
		if (atRule.some((n) => n.type === "atrule")) {
			recursivelyFlattenAtRules(atRule, atRulePattern, helpers);
		}

		// cannot flatten if already on root
		if (localRoot.type === "root") return;

		// media rule nested in non media rule, invert
		if (atRule.name === "media" && atRule.name !== localRoot.name) {
			const newMedia = new helpers.AtRule({ name: atRule.name, params: atRule.params });

			newMedia.append(
				new helpers.AtRule({
					name: localRoot.name,
					params: localRoot.params,
					nodes: atRule.nodes,
				})
			);
			root.append(newMedia);
		} else {
			// cannot flatten if incompatible atRulePattern
			if (atRule.name !== localRoot.name) return;

			try {
				// merge media and layers into single rule
				const queryBase = joinParams([localRoot.params, atRule.params], atRule.name);
				const query = joinParams(sortParams(queryBase));

				if (localRoot.parent) {
					localRoot.parent.append(
						new helpers.AtRule({
							name: atRule.name,
							params: query,
							nodes: atRule.nodes,
						})
					);
				}
			} catch (error) {
				localRoot.warn(
					root.toResult(),
					`[Flatten]: Invalid "${atRule.params}", child of "${localRoot.params}"`,
					{ node: atRule }
				);
			}
		}

		atRule.remove();
	});
}

/**
 * Recursively merge atRules
 * @template {AtRule|Root} T
 * @param {T} localRoot - Root or atRule instance
 * @param {string|RegExp} atRulePattern - atRuleMathing string or regex pattern
 * @param {Helpers} helpers - postcss helpers
 */
function recursivelyMergeAtRules(localRoot, atRulePattern, helpers) {
	/** @type {Map<string, AtRule>} */
	const seenAtRules = new Map();

	// Pass 1: merge direct children only.
	localRoot.each((node) => {
		if (node.type !== "atrule") return;

		const atRule = /** @type {AtRule} */ (node);

		if (!atRule.params || !atRule.nodes) return;
		if (!matchesPattern(atRule.name, atRulePattern)) return;

		let query;

		try {
			query = joinParams(sortParams(atRule.params));
		} catch (error) {
			localRoot.warn(localRoot.root().toResult(), `[Merge]: Invalid "${atRule.params}"`, {
				node: atRule,
			});
			atRule.remove();

			return;
		}

		const existing = seenAtRules.get(query);

		if (existing !== undefined) {
			existing.append(atRule.nodes);
			atRule.remove();
		} else {
			seenAtRules.set(query, atRule.assign({ params: query }));
		}
	});

	// Pass 2: recurse into every surviving direct-child atRule.
	localRoot.each((node) => {
		if (node.type !== "atrule") return;

		const atRule = /** @type {AtRule} */ (node);

		if (!atRule.params || !atRule.nodes) return;
		if (!matchesPattern(atRule.name, atRulePattern)) return;

		recursivelyMergeAtRules(atRule, atRulePattern, helpers);
	});
}

/**
 * Recursively nest atRules
 * @template {AtRule|Root} T
 * @param {T} localRoot - Root or atRule instance
 * @param {string|RegExp} atRulePattern - atRuleMathing string or regex pattern
 * @param {Helpers} helpers - postcss helpers
 */
function recursivelyNestAtRules(localRoot, atRulePattern, helpers) {
	/** @type {Map<string, {atRule: AtRule, queryParams: ReadonlyArray<string>}[]>} */
	const groups = new Map();

	// Pass 1: Group matching direct children and recurse into all children.
	localRoot.each((node) => {
		if (node.type === "atrule" && matchesPattern(node.name, atRulePattern)) {
			if (!node.params || !node.nodes) return;

			try {
				const query = joinParams(sortParams(node.params));
				const queryParams = getParams(query);
				const base = queryParams[0];

				if (!groups.has(base)) groups.set(base, []);

				groups.get(base)?.push({ atRule: node, queryParams });
			} catch (error) {
				localRoot.warn(localRoot.root().toResult(), `[Nest]: Invalid "${node.params}"`, {
					node,
				});
				node.remove();
			}
		} else if ("nodes" in node && node.nodes) {
			// Recurse into any container (Rule, Root, non-matching AtRule)
			recursivelyNestAtRules(/** @type {AtRule|Root} */ (node), atRulePattern, helpers);
		}
	});

	// Pass 2: Process each group of siblings.
	for (const [base, entries] of groups) {
		const firstEntry = entries[0];
		const hasMultipleEntries = entries.length > 1;
		const hasMultipleParams = firstEntry.queryParams.length > 1;

		try {
			if (hasMultipleEntries || hasMultipleParams) {
				// Rewrite the first rule to be the parent of its own content (if it has multiple params).
				if (hasMultipleParams) {
					const remaining = firstEntry.queryParams.filter((p) => p !== base);

					firstEntry.atRule.assign({
						params: base,
						nodes: [
							firstEntry.atRule.clone({
								params: joinParams(remaining, firstEntry.atRule.name),
							}),
						],
					});
				} else {
					firstEntry.atRule.assign({ params: base });
				}

				// Move all other rules in the group into this parent.
				for (let i = 1; i < entries.length; i++) {
					const { atRule, queryParams } = entries[i];

					try {
						const remainingParams = queryParams.filter((p) => p !== base);

						if (remainingParams.length === 0) {
							firstEntry.atRule.append(atRule.nodes);
							atRule.remove();
						} else {
							atRule.assign({ params: joinParams(remainingParams, atRule.name) });
							firstEntry.atRule.append(atRule);
						}
					} catch (error) {
						localRoot.warn(
							localRoot.root().toResult(),
							`[Nest]: Invalid sibling "${atRule.params}" of "${firstEntry.atRule.params}"`,
							{ node: atRule }
						);
						atRule.remove();
					}
				}

				// Recurse into the modified rule to process newly nested content.
				recursivelyNestAtRules(firstEntry.atRule, atRulePattern, helpers);
			} else {
				// Alone and single param - just recurse into it.
				recursivelyNestAtRules(firstEntry.atRule, atRulePattern, helpers);
			}

			// Optimization: merge back if it only has one child atRule of the same name.
			if (
				firstEntry.atRule.nodes &&
				firstEntry.atRule.nodes.length === 1 &&
				firstEntry.atRule.nodes[0].type === "atrule" &&
				/** @type {AtRule} */ (firstEntry.atRule.nodes[0]).name === firstEntry.atRule.name
			) {
				const child = /** @type {AtRule} */ (firstEntry.atRule.nodes[0]);

				firstEntry.atRule.assign({
					params: joinParams(
						[firstEntry.atRule.params, child.params],
						firstEntry.atRule.name
					),
					nodes: child.nodes,
				});
			}
		} catch (error) {
			localRoot.warn(
				localRoot.root().toResult(),
				`[Nest]: Can't nest siblings to invalid "${firstEntry.atRule.params}"`,
				{ node: firstEntry.atRule }
			);
			firstEntry.atRule.remove();
		}
	}
}

/**
 * Plugin constructor
 * @param {pluginOptions} options - plugin options
 * @returns {Plugin} - plugin object
 */
module.exports = (options = {}) => {
	const { atRulePattern, flatten, merge, nest } = Object.assign(
		{ atRulePattern: /(media|layer|supports)/im, merge: true, flatten: true },
		options
	);

	return {
		postcssPlugin: "postcss-merge-at-rules",
		OnceExit(root, helpers) {
			if (!atRulePattern) throw new Error("A valid matching atRule pattern is required");

			resetCaches();

			if (flatten) recursivelyFlattenAtRules(root, atRulePattern, helpers);
			if (merge) recursivelyMergeAtRules(root, atRulePattern, helpers);
			if (nest) recursivelyNestAtRules(root, atRulePattern, helpers);
		},
	};
};

module.exports.postcss = true;
