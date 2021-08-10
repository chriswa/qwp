import fs from "fs"
import { ByteBuffer } from "../bytecode/ByteBuffer"
import { generateBytecode } from "../compiler/bytecodeGenerator/bytecodeGenerator"
import { decompileOneInstruction, dumpDecompile } from "../bytecode/decompiler"
import { VM } from "../vm/VM"
import { getPositionInSource, printPositionInSource } from "../errorReporting"
import { parse } from "../compiler/parser/parser"
import { ErrorWithSourcePos } from "../ErrorWithSourcePos"
import { testExpectedKindStringToEnum, TestResult, TestResultKind } from "./results"
import { printFailedTestHeader, printTestsRunnerHeader, printTestsRunnerSuccess, reportFailedTest, reportSuccessfulTest } from "./reporting"
import { setBuiltinPrintFunction } from "../builtins/builtins"
import { CompileError } from "../compiler/CompileError"

const VM_DEBUG = false;

var myArgs = process.argv.slice(2);

const userSpecifiedTestFile = myArgs.shift();
function isTestFileSpecified(candidateFilename: string) {
  const basename = candidateFilename.replace(/\.\w+$/, '');
  return userSpecifiedTestFile === basename || userSpecifiedTestFile === undefined;
}

printTestsRunnerHeader();

let completedTestCount = 0;
let skippedTestCount = 0;
fs.readdirSync("tests/").forEach((filename) => {
  if (!isTestFileSpecified(filename)) {
    skippedTestCount += 1;
    return;
  }
  const path = "tests/" + filename;
  if (fs.lstatSync(path).isFile()) {
    try {
      const wasSuccessful = performTest(path);
      if (!wasSuccessful) {
        process.exit(1);
      }
      completedTestCount += 1;
    }
    catch (error) {
      printFailedTestHeader(path, "Internal error performing test!");
      console.log(error);
      process.exit(1);
    }
  }
});
printTestsRunnerSuccess(completedTestCount, skippedTestCount);
process.exit(0); // success!

function performTest(path: string): boolean {
  const source = fs.readFileSync(path, "utf8");
  const expectedResult = getExpectedResultFromSource(source);
  const actualResult = runSource(path, source);
  if (!actualResult.matchesDetail(expectedResult)) {
    reportFailedTest(path, source, expectedResult, actualResult);
    return false;
  }
  else {
    reportSuccessfulTest(path);
    return true;
  }
}

function runSource(path: string, source: string): TestResult {
  // const parserResponse = parse(source, path);
  // if (parserResponse.kind === "SYNTAX_ERROR") {
  //   const firstError = parserResponse.syntaxErrors[0];
  //   return new TestResult(TestResultKind.COMPILE_ERROR, generateErrorMessageWithLineNumber(path, source, firstError) + "\n", firstError);
  // }
  // // parserResponse.resolverOutput.varDeclarationsByBlockOrFunctionNode.forEach((resolverScopeOutput, node) => {
  // //   printPositionInSource(path, source, node.referenceToken.charPos)
  // //   for (const identifier in resolverScopeOutput.table) {
  // //     const resolverVariableDetails = resolverScopeOutput.table[identifier]
  // //     console.log(`  ${identifier}: ${resolverVariableDetails.toString()}`)
  // //   }
  // // });
  // const constantBuffer = compile(parserResponse.topSyntaxNode, parserResponse.resolverOutput);
  let constantBuffer: ByteBuffer;
  try {
    constantBuffer = generateBytecode(source, path)
  }
  catch (err) {
    if (err instanceof CompileError) {
      const errOutput = err.errorsWithSourcePos.map((errorWithSourcePos) => generateErrorMessageWithLineNumber(path, source, errorWithSourcePos)).join("\n") + "\n";
      return new TestResult(TestResultKind.COMPILE_ERROR, errOutput, err.errorsWithSourcePos);
    }
    else {
      throw err
    }
  }

  // dumpDecompile(constantBuffer);

  let output = '';
  setBuiltinPrintFunction((str: string) => {
    output += str + "\n";
  });

  if (VM_DEBUG) { console.log(`VM START`) }
  const vm = new VM(constantBuffer, 1024);
  while (!vm.isHalted) {
    // if (VM_DEBUG) {
    //   console.log(`---`)
    //   let stackView = ''
    //   const stackLength = vm.ramBuffer.byteCursor / 4
    //   for (let i = 0; i < stackLength; i += 1) {
    //     const bytePos = 4 * i
    //     if (i > 0) { stackView += ', ' }
    //     if (i === vm.callFrameIndex) { stackView += '[ ' }
    //     stackView += `${vm.ramBuffer.peekUint32At(bytePos)}`
    //   }
    //   console.log(`STACK: ${stackView}`)
    //   decompileOneInstructionAndRewind(vm.constantBuffer)
    // }
    vm.runOneInstruction();
  }
  // if (VM_DEBUG) {
  //   console.log(`---`)
  //   console.log(`VM HALTED`)
  // }
  return new TestResult(TestResultKind.COMPLETION, output, undefined);
}

function generateErrorMessageWithLineNumber(path: string, source: string, errorWithSourcePos: ErrorWithSourcePos) {
  const { row, col } = getPositionInSource(path, source, errorWithSourcePos.charPos);
  return `${errorWithSourcePos.message} at line ${row}, col ${col}`;
}

function getExpectedResultFromSource(source: string): TestResult {
  const matches = source.match(/\/\*\nEXPECT (COMPILE ERROR|RUNTIME ERROR|COMPLETION)\n((?:(?!\*\/).+))\*\//ms);
  if (matches === null) { throw new Error(`test source did not have valid "EXPECTED" comment block: regex fail`) }
  // const kind = TestResultKind[matches[1].replace(' ', '_') as keyof typeof TestResultKind];
  const kind = testExpectedKindStringToEnum[matches[1]];
  if (kind === undefined) { throw new Error(`test source did not have valid "EXPECTED" comment block: unknown kind`) }
  const detail = matches[2];
  return new TestResult(kind, detail, undefined);
}

function decompileOneInstructionAndRewind(byteBuffer: ByteBuffer) {
  const origByteCursor = byteBuffer.byteCursor;
  decompileOneInstruction(byteBuffer, []);
  byteBuffer.setByteCursor(origByteCursor);
}


