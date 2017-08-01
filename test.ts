import * as ts from 'typescript';

// Compiler options including emitDecoratorMetadata and experimentalDecorators.
const compilerOptions = {
  target: ts.ScriptTarget.ES5,
  module: ts.ModuleKind.ES2015,
  emitDecoratorMetadata: true,
  experimentalDecorators: true,
  sourceMap: false,
};

// Make a in-memory host and populate it with a single file
const fileMap = new Map<string, string>();
const sourcesMap = new Map<string, ts.SourceFile>();
const outputs = new Map<string, string>();

const host: ts.CompilerHost = {
  getSourceFile: (fileName) => sourcesMap.get(fileName),
  getDefaultLibFileName: () => 'lib.d.ts',
  getCurrentDirectory: () => ts.sys.getCurrentDirectory(),
  getDirectories: () => [],
  getCanonicalFileName: (fileName) => fileName,
  useCaseSensitiveFileNames: () => true,
  getNewLine: () => ts.sys.newLine,
  fileExists: (fileName) => fileMap.has(fileName),
  readFile: (fileName) => fileMap.has(fileName) ? fileMap.get(fileName) : '',
  writeFile: (fileName, text) => outputs.set(fileName, text),
};

fileMap.set('/file.ts', `
  function classDecorator<T extends { new(...args: any[]): {} }>(constructor: T) {
    return class extends constructor { }
  }

  class SomeClass {}

  @classDecorator
  export class AppComponent {
    constructor(test: SomeClass) { }
  }

  'change me';
`);

// Create the SourceFile
fileMap.forEach((v, k) => sourcesMap.set(
  k, ts.createSourceFile(k, v, ts.ScriptTarget.Latest)));

// Create the TS program.
const program = ts.createProgram(['/file.ts'], compilerOptions, host);
const sourceFile = program.getSourceFile('/file.ts');

// Simple transform that changes 'change me' to 'changed'.
const changeTransform = (context: ts.TransformationContext): ts.Transformer<ts.SourceFile> => {
  const transformer: ts.Transformer<ts.SourceFile> = (sf: ts.SourceFile) => {
    const visitor: ts.Visitor = (node) => {
      // Removes VariableDeclarationList nodes (like `let value = 42`).
      if (node.kind === ts.SyntaxKind.StringLiteral
        && (node as ts.StringLiteral).text === 'change me') {
        return ts.createLiteral('changed');
      }
      // Otherwise return node as is.
      return ts.visitEachChild(node, visitor, context);
    };
    return ts.visitNode(sf, visitor);
  };
  return transformer;
};

// Emit file.ts, using removeTransform.
const { emitSkipped } = program.emit(
  sourceFile, undefined, undefined, undefined, { before: [changeTransform] }
);

if (emitSkipped) {
  throw new Error(`Emit failed.`);
}

// Print the emitted file.
console.log('Emit successfull:');
console.log(outputs.get('/file.js'));