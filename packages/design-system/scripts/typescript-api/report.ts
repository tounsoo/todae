import { existsSync, readFileSync } from 'node:fs';
import { basename, join, relative, resolve, sep } from 'node:path';
import ts from 'typescript';

/** One public export, or one member of it, and its rendered type. */
export type ApiEntry = { entry: string; path: string; text: string };

const FLAGS =
  ts.TypeFormatFlags.NoTruncation |
  ts.TypeFormatFlags.UseSingleQuotesForStringLiteralType |
  ts.TypeFormatFlags.WriteArrowStyleSignature |
  ts.TypeFormatFlags.UseAliasDefinedOutsideCurrentScope;

const NODE_FLAGS =
  ts.NodeBuilderFlags.NoTruncation |
  ts.NodeBuilderFlags.UseSingleQuotesForStringLiteralType |
  ts.NodeBuilderFlags.UseAliasDefinedOutsideCurrentScope |
  ts.NodeBuilderFlags.IgnoreErrors;

const PRINTER = ts.createPrinter({ removeComments: true, newLine: ts.NewLineKind.LineFeed });

const SET_THRESHOLD = 12;

const SCRATCH = ts.createSourceFile('api.ts', '', ts.ScriptTarget.Latest);

function oneLine(text: string): string {
  return text.replace(/\s*\n\s*/g, ' ');
}

function print(node: ts.Node): string {
  return oneLine(PRINTER.printNode(ts.EmitHint.Unspecified, node, SCRATCH));
}

function renameParameters(parameters: ts.NodeArray<ts.ParameterDeclaration>): ts.NodeArray<ts.ParameterDeclaration> {
  return ts.factory.createNodeArray(
    parameters.map((parameter, index) =>
      ts.factory.updateParameterDeclaration(
        parameter,
        parameter.modifiers,
        parameter.dotDotDotToken,
        ts.factory.createIdentifier(`arg${index}`),
        parameter.questionToken,
        parameter.type,
        undefined,
      ),
    ),
  );
}

/**
 * The checker orders union members by when it first met each type, which depends on the
 * rest of the program. Sorting them by text keeps an unrelated change from reordering a union.
 * Parameter names of every function type become `arg0`, `arg1`, so renaming a callback's parameter changes nothing.
 */
function sortUnions<T extends ts.Node>(node: T): T {
  const result = ts.transform(node, [
    (context) => {
      const visit = (child: ts.Node): ts.Node => {
        const visited = ts.visitEachChild(child, visit, context);
        if (ts.isFunctionTypeNode(visited)) {
          return ts.factory.updateFunctionTypeNode(visited, visited.typeParameters, renameParameters(visited.parameters), visited.type);
        }
        if (ts.isConstructorTypeNode(visited)) {
          return ts.factory.updateConstructorTypeNode(visited, visited.modifiers, visited.typeParameters, renameParameters(visited.parameters), visited.type);
        }
        if (ts.isMethodSignature(visited)) {
          return ts.factory.updateMethodSignature(visited, visited.modifiers, visited.name, visited.questionToken, visited.typeParameters, renameParameters(visited.parameters), visited.type);
        }
        if (ts.isCallSignatureDeclaration(visited)) {
          return ts.factory.updateCallSignature(visited, visited.typeParameters, renameParameters(visited.parameters), visited.type);
        }
        if (ts.isConstructSignatureDeclaration(visited)) {
          return ts.factory.updateConstructSignature(visited, visited.typeParameters, renameParameters(visited.parameters), visited.type);
        }
        if (!ts.isUnionTypeNode(visited)) return visited;
        const sorted = [...visited.types].sort((a, b) => byCodePoint(print(a), print(b)));
        return ts.factory.updateUnionTypeNode(visited, ts.factory.createNodeArray(sorted));
      };
      return (root) => visit(root) as T;
    },
  ]);
  const [transformed] = result.transformed;
  result.dispose();
  if (transformed === undefined) throw new Error('Could not normalize a type.');
  return transformed;
}

const CONFIGS = ['tsconfig.build.json', 'tsconfig.scripts.json'];


function byCodePoint(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** `exports` subpaths that publish types, mapped to the `.d.ts` file they name. */
export function typedEntries(packageJson: unknown): Map<string, string> {
  const entries = new Map<string, string>();
  const exportsField = (packageJson as { exports?: Record<string, unknown> }).exports ?? {};
  for (const [subpath, target] of Object.entries(exportsField)) {
    if (typeof target !== 'object' || target === null) continue;
    const types = (target as { types?: unknown }).types;
    if (typeof types === 'string') entries.set(subpath, types);
  }
  return entries;
}

function parseConfig(root: string, name: string): ts.ParsedCommandLine {
  const parsed = ts.getParsedCommandLineOfConfigFile(join(root, name), {}, {
    ...ts.sys,
    onUnRecoverableConfigFileDiagnostic: (diagnostic) => {
      throw new Error(ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'));
    },
  });
  if (!parsed) throw new Error(`Could not read ${name}.`);
  return parsed;
}

function isExternal(declaration: ts.Declaration): boolean {
  const file = declaration.getSourceFile();
  return file.isDeclarationFile && file.fileName.includes(`${sep}node_modules${sep}`) || file.hasNoDefaultLib;
}

function isNamedType(symbol: ts.Symbol): boolean {
  return (symbol.flags & (ts.SymbolFlags.TypeAlias | ts.SymbolFlags.Interface | ts.SymbolFlags.Enum | ts.SymbolFlags.Class)) !== 0;
}

class Renderer {
  readonly entries: ApiEntry[] = [];
  private readonly checker: ts.TypeChecker;
  private readonly entry: string;
  /** Named types declared in the package that a printed type refers to. */
  private readonly reached = new Set<ts.Symbol>();
  constructor(checker: ts.TypeChecker, entry: string) {
    this.checker = checker;
    this.entry = entry;
  }

  /**
   * Prints each named type the entry's API refers to but doesn't export, as `internal <Name>`,
   * so a change inside it is a change to the API that uses it.
   */
  internalTypes(exported: ReadonlySet<ts.Symbol>): void {
    const done = new Set<ts.Symbol>(exported);
    const names = new Map<string, ts.Symbol>();
    for (;;) {
      const next = [...this.reached].filter((symbol) => !done.has(symbol)).sort((a, b) => byCodePoint(a.name, b.name))[0];
      if (next === undefined) return;
      done.add(next);
      const declaration = next.declarations?.[0];
      if (!declaration) continue;
      const taken = names.get(next.name);
      const name = taken === undefined ? next.name : `${next.name}@${basename(declaration.getSourceFile().fileName)}`;
      names.set(next.name, taken ?? next);
      this.exportType(name, next, declaration, 'internal');
    }
  }

  /**
   * Notes each package type a printed type names. The node builder tags the identifiers it
   * creates with their symbol; an identifier it reuses from the source resolves through the checker.
   */
  private collect(node: ts.Node): void {
    const visit = (child: ts.Node): void => {
      if (ts.isIdentifier(child)) {
        const tagged = (child as ts.Identifier & { symbol?: ts.Symbol }).symbol;
        const original = ts.getOriginalNode(child);
        let symbol = tagged ?? (original.pos >= 0 ? this.checker.getSymbolAtLocation(original) : undefined);
        if (symbol && symbol.flags & ts.SymbolFlags.Alias) symbol = this.checker.getAliasedSymbol(symbol);
        if (symbol && isNamedType(symbol) && !(symbol.declarations ?? []).every(isExternal)) this.reached.add(symbol);
      }
      ts.forEachChild(child, visit);
    };
    visit(node);
  }

  /** While an exported generic type is listed, its type parameter names and the `T0`, `T1` they print as. */
  private parameterNames: Map<string, string> | null = null;

  private add(path: string, text: string): void {
    const names = this.parameterNames;
    if (names === null || names.size === 0) {
      this.entries.push({ entry: this.entry, path, text });
      return;
    }
    const pattern = new RegExp(`(?<![\\w$])(${[...names.keys()].join('|')})(?![\\w$])`, 'g');
    const rename = (value: string) => value.replace(pattern, (name) => names.get(name) ?? name);
    // Member names stay; only a type in an `extends`, union or tuple tail is renamed.
    this.entries.push({ entry: this.entry, path: path.replace(/ (?:extends|\||has) .*$/, rename), text: rename(text) });
  }

  private typeText(type: ts.Type, node?: ts.Node, flags = NODE_FLAGS): string {
    const built = this.checker.typeToTypeNode(type, node, flags);
    if (!built) return this.checker.typeToString(type, node, FLAGS);
    this.collect(built);
    return print(sortUnions(built));
  }

  private declaredText(type: ts.Type, node: ts.Node): string {
    return this.typeText(type, node, NODE_FLAGS | ts.NodeBuilderFlags.InTypeAlias);
  }

  exportSymbol(name: string, symbol: ts.Symbol): void {
    const target = symbol.flags & ts.SymbolFlags.Alias ? this.checker.getAliasedSymbol(symbol) : symbol;
    const declaration = target.declarations?.[0];
    if (!declaration) {
      this.add(name, 'unknown');
      return;
    }
    if (target.flags & (ts.SymbolFlags.TypeAlias | ts.SymbolFlags.Interface)) this.exportType(name, target, declaration);
    if (target.flags & ts.SymbolFlags.Value) this.exportValue(name, target, declaration);
  }

  /**
   * A generic type's parameters as `T0 extends string = string`, numbered rather than named, with
   * their constraints and defaults printed by the checker so a reordered union reads the same.
   */
  private typeParameters(declaration: ts.Declaration): { names: Map<string, string>; text: string } {
    const params = ts.getEffectiveTypeParameterDeclarations(declaration as ts.DeclarationWithTypeParameters);
    const names = new Map(params.map((param, index) => [param.name.text, `T${index}`]));
    const text = params.map((param, index) => {
      const constraint = param.constraint ? ` extends ${this.typeText(this.checker.getTypeAtLocation(param.constraint), param)}` : '';
      const fallback = param.default ? ` = ${this.typeText(this.checker.getTypeAtLocation(param.default), param)}` : '';
      return `T${index}${constraint}${fallback}`;
    });
    return { names, text: text.length === 0 ? '' : `<${text.join(', ')}>` };
  }

  private exportType(name: string, symbol: ts.Symbol, declaration: ts.Declaration, kind: 'type' | 'internal' = 'type'): void {
    const type = this.checker.getDeclaredTypeOfSymbol(symbol);
    const head = `${kind} ${name}`;
    const parameters = this.typeParameters(declaration);
    this.parameterNames = parameters.names;
    try {
      if (parameters.text !== '') this.add(`${head}<>`, parameters.text);
      if (this.isObjectish(type)) {
        this.add(head, 'object');
        this.members(head, type, declaration);
      } else {
        this.addType(head, type, declaration, this.declaredText(type, declaration));
      }
    } finally {
      this.parameterNames = null;
    }
  }

  private exportValue(name: string, symbol: ts.Symbol, declaration: ts.Declaration): void {
    const type = this.checker.getTypeOfSymbolAtLocation(symbol, declaration);
    const own = this.ownProperties(type);
    if (own.length > 0 && type.getCallSignatures().length === 0) {
      this.add(name, 'object');
      for (const property of own) {
        const decl = property.valueDeclaration ?? property.declarations?.[0] ?? declaration;
        this.value(`${name}.${this.propertyName(property)}`, this.checker.getTypeOfSymbolAtLocation(property, decl), decl);
      }
      return;
    }
    this.value(name, type, declaration);
  }

  /** A function declared in todae prints as its signatures, with parameter names left out. */
  private value(path: string, type: ts.Type, node: ts.Node): void {
    const signatures = type.getCallSignatures();
    const isFunction = signatures.length > 0 && (type.symbol?.flags ?? 0) & (ts.SymbolFlags.Function | ts.SymbolFlags.Method);
    if (!isFunction) {
      this.addType(path, type, node);
      return;
    }
    this.add(path, signatures.map((signature) => this.signatureText(signature, node)).join(' & '));
  }

  private signatureText(signature: ts.Signature, node: ts.Node): string {
    const built = this.checker.signatureToSignatureDeclaration(signature, ts.SyntaxKind.FunctionType, node, NODE_FLAGS);
    if (!built || !ts.isFunctionTypeNode(built)) return this.checker.signatureToString(signature, node, FLAGS);
    this.collect(built);
    const text = print(sortUnions(built));
    const names = (built.typeParameters ?? []).map((parameter) => parameter.name.text);
    if (names.length === 0) return text;
    const numbered = new Map(names.map((name, index) => [name, `T${index}`]));
    return text.replace(new RegExp(`(?<![\\w$])(${names.join('|')})(?![\\w$])`, 'g'), (name) => numbered.get(name) ?? name);
  }

  /** A long union of literals, or a long tuple, lists one member per line so a removed member is its own entry. */
  private addType(path: string, type: ts.Type, node: ts.Node, text = this.typeText(type, node)): void {
    const members = this.literalSet(type);
    if (members === null) {
      this.add(path, text);
      return;
    }
    this.add(path, members.kind);
    for (const member of members.items) this.add(`${path} ${members.kind === 'union' ? '|' : 'has'} ${member}`, 'member');
  }

  private literalSet(type: ts.Type): { kind: 'union' | 'tuple'; items: string[] } | null {
    let parts: readonly ts.Type[] | null = null;
    let kind: 'union' | 'tuple' = 'union';
    if (type.isUnion()) parts = type.types;
    else if (this.checker.isTupleType(type)) {
      parts = this.checker.getTypeArguments(type as ts.TypeReference);
      kind = 'tuple';
    }
    if (parts === null || parts.length < SET_THRESHOLD || !parts.every((part) => part.isLiteral())) return null;
    return { kind, items: [...new Set(parts.map((part) => this.typeText(part)))].sort(byCodePoint) };
  }

  private isObjectish(type: ts.Type): boolean {
    if (type.isIntersection()) return type.types.every((part) => this.isObjectish(part));
    if (this.checker.isArrayType(type) || this.checker.isTupleType(type)) return false;
    return (type.flags & ts.TypeFlags.Object) !== 0 && type.getCallSignatures().length === 0;
  }

  private ownProperties(type: ts.Type): ts.Symbol[] {
    return this.checker
      .getPropertiesOfType(type)
      .filter((property) => !(property.declarations ?? []).every(isExternal))
      .sort((a, b) => byCodePoint(a.name, b.name));
  }

  /** A unique symbol key prints as `[name]`, since its escaped name carries a number that changes between runs. */
  private propertyName(property: ts.Symbol): string {
    return property.escapedName.toString().startsWith('__@') ? this.checker.symbolToString(property) : property.name;
  }

  private members(prefix: string, type: ts.Type, declaration: ts.Declaration): void {
    const inherited = new Map<ts.Symbol, Map<string, { property: ts.Symbol; decl: ts.Declaration }>>();
    for (const property of this.checker.getPropertiesOfType(type)) {
      const declarations = property.declarations ?? [];
      if (declarations.length > 0 && declarations.every(isExternal)) {
        for (const decl of declarations) {
          const owner = decl.parent;
          const ownerSymbol = ts.isInterfaceDeclaration(owner) ? this.checker.getSymbolAtLocation(owner.name) : undefined;
          if (!ownerSymbol) continue;
          const present = inherited.get(ownerSymbol) ?? new Map<string, { property: ts.Symbol; decl: ts.Declaration }>();
          present.set(property.name, { property, decl });
          inherited.set(ownerSymbol, present);
        }
        continue;
      }
      const optional = property.flags & ts.SymbolFlags.Optional ? '?' : '';
      const decl = property.valueDeclaration ?? declarations[0] ?? declaration;
      const readonly = decl && ts.getCombinedModifierFlags(decl) & ts.ModifierFlags.Readonly ? 'readonly ' : '';
      const propType = this.checker.getTypeOfSymbolAtLocation(property, declaration);
      this.addType(`${prefix}.${this.propertyName(property)}${optional}`, propType, declaration, `${readonly}${this.typeText(propType, declaration)}`);
    }
    const owners = [...inherited.entries()].map(([owner, present]) => ({ owner, present, name: this.ownerName(owner, present, declaration) }));
    for (const { owner, present, name } of owners.sort((a, b) => byCodePoint(a.name, b.name))) {
      const missing: string[] = [];
      owner.members?.forEach((member) => {
        if (member.flags & ts.SymbolFlags.Property && !present.has(member.name)) missing.push(member.name);
      });
      missing.sort(byCodePoint);
      this.add(`${prefix} extends ${name}`, missing.length === 0 ? 'all' : `except ${missing.join(', ')}`);
    }
  }

  /**
   * The inherited interface with the type arguments its props were given, such as
   * `DOMAttributes<HTMLDivElement>`, so a change of element shows. Each argument is read off the first
   * prop whose declared type uses that parameter, by matching the printed prop type against its declaration.
   * An interface whose props don't use a parameter is named without arguments, since the argument changes nothing.
   */
  private ownerName(owner: ts.Symbol, present: Map<string, { property: ts.Symbol; decl: ts.Declaration }>, at: ts.Node): string {
    const declaration = owner.declarations?.find(ts.isInterfaceDeclaration);
    const parameters = declaration?.typeParameters?.map((parameter) => parameter.name.text) ?? [];
    if (parameters.length === 0) return owner.name;
    const found = new Map<string, string>();
    for (const { property, decl } of [...present.values()].sort((a, b) => byCodePoint(a.property.name, b.property.name))) {
      if (found.size === parameters.length) break;
      const typeNode = (decl as ts.PropertySignature).type;
      if (!typeNode) continue;
      const declared = oneLine(typeNode.getText());
      const used = parameters.filter((name) => !found.has(name) && new RegExp(`(?<![\\w$])${name}(?![\\w$])`).test(declared));
      if (used.length === 0) continue;
      const printed = this.checker.typeToString(this.checker.getTypeOfSymbolAtLocation(property, at), undefined, FLAGS);
      const groups: string[] = [];
      const pattern = declared
        .split(new RegExp(`(?<![\\w$])(${parameters.join('|')})(?![\\w$])`))
        .map((part, index) => {
          if (index % 2 === 0) return part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const seen = groups.indexOf(part);
          if (seen >= 0) return `\\k<p${seen}>`;
          groups.push(part);
          return `(?<p${groups.length - 1}>.+?)`;
        })
        .join('');
      const match = new RegExp(`^${pattern}$`).exec(printed);
      if (!match?.groups) continue;
      groups.forEach((name, index) => {
        const value = match.groups?.[`p${index}`];
        if (value !== undefined && !found.has(name)) found.set(name, value);
      });
    }
    if (found.size === 0) return owner.name;
    return `${owner.name}<${parameters.map((name) => found.get(name) ?? name).join(', ')}>`;
  }
}

export function apiReport(packageRoot: string): ApiEntry[] {
  const root = resolve(packageRoot);
  const packageJson = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as { name: string };
  const wanted = new Map<string, string>();
  for (const [subpath, types] of typedEntries(packageJson)) wanted.set(resolve(root, types), subpath);
  const entries: ApiEntry[] = [];
  const found = new Set<string>();
  for (const config of CONFIGS) {
    if (!existsSync(join(root, config))) continue;
    const parsed = parseConfig(root, config);
    const sources = new Map<string, string>();
    for (const file of parsed.fileNames) {
      for (const output of ts.getOutputFileNames(parsed, file, false)) {
        const subpath = wanted.get(resolve(output));
        if (subpath !== undefined) sources.set(resolve(file), subpath);
      }
    }
    if (sources.size === 0) continue;
    const program = ts.createProgram({ rootNames: [...sources.keys()], options: parsed.options });
    const checker = program.getTypeChecker();
    for (const [file, subpath] of sources) {
      const source = program.getSourceFile(file);
      const module = source && checker.getSymbolAtLocation(source);
      if (!module) throw new Error(`${relative(root, file)} has no exports.`);
      const renderer = new Renderer(checker, subpath === '.' ? packageJson.name : `${packageJson.name}/${subpath.slice(2)}`);
      const exported = new Set<ts.Symbol>();
      for (const symbol of checker.getExportsOfModule(module)) {
        renderer.exportSymbol(symbol.name, symbol);
        exported.add(symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol);
      }
      renderer.internalTypes(exported);
      entries.push(...renderer.entries);
      found.add(subpath);
    }
  }
  for (const subpath of wanted.values()) {
    if (!found.has(subpath)) throw new Error(`No source file declares the types of "${subpath}".`);
  }
  return entries.sort((a, b) => byCodePoint(a.entry, b.entry) || byCodePoint(a.path, b.path));
}
