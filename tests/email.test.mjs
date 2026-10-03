import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire, Module } from 'node:module';
import ts from 'typescript';
import { emailFixtures } from './email-fixtures.mjs';
import { pdfText } from './pdf-text.mjs';

const require = createRequire(import.meta.url);
const original = Module._resolveFilename;
Module._resolveFilename = function (request, parent, ...rest) { return original.call(this, request.startsWith('@/') ? path.resolve('src', request.slice(2)) : request, parent, ...rest); };
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText, filename);
require.extensions['.tsx'] = require.extensions['.ts'];
const { emptyProfile } = require('../src/lib/schema.ts');
const { demoProfiles } = require('../src/lib/demo.ts');
const { applyStep } = require('../src/lib/interview.ts');
const { renderCvPdf } = require('../src/lib/pdf/render.tsx');
const { safePdfUrl } = require('../src/lib/pdf/CvPdfDocument.tsx');
const { emailConfig, emailRequestSchema, createEmailHandler, EmailThrottle, safeCvFilename, sendWithBrevo } = require('../src/lib/email-cv.ts');
const fixtures = emailFixtures(emptyProfile, demoProfiles, applyStep);
const config = { enabled: true, key: 'test-secret', from: 'sender@example.com', fromName: 'CV Corner' };
const pdf = Buffer.from('%PDF-test-fixture');
const request = (body = { profile: fixtures.technical }, extra = {}) => new Request('https://example.com/api/email-cv', { method: 'POST', headers: { 'content-type': 'application/json', ...extra }, body: typeof body === 'string' ? body : JSON.stringify(body) });
const handler = (overrides = {}) => createEmailHandler({ config: () => config, render: async () => pdf, send: async () => {}, ...overrides });

for (const [name, profile] of Object.entries(fixtures)) test(`text PDF generation: ${name}`, async () => {
  const buffer = await renderCvPdf(profile);
  assert.equal(buffer.subarray(0, 5).toString(), '%PDF-');
  assert.ok(buffer.length > 1000);
  assert.ok(buffer.length < 2_000_000);
  assert.match(buffer.toString('latin1'), /MediaBox \[0 0 595\.28\d* 841\.89\d*\]/);
  const text = pdfText(buffer).replace(/\s+/g, '');
  assert.ok(text.includes(profile.personal.email.replace(/\s+/g, '')));
  assert.doesNotMatch(text, /Print\/SavePDF|EmailMyCV|AICVCopilot|CVReadinessCheck/);
  if (name === 'contribution') assert.ok(text.includes('Designedthesurveyandanalyzed40responses'));
  if (name === 'sparse') assert.doesNotMatch(text, /Education|Projects|Experience|Skills|Languages/);
  if (name === 'urls') assert.ok(text.includes(profile.projects[0].link.replace(/^https?:\/\//, '')));
});
test('invalid profile cannot reach PDF generation', async () => { await assert.rejects(renderCvPdf({ personal: { fullName: 42 } })); });
test('filename and URL safety handle Unicode, reserved names and unsafe schemes', () => {
  assert.equal(safeCvFilename('../../CON'), 'My_CV.pdf');
  assert.equal(safeCvFilename(' Osaid / Smith:* '), 'Osaid_Smith_CV.pdf');
  assert.equal(safeCvFilename(''), 'My_CV.pdf');
  assert.match(safeCvFilename('محمد Zoë'), /^محمد_Zoë_CV.pdf$/);
  assert.equal(safePdfUrl('javascript:alert(1)'), null);
  assert.equal(safePdfUrl('file:///etc/passwd'), null);
  assert.equal(safePdfUrl('https://example.com/test'), 'https://example.com/test');
});
test('only a valid profile email is accepted; arbitrary recipient and mail fields reject', () => {
  for (const key of ['recipient', 'to', 'cc', 'bcc', 'subject', 'html', 'attachment', 'sender']) assert.equal(emailRequestSchema.safeParse({ profile: fixtures.technical, [key]: 'arbitrary' }).success, false);
  const invalid = structuredClone(fixtures.technical); invalid.personal.email = 'not-an-email';
  assert.equal(emailRequestSchema.safeParse({ profile: invalid }).success, false);
  invalid.personal.email = 'a'.repeat(241) + '@example.com';
  assert.equal(emailRequestSchema.safeParse({ profile: invalid }).success, false);
});
test('toggle, missing key and missing sender do not render or send', async () => {
  for (const changed of [{ enabled: false }, { key: '' }, { from: '' }]) {
    let called = false;
    const response = await handler({ config: () => ({ ...config, ...changed }), render: async () => { called = true; return pdf; } })(request());
    assert.equal(response.status, 503); assert.equal(called, false);
  }
  assert.equal(emailConfig({}).enabled, false);
  assert.equal(emailConfig({ CV_EMAIL_SEND_ENABLED: 'false' }).enabled, false);
});
test('malformed, oversized, unknown recipient and cross-origin requests fail before sending', async () => {
  for (const value of ['{', { profile: {} }, { profile: fixtures.technical, recipient: 'other@example.com' }, 'x'.repeat(262_145)]) assert.equal((await handler()(request(value))).status, 400);
  assert.equal((await handler()(request(undefined, { origin: 'https://other.example.com' }))).status, 403);
});
test('success sends exactly one generated PDF to the profile email', async () => {
  let calls = 0;
  const response = await handler({ send: async (profile, attachment) => { calls++; assert.equal(profile.personal.email, fixtures.technical.personal.email); assert.deepEqual(attachment, pdf); } })(request());
  assert.equal(response.status, 200); assert.equal(calls, 1); assert.deepEqual(await response.json(), { sent: true });
  assert.equal(response.headers.get('cache-control'), 'no-store');
});
test('PDF and provider failures produce safe messages and never retry', async () => {
  for (const stage of ['render', 'send']) {
    let calls = 0;
    const response = await handler({ [stage]: async () => { calls++; throw new Error('test-secret PRIVATE PROFILE'); } })(request());
    assert.equal(response.status, 503); assert.equal(calls, 1); assert.doesNotMatch(await response.text(), /test-secret|PRIVATE PROFILE|BREVO/);
  }
  assert.equal((await handler({ render: async () => Buffer.from('not PDF') })(request())).status, 503);
});
test('timeout bounds PDF generation and cannot send a late result', async () => {
  let sends = 0;
  const response = await handler({ timeoutMs: 5, render: () => new Promise(resolve => setTimeout(() => resolve(pdf), 30)), send: async () => { sends++; } })(request());
  assert.equal(response.status, 503); await new Promise(resolve => setTimeout(resolve, 40)); assert.equal(sends, 0);
});
test('slow input and provider timeout are bounded without retry', async () => {
  const stalled = new Request('https://example.com/api/email-cv', { method: 'POST', headers: { 'content-type': 'application/json' }, body: new ReadableStream({}), duplex: 'half' });
  assert.equal((await handler({ timeoutMs: 5 })(stalled)).status, 400);
  let sends = 0;
  assert.equal((await handler({ timeoutMs: 5, send: async () => { sends++; await new Promise(resolve => setTimeout(resolve, 30)); } })(request())).status, 503);
  assert.equal(sends, 1);
});
test('best effort throttle blocks duplicate recipient and bursts, then expires', async () => {
  const limited = handler(); assert.equal((await limited(request())).status, 200); assert.equal((await limited(request())).status, 429);
  const throttle = new EmailThrottle();
  for (let index = 0; index < 5; index++) assert.equal(throttle.take(`student${index}@example.com`, 'local', 0), true);
  assert.equal(throttle.take('sixth@example.com', 'local', 0), false);
  assert.equal(throttle.take('student0@example.com', 'other', 61_000), true);
});
test('Brevo payload is fixed, attachment is base64 PDF, errors never leak response bodies', async () => {
  let payload;
  await sendWithBrevo(fixtures.technical, pdf, config, new AbortController().signal, async (url, options) => { assert.equal(url, 'https://api.brevo.com/v3/smtp/email'); payload = JSON.parse(options.body); return new Response('{"messageId":"synthetic"}', { status: 201 }); });
  assert.equal(payload.to.length, 1); assert.equal(payload.to[0].email, fixtures.technical.personal.email);
  assert.equal(payload.subject, 'Your CV from AI CV Copilot'); assert.equal(payload.sender.email, config.from);
  assert.deepEqual(Buffer.from(payload.attachment[0].content, 'base64'), pdf); assert.match(payload.attachment[0].name, /_CV.pdf$/);
  assert.equal(payload.cc, undefined); assert.equal(payload.htmlContent, undefined); assert.doesNotMatch(payload.textContent, /Research Paper Assistant|test-secret/);
  for (const status of [400, 429, 500]) await assert.rejects(sendWithBrevo(fixtures.technical, pdf, config, new AbortController().signal, async () => new Response('secret provider body', { status })), /^Error: Delivery unavailable$/);
});
