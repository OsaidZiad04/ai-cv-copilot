import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const root = path.resolve("src");
const files = [];
function visit(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const location = path.join(directory, entry.name);
    if (entry.isDirectory()) visit(location);
    else if (/\.tsx?$/.test(entry.name)) files.push(location);
  }
}
visit(root);
let issues = 0;
for (const file of files) {
  const source = fs.readFileSync(file, "utf8");
  const parsed = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const report = (node, message) => { const { line } = parsed.getLineAndCharacterOfPosition(node.pos); process.stderr.write(`${path.relative(process.cwd(), file)}:${line + 1}: ${message}\n`); issues++; };
  for (const diagnostic of parsed.parseDiagnostics) { report({ pos: diagnostic.start || 0 }, ts.flattenDiagnosticMessageText(diagnostic.messageText, " ")); }
  function inspect(node) {
    if (node.kind === ts.SyntaxKind.DebuggerStatement) report(node, "Remove debugger statement");
    if (node.kind === ts.SyntaxKind.AnyKeyword) report(node, "Avoid explicit any");
    if (ts.isIdentifier(node) && ["dangerouslySetInnerHTML", "eval"].includes(node.text)) report(node, `Avoid ${node.text}`);
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.expression.expression.getText(parsed) === "console" && node.expression.name.text === "log") report(node, "Remove console.log");
    ts.forEachChild(node, inspect);
  }
  inspect(parsed);
  if (/NEXT_PUBLIC_(?:GROQ|API_KEY|SECRET)/.test(source)) report({ pos: 0 }, "Do not expose secrets to the client");
  if (/\/\/\s*@ts-ignore/.test(source)) report({ pos: 0 }, "Avoid @ts-ignore");
}
if (issues) process.exit(1);
process.stdout.write(`Lint passed: ${files.length} source files checked.\n`);
