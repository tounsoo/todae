// Checks every hand-written prop in src/**/*.meta.ts against the TypeScript
// type of the export it describes: the prop must exist, `required` must match,
// the `type` string must name the same type, and a literal `default` must match
// a literal default in the code. `scripts/meta-types.test.ts` runs it.
//
// How a meta prop name finds its TypeScript prop, for an export `X` or a part `X.Y`:
// - Each call signature, and each member of a union first parameter, is one
//   shape. A prop is required when every shape requires it, and its type is
//   the union of the shapes that allow it. A shape whose type for the prop is
//   only `undefined` or `never` doesn't allow it.
// - `name` is a field of the first parameter when that has one, or else a
//   parameter of that name. `a.b` is field `b` of parameter or field `a`.
//   `...name` is a rest parameter.
// - An export that takes no parameters and returns a function, such as
//   useAnnouncer, is described by the function it returns.
// - Type strings resolve against the main entry's exported types, a few React
//   types (ReactNode, ReactElement, Ref, RefObject, RefCallback, ChangeEvent,
//   CSSProperties) and the `React` namespace. A type parameter that the meta
//   names, such as `T` in `Toaster<T>`, stands for the export's own type
//   parameter; one it doesn't name is read at its constraint.
// - A type ending in `| …` lists only some members: each must be allowed.
// - A type that is or holds `any`, such as `any[]`, fails unless TypeScript's
//   does too.
// - A code default is a literal, or a const the checker reads as one, set in
//   the destructuring or the parameter, or put after `name ?? …` in the body.
//   A meta must list a destructuring or parameter default. One found after
//   `??` is checked only when the meta lists a default. A function with no
//   default of its own that hands the prop on, as `{...props}`, `key={key}`
//   or an argument, is read where the prop lands. A meta default that isn't a
//   literal fails when the code has one. Native attribute defaults, such as a
//   slider's min, and defaults from StringsProvider aren't in code and go
//   unchecked. So does a default set only in a nested block or after
//   `const {…} = props ?? {}` or a call on the props.
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';
import type { ComponentMeta, PropMeta } from '../src/meta.ts';

const root = join(import.meta.dirname, '..');
const srcDir = join(root, 'src');
const indexFile = join(srcDir, 'index.ts');
const probeFile = join(srcDir, '__meta-types-probe__.ts');
const reactTypes = ['ReactNode', 'ReactElement', 'Ref', 'RefObject', 'RefCallback', 'ChangeEvent', 'CSSProperties'];
const ELLIPSIS = /\s*\|\s*…\s*$/;

/** Every meta in the package, as `pnpm schema` reads them. */
export async function loadMetas(): Promise<ComponentMeta[]> {
  const files = readdirSync(srcDir, { recursive: true, encoding: 'utf8' })
    .filter((file) => file.endsWith('.meta.ts'))
    .sort();
  return Promise.all(
    files.map(async (file) => ((await import(pathToFileURL(join(srcDir, file)).href)) as { meta: ComponentMeta }).meta),
  );
}

type Probe = { meta: ComponentMeta; space: string; props: { prop: PropMeta; alias: string; line: number }[] };

function compilerOptions() {
  const config = ts.readConfigFile(join(root, 'tsconfig.json'), ts.sys.readFile);
  return ts.parseJsonConfigFileContent(config.config, ts.sys, root).options;
}

function exportedTypeNames(program: ts.Program): Set<string> {
  const checker = program.getTypeChecker();
  const module = checker.getSymbolAtLocation(program.getSourceFile(indexFile)!)!;
  const names = new Set<string>();
  for (const symbol of checker.getExportsOfModule(module)) {
    const target = symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol;
    if (target.flags & ts.SymbolFlags.Type) names.add(symbol.name);
  }
  return names;
}

/** The export a meta describes, as the probe file writes it: `Button.Root`, `useTooltip`. */
function exportPath(name: string) {
  return name.split('.').map((part) => (/^[A-Za-z_$][\w$]*$/.test(part) ? part : JSON.stringify(part)));
}

function typeParametersOf(program: ts.Program, name: string): ts.TypeParameterDeclaration[] {
  const checker = program.getTypeChecker();
  const source = program.getSourceFile(indexFile)!;
  const [head, ...rest] = name.split('.');
  const symbol = checker.getExportsOfModule(checker.getSymbolAtLocation(source)!).find((s) => s.name === head);
  if (!symbol) return [];
  let type = checker.getTypeOfSymbolAtLocation(symbol, source);
  for (const part of rest) {
    const member = type.getProperty(part);
    if (!member) return [];
    type = checker.getTypeOfSymbolAtLocation(member, source);
  }
  const declaration = type.getCallSignatures()[0]?.getDeclaration();
  return declaration?.typeParameters ? [...declaration.typeParameters] : [];
}

/** One mismatch: the meta it is in, and a line that names the part, the prop and what differs. */
export type MetaTypeProblem = { meta: ComponentMeta; text: string };

/** Checks the metas against the TypeScript types and returns each mismatch. */
export function checkMetaTypes(metas: readonly ComponentMeta[]): MetaTypeProblem[] {
  const options = compilerOptions();
  const base = ts.createProgram([indexFile], options);
  const baseChecker = base.getTypeChecker();
  const typeNames = [...exportedTypeNames(base)].filter((name) => !reactTypes.includes(name));

  // One namespace per meta: its type parameters, the export instantiated with
  // them, and one alias per prop type.
  const lines = [
    `import type * as React from 'react';`,
    `import type { ${reactTypes.join(', ')} } from 'react';`,
    `import type { ${typeNames.join(', ')} } from './index.ts';`,
    `import * as __api from './index.ts';`,
  ];
  const probes: Probe[] = [];
  metas.forEach((meta, m) => {
    const space = `N${m}`;
    const probe: Probe = { meta, space, props: [] };
    probes.push(probe);
    lines.push(`namespace ${space} {`);
    const named = meta.props.map((prop) => prop.type).join(' ');
    const params = typeParametersOf(base, meta.name);
    const args = params.map((param) => {
      const name = param.name.text;
      const constraint = param.constraint
        ? baseChecker.typeToString(baseChecker.getTypeFromTypeNode(param.constraint), undefined, ts.TypeFormatFlags.NoTruncation)
        : 'unknown';
      if (new RegExp(`\\b${name}\\b`).test(named)) {
        // An opaque stand-in, so `T` in the meta matches only the export's own `T`.
        lines.push(`  type ${name} = (${constraint}) & { readonly __typeParameter: '${space}.${name}' };`);
        return name;
      }
      return constraint;
    });
    const path = exportPath(meta.name);
    const access = path.length === 1 ? `__api.${path[0]}` : `__api.${path[0]}[${JSON.stringify(meta.name.split('.')[1])}]`;
    lines.push(
      args.length > 0
        ? `  export declare const F: typeof ${path.join('.')}<${args.join(', ')}>;`
        : `  export declare const F: typeof ${access};`,
    );
    meta.props.forEach((prop, p) => {
      const alias = `M${p}`;
      probe.props.push({ prop, alias, line: lines.length });
      lines.push(`  export type ${alias} = ${prop.type.replace(ELLIPSIS, '').replace(/\s*\n\s*/g, ' ')};`);
    });
    lines.push('}');
  });
  // `typeof X.Y<T>` needs the value names in scope.
  const values = [...new Set(metas.map((meta) => meta.name.split('.')[0]!))];
  lines.splice(4, 0, `const { ${values.join(', ')} } = __api;`);
  for (const probe of probes) for (const entry of probe.props) entry.line += 1;
  const text = `${lines.join('\n')}\n`;

  const host = ts.createCompilerHost(options);
  const { readFile, fileExists, getSourceFile } = host;
  host.readFile = (name) => (name === probeFile ? text : readFile.call(host, name));
  host.fileExists = (name) => name === probeFile || fileExists.call(host, name);
  host.getSourceFile = (name, language, ...rest) =>
    name === probeFile ? ts.createSourceFile(name, text, language, true) : getSourceFile.call(host, name, language, ...rest);
  const program = ts.createProgram([indexFile, probeFile], options, host, base);
  const checker = program.getTypeChecker();
  const source = program.getSourceFile(probeFile)!;

  const errors = new Map<number, string>();
  for (const diagnostic of [...program.getSyntacticDiagnostics(source), ...program.getSemanticDiagnostics(source)]) {
    const { line } = source.getLineAndCharacterOfPosition(diagnostic.start ?? 0);
    if (!errors.has(line)) errors.set(line, ts.flattenDiagnosticMessageText(diagnostic.messageText, ' '));
  }

  const spaces = new Map(
    source.statements
      .filter(ts.isModuleDeclaration)
      .map((space) => [space.name.text, space.body as ts.ModuleBlock] as const),
  );

  const problems: MetaTypeProblem[] = [];
  for (const probe of probes) {
    const report = (text: string) => problems.push({ meta: probe.meta, text });
    const body = spaces.get(probe.space)!;
    const fnStatement = body.statements.find(ts.isVariableStatement)!;
    const fnLine = source.getLineAndCharacterOfPosition(fnStatement.getStart()).line;
    if (probe.meta.name.split('.').length > 2) {
      report(`${probe.meta.name}: no such export (a name has at most two parts)`);
      continue;
    }
    if (errors.has(fnLine)) {
      report(`${probe.meta.name}: no such export (${errors.get(fnLine)})`);
      continue;
    }
    const fnType = checker.getTypeAtLocation(fnStatement.declarationList.declarations[0]!.name);
    const shapes = shapesOf(checker, fnType, source);
    if (shapes.length === 0) {
      report(`${probe.meta.name}: is not a function`);
      continue;
    }
    const aliases = new Map(
      body.statements.filter(ts.isTypeAliasDeclaration).map((alias) => [alias.name.text, alias] as const),
    );
    for (const { prop, alias, line } of probe.props) {
      const where = `${probe.meta.name} ${prop.name}`;
      const error = errors.get(line);
      if (error) {
        report(`${where}: type "${prop.type}" doesn't compile: ${error}`);
        continue;
      }
      const found = shapes.map((shape) => lookup(checker, shape, prop.name, source));
      const present = found.filter((f): f is Found => f !== undefined);
      if (present.length === 0) {
        report(`${where}: TypeScript has no such prop`);
        continue;
      }
      const required = found.every((f) => f !== undefined && !f.optional);
      if (required !== prop.required) {
        report(`${where}: required is ${prop.required}, TypeScript says ${required}`);
      }
      const declared = checker.getTypeAtLocation(aliases.get(alias)!.name);
      // An `any` anywhere, as in `any[]`, passes both assignability checks, so look for the word.
      const hasAny = (text: string) => /\bany\b/.test(text.replace(/"[^"]*"|'[^']*'/g, ''));
      const codeHasAny = present.some((f) => hasAny(checker.typeToString(f.type, undefined, ts.TypeFormatFlags.NoTruncation)));
      if ((declared.flags & ts.TypeFlags.Any || hasAny(prop.type)) && !codeHasAny) {
        report(`${where}: type is "${prop.type}", which allows anything; name the type`);
        continue;
      }
      const partial = ELLIPSIS.test(prop.type);
      const covers = partial || present.every((f) => defined(f.type).every((part) => checker.isTypeAssignableTo(part, declared)));
      const allowed = defined(declared).every((part) => present.some((f) => checker.isTypeAssignableTo(part, f.type)));
      if (!covers || !allowed) {
        const actual = present.map((f) => checker.typeToString(f.type, undefined, ts.TypeFormatFlags.NoTruncation));
        report(`${where}: type is "${prop.type}", TypeScript has "${[...new Set(actual)].join('" or "')}"`);
      }
      if (prop.required && required) {
        // Optional props take undefined anyway; a required one takes it only when its type says so.
        const takes = (type: ts.Type) => (type.isUnion() ? type.types : [type]).some((part) => part.flags & ts.TypeFlags.Undefined);
        if (takes(declared) !== present.some((f) => takes(f.type))) {
          report(`${where}: type is "${prop.type}", TypeScript ${takes(declared) ? "doesn't take" : 'also takes'} undefined`);
        }
      }
      const literal = parseLiteral(prop.default);
      const literalType = literal === undefined ? undefined : literalTypeOf(checker, literal);
      if (literalType && !present.some((f) => checker.isTypeAssignableTo(literalType, f.type))) {
        report(`${where}: default ${prop.default} isn't a value of its type`);
      }
      const code = present.map((f) => f.default).find((d) => d !== undefined);
      if (code !== undefined && literal !== undefined && code.value !== literal) {
        report(`${where}: default is ${prop.default}, the code defaults to ${code.value}`);
      }
      if (code !== undefined && literal === undefined && prop.default !== undefined) {
        report(`${where}: default ${prop.default} isn't a literal, the code defaults to ${code.value}`);
      }
      if (code?.initializer && prop.default === undefined) {
        report(`${where}: has no default, the code defaults to ${code.value}`);
      }
    }
  }
  return problems;
}

type Shape = { params: readonly ts.Symbol[]; first: ts.Type | undefined; declaration: ts.SignatureDeclaration | undefined };
/** A literal default in the code, as JSON. `initializer` is false for one found only after `?? `, which a meta may leave out. */
type Default = { value: string; initializer: boolean };
type Found = { type: ts.Type; optional: boolean; default: Default | undefined };

function shapesOf(checker: ts.TypeChecker, fnType: ts.Type, at: ts.Node): Shape[] {
  let signatures = fnType.getCallSignatures();
  // The function the code returns, when the returned type is only an alias, so its defaults can be read.
  let returnedFunction: ts.SignatureDeclaration | undefined;
  // A hook that takes nothing and returns a function is described by that function.
  if (signatures.length > 0 && signatures.every((s) => s.getParameters().length === 0)) {
    const returned = signatures.flatMap((s) => s.getReturnType().getCallSignatures());
    if (returned.length > 0) {
      returnedFunction = returnedImplementation(checker, signatures);
      signatures = returned;
    }
  }
  return signatures.flatMap((signature): Shape[] => {
    const params = signature.getParameters();
    const own = signature.getDeclaration() as ts.SignatureDeclaration | undefined;
    const declaration = implementationOf(own) ? own : (returnedFunction ?? own);
    const firstParam = params[0];
    if (!firstParam) return [{ params, first: undefined, declaration }];
    const firstType = checker.getTypeOfSymbolAtLocation(firstParam, at);
    return defined(firstType).map((first) => ({ params, first, declaration }));
  });
}

/** The one function declaration the hook's body returns by name, such as `return announce`. */
function returnedImplementation(checker: ts.TypeChecker, signatures: readonly ts.Signature[]): ts.SignatureDeclaration | undefined {
  const found = new Set<ts.SignatureDeclaration>();
  for (const signature of signatures) {
    const body = implementationOf(signature.getDeclaration() as ts.SignatureDeclaration | undefined)?.body;
    if (!body) continue;
    const visit = (node: ts.Node) => {
      if (ts.isFunctionLike(node)) return;
      if (ts.isReturnStatement(node) && node.expression && ts.isIdentifier(node.expression)) {
        const declaration = checker.getSymbolAtLocation(node.expression)?.valueDeclaration;
        if (declaration && implementationOf(declaration as ts.SignatureDeclaration)) found.add(declaration as ts.SignatureDeclaration);
      }
      ts.forEachChild(node, visit);
    };
    ts.forEachChild(body, visit);
  }
  return found.size === 1 ? [...found][0] : undefined;
}

function defined(type: ts.Type): ts.Type[] {
  return (type.isUnion() ? type.types : [type]).filter((part) => !(part.flags & (ts.TypeFlags.Undefined | ts.TypeFlags.Never)));
}

function isObject(type: ts.Type) {
  return (type.flags & ts.TypeFlags.Object) !== 0 || type.isIntersection();
}

function lookup(checker: ts.TypeChecker, shape: Shape, name: string, at: ts.Node): Found | undefined {
  const rest = name.startsWith('...');
  const [head, ...tail] = (rest ? name.slice(3) : name).split('.');
  let found: Found | undefined;
  const field = !rest && shape.first && isObject(shape.first) ? shape.first.getProperty(head!) : undefined;
  if (field) {
    found = { type: checker.getTypeOfSymbolAtLocation(field, at), optional: (field.flags & ts.SymbolFlags.Optional) !== 0, default: undefined };
    if (tail.length === 0) found.default = bindingDefault(checker, shape.declaration, 0, head!);
  } else {
    const index = shape.params.findIndex((p) => p.name === head);
    const param = shape.params[index];
    const declaration = param?.valueDeclaration;
    if (!param || !declaration || !ts.isParameter(declaration) || rest !== (declaration.dotDotDotToken !== undefined)) return undefined;
    found = {
      type: checker.getTypeOfSymbolAtLocation(param, at),
      optional: rest || checker.isOptionalParameter(declaration),
      default: paramDefault(checker, shape.declaration, index),
    };
    if (tail.length === 1) {
      const member: ts.Symbol | undefined = defined(found.type).map((t) => t.getProperty(tail[0]!)).find(Boolean);
      if (!member) return undefined;
      found = {
        type: checker.getTypeOfSymbolAtLocation(member, at),
        optional: found.optional || (member.flags & ts.SymbolFlags.Optional) !== 0,
        default: bindingDefault(checker, shape.declaration, index, tail[0]!),
      };
      return defined(found.type).length > 0 ? found : undefined;
    }
  }
  for (const key of tail) {
    const member: ts.Symbol | undefined = defined(found.type).map((t) => t.getProperty(key)).find(Boolean);
    if (!member) return undefined;
    found = {
      type: checker.getTypeOfSymbolAtLocation(member, at),
      optional: found.optional || (member.flags & ts.SymbolFlags.Optional) !== 0,
      default: undefined,
    };
  }
  return defined(found.type).length > 0 ? found : undefined;
}

/**
 * The literal default the code gives `key` of parameter `index`: in the
 * parameter's destructuring, in a top-level `const { key = … } = param`, or as
 * the one literal the body puts after `key ?? …`. When the function has none
 * and hands the prop on, to a component as `{...props}` or `key={key}` or to a
 * function as an argument, the default is the one that function gives.
 */
function bindingDefault(
  checker: ts.TypeChecker,
  declaration: ts.SignatureDeclaration | undefined,
  index: number,
  key: string,
  depth = 0,
): Default | undefined {
  const implementation = implementationOf(declaration);
  const param = implementation?.parameters[index];
  if (!implementation || !param) return undefined;
  const patterns: ts.ObjectBindingPattern[] = [];
  // Names that hold the whole props object, or the rest of it.
  const holders = new Set<string>();
  if (ts.isObjectBindingPattern(param.name)) patterns.push(param.name);
  else if (ts.isIdentifier(param.name)) {
    holders.add(param.name.text);
    if (implementation.body && ts.isBlock(implementation.body)) {
      const paramName = param.name.text;
      for (const statement of implementation.body.statements) {
        if (!ts.isVariableStatement(statement)) continue;
        for (const variable of statement.declarationList.declarations) {
          if (ts.isObjectBindingPattern(variable.name) && variable.initializer && ts.isIdentifier(variable.initializer) && variable.initializer.text === paramName) {
            patterns.push(variable.name);
          }
        }
      }
    }
  }
  let local: string | undefined;
  const nameOf = (element: ts.BindingElement) => {
    const property = element.propertyName ?? element.name;
    return ts.isIdentifier(property) || ts.isStringLiteral(property) ? property.text : undefined;
  };
  for (const pattern of patterns) {
    // A rest holds the prop only when the same pattern didn't take it out.
    const takes = pattern.elements.some((element) => !element.dotDotDotToken && nameOf(element) === key);
    for (const element of pattern.elements) {
      if (element.dotDotDotToken && ts.isIdentifier(element.name)) {
        if (!takes) holders.add(element.name.text);
        continue;
      }
      if (nameOf(element) !== key) continue;
      if (element.initializer) return initializerDefault(checker, element.initializer);
      if (ts.isIdentifier(element.name)) local = element.name.text;
    }
  }
  const own = coalesceDefault(checker, implementation, (node) =>
    (local !== undefined && ts.isIdentifier(node) && node.text === local) ||
    ((ts.isPropertyAccessExpression(node) || ts.isPropertyAccessChain(node)) && node.name.text === key && ts.isIdentifier(node.expression) && holders.has(node.expression.text)),
  );
  if (own || depth >= 3 || !implementation.body) return own;
  // The prop is handed on: read the default where it lands.
  const found = new Map<string, Default>();
  const follow = (target: ts.Node, at: number) => {
    const signatures = checker.getTypeAtLocation(target).getCallSignatures();
    for (const signature of signatures) {
      const next = bindingDefault(checker, signature.getDeclaration() as ts.SignatureDeclaration | undefined, at, key, depth + 1);
      if (next) found.set(`${next.value}:${next.initializer}`, next);
    }
  };
  const isHolder = (node: ts.Node) => ts.isIdentifier(node) && holders.has(node.text);
  const isLocal = (node: ts.Node | undefined) => node !== undefined && ts.isIdentifier(node) && node.text === local;
  const visit = (node: ts.Node) => {
    if (ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) {
      const hands = node.attributes.properties.some(
        (attribute) =>
          (ts.isJsxSpreadAttribute(attribute) && isHolder(attribute.expression)) ||
          (ts.isJsxAttribute(attribute) &&
            ts.isIdentifier(attribute.name) &&
            attribute.name.text === key &&
            attribute.initializer !== undefined &&
            ts.isJsxExpression(attribute.initializer) &&
            isLocal(attribute.initializer.expression)),
      );
      if (hands) follow(node.tagName, 0);
    } else if (ts.isCallExpression(node)) {
      node.arguments.forEach((argument, at) => {
        const hands =
          isHolder(argument) ||
          (ts.isObjectLiteralExpression(argument) &&
            argument.properties.some(
              (property) =>
                (ts.isSpreadAssignment(property) && isHolder(property.expression)) ||
                (ts.isShorthandPropertyAssignment(property) && property.name.text === key && local === key) ||
                (ts.isPropertyAssignment(property) && ts.isIdentifier(property.name) && property.name.text === key && isLocal(property.initializer)),
            ));
        if (hands) follow(node.expression, at);
      });
    }
    ts.forEachChild(node, visit);
  };
  visit(implementation.body);
  return found.size === 1 ? [...found.values()][0] : undefined;
}

/** The literal default the code gives parameter `index`, as its initializer or after `name ?? …` in the body. */
function paramDefault(checker: ts.TypeChecker, declaration: ts.SignatureDeclaration | undefined, index: number): Default | undefined {
  const implementation = implementationOf(declaration);
  const param = implementation?.parameters[index];
  if (!implementation || !param) return undefined;
  if (param.initializer) return initializerDefault(checker, param.initializer);
  const name = param.name;
  return ts.isIdentifier(name) ? coalesceDefault(checker, implementation, (left) => ts.isIdentifier(left) && left.text === name.text) : undefined;
}

/** The one literal the body puts after `name ?? …`, such as `type ?? 'button'`; undefined when there is none or more than one. */
function coalesceDefault(checker: ts.TypeChecker, implementation: ts.FunctionLikeDeclaration, matches: (left: ts.Expression) => boolean): Default | undefined {
  const values = new Set<string | undefined>();
  const visit = (node: ts.Node) => {
    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken &&
      matches(node.left)
    ) {
      values.add(literalValue(checker, node.right));
    }
    ts.forEachChild(node, visit);
  };
  if (implementation.body) visit(implementation.body);
  const [only] = values;
  return values.size === 1 && only !== undefined ? { value: only, initializer: false } : undefined;
}

function initializerDefault(checker: ts.TypeChecker, node: ts.Expression): Default | undefined {
  const value = literalValue(checker, node);
  return value === undefined ? undefined : { value, initializer: true };
}

/** The overload's implementation, which holds the parameter defaults. */
function implementationOf(declaration: ts.SignatureDeclaration | undefined): ts.FunctionLikeDeclaration | undefined {
  if (!declaration) return undefined;
  if (ts.isFunctionDeclaration(declaration) && !declaration.body && declaration.name) {
    const parent = declaration.parent;
    const name = declaration.name.text;
    const statements: readonly ts.Statement[] = ts.isSourceFile(parent) || ts.isModuleBlock(parent) || ts.isBlock(parent) ? parent.statements : [];
    return statements.find((s): s is ts.FunctionDeclaration => ts.isFunctionDeclaration(s) && s.name?.text === name && s.body !== undefined);
  }
  if (ts.isFunctionDeclaration(declaration) || ts.isArrowFunction(declaration) || ts.isFunctionExpression(declaration) || ts.isMethodDeclaration(declaration)) {
    return declaration;
  }
  return undefined;
}

/** A literal, or a name the checker reads as one, such as a `const` set to `"primary"`, as JSON; undefined for anything else. */
function literalValue(checker: ts.TypeChecker, node: ts.Expression): string | undefined {
  const text = literalText(node);
  if (text !== undefined || !(ts.isIdentifier(node) || ts.isPropertyAccessExpression(node))) return text;
  // A const such as `DEFAULT_AS: TextAs = 'p'` whose declared type is wider than its value.
  const declaration = checker.getSymbolAtLocation(ts.isPropertyAccessExpression(node) ? node.name : node)?.valueDeclaration;
  if (
    declaration &&
    ts.isVariableDeclaration(declaration) &&
    declaration.initializer &&
    ts.isVariableDeclarationList(declaration.parent) &&
    declaration.parent.flags & ts.NodeFlags.Const
  ) {
    const written = literalText(declaration.initializer);
    if (written !== undefined) return written;
  }
  const type = checker.getTypeAtLocation(node);
  if (type.isStringLiteral() || type.isNumberLiteral()) return JSON.stringify(type.value);
  if (type.flags & ts.TypeFlags.BooleanLiteral) return checker.typeToString(type);
  if (type.flags & ts.TypeFlags.Null) return 'null';
  return undefined;
}

/** A literal written out, as JSON, such as `"primary"`, `false` or `300`; undefined for anything else. */
function literalText(node: ts.Expression): string | undefined {
  while (ts.isAsExpression(node) || ts.isSatisfiesExpression(node) || ts.isParenthesizedExpression(node)) node = node.expression;
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return JSON.stringify(node.text);
  if (ts.isNumericLiteral(node)) return JSON.stringify(Number(node.text));
  if (ts.isPrefixUnaryExpression(node) && node.operator === ts.SyntaxKind.MinusToken && ts.isNumericLiteral(node.operand)) {
    return JSON.stringify(-Number(node.operand.text));
  }
  if (node.kind === ts.SyntaxKind.TrueKeyword) return 'true';
  if (node.kind === ts.SyntaxKind.FalseKeyword) return 'false';
  if (node.kind === ts.SyntaxKind.NullKeyword) return 'null';
  return undefined;
}

function literalTypeOf(checker: ts.TypeChecker, json: string): ts.Type | undefined {
  const value: unknown = JSON.parse(json);
  if (typeof value === 'string') return checker.getStringLiteralType(value);
  if (typeof value === 'number') return checker.getNumberLiteralType(value);
  if (typeof value === 'boolean') return value ? checker.getTrueType() : checker.getFalseType();
  if (value === null) return checker.getNullType();
  return undefined;
}

/** A meta default that is a plain literal, as JSON; undefined for prose such as "tooltip.delay.show (300ms)". */
function parseLiteral(text: string | undefined): string | undefined {
  if (text === undefined) return undefined;
  const normalized = /^'[^'"\\]*'$/.test(text) ? `"${text.slice(1, -1)}"` : text;
  try {
    const value: unknown = JSON.parse(normalized);
    return value === null || ['string', 'number', 'boolean'].includes(typeof value) ? JSON.stringify(value) : undefined;
  } catch {
    return undefined;
  }
}
