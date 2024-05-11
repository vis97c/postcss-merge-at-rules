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
	test("Do nothing, { flatten: false, merge: false }", async () => {
		await run("default.in.css", { flatten: false, merge: false });
	});

	test("Merge & flatten, {}, Default behavior", async () => {
		await run("default.out.css");
	});

	test("Flatten only, { merge: false }", async () => {
		await run("flatten.out.css", { merge: false });
	});

	test("Merge only, { flatten: false }", async () => {
		await run("merge.out.css", { flatten: false });
	});

	test("Merge layers only, { atRulePattern: 'layer', flatten: false }", async () => {
		await run("merge_layers.out.css", { atRulePattern: "layer", flatten: false });
	});

	test("Nest only, { flatten: false, merge: false, nest: true }", async () => {
		await run("nest.out.css", { flatten: false, merge: false, nest: true });
	});

	test("Merge and nest, { flatten: false, nest: true }", async () => {
		await run("merge_nest.out.css", { flatten: false, nest: true });
	});

	test("Merge and nest layers only, { atRulePattern: 'layer', flatten: false, nest: true }", async () => {
		await run("merge_nest_layers.out.css", {
			atRulePattern: "layer",
			flatten: false,
			nest: true,
		});
	});

	test("Flatten, merge and nest, { nest: true }", async () => {
		await run("flatten_merge_nest.out.css", { nest: true });
	});

	test("Flatten, merge and nest layers only, { atRulePattern: 'layer', nest: true }", async () => {
		await run("merge_nest_layers.out.css", {
			atRulePattern: "layer",
			nest: true,
		});
	});
});
