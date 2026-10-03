// Synthetic developer QA only. Production rendering never writes PDFs to disk.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire, Module } from 'node:module';
import ts from 'typescript';
import { emailFixtures } from '../tests/email-fixtures.mjs';
const require = createRequire(import.meta.url);
const original = Module._resolveFilename;
Module._resolveFilename = function (request, parent, ...rest) { return original.call(this, request.startsWith('@/') ? path.resolve('src', request.slice(2)) : request, parent, ...rest); };
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText, filename);
require.extensions['.tsx'] = require.extensions['.ts'];
const { emptyProfile } = require('../src/lib/schema.ts');
const { demoProfiles } = require('../src/lib/demo.ts');
const { applyStep } = require('../src/lib/interview.ts');
const { renderCvPdf } = require('../src/lib/pdf/render.tsx');
const { CvDocument } = require('../src/components/CvDocument.tsx');
const { renderToStaticMarkup } = require('react-dom/server');
const React = require('react');
const output = path.resolve('experiments/email-cv-delivery/qa'); fs.mkdirSync(output, { recursive: true });
for (const [name, profile] of Object.entries(emailFixtures(emptyProfile, demoProfiles, applyStep))) {
  fs.writeFileSync(path.join(output, `${name}.pdf`), await renderCvPdf(profile));
  fs.writeFileSync(path.join(output, `${name}.html`), renderToStaticMarkup(React.createElement(CvDocument, { profile })));
  console.log(`Generated synthetic ${name} PDF and browser markup`);
}
