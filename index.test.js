// @ts-check

/**
 * @typedef {import('./index').pluginOptions} pluginOptions
 */

let fs = require("fs");
let postcss = require("postcss");
let plugin = require("./index");

/**
 * Run postcss processing¿
 * @param {string} outputFileName - CSS output file name
 * @param {pluginOptions} options - plugin options
 */
async function run(outputFileName, options = {}) {
	const input = fs.readFileSync("./test/default.in.css", "utf8");
	const output = fs.readFileSync(`./test/${outputFileName}`, "utf8");
	const result = await postcss([plugin(options)]).process(input, { from: undefined });

	expect(result.css).toEqual(output);
	expect(result.warnings()).toHaveLength(0);
}

describe("Throw error if options are no correct", () => {
	test("No valid regex pattern or string is provided, { atRulePattern: undefined }", async () => {
		await expect(run("default.in.css", { atRulePattern: undefined })).rejects.toThrow(
			"A valid matching atRule pattern is required"
		);
	});
});

describe("Check merge strategies", () => {
	test("Do nothing, { merge: false }", async () => {
		await run("default.in.css", { merge: false });
	});

	test("Merge only, {}, Default behavior", async () => {
		await run("merge.out.css");
	});

	test("Merge layers only, { atRulePattern: 'layer' }", async () => {
		await run("merge_layers.out.css", { atRulePattern: "layer" });
	});

	test("Nest only, { merge: false, nest: true }", async () => {
		await run("nest.out.css", { merge: false, nest: true });
	});

	test("Nest layers only, { atRulePattern: 'layer', merge: false, nest: true }", async () => {
		await run("nest_layers.out.css", { atRulePattern: "layer", merge: false, nest: true });
	});

	test("Merge and nest, { nest: true }", async () => {
		await run("merge_nest.out.css", { nest: true });
	});

	test("Merge and nest layers only, { atRulePattern: 'layer', nest: true }", async () => {
		await run("merge_nest_layers.out.css", { atRulePattern: "layer", nest: true });
	});
});
