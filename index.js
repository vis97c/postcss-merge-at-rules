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

/**
 * Get AtRule params array
 * @param {string} query - AtRule params
 * @returns {string[]} AtRule params array
 */
function getParams(query) {
	return [...new Set(query.split(" and ").map((q) => q.trim()))];
}

/**
 * get param value
 * @param {string} param - The queries
 * @returns {number[]} - querie values
 */
function getNumValues(param) {
	return param
		.split(" ")
		.map((v) => parseFloat(v.replace(/\D/g, "")))
		.filter((v) => !isNaN(v));
}

/**
 * string includes one or more of
 * @param {string} value - the value
 * @param {string[]} toCompare - to compare values
 * @returns {boolean} - result
 */
function includes(value, toCompare) {
	return toCompare.some((c) => value.includes(c));
}

/**
 * replace on string
 * @param {string} value - the value
 * @param {(string|number)[]} toReplace - to replace values
 * @param {(string|number)[]} toReplaceWith - to replace values
 * @returns {string} - result
 */
function replaceAllOf(value, toReplace, toReplaceWith = []) {
	toReplace.forEach((c, cIndex) => {
		value = value.replace(String(c), String(toReplaceWith[cIndex] || ""));
	});

	return value;
}

/**
 * Join params array
 * @param {string[]} paramsArr - AtRule params array
 * @param {string} name - AtRule name ("media"|"layer")
 * @returns {string} AtRule params
 */
function joinParams(paramsArr, name = "media") {
	let params = [...new Set(paramsArr.map((p) => getParams(p)).flat())].reduce(dedupe, []);

	/**
	 * Omit useless queries
	 * @param {string[]} acc - The array of queries
	 * @param {string} current - Current querie
	 * @returns {string[]} - Reduced array
	 *
	 * About intersection
	 * @see https://scicomp.stackexchange.com/a/26260
	 */
	function dedupe(acc, current) {
		const previous = acc[acc.length - 1];
		const min = [" > ", ">="];
		const max = [" < ", "<="];
		const minExtended = [...min, "min-"];
		const maxExtended = [...max, "max-"];
		const minMaxExtended = [...minExtended, ...maxExtended];

		// first
		if (!previous) return [current];
		else if (!includes(previous, minMaxExtended) || !includes(current, minMaxExtended)) {
			return [...acc, current];
		}

		const previousValues = getNumValues(previous);
		const currentValues = getNumValues(current);

		if (!previousValues.length || !currentValues.length) return [...acc, current];

		// compare min
		if (includes(previous, minExtended)) {
			// closed range, new syntax only, intersect
			if (previousValues.length === 2 && currentValues.length === 2) {
				if (previousValues[1] > currentValues[0] || currentValues[1] > previousValues[0]) {
					// empty intersection
					throw new Error("Min, empty intersection");
				}

				const newValues = [
					Math.max(previousValues[0], currentValues[0]),
					Math.min(previousValues[1], currentValues[1]),
				];
				const newPrevious = replaceAllOf(previous, previousValues, newValues);

				return [...acc.slice(0, -1), newPrevious];
			}

			if (includes(current, minExtended)) {
				// prefer previous if bigger
				if (previousValues[0] > currentValues[0]) return acc;
				else return [...acc.slice(0, -1), current];
			} else if (previousValues[0] >= currentValues[0]) {
				// min vs max, invalid comparison
				throw new Error("Min vs max, invalid range");
			}
		}
		// compare max
		else if (includes(previous, maxExtended)) {
			// closed range, new syntax only
			if (previousValues.length === 2 && currentValues.length === 2) {
				if (previousValues[0] > currentValues[1] || currentValues[0] > previousValues[1]) {
					// empty intersection
					throw new Error("Max, empty intersection");
				}

				const newValues = [
					Math.min(previousValues[0], currentValues[0]),
					Math.max(previousValues[1], currentValues[1]),
				];
				const newPrevious = replaceAllOf(previous, previousValues, newValues);

				return [...acc.slice(0, -1), newPrevious];
			}

			if (includes(current, maxExtended)) {
				// prefer previous if smaller
				if (previousValues[0] < currentValues[0]) return acc;
				else return [...acc.slice(0, -1), current];
			} else if (previousValues[0] <= currentValues[0]) {
				// max vs min, invalid comparison
				throw new Error("Max vs min, invalid range");
			}
		}

		return [...acc, current];
	}

	switch (name) {
		case "layer":
			return params.join(".");
		default:
			return params.join(" and ");
	}
}

/**
 * Sort AtRule params, to get better matches
 * @param {string} params - AtRule params
 * @returns {string[]} sorted AtRule params
 */
function sortParams(params) {
	/**
	 * Checks if a string contains a number.
	 * @param {string} param - The string to check.
	 * @returns {boolean} - has number
	 */
	function hasNumber(param) {
		return /\d/.test(param);
	}
	/**
	 * Sorts two strings based on whether they contain a number or not.
	 * @param {string} a - The first string to compare.
	 * @param {string} b - The second string to compare.
	 * @returns {number} - Sort value
	 */
	function sort(a, b) {
		if (hasNumber(a)) return 1;
		else if (hasNumber(b)) return -1;

		return 0;
	}

	return getParams(params).sort(sort);
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
		if (atRule.some((innerRule) => innerRule.type === "atrule")) {
			recursivelyFlattenAtRules(atRule, atRulePattern, helpers);
		}

		// cannot flatten if already on root
		if (localRoot.type === "root") return;

		// media rule nested in non media rule, invert
		if (atRule.name === "media" && atRule.name !== localRoot.name) {
			const newMedia = new helpers.AtRule({
				name: atRule.name,
				params: atRule.params,
			});

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
			} catch (err) {
				// invalid new query
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
	/** @type {{[key: string]: AtRule}} */
	const atRules = {};

	localRoot.walkAtRules(atRulePattern, (atRule) => {
		const atRuleIndex = localRoot.index(atRule);

		// AtRule exists
		if (atRuleIndex === -1 || !atRule.params || !atRule.nodes) return;

		try {
			const query = joinParams(sortParams(atRule.params));

			if (atRules[query] !== undefined) {
				atRules[query].append(atRule.nodes);
				recursivelyMergeAtRules(atRules[query], atRulePattern, helpers);
				atRule.remove();
			} else {
				atRules[query] = atRule.assign({ params: query });
			}
		} catch (err) {
			// invalid new query
			localRoot.warn(localRoot.root().toResult(), `[Merge]: Invalid "${atRule.params}"`, {
				node: atRule,
			});
			atRule.remove();
		}
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
	localRoot.walkAtRules(atRulePattern, (atRule) => {
		let atRuleIndex = localRoot.index(atRule);

		// AtRule exists
		if (atRuleIndex === -1 || !atRule.params || !atRule.nodes) return;

		try {
			let query = joinParams(sortParams(atRule.params));
			const queryParams = getParams(query);

			// rewrite
			if (queryParams.length > 1) {
				query = String(queryParams.shift());

				atRule.assign({
					params: query,
					nodes: [atRule.clone({ params: joinParams(queryParams) })],
				});
			}

			// nest siblings
			localRoot.walkAtRules(atRulePattern, (innerAtRule) => {
				const innerAtRuleIndex = localRoot.index(innerAtRule);

				try {
					const innerQuery = joinParams(sortParams(innerAtRule.params));

					if (
						innerAtRuleIndex === -1 ||
						!innerAtRule.params ||
						!innerAtRule.nodes ||
						atRuleIndex === innerAtRuleIndex ||
						!innerQuery.startsWith(query)
					) {
						return;
					}

					if (query === innerQuery) {
						atRule.append(innerAtRule.nodes);
					} else {
						const innerQueryParams = getParams(innerQuery).filter(
							(param) => param !== query
						);

						atRule.append(innerAtRule.clone({ params: joinParams(innerQueryParams) }));
					}
				} catch (error) {
					// invalid new query
					localRoot.warn(
						localRoot.root().toResult(),
						`[Nest]: Invalid sibling "${innerAtRule.params}" of "${atRule.params}"`,
						{ node: innerAtRule }
					);
				}

				innerAtRule.remove();
			});

			recursivelyNestAtRules(atRule, atRulePattern, helpers);

			// merge into single atRule
			if (
				atRule.nodes.length === 1 &&
				atRule.nodes[0].type === "atrule" &&
				atRule.nodes[0].name === "media"
			) {
				const singleAtRule = /** @type {AtRule}*/ (atRule.nodes[0]);

				atRule.assign({
					params: joinParams([query, singleAtRule.params]),
					nodes: singleAtRule.nodes,
				});
			}
		} catch (error) {
			// invalid new query
			localRoot.warn(
				localRoot.root().toResult(),
				`[Nest]: Can't nest siblings to invalid "${atRule.params}"`,
				{ node: atRule }
			);
			atRule.remove();
		}
	});
}

/**
 * Plugin constructor
 * @param {pluginOptions} options - plugin options
 * @returns {Plugin} - plugin object
 */
module.exports = (options = {}) => {
	const { atRulePattern, flatten, merge, nest } = Object.assign(
		{
			atRulePattern: /(media|layer|supports)/im,
			merge: true,
			flatten: true,
		},
		options
	);

	return {
		postcssPlugin: "postcss-merge-at-rules",
		OnceExit(root, helpers) {
			if (!atRulePattern) throw new Error("A valid matching atRule pattern is required");

			if (flatten) recursivelyFlattenAtRules(root, atRulePattern, helpers);
			if (merge) recursivelyMergeAtRules(root, atRulePattern, helpers);
			if (nest) recursivelyNestAtRules(root, atRulePattern, helpers);
		},
	};
};

module.exports.postcss = true;
