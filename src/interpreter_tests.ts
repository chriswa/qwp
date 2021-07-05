import fs from "fs";
import chalk from "chalk";
import { Interpreter } from "./interpreter/Interpreter";
import { parse } from "./sourcecode/parser/parser";
import { SyntaxError } from "./sourcecode/parser/SyntaxError"
import { InterpreterRuntimeError } from "./interpreter/InterpreterRuntimeError"
import { getPositionInSource, printPositionInSource } from "./cliUtil"


fs.readdirSync("tests/").forEach((filename) => {
  const path = "tests/" + filename;
  if (fs.lstatSync(path).isFile()) {
    try {
      const wasSuccessful = performTest(path);
      if (!wasSuccessful) {
        process.exit(1);
      }
    }
    catch (error) {
      printFailedTestHeader(path, "Internal error performing test!");
      console.log(error);
      return;
    }
  }
});
process.exit(0); // success!

function performTest(path: string): boolean {
  // console.log(chalk.cyan(`=== ${path} ===`));
  const testInput = loadTestFile(path);
  const { source, expectedResultType, expectedResultContent } = testInput;
  const runResult = runSource(path, source);
  if (expectedResultType === "SYNTAX_ERROR" && runResult.kind === "SYNTAX_ERROR") {
    const errorMessage = generateErrorMessageWithLineNumber(path, source, runResult.syntaxErrors[0])
    if (errorMessage === expectedResultContent.trim()) {
      reportSuccessfulTest(path, testInput);
      return true;
    }
  }
  else if (expectedResultType === "RUNTIME_ERROR" && runResult.kind === "RUNTIME_ERROR") {
    const errorMessage = generateErrorMessageWithLineNumber(path, source, runResult.runtimeError)
    if (errorMessage === expectedResultContent.trim()) {
      reportSuccessfulTest(path, testInput);
      return true;
    }
  }
  else if (expectedResultType === "OUTPUT" && runResult.kind === "COMPLETED") {
    if (runResult.output === expectedResultContent) {
      reportSuccessfulTest(path, testInput);
      return true;
    }
  }
  reportFailedTest(path, source, testInput, runResult)
  return false
}

function generateErrorMessageWithLineNumber(path: string, source: string, error: SyntaxError | InterpreterRuntimeError) {
  const { row, col } = getPositionInSource(path, source, error.charPos);
  return `${error.message} at line ${row}, col ${col}`;
}

function reportSuccessfulTest(path: string, testInput: ITestDetails) {
  console.log(chalk.green(` ✓ ${path}`));
}

function reportFailedTest(path: string, source: string, testInput: ITestDetails, runResult: RunResult) {
  console.log(chalk.red(` X ${path}`));
  console.log();
  console.log(chalk.white(drawBox(`Expecting ${testInput.expectedResultType}`)));
  if (testInput.expectedResultType === "OUTPUT") {
    console.log(chalk.white(`${testInput.expectedResultContent}`));
  }
  else {
    console.log(chalk.white(`${testInput.expectedResultContent.trim()}`));
  }
  console.log(chalk.red(drawBox(`Result ${runResult.kind}`)));
  switch (runResult.kind) {
    case "SYNTAX_ERROR":
      const firstSyntaxError = runResult.syntaxErrors[0];
      console.log(chalk.red(generateErrorMessageWithLineNumber(path, source, firstSyntaxError)));
      printPositionInSource(firstSyntaxError.path, source, firstSyntaxError.charPos);
      break;
    case "RUNTIME_ERROR":
      const runtimeError = runResult.runtimeError;
      console.log(chalk.red(generateErrorMessageWithLineNumber(path, source, runtimeError)));
      printPositionInSource(runtimeError.path, source, runtimeError.charPos);
      break;
    case "COMPLETED":
      console.log(chalk.red(`${runResult.output}`));
      break;
  }
}

interface ITestDetails {
  source: string;
  expectedResultType: string;
  expectedResultContent: string;
}
function loadTestFile(path: string): ITestDetails {
  const fileContent = fs.readFileSync(path, "utf8");
  const lastNewlinePos = fileContent.search(/\n__(SYNTAX_ERROR|RUNTIME_ERROR|OUTPUT)__\n/);
  if (lastNewlinePos === -1) {
    throw new Error(`${path}: test files must contain an end-of-source marker: one of __SYNTAX_ERROR__, __RUNTIME_ERROR__, or __OUTPUT__`);
  }
  const source = fileContent.substr(0, lastNewlinePos + 1);
  const [expectedResultType, expectedResultContent] = fileContent.substr(lastNewlinePos + 3).split(/__\n/, 2);
  return { source, expectedResultType, expectedResultContent };
}

interface ISyntaxErrorRunResult {
  kind: "SYNTAX_ERROR";
  syntaxErrors: Array<SyntaxError>;
}
interface IRuntimeErrorRunResult {
  kind: "RUNTIME_ERROR";
  runtimeError: InterpreterRuntimeError;
}
interface ICompletedRunResult {
  kind: "COMPLETED";
  output: string;
}
type RunResult = ISyntaxErrorRunResult | IRuntimeErrorRunResult | ICompletedRunResult;
function runSource(path: string, source: string): RunResult {
  const parserResponse = parse(source, path);
  if (parserResponse.syntaxErrors !== null) {
    return { kind: "SYNTAX_ERROR", syntaxErrors: parserResponse.syntaxErrors };
  }
  if (parserResponse.topSyntaxNode === null) {
    throw new Error(`Internal logic error: either topSyntaxNode or syntaxErrors should be non-null`);
  }
  const interpreter = new Interpreter();
  const runtimeError = interpreter.interpret(parserResponse.topSyntaxNode);
  if (runtimeError !== null) {
    return { kind: "RUNTIME_ERROR", runtimeError };
  }
  const output = interpreter.getOutput();
  return { kind: "COMPLETED", output };
}

function printFailedTestHeader(path: string, reason: string) {
  console.log(chalk.redBright(drawBox(`TEST FAILED: ${path} : ${reason}`)));
}
function drawBox(title: string) {
  return `╔${"═".repeat(80)}╗\n` + `║ ${title}${" ".repeat(78 - title.length)} ║\n` + `╚${"═".repeat(80)}╝`;
}
