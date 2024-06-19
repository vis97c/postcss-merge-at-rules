const gulp = require("gulp");
const rename = require("gulp-rename");
const postcss = require("gulp-postcss");
const plugin = require("./index.js");

const tasks = [];

/**
 * A function to create a Gulp task that processes CSS files using the plugin.
 * @param {string} name - The name of the task.
 * @param {object} options - The options to pass to the plugin.
 * @returns {Function} A Gulp task function.
 */
function makeTask(name, options = {}) {
	const taskName = `${name}_out`;

	tasks.push(taskName);

	return [
		taskName,
		function () {
			// Use Gulp to read the input CSS file
			return (
				gulp
					.src("test/default.in.css")
					// Use PostCSS to process the CSS file with the plugin
					.pipe(postcss([plugin(options)]))
					// Rename the output CSS file
					.pipe(rename(`${name}.out.css`))
					// Write the output CSS file to the test directory
					.pipe(gulp.dest("test"))
			);
		},
	];
}

gulp.task(...makeTask("default"));
gulp.task(...makeTask("flatten", { merge: false }));
gulp.task(...makeTask("merge", { flatten: false }));

gulp.task(...makeTask("merge_layers", { atRulePattern: "layer", flatten: false }));
gulp.task(...makeTask("nest", { flatten: false, merge: false, nest: true }));
gulp.task(...makeTask("merge_nest", { flatten: false, nest: true }));
gulp.task(
	...makeTask("merge_nest_layers", {
		atRulePattern: "layer",
		flatten: false,
		nest: true,
	})
);
gulp.task(...makeTask("flatten_merge_nest", { nest: true }));
gulp.task(...makeTask("merge_nest_layers", { atRulePattern: "layer", nest: true }));

// makeTask parallel tasks
gulp.task("default", gulp.parallel(...tasks));
