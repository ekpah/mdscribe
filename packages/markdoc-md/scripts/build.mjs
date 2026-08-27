import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageDirectory = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const distDirectory = join(packageDirectory, "dist");

const runBun = (arguments_) => {
	const result = spawnSync(process.execPath, arguments_, {
		cwd: packageDirectory,
		stdio: "inherit",
	});
	if (result.error) throw result.error;
	if (result.status !== 0) process.exit(result.status ?? 1);
};

const collectDeclarations = (directory) =>
	readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
		const path = join(directory, entry.name);
		return entry.isDirectory() ? collectDeclarations(path) : path.endsWith(".d.ts") ? [path] : [];
	});

const normalizeDeclarationImports = () => {
	const declarations = collectDeclarations(distDirectory);
	for (const declaration of declarations) {
		const source = readFileSync(declaration, "utf8");
		const normalized = source.replace(/(["'])(\.\.?\/[^"']+)\1/g, (match, quote, specifier) => {
			if (extname(specifier)) return match;

			const directTarget = resolve(dirname(declaration), `${specifier}.d.ts`);
			if (existsSync(directTarget)) return `${quote}${specifier}.js${quote}`;

			const indexTarget = resolve(dirname(declaration), specifier, "index.d.ts");
			if (existsSync(indexTarget)) return `${quote}${specifier}/index.js${quote}`;

			assert.fail(`declaration ${declaration} references missing module ${specifier}`);
		});
		writeFileSync(declaration, normalized);
	}
	console.log(`Normalized ESM specifiers in ${declarations.length} declaration files.`);
};

rmSync(distDirectory, { force: true, recursive: true });

runBun(["x", "tsc", "-p", "tsconfig.build.json"]);
normalizeDeclarationImports();

const sharedBuildArguments = [
	"build",
	"--outdir",
	"dist",
	"--target",
	"browser",
	"--format",
	"esm",
	"--production",
	"--sourcemap=external",
	"--external",
	"@markdoc/markdoc",
	"--external",
	"fparser",
];

runBun([
	...sharedBuildArguments,
	"--splitting",
	"--external",
	"fhirpath",
	"--external",
	"fhirpath/*",
	"index.ts",
	"citations.ts",
	"config.ts",
	"editor.ts",
	"parse.ts",
	"sources.ts",
]);

runBun([
	...sharedBuildArguments,
	"--external",
	"react",
	"--external",
	"react/jsx-runtime",
	"--external",
	"react/jsx-dev-runtime",
	"--banner",
	'"use client";',
	"react.ts",
]);

runBun(["__tests__/verify-dist.mjs"]);
// Type-check the public surface via a dedicated tsconfig. Passing files on the
// command line errors under TypeScript 7 (TS5112) because tsconfig.json is present.
runBun(["x", "tsc", "-p", "__tests__/tsconfig.json"]);
