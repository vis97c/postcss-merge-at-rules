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
 * Join params array
 * @param {string[]} paramsArr - AtRule params array
 * @returns {string} AtRule params
 */
function joinParams(paramsArr) {
	const params = [...new Set(paramsArr.map((p) => getParams(p)).flat())];

	return params.join(" and ");
}

/**
 * Sort AtRule params, to get better matches
 * @param {string} params - AtRule params
 * @returns {string[]} sorted AtRule params
 */
function sortParams(params) {
	const hasNumber = (param) => /\d/.test(param);
	const sort = (a, b) => {
		if (hasNumber(a)) return 1;
		else if (hasNumber(b)) return -1;

		return 0;
	};

	return getParams(params).sort(sort);
}

/**
 * Recursively flatten atRules
 * @template {AtRule|Root} T
 * @param {Root} root - Root instance
 * @param {T} localRoot - Root or atRule instance
 * @param {string|RegExp} atRulePattern - atRuleMathing string or regex pattern
 * @param {Helpers} helpers - postcss helpers
 */
function recursivelyFlattenAtRules(root, localRoot, atRulePattern, helpers) {
	localRoot.walkAtRules(atRulePattern, (atRule) => {
		const atRuleIndex = localRoot.index(atRule);

		// AtRule exists
		if (atRuleIndex === -1 || !atRule.params || !atRule.nodes) return;

		// flatten inner rules first
		if (atRule.some((innerRule) => innerRule.type === "atrule")) {
			recursivelyFlattenAtRules(root, atRule, atRulePattern, helpers);
		}

		// cannot flatten if already on root
		if (localRoot.type === "root") return;

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
			if (atRule.name !== localRoot.name || atRule.name === "layer") return;

			let query = joinParams(sortParams(joinParams([localRoot.params, atRule.params])));

			if (localRoot.parent) {
				localRoot.parent.append(
					new helpers.AtRule({
						name: atRule.name,
						params: query,
						nodes: atRule.nodes,
					})
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
 */
function recursivelyMergeAtRules(localRoot, atRulePattern) {
	/** @type {{[key: string]: AtRule}} */
	const atRules = {};

	localRoot.walkAtRules(atRulePattern, (atRule) => {
		const atRuleIndex = localRoot.index(atRule);

		// AtRule exists
		if (atRuleIndex === -1 || !atRule.params || !atRule.nodes) return;

		const query = joinParams(sortParams(atRule.params));

		if (atRules[query] !== undefined) {
			atRules[query].append(atRule.nodes);
			recursivelyMergeAtRules(atRules[query], atRulePattern);
			atRule.remove();
		} else {
			atRules[query] = atRule.assign({ params: query });
		}
	});
}

/**
 * Recursively nest atRules
 * @template {AtRule|Root} T
 * @param {T} localRoot - Root or atRule instance
 * @param {string|RegExp} atRulePattern - atRuleMathing string or regex pattern
 */
function recursivelyNestAtRules(localRoot, atRulePattern) {
	localRoot.walkAtRules(atRulePattern, (atRule) => {
		let atRuleIndex = localRoot.index(atRule);

		// AtRule exists
		if (atRuleIndex === -1 || !atRule.params || !atRule.nodes) return;

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
				const innerQueryParams = getParams(innerQuery).filter((param) => param !== query);

				atRule.append(innerAtRule.clone({ params: joinParams(innerQueryParams) }));
			}

			innerAtRule.remove();
		});

		recursivelyNestAtRules(atRule, atRulePattern);

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

			if (flatten) recursivelyFlattenAtRules(root, root, atRulePattern, helpers);
			if (merge) recursivelyMergeAtRules(root, atRulePattern);
			if (nest) recursivelyNestAtRules(root, atRulePattern);
		},
	};
};

module.exports.postcss = true;
