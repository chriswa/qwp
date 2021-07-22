import chalk from "chalk"
import fs from "fs";
import { ByteBuffer } from "./bytecode/compiler/ByteBuffer"
import { compile } from "./bytecode/compiler/compiler"
import { decompileOneInstruction, dumpDecompile } from "./bytecode/decompiler"
import { VM } from "./bytecode/vm/VM"
import { printPositionInSource } from "./cliUtil"
import { Interpreter } from "./interpreter/Interpreter"
import { parse } from "./sourcecode/parser/parser"

// var myArgs = process.argv.slice(2);
// 
// const path = myArgs.shift();
// if (path === undefined) {
//   console.log("must specify script filename as first argv");
//   process.exit(1);
// }
// const source = fs.readFileSync(path, "utf8");

const path = "sample.dog";
const source = `
const foo := 123;
// printFloat32(foo + foo);

const f := fn(a, b) {
  // return a + b;
  // return a + b + foo;
  return fn() {
    return a + b + foo;
  };
};

printFloat32(f(1, 2)());
// printFloat32(f(3, 4)());
// printFloat32(456);
`.trim() + "\n";

const parserResponse = parse(source, path);
if (parserResponse.kind === "SYNTAX_ERROR") {
  const firstSyntaxError = parserResponse.syntaxErrors[0];
  console.log(chalk.red(`PARSER ERROR: ${firstSyntaxError.message}`));
  printPositionInSource(firstSyntaxError.path, source, firstSyntaxError.charPos);
  process.exit(1);
}

console.log(`--- RESOLVER ---`)
parserResponse.resolverOutput.varDeclarationsByBlockOrFunctionNode.forEach((resolverScopeOutput, node) => {
  printPositionInSource(path, source, node.referenceToken.charPos)
  for (const identifier in resolverScopeOutput.table) {
    const resolverVariableDetails = resolverScopeOutput.table[identifier]
    console.log(`  ${identifier}: ${resolverVariableDetails.toString()}`)
  }
});

const constantBuffer = compile(parserResponse.topSyntaxNode, parserResponse.resolverOutput);
dumpDecompile(constantBuffer);

const VM_DEBUG = true;

if (VM_DEBUG) { console.log(`VM START`) }
const vm = new VM(constantBuffer, 1024);
while (!vm.isHalted) {
  if (VM_DEBUG) {
    console.log(`---`)
    let stackView = ''
    const stackLength = vm.ramBuffer.byteCursor / 4
    for (let i = 0; i < stackLength; i += 1) {
      const bytePos = 4 * i
      if (i > 0) { stackView += ', ' }
      if (i === vm.callFrameIndex) { stackView += '[ ' }
      stackView += `${vm.ramBuffer.peekUint32At(bytePos)}`
    }
    console.log(`STACK: ${stackView}`)

    decompileOneInstructionAndRewind(vm.constantBuffer)
  }
  
  vm.runOneInstruction();
}
if (VM_DEBUG) {
  console.log(`---`)
  console.log(`VM HALTED`)
}

function decompileOneInstructionAndRewind(byteBuffer: ByteBuffer) {
  const origByteCursor = byteBuffer.byteCursor;
  decompileOneInstruction(byteBuffer, []);
  byteBuffer.setByteCursor(origByteCursor);
}


