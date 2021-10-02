import fs from "fs"
import { testExpectedKindStringToEnum, TestResult, TestResultKind } from "./results"
import { printFailedTestHeader, printTestsRunnerHeader, printTestsRunnerSuccess, reportFailedTest, reportSuccessfulTest } from "./reporting"
import { setBuiltinPrintCallback } from "../builtins/builtins"
import { CompileError } from "../compiler/CompileError"
import chalk from "chalk"
import { createInterpreter, IInterpreterFacade, Interpreter } from "../interpreter/Interpreter"
import { sourceReporter } from "../sourceReporter"
import { InternalError } from "../util"

var myArgs = process.argv.slice(2);

const userSpecifiedTestFile = myArgs.shift();
function isTestFileSpecified(candidateFilename: string) {
  const basename = candidateFilename.replace(/\.\w+$/, '');
  return userSpecifiedTestFile === basename || userSpecifiedTestFile === undefined;
}

const DEBUG_MODE = userSpecifiedTestFile !== undefined;
const RUN_WITH_INTERPRETER = true;
const RUN_WITH_COMPILER_AND_VM = false;

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
    const source = fs.readFileSync(path, "utf8");
    sourceReporter.registerSource(path, source);
    try {
      const wasSuccessful = performTest(path, source);
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
    sourceReporter.unregisterSource(path);
  }
});
printTestsRunnerSuccess(completedTestCount, skippedTestCount);
process.exit(0); // success!

function performTest(path: string, source: string): boolean {
  const expectedResult = getExpectedResultFromSource(source);

  if (RUN_WITH_INTERPRETER) {
    const interpreterResult = interpretSource(path, source);
    if (!interpreterResult.matchesDetail(expectedResult)) {
      reportFailedTest('interpret', path, expectedResult, interpreterResult);
      return false;
    }
  }

  // if (RUN_WITH_COMPILER_AND_VM) {
  //   const vmResult = compileAndRunSource(path, source)
  //   if (!vmResult.matchesDetail(expectedResult)) {
  //     reportFailedTest('compile and vm', path, expectedResult, vmResult)
  //     return false
  //   }
  // }
  
  reportSuccessfulTest(path);
  return true;
}

function interpretSource(path: string, source: string): TestResult {
  let output = '';
  setBuiltinPrintCallback((str: string) => {
    output += str + "\n";
    if (DEBUG_MODE) {
      console.log(chalk.magentaBright("BUILTIN PRINT ➤➤➤ " + str));
    }
  });

  try {
    const interpreter = createInterpreter(path, source, DEBUG_MODE);
    while (!interpreter.isHalted()) {
      interpreter.runOneStep();
    }
    if (DEBUG_MODE) {
      console.log(`---`)
      console.log(`INTERPRETER HALTED`)
    }
  }
  catch (err) {
    if (err instanceof CompileError) {
      const errOutput = err.errorsWithSourcePos.map((errorWithSourcePos) => sourceReporter.generateErrorMessageWithLineNumber(path, errorWithSourcePos)).join("\n") + "\n";
      return new TestResult(TestResultKind.COMPILE_ERROR, errOutput, err.errorsWithSourcePos);
    }
    else {
      throw err;
    }
  }

  return new TestResult(TestResultKind.COMPLETION, output, undefined)
}

// function compileAndRunSource(path: string, source: string): TestResult {
//   let output = '';
//   setBuiltinPrintCallback((str: string) => {
//     output += str + "\n";
//     if (DEBUG_MODE) {
//       console.log(chalk.magentaBright("BUILTIN PRINT ➤➤➤ " + str));
//     }
//   });
// 
//   let constantBuffer: ByteBuffer;
//   try {
//     constantBuffer = generateBytecode(source, path)
//   }
//   catch (err) {
//     if (err instanceof CompileError) {
//       const errOutput = err.errorsWithSourcePos.map((errorWithSourcePos) => sourceReporter.generateErrorMessageWithLineNumber(path, errorWithSourcePos)).join("\n") + "\n";
//       return new TestResult(TestResultKind.COMPILE_ERROR, errOutput, err.errorsWithSourcePos);
//     }
//     else {
//       throw err;
//     }
//   }
// 
//   if (DEBUG_MODE) {
//     console.log(chalk.magenta(drawBox(`Decompilation of ${path}`)));
//     dumpDecompile(constantBuffer);
//   }
// 
//   if (DEBUG_MODE) {
//     console.log(chalk.cyan(drawBox("VM START")));
//   }
//   const vm = new VM(constantBuffer, 1024);
//   while (!vm.isHalted) {
//     if (DEBUG_MODE) {
//       console.log(`---`)
//       let stackView = ''
//       const stackLength = vm.ramBuffer.byteCursor / 4
//       for (let i = 0; i < stackLength; i += 1) {
//         const bytePos = 4 * i
//         if (i > 0) { stackView += ', ' }
//         if (i === vm.callFrameIndex) { stackView += '[ ' }
//         stackView += `${vm.ramBuffer.peekUint32At(bytePos)}`
//       }
//       console.log(`STACK: ${stackView}`)
//       decompileOneInstructionAndRewind(vm.constantBuffer)
//     }
//     vm.runOneInstruction();
//   }
//   if (DEBUG_MODE) {
//     console.log(`---`)
//     console.log(`VM HALTED`)
//   }
//   return new TestResult(TestResultKind.COMPLETION, output, undefined);
// }

function getExpectedResultFromSource(source: string): TestResult {
  const matches = source.match(/\/\*\nEXPECT (COMPILE ERROR|RUNTIME ERROR|COMPLETION)\n((?:(?!\*\/).+))\*\//ms);
  if (matches === null) { throw new InternalError(`test source did not have valid "EXPECTED" comment block: regex fail`) }
  // const kind = TestResultKind[matches[1].replace(' ', '_') as keyof typeof TestResultKind];
  const kind = testExpectedKindStringToEnum[matches[1]];
  if (kind === undefined) { throw new InternalError(`test source did not have valid "EXPECTED" comment block: unknown kind`) }
  const detail = matches[2];
  return new TestResult(kind, detail, undefined);
}

// function decompileOneInstructionAndRewind(byteBuffer: ByteBuffer) {
//   const origByteCursor = byteBuffer.byteCursor;
//   decompileOneInstruction(byteBuffer, []);
//   byteBuffer.setByteCursor(origByteCursor);
// }


