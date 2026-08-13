// Verifies the package exactly as consumers load it from dist.
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const packageDirectory = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const distDirectory = join(packageDirectory, "dist");
const packageJson = JSON.parse(readFileSync(join(packageDirectory, "package.json"), "utf8"));

assert.equal(packageJson.private, undefined, "the published package must not be private");
assert.equal(packageJson.type, "module", "the package must remain ESM");
assert.equal(
	typeof packageJson.dependencies?.["@markdoc/markdoc"],
	"string",
	"@markdoc/markdoc must remain an installed production dependency",
);
assert.equal(
	packageJson.peerDependencies?.["@markdoc/markdoc"],
	undefined,
	"@markdoc/markdoc must not require a separate peer installation",
);
assert.equal(
	packageJson.peerDependenciesMeta?.react?.optional,
	true,
	"React must remain an optional peer for the headless entry points",
);
assert.deepEqual(
	packageJson.files,
	["dist", "README.md", "LICENSE"],
	"the package file allowlist changed unexpectedly",
);

const publicJavaScriptEntries = [];
for (const [subpath, declaration] of Object.entries(packageJson.exports)) {
	if (typeof declaration === "string") {
		assert(existsSync(join(packageDirectory, declaration)), `missing export ${subpath}: ${declaration}`);
		continue;
	}
	for (const field of ["types", "import"]) {
		const target = declaration[field];
		assert.equal(typeof target, "string", `export ${subpath} is missing its ${field} target`);
		assert(existsSync(join(packageDirectory, target)), `missing export ${subpath}: ${target}`);
	}
	publicJavaScriptEntries.push(join(packageDirectory, declaration.import));
}

const distJavaScriptFiles = readdirSync(distDirectory)
	.filter((name) => name.endsWith(".js"))
	.map((name) => join(distDirectory, name));
for (const file of distJavaScriptFiles) {
	const source = readFileSync(file, "utf8");
	assert(!source.includes("@repo/"), `${file} leaks a workspace-only import`);
}

const collectDeclarations = (directory) =>
	readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
		const path = join(directory, entry.name);
		return entry.isDirectory() ? collectDeclarations(path) : path.endsWith(".d.ts") ? [path] : [];
	});
for (const declaration of collectDeclarations(distDirectory)) {
	const source = readFileSync(declaration, "utf8");
	assert(
		!/["']\.\.?\/[^"']*(?<!\.js)["']/.test(source),
		`${declaration} contains a relative ESM specifier without a .js extension`,
	);
}

const reactEntry = readFileSync(join(distDirectory, "react.js"), "utf8");
assert(reactEntry.startsWith('"use client";'), "the React entry must preserve its client directive");

const collectReachableImports = (entry) => {
	const visited = new Set();
	const visit = (file) => {
		if (visited.has(file)) return;
		visited.add(file);
		const source = readFileSync(file, "utf8");
		const importPattern = /(?:from|import)\s*["']([^"']+)["']/g;
		for (const match of source.matchAll(importPattern)) {
			const specifier = match[1];
			assert(
				specifier !== "react" && !specifier.startsWith("react/"),
				`headless entry unexpectedly reaches React through ${file}`,
			);
			if (specifier.startsWith(".")) visit(resolve(dirname(file), specifier));
		}
	};
	visit(entry);
	return visited;
};
collectReachableImports(join(distDirectory, "index.js"));

for (const entry of publicJavaScriptEntries) {
	await import(pathToFileURL(entry).href);
}

const core = await import(pathToFileURL(join(distDirectory, "index.js")).href);
assert.deepEqual(core.validateMarkdocTemplate('{% info "name" /%}'), []);
assert.equal(core.parseCitationSource("https://example.test/reference").kind, "external");

const reactApi = await import(pathToFileURL(join(distDirectory, "react.js")).href);
const html = renderToStaticMarkup(
	React.createElement(reactApi.DynamicMarkdocRenderer, {
		markdocContent: '{% info "name" /%}',
		variables: { name: "Packed API" },
	}),
);
assert(html.includes("Packed API"), "the built React renderer failed its Node SSR smoke test");

console.log(`Verified ${publicJavaScriptEntries.length} public entries and ${distJavaScriptFiles.length} JavaScript artifacts.`);
