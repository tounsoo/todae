import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { BrowserResults } from './browser-results-reporter.ts';
import ts from 'typescript';
import { annotations, firefoxBranches, type FirefoxBranch, firefoxQuarantine, judge, summary, type QuarantineEntry } from './firefox-quarantine.ts';

const listed: QuarantineEntry = { file: 'src/browser/a.browser.test.tsx', test: 'A > flakes', issue: 'https://github.com/tounsoo/todae/issues/367', reason: 'Known.' };
const other = { file: 'src/browser/a.browser.test.tsx', name: 'A > works' };

function run(tests: BrowserResults['tests'], extra: Partial<BrowserResults> = {}): BrowserResults {
  return { reason: tests.some((test) => test.state === 'failed') ? 'failed' : 'passed', unhandledErrors: [], outside: [], tests, ...extra };
}

describe('the Firefox quarantine gate', () => {
  it('lets a run pass when only a quarantined test failed, and warns about it', () => {
    const verdict = judge(
      run([
        { ...other, state: 'passed', errors: [] },
        { file: listed.file, name: listed.test, state: 'failed', errors: ['AssertionError: expected 62 to be +0\n    at stack'] },
      ]),
      [listed],
      1,
    );
    expect(verdict.blocking).toEqual([]);
    expect(verdict.quarantinedFailures).toEqual([{ entry: listed, errors: ['AssertionError: expected 62 to be +0\n    at stack'] }]);
    expect(annotations(verdict)).toEqual([
      '::warning title=Quarantined Firefox test failed (https://github.com/tounsoo/todae/issues/367)::src/browser/a.browser.test.tsx > A > flakes: AssertionError: expected 62 to be +0',
    ]);
  });

  it('fails the run when a test outside the quarantine fails', () => {
    const verdict = judge(
      run([
        { ...other, state: 'failed', errors: ['Error: boom'] },
        { file: listed.file, name: listed.test, state: 'failed', errors: ['Error: known'] },
      ]),
      [listed],
      1,
    );
    expect(verdict.blocking).toEqual(['src/browser/a.browser.test.tsx > A > works failed: Error: boom']);
  });

  it('matches a quarantined test by its file as well as its name', () => {
    const verdict = judge(
      run([
        { file: 'src/browser/b.browser.test.tsx', name: listed.test, state: 'failed', errors: ['Error: same name'] },
        { file: listed.file, name: listed.test, state: 'passed', errors: [] },
      ]),
      [listed],
      1,
    );
    expect(verdict.blocking).toEqual(['src/browser/b.browser.test.tsx > A > flakes failed: Error: same name']);
  });

  it('flags a quarantined test that passed so it can come off the list', () => {
    const verdict = judge(run([{ file: listed.file, name: listed.test, state: 'passed', errors: [] }]), [listed], 0);
    expect(verdict.blocking).toEqual([]);
    expect(verdict.quarantinedPasses).toEqual([listed]);
    expect(annotations(verdict)[0]).toMatch(/^::notice title=Quarantined Firefox test passed::.*take it off the quarantine\.$/);
    expect(summary(verdict)).toContain('| src/browser/a.browser.test.tsx > A > flakes | Passed; take it off the list if it keeps passing |');
  });

  it('fails the run when a quarantined test is skipped or never finishes, since then nothing shows its failure', () => {
    for (const [state, said] of [['skipped', 'skipped'], ['pending', 'never finished']] as const) {
      const verdict = judge(run([{ file: listed.file, name: listed.test, state, errors: [] }]), [listed], 0);
      expect(verdict.blocking).toEqual([
        `The quarantine lists src/browser/a.browser.test.tsx > A > flakes, which this run ${said}. A quarantined test must run; stop skipping it or take it off the list.`,
      ]);
    }
  });

  it('fails the run when an entry names no test, so a renamed test cannot hide behind a stale entry', () => {
    const verdict = judge(run([{ ...other, state: 'passed', errors: [] }]), [listed], 0);
    expect(verdict.blocking).toEqual([
      'The quarantine lists src/browser/a.browser.test.tsx > A > flakes, which this run has no test for. Fix its name or take it off the list.',
    ]);
  });

  it('fails the run on errors outside any test, even with only quarantined failures', () => {
    const results = run([{ file: listed.file, name: listed.test, state: 'failed', errors: ['Error: known'] }], {
      unhandledErrors: ['TypeError: late\n    at x'],
      outside: [
        { file: 'src/browser/c.browser.test.tsx', suite: '', errors: ['SyntaxError: bad import'] },
        { file: listed.file, suite: 'A', errors: ['Error: afterAll broke'] },
      ],
    });
    expect(judge(results, [listed], 1).blocking).toEqual([
      'src/browser/c.browser.test.tsx failed outside its tests: SyntaxError: bad import',
      'src/browser/a.browser.test.tsx > A failed outside its tests: Error: afterAll broke',
      'Unhandled error: TypeError: late',
    ]);
  });

  it('fails an interrupted run, an empty run, and a failing exit the results do not explain', () => {
    expect(judge(run([{ ...other, state: 'passed', errors: [] }], { reason: 'interrupted' }), [], 1).blocking).toEqual([
      'The run was interrupted before every test finished.',
    ]);
    expect(judge(run([]), [], 0).blocking).toEqual(['The run reported no tests.']);
    expect(judge(run([{ ...other, state: 'passed', errors: [] }]), [], 1).blocking).toEqual(["Vitest exited with 1, which its results don't explain."]);
    const quarantinedFailure = run([{ file: listed.file, name: listed.test, state: 'failed', errors: ['Error: known'] }]);
    expect(judge(quarantinedFailure, [listed], 1).blocking).toEqual([]);
    expect(judge(quarantinedFailure, [listed], 130).blocking).toEqual(["Vitest exited with 130, which its results don't explain."]);
  });

  it('fails a list that names one test twice', () => {
    const verdict = judge(run([{ file: listed.file, name: listed.test, state: 'passed', errors: [] }]), [listed, listed], 0);
    expect(verdict.blocking).toEqual(['The quarantine lists src/browser/a.browser.test.tsx > A > flakes twice.']);
  });

  it('escapes annotation text so a multi-line message stays one annotation', () => {
    const entry = { ...listed, test: 'A > 100% done' };
    const verdict = judge(run([{ file: entry.file, name: entry.test, state: 'failed', errors: ['Error: x'] }]), [entry], 1);
    expect(annotations(verdict)[0]).toContain('A > 100%25 done');
  });
});

describe('the Firefox quarantine list', () => {
  it('points every entry at a browser test file and an issue, with a reason', () => {
    for (const entry of firefoxQuarantine) {
      expect(entry.file).toMatch(/^src\/browser\/[\w-]+\.browser\.test\.tsx$/);
      expect(entry.test).toContain(' > ');
      expect(entry.issue).toMatch(/^https:\/\/github\.com\/tounsoo\/todae\/issues\/\d+$/);
      expect(entry.reason.trim()).not.toBe('');
    }
  });
});

const kindOf = (file: string) => (file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);

/** The file's code with its comments blanked out, keeping every character's place. */
function withoutComments(file: string, source: string) {
  // TypeScript's parser tells a comment from a string, a regex, a template or JSX text.
  const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, false, kindOf(file));
  const comments: ts.CommentRange[] = [];
  const text: ts.Node[] = [];
  const visit = (node: ts.Node) => {
    if (node.kind === ts.SyntaxKind.JsxText) text.push(node);
    comments.push(...(ts.getLeadingCommentRanges(source, node.pos) ?? []), ...(ts.getTrailingCommentRanges(source, node.end) ?? []));
    for (const child of node.getChildren(tree)) visit(child);
  };
  visit(tree);
  let code = source;
  // JSX text has no comments, though it can read like one.
  const inText = ({ pos }: ts.CommentRange) => text.some((node) => pos >= node.pos && pos < node.end);
  for (const { pos, end } of comments.filter((comment) => !inText(comment))) code = code.slice(0, pos) + code.slice(pos, end).replace(/[^\n]/g, ' ') + code.slice(end);
  return code;
}

/** Code that names the engine: Firefox, Gecko, Mozilla, or a `-moz-` or `Moz…` feature. */
const namesFirefox = (text: string) => /firefox|gecko|mozilla|-moz-/i.test(text) || /\b[Mm]oz[A-Z]/.test(text);

const each = (node: ts.Node, visit: (node: ts.Node) => void) => {
  visit(node);
  node.forEachChild((child) => each(child, visit));
};

/**
 * The lines of these files that treat Firefox apart: code, not comments, that
 * names the engine, or uses a variable, function or class whose value or body
 * does. The compiler resolves each name, so a value is followed however it is
 * bound, assigned, destructured, exported or imported, and a different value
 * that shares its name is not.
 */
function firefoxLinesIn(files: { file: string; source: string }[]) {
  const codes = new Map(files.map(({ file, source }) => [`/${file}`, withoutComments(file, source)]));
  const options: ts.CompilerOptions = { noLib: true, noResolve: false, jsx: ts.JsxEmit.Preserve, module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler, target: ts.ScriptTarget.Latest };
  const host: ts.CompilerHost = {
    ...ts.createCompilerHost(options),
    fileExists: (path) => codes.has(path),
    readFile: (path) => codes.get(path),
    getSourceFile: (path, target) => (codes.has(path) ? ts.createSourceFile(path, codes.get(path)!, target, true, kindOf(path)) : undefined),
    getCurrentDirectory: () => '/',
    directoryExists: () => true,
  };
  const program = ts.createProgram([...codes.keys()], options, host);
  const checker = program.getTypeChecker();
  const trees = [...codes.keys()].map((path) => program.getSourceFile(path)!);
  const symbolOf = (node: ts.Node) => {
    const symbol = ts.isShorthandPropertyAssignment(node.parent) && node.parent.name === node ? checker.getShorthandAssignmentValueSymbol(node.parent) : checker.getSymbolAtLocation(node);
    return symbol && symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol;
  };
  const tainted = new Set<ts.Symbol>();
  /** A module with a value that treats Firefox apart, for `await import(…)`. */
  const taintedModules = new Set<ts.SourceFile>();
  const uses = (node: ts.Node | undefined, tree: ts.SourceFile) => {
    if (!node) return false;
    let found = false;
    const visit = (child: ts.Node): void => {
      // A type that spells out 'firefox' among the engines a value may be decides nothing at run time.
      if (found || (ts.isTypeNode(child) && !ts.isExpressionWithTypeArguments(child))) return;
      let leaf = true;
      child.forEachChild((grandchild) => {
        leaf = false;
        visit(grandchild);
      });
      if (leaf && namesFirefox(child.getText(tree))) found = true;
      else if (ts.isIdentifier(child)) {
        const symbol = symbolOf(child);
        found = !!symbol && tainted.has(symbol);
      } else if (ts.isCallExpression(child) && child.expression.kind === ts.SyntaxKind.ImportKeyword && child.arguments[0] && ts.isStringLiteral(child.arguments[0])) {
        const target = ts.resolveModuleName(child.arguments[0].text, tree.fileName, options, host).resolvedModule;
        found = !!target && [...taintedModules].some((module) => module.fileName === target.resolvedFileName);
      }
    };
    visit(node);
    return found;
  };
  /** The names a declaration binds or an assignment writes, through any destructuring. */
  const names = (target: ts.Node): ts.Node[] => {
    if (ts.isIdentifier(target)) return [target];
    if (ts.isObjectBindingPattern(target) || ts.isArrayBindingPattern(target)) return target.elements.flatMap((el) => (ts.isOmittedExpression(el) ? [] : names(el.name)));
    if (ts.isParenthesizedExpression(target) || ts.isNonNullExpression(target) || ts.isAsExpression(target) || ts.isSpreadElement(target) || ts.isSpreadAssignment(target)) return names(target.expression);
    // `cfg.skip = …` taints `cfg`, since that is where the value is read back.
    // `this.ff = …` in a constructor taints the property, so it reaches `this.ff` in a method.
    if (ts.isPropertyAccessExpression(target)) return target.expression.kind === ts.SyntaxKind.ThisKeyword ? [target.name] : names(target.expression);
    if (ts.isElementAccessExpression(target)) return names(target.expression);
    if (ts.isArrayLiteralExpression(target)) return target.elements.flatMap(names);
    if (ts.isObjectLiteralExpression(target)) return target.properties.flatMap(names);
    if (ts.isShorthandPropertyAssignment(target)) return [target.name];
    if (ts.isPropertyAssignment(target)) return names(target.initializer);
    if (ts.isBinaryExpression(target) && target.operatorToken.kind === ts.SyntaxKind.EqualsToken) return names(target.left);
    if (ts.isVariableDeclarationList(target)) return target.declarations.flatMap((declaration) => names(declaration.name));
    return [];
  };
  const isAssignment = (node: ts.Node): node is ts.BinaryExpression =>
    ts.isBinaryExpression(node) && node.operatorToken.kind >= ts.SyntaxKind.FirstAssignment && node.operatorToken.kind <= ts.SyntaxKind.LastAssignment;
  /** A call to a method that changes the collection or object it is called on, like `skipped.add(…)`. */
  const changes = (node: ts.Node): node is ts.CallExpression & { expression: ts.PropertyAccessExpression } =>
    ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && /^(add|set|delete|clear|push|pop|shift|unshift|splice|append|remove|assign|sort|reverse|fill)$/.test(node.expression.name.text);
  /** The function a node is, or names, so a value handed to it reaches its parameters. */
  const functionsAt = (node: ts.Node): ts.SignatureDeclaration[] => {
    if (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) return [node];
    if (!ts.isIdentifier(node) && !ts.isPropertyAccessExpression(node)) return [];
    return (symbolOf(ts.isPropertyAccessExpression(node) ? node.name : node)?.declarations ?? []).flatMap((declaration): ts.SignatureDeclaration[] =>
      ts.isFunctionDeclaration(declaration) || ts.isMethodDeclaration(declaration)
        ? [declaration]
        : ts.isVariableDeclaration(declaration) && declaration.initializer && (ts.isArrowFunction(declaration.initializer) || ts.isFunctionExpression(declaration.initializer))
          ? [declaration.initializer]
          : [],
    );
  };
  /** The names written anywhere in a node: assigned, counted up or down, or changed by a method called on them. */
  const writes = (node: ts.Node) => {
    const found: ts.Node[] = [];
    each(node, (child) => {
      if (isAssignment(child)) found.push(...names(child.left));
      else if ((ts.isPrefixUnaryExpression(child) || ts.isPostfixUnaryExpression(child)) && [ts.SyntaxKind.PlusPlusToken, ts.SyntaxKind.MinusMinusToken].includes(child.operator)) found.push(...names(child.operand));
      else if (changes(child)) found.push(...names(child.expression.expression));
      else if (ts.isDeleteExpression(child)) found.push(...names(child.expression));
    });
    // A counter or a list that lives only inside the branch ends with it.
    const inside = (name: ts.Node) => (symbolOf(name)?.declarations ?? []).some((declaration) => declaration.pos >= node.pos && declaration.end <= node.end && declaration.getSourceFile() === node.getSourceFile());
    return found.filter((name) => !inside(name));
  };
  for (let grew = true; grew; ) {
    grew = false;
    const mark = (symbol: ts.Symbol | undefined) => {
      if (symbol && !tainted.has(symbol)) {
        tainted.add(symbol);
        grew = true;
      }
    };
    const taint = (nodes: ts.Node[]) => nodes.forEach((node) => mark(symbolOf(node)));
    for (const tree of trees) {
      const module = checker.getSymbolAtLocation(tree);
      const exports = module ? checker.getExportsOfModule(module) : [];
      const exportOf = (name: string) => exports.find((symbol) => symbol.escapedName === name);
      each(tree, (node) => {
        if (ts.isVariableDeclaration(node) && uses(node.initializer, tree)) taint(names(node.name));
        else if ((ts.isBindingElement(node) || ts.isParameter(node)) && uses(node.initializer, tree)) taint(names(node.name));
        else if ((ts.isPropertyDeclaration(node) || ts.isMethodDeclaration(node) || ts.isGetAccessorDeclaration(node)) && ts.isIdentifier(node.name) && uses(node, tree)) taint([node.name]);
        else if ((ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node) || ts.isEnumDeclaration(node)) && uses(node, tree)) {
          if (node.name) taint([node.name]);
          else mark(exportOf('default'));
        } else if (isAssignment(node) && uses(node.right, tree)) taint(names(node.left));
        else if ((ts.isForOfStatement(node) || ts.isForInStatement(node)) && uses(node.expression, tree)) taint(names(node.initializer));
        else if (ts.isExportAssignment(node) && uses(node.expression, tree)) {
          mark(exportOf('default'));
        } else if (
          ((ts.isIfStatement(node) || ts.isWhileStatement(node) || ts.isDoStatement(node) || ts.isConditionalExpression(node)) && uses(ts.isConditionalExpression(node) ? node.condition : node.expression, tree)) ||
          (ts.isSwitchStatement(node) && (uses(node.expression, tree) || node.caseBlock.clauses.some((clause) => ts.isCaseClause(clause) && uses(clause.expression, tree)))) ||
          (ts.isBinaryExpression(node) && [ts.SyntaxKind.AmpersandAmpersandToken, ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken].includes(node.operatorToken.kind) && uses(node.left, tree))
        ) {
          // Whatever is set, counted or changed only when the condition names Firefox treats Firefox apart too.
          taint(writes(ts.isBinaryExpression(node) ? node.right : node));
        } else if (ts.isCallExpression(node)) {
          const passes = node.arguments.some((arg) => !ts.isFunctionLike(arg) && uses(arg, tree));
          // `it.skipIf(ff)(name, cb)` only decides whether cb runs; it hands cb nothing from Firefox.
          const registers = ts.isCallExpression(node.expression) && ts.isPropertyAccessExpression(node.expression.expression) && /^(skipIf|runIf)$/.test(node.expression.expression.name.text);
          if (!passes && (registers || !uses(node.expression, tree))) return;
          // A function handed a Firefox value gets it as a parameter: a callback, as in `it.each(cases)(name, (c) => …)`
          // or `list.forEach((skip) => …)`, whether written in place or named, and a function called with it, as `register(ff)`.
          const functions = node.arguments.flatMap((arg) => functionsAt(arg));
          if (passes) functions.push(...functionsAt(node.expression));
          for (const fn of functions) taint(fn.parameters.flatMap((parameter) => names(parameter.name)));
          // `skipped.add(…)`, `waits.push(…)` and `Object.assign(cfg, …)` change the value they are called on.
          if (passes) {
            if (changes(node)) taint(names(node.expression.expression));
            if (node.expression.getText(tree) === 'Object.assign' && node.arguments[0]) taint(names(node.arguments[0]));
          }
        }
      });
      const resolved = (symbol: ts.Symbol) => (symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol);
      if (!taintedModules.has(tree) && exports.some((symbol) => tainted.has(symbol) || tainted.has(resolved(symbol)))) {
        taintedModules.add(tree);
        grew = true;
      }
    }
  }
  return trees.flatMap((tree) => {
    const file = tree.fileName.slice(1);
    const lines = codes.get(tree.fileName)!.split('\n');
    const marked = new Set(lines.flatMap((text, index) => (namesFirefox(text) ? [index] : [])));
    each(tree, (node) => {
      if (!ts.isIdentifier(node)) return;
      const symbol = symbolOf(node);
      if (symbol && tainted.has(symbol)) marked.add(tree.getLineAndCharacterOfPosition(node.getStart(tree)).line);
    });
    return [...marked].sort((x, y) => x - y).map((index) => ({ file, line: index + 1, text: lines[index]!.trim() }));
  });
}

/**
 * Pairs each line with an entry whose code it holds, one entry to a line, so
 * a loose entry can't take the line a closer one was written for.
 */
function matchBranches<Line extends { file: string; text: string }>(lines: Line[], branches: readonly FirefoxBranch[]) {
  const fits = lines.map((line) => branches.flatMap((branch, index) => (branch.file === line.file && line.text.includes(branch.code) ? [index] : [])));
  const owner = new Array<number>(branches.length).fill(-1);
  const place = (line: number, seen: Set<number>): boolean =>
    fits[line]!.some((branch) => {
      if (seen.has(branch)) return false;
      seen.add(branch);
      if (owner[branch] !== -1 && !place(owner[branch]!, seen)) return false;
      owner[branch] = line;
      return true;
    });
  for (let line = 0; line < lines.length; line++) place(line, new Set());
  const placed = new Set(owner.filter((line) => line !== -1));
  return { unlisted: lines.filter((_, index) => !placed.has(index)), unused: branches.filter((_, index) => owner[index] === -1) };
}

const firefoxLines = (source: string) => firefoxLinesIn([{ file: 'src/browser/a.tsx', source }]).map(({ line, text }) => ({ line, text }));

it('pairs a line with the entry written for it before a looser one', () => {
  const lines = [
    { file: 'a.tsx', text: "if (server.browser === 'firefox') probes.length = 0;" },
    { file: 'a.tsx', text: "if (server.browser === 'firefox' && document.activeElement) blur();" },
  ];
  const branches = [
    { file: 'a.tsx', code: "server.browser === 'firefox'", reason: 'loose' },
    { file: 'a.tsx', code: "if (server.browser === 'firefox') probes.length = 0;", reason: 'close' },
  ];
  expect(matchBranches(lines, branches)).toEqual({ unlisted: [], unused: [] });
  expect(matchBranches([...lines, lines[0]!], branches).unlisted).toEqual([lines[0]]);
});

it('reads a .ts file as TypeScript, so a generic arrow leaves its comments as comments', () => {
  const found = firefoxLinesIn([{ file: 'src/test/a.ts', source: 'export const first = <T>(items: T[]): T | undefined => items[0];\n// Firefox paints later.\nconst y = <HTMLElement>el;\n// Gecko too.\n' }]);
  expect(found).toEqual([]);
});

it('follows a value through shorthand properties, compound and destructuring assignments, defaults, enums, loops and conditions', () => {
  const lines = (source: string[]) => firefoxLines(source.join('\n')).map(({ line }) => line);
  expect(lines(["const skip = server.browser === 'firefox';", 'const opts = { skip };', "it('a', opts, () => {});"])).toEqual([1, 2, 3]);
  expect(lines(['let skip = false;', "skip ||= server.browser === 'firefox';", "it.skipIf(skip)('a', () => {});"])).toEqual([1, 2, 3]);
  expect(lines(['let a = false, b = false;', "({ a } = { a: server.browser === 'firefox' });", "[b] = [server.browser === 'firefox'];", 'it.skipIf(a)("a", () => {});', 'it.skipIf(b)("b", () => {});'])).toEqual([1, 2, 3, 4, 5]);
  expect(lines(["const [x = server.browser === 'firefox'] = [];", "it.skipIf(x)('c', () => {});"])).toEqual([1, 2]);
  expect(lines(['const cfg = { skip: false };', "cfg.skip = server.browser === 'firefox';", "it.skipIf(cfg.skip)('a', () => {});"])).toEqual([1, 2, 3]);
  expect(lines(["enum Engine { FF = 'firefox' }", "it.skipIf(server.browser === Engine.FF)('a', () => {});"])).toEqual([1, 2]);
  expect(lines(["const slow = ['firefox'];", 'for (const engine of slow) {', "  it.skipIf(server.browser === engine)('a', () => {});", '}'])).toEqual([1, 2, 3]);
  expect(lines(["[server.browser === 'firefox'].forEach((skip) => {", "  it.skipIf(skip)('a', () => {});", '});'])).toEqual([1, 2]);
  expect(lines(['let skip = false;', "if (server.browser === 'firefox') {", '  skip = true;', '}', "it.skipIf(skip)('a', () => {});"])).toEqual([1, 2, 3, 5]);
});

it('follows a default parameter, and a class member read through this, along with the class and method built on it', () => {
  const lines = (source: string[]) => firefoxLines(source.join('\n')).map(({ line }) => line);
  expect(lines(["function guard(cond = server.browser === 'firefox') {", "  it.skipIf(cond)('a', () => {});", '}'])).toEqual([1, 2]);
  expect(lines(['class Probe {', "  ff = server.browser === 'firefox';", '  run() {', "    it.skipIf(this.ff)('a', () => {});", '  }', '}'])).toEqual([1, 2, 3, 4]);
});

it('follows a value into each callback, switch case, count and method call that changes it', () => {
  const lines = (source: string[]) => firefoxLines(source.join('\n')).map(({ line }) => line);
  expect(
    lines([
      "const cases = [{ name: 'drag', skip: server.browser === 'firefox' }];",
      "it.each(cases)('$name', ({ skip }) => {",
      '  if (skip) return;',
      '});',
      "describe.each(cases)('$name', (c) => {",
      "  it.skipIf(c.skip)('y', () => {});",
      '});',
    ]),
  ).toEqual([1, 2, 3, 5, 6]);
  expect(lines(['let tolerance = 1;', 'switch (server.browser) {', "  case 'firefox':", '    tolerance = 2;', '}', 'expect(delta).toBeLessThan(tolerance);'])).toEqual([1, 3, 4, 6]);
  expect(lines(['let frames = 1;', "if (server.browser === 'firefox') frames++;", 'await settle(frames);'])).toEqual([1, 2, 3]);
  expect(lines(['const skipped = new Set<string>();', "if (server.browser === 'firefox') skipped.add('drag');", "it.skipIf(skipped.has('drag'))('drag', () => {});"])).toEqual([1, 2, 3]);
  expect(lines(['const waits: number[] = [];', "waits.push(server.browser === 'firefox' ? 50 : 0);", 'await wait(waits[0]);'])).toEqual([1, 2, 3]);
  expect(lines(['const cfg = { skip: false };', "Object.assign(cfg, { skip: server.browser === 'firefox' });", "it.skipIf(cfg.skip)('a', () => {});"])).toEqual([1, 2, 3]);
  expect(lines(['let tolerance = 1;', "server.browser === 'firefox' && (tolerance = 2);", 'expect(delta).toBeLessThan(tolerance);'])).toEqual([1, 2, 3]);
});

it('follows a property set in a constructor, and ignores a Firefox that only appears in a type', () => {
  const lines = (source: string[]) => firefoxLines(source.join('\n')).map(({ line }) => line);
  expect(lines(['class P {', '  ff: boolean;', '  constructor() {', "    this.ff = server.browser === 'firefox';", '  }', '  run() {', "    it.skipIf(this.ff)('a', () => {});", '  }', '}'])).toContain(7);
  expect(lines(["function offsetFor(engine: 'firefox' | 'chromium' | 'webkit') {", '  return engine.length;', '}', "expect(offsetFor('chromium')).toBe(8);"])).toEqual([1]);
});

it('follows a switch on a Firefox value, a named callback, removals, and leaves a skipped test its own fixtures', () => {
  const lines = (source: string[]) => firefoxLines(source.join('\n')).map(({ line }) => line);
  expect(lines(["const kind = server.browser === 'firefox' ? 'slow' : 'fast';", 'let tolerance = 1;', 'switch (kind) {', "  case 'slow':", '    tolerance = 2;', '}', 'expect(delta).toBeLessThan(tolerance);'])).toEqual([1, 2, 3, 5, 7]);
  expect(lines(["const cases = [{ name: 'drag', skip: server.browser === 'firefox' }];", 'function runCase({ skip }: { skip: boolean }) {', '  if (skip) return;', '}', "it.each(cases)('$name', runCase);"])).toEqual([1, 2, 3, 5]);
  expect(lines(["const ff = server.browser === 'firefox';", 'function register(skip: boolean) {', "  it.skipIf(skip)('a', () => {});", '}', 'register(ff);'])).toEqual([1, 2, 3, 5]);
  expect(lines(["const cases = ['a', 'drag'];", "if (server.browser === 'firefox') cases.pop();", "it.each(cases)('%s', () => {});"])).toEqual([1, 2, 3]);
  expect(lines(['const opts = { retry: 2 };', "if (server.browser === 'firefox') delete opts.retry;", "it('a', opts, () => {});"])).toEqual([1, 2, 3]);
  expect(lines(["const ff = server.browser === 'firefox';", "it.skipIf(ff)('a', async ({ expect }) => {", '  expect(1).toBe(1);', '});'])).toEqual([1, 2]);
});

it('leaves alone what lives only inside a Firefox branch, another object of the same shape, and follows a Firefox base class', () => {
  const lines = (source: string[]) => firefoxLines(source.join('\n')).map(({ line }) => line);
  expect(lines(["if (server.browser === 'firefox') {", '  for (let frames = 0; frames < 2; frames++) await frame();', '  const seen: number[] = [];', '  seen.push(1);', '}'])).toEqual([1]);
  expect(lines(['class Probe { delay = 0 }', 'const a = new Probe();', 'const b = new Probe();', "if (server.browser === 'firefox') a.delay = 50;", 'expect(b.delay).toBe(0);'])).toEqual([2, 4]);
  expect(lines(["class FfBase { skip = server.browser === 'firefox' }", 'class Probe extends FfBase {}', 'const p = new Probe();', "it.skipIf(p.skip)('a', () => {});"])).toEqual([1, 2, 3, 4]);
});

it('follows a default export and a dynamic import into another file', () => {
  const found = firefoxLinesIn([
    { file: 'src/test/a.ts', source: "export default server.browser === 'firefox';" },
    { file: 'src/test/b.ts', source: "export default function () {\n  return server.browser === 'firefox';\n}" },
    { file: 'src/test/c.ts', source: "export const noDrag = server.browser === 'firefox';" },
    {
      file: 'src/browser/x.browser.test.tsx',
      source: [
        "import ff from '../test/a.js';",
        "import fn from '../test/b.js';",
        "it.skipIf(ff)('a', () => {});",
        "it.skipIf(fn())('b', () => {});",
        "const { noDrag } = await import('../test/c.js');",
        "it.skipIf(noDrag)('c', () => {});",
        "const mod = await import('../test/c.js');",
        "it.skipIf(mod.noDrag)('d', () => {});",
      ].join('\n'),
    },
  ]);
  expect(found.filter(({ file }) => file.endsWith('x.browser.test.tsx')).map(({ line }) => line)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
});

it('follows only the value that names Firefox, not another one that shares its name', () => {
  const found = firefoxLines(
    [
      "it('a', () => { const at = server.browser === 'firefox' ? 2 : 1; expect(x).toBe(at); });",
      "it('b', () => { const at = edge.getBoundingClientRect();",
      '  expect(at.left).toBe(0); });',
      "it('resizes a panel at the end', () => {});",
    ].join('\n'),
  );
  expect(found.map(({ line }) => line)).toEqual([1]);
});

it('follows a name whose value names Firefox, however it is bound, within a file and through imports', () => {
  const found = firefoxLinesIn([
    {
      file: 'src/test/engine.ts',
      source: [
        'export const noDrag =',
        "  server.browser === 'firefox';",
        "const at = server.browser === 'firefox' ? 1 : 2;",
        "const later = server.browser === 'firefox';",
        'export { later as alsoLater };',
        'export default noDrag;',
      ].join('\n'),
    },
    {
      file: 'src/browser/a.browser.test.tsx',
      source: [
        "import plain, { noDrag as nd, alsoLater } from '../test/engine.js';",
        "import * as engine from '../test/engine.js';",
        'const at = 3;',
        'expect(at).toBe(3);',
        "it.skipIf(nd)('a', () => {});",
        "it.skipIf(engine.noDrag)('b', () => {});",
        "it.skipIf(plain || alsoLater)('c', () => {});",
        'function unsupported() {',
        "  return 'MozAppearance' in document.documentElement.style;",
        '}',
        "it.skipIf(unsupported())('d', () => {});",
        "const { $ff } = { $ff: CSS.supports('-moz-appearance', 'none') };",
        "it.skipIf($ff)('e', () => {});",
        'let late = false;',
        "late = navigator.userAgent.includes('Gecko/');",
        "it.skipIf(late)('f', () => {});",
        'const skipDrag = (name: string, fn: () => void) =>',
        "  it.skipIf(server.browser === 'firefox')(name, fn);",
        "skipDrag('g', () => {});",
      ].join('\n'),
    },
  ]);
  expect(found.map(({ file, line }) => `${file}:${line}`)).toEqual([
    'src/test/engine.ts:1',
    'src/test/engine.ts:2',
    'src/test/engine.ts:3',
    'src/test/engine.ts:4',
    'src/test/engine.ts:5',
    'src/test/engine.ts:6',
    ...[1, 5, 6, 7, 8, 9, 11, 12, 13, 14, 15, 16, 17, 18, 19].map((line) => `src/browser/a.browser.test.tsx:${line}`),
  ]);
});

describe('Firefox branches in browser tests', () => {
  it('finds every line of code that names Firefox, and none in a comment', () => {
    const source = [
      "const isFirefox = server.browser === 'firefox';",
      "it.skipIf(isFirefox)('through a constant', () => {});",
      "it.skipIf(server.browser === 'chromium')('another engine only', () => {});",
      '// Firefox draws this differently, but a comment changes nothing.',
      "/* it.skipIf(server.browser === 'firefox')('a skip in a block comment', () => {}); */",
      "const images = '**/*.png';",
      "it('in options', { skip: server.browser === 'firefox' }, () => {});",
      "const fonts = '**/*.woff2'; // a URL like 'https://example.com' isn't a comment",
      "it('from the body', ({ skip }) => { if (/Gecko\\/\\d/.test(navigator.userAgent)) skip(); });",
      "it.skipIf(server.browser === 'firefox')( // Firefox can't start the drag",
      "  'with a comment after it',",
      ');',
      "const trim = (path: string) => path.replace(/\\/*$/, '');",
      "const remote = /^https?:\\/\\//.test(location.href) && server.browser === 'firefox';",
      "const origin = `${remote ? `https://` : `http://`}${server.browser === 'firefox' ? 'a' : 'b'}`;",
      "const quoted = /^['\"]/; // Firefox quotes a mention the same way",
      "const Note = () => <p>Don't stop {/* Firefox needs nothing here */}</p>;",
      'const Url = () => <p>// Firefox, as text</p>;',
      "const dragIt = it.skipIf(server.browser === 'firefox');",
      "dragIt('through an alias', () => {});",
      "it.runIf(server.browser === 'chromium')('another engine only, again', () => {});",
    ].join('\n');
    expect(firefoxLines(source).map(({ line }) => line)).toEqual([1, 2, 7, 9, 10, 14, 15, 18, 19, 20]);
    expect(firefoxLines(source)[4]!.text).toBe("it.skipIf(server.browser === 'firefox')(");
  });

  const root = join(import.meta.dirname, '../src');
  const files = (readdirSync(root, { recursive: true }) as string[])
    .map((name) => name.split('\\').join('/'))
    .filter((name) => /\.browser\.test\.tsx?$/.test(name) || /^(test|browser)\/.+\.tsx?$/.test(name));
  const found = firefoxLinesIn(files.map((name) => ({ file: `src/${name}`, source: readFileSync(join(root, name), 'utf8') })));
  // Each entry names one line, so a second line like one already listed needs its own entry and reason.
  const { unlisted, unused } = matchBranches(found, firefoxBranches);

  it('lists every line of a browser test that treats Firefox apart, so a failure cannot be silenced by a skip', () => {
    expect(found.length).toBeGreaterThan(0);
    expect(
      unlisted.map(({ file, line, text }) => `${file}:${line} ${text}`),
      'These lines treat Firefox apart; add each to firefoxBranches with a reason, or quarantine the test instead',
    ).toEqual([]);
  });

  it('keeps no entry for a line that is gone, and gives each one a reason', () => {
    expect(
      unused.map(({ file, code }) => `${file}: ${code}`),
      'firefoxBranches lists lines that no longer exist',
    ).toEqual([]);
    for (const branch of firefoxBranches) expect(branch.reason.trim()).not.toBe('');
  });
});
