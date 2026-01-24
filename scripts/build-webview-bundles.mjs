import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync, writeFileSync } from 'node:fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const entry = path.join(repoRoot, 'webviewBundles/markdownEditorBundle/index.ts');
const outDir = path.join(repoRoot, 'webviewBundles/generated');
const outFile = path.join(outDir, 'markdownEditorBundle.generated.ts');

const banner = `/* eslint-disable */
// AUTO-GENERATED FILE.
// Run: node scripts/build-webview-bundles.mjs
// Do not edit by hand.
`;

async function buildOnce() {
	let esbuild;
	try {
		esbuild = await import('esbuild');
	} catch (e) {
		console.error('Missing dev dependency: esbuild');
		console.error('Install with: bun add -d esbuild  (or npm i -D esbuild)');
		process.exit(1);
	}

	const result = await esbuild.build({
		entryPoints: [entry],
		bundle: true,
		write: false,
		platform: 'browser',
		format: 'iife',
		target: ['es2019'],
		minify: true,
		sourcemap: false,
		logLevel: 'info',
	});

	// When write:false and no outfile/outdir is provided, esbuild uses "<stdout>" as the output path.
	const js = result.outputFiles[0]?.text;
	if (!js) throw new Error('esbuild did not produce JS output');

	mkdirSync(outDir, { recursive: true });
	writeFileSync(
		outFile,
		`${banner}
export const markdownEditorBundleJs = ${JSON.stringify(js)} as const;
`,
		'utf8',
	);

	console.log(`Wrote ${path.relative(repoRoot, outFile)}`);
}

await buildOnce();

