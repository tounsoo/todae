// Checks every hand-written prop in src/**/*.meta.ts against the TypeScript
// type of the export it describes: the prop must exist, `required` must match,
// the `type` string must name the same type, and a literal `default` must match
// a literal default in the code. `src/metaTypes.test.ts` runs it.
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
      lines.push(`  export type ${alias} = ${prop.type.replace(ELLIPSIS, '').replace(/\s+/g, ' ')};`);
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
      const partial = ELLIPSIS.test(prop.type);
      const covers = partial || present.every((f) => defined(f.type).every((part) => checker.isTypeAssignableTo(part, declared)));
      const allowed = defined(declared).every((part) => present.some((f) => checker.isTypeAssignableTo(part, f.type)));
      if (!covers || !allowed) {
        const actual = present.map((f) => checker.typeToString(f.type, undefined, ts.TypeFormatFlags.NoTruncation));
        report(`${where}: type is "${prop.type}", TypeScript has "${[...new Set(actual)].join('" or "')}"`);
      }
      const literal = parseLiteral(prop.default);
      const code = present.map((f) => f.default).find((d) => d !== undefined);
      if (code !== undefined && literal !== undefined && code !== literal) {
        report(`${where}: default is ${prop.default}, the code defaults to ${code}`);
      }
      if (code !== undefined && prop.default === undefined) {
        report(`${where}: has no default, the code defaults to ${code}`);
      }
    }
  }
  return problems;
}

type Shape = { params: readonly ts.Symbol[]; first: ts.Type | undefined; declaration: ts.SignatureDeclaration | undefined };
type Found = { type: ts.Type; optional: boolean; default: string | undefined };

function shapesOf(checker: ts.TypeChecker, fnType: ts.Type, at: ts.Node): Shape[] {
  let signatures = fnType.getCallSignatures();
  // A hook that takes nothing and returns a function is described by that function.
  if (signatures.length > 0 && signatures.every((s) => s.getParameters().length === 0)) {
    const returned = signatures.flatMap((s) => s.getReturnType().getCallSignatures());
    if (returned.length > 0) signatures = returned;
  }
  return signatures.flatMap((signature): Shape[] => {
    const params = signature.getParameters();
    const declaration = signature.getDeclaration() as ts.SignatureDeclaration | undefined;
    const firstParam = params[0];
    if (!firstParam) return [{ params, first: undefined, declaration }];
    const firstType = checker.getTypeOfSymbolAtLocation(firstParam, at);
    return defined(firstType).map((first) => ({ params, first, declaration }));
  });
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
    if (tail.length === 0) found.default = bindingDefault(shape.declaration, 0, head!);
  } else {
    const index = shape.params.findIndex((p) => p.name === head);
    const param = shape.params[index];
    const declaration = param?.valueDeclaration;
    if (!param || !declaration || !ts.isParameter(declaration) || rest !== (declaration.dotDotDotToken !== undefined)) return undefined;
    found = {
      type: checker.getTypeOfSymbolAtLocation(param, at),
      optional: rest || checker.isOptionalParameter(declaration),
      default: declaration.initializer ? literalText(declaration.initializer) : undefined,
    };
    if (tail.length === 1) {
      const member: ts.Symbol | undefined = defined(found.type).map((t) => t.getProperty(tail[0]!)).find(Boolean);
      if (!member) return undefined;
      found = {
        type: checker.getTypeOfSymbolAtLocation(member, at),
        optional: found.optional || (member.flags & ts.SymbolFlags.Optional) !== 0,
        default: bindingDefault(shape.declaration, index, tail[0]!),
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

/** The literal default the code gives `key` of parameter `index`, in the parameter itself or a top-level `const { key = … } = param`. */
function bindingDefault(declaration: ts.SignatureDeclaration | undefined, index: number, key: string): string | undefined {
  const implementation = implementationOf(declaration);
  const param = implementation?.parameters[index];
  if (!implementation || !param) return undefined;
  const patterns: ts.ObjectBindingPattern[] = [];
  if (ts.isObjectBindingPattern(param.name)) patterns.push(param.name);
  else if (ts.isIdentifier(param.name) && implementation.body && ts.isBlock(implementation.body)) {
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
  for (const pattern of patterns) {
    for (const element of pattern.elements) {
      const property = element.propertyName ?? element.name;
      const propertyName = ts.isIdentifier(property) || ts.isStringLiteral(property) ? property.text : undefined;
      if (propertyName === key && element.initializer) return literalText(element.initializer);
    }
  }
  return undefined;
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

/** A literal as JSON, such as `"primary"`, `false` or `300`; undefined for anything else. */
function literalText(node: ts.Expression): string | undefined {
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
