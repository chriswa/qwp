import chalk from "chalk"
import { printPositionInSource } from "../cliUtil"
import { TestResult, TestResultKind } from "./results"

export function reportSuccessfulTest(path: string) {
  console.log(chalk.green(` ✓ ${path}`));
}

export function reportFailedTest(path: string, source: string, expectedResult: TestResult, actualResult: TestResult) {
  console.log(chalk.red(` X ${path}`));
  console.log();
  console.log(chalk.white(drawBox(`Expected: ${TestResultKind[expectedResult.kind]}`)));
  console.log(chalk.white(`${expectedResult.detail}`));
  console.log(chalk.red(drawBox(`Actual: ${TestResultKind[actualResult.kind]}`)));
  console.log(chalk.red(actualResult.detail));
  if (actualResult.errorWithSourcePos !== undefined) {
    printPositionInSource(actualResult.errorWithSourcePos.path, source, actualResult.errorWithSourcePos.charPos);
  }
}

export function printFailedTestHeader(path: string, reason: string) {
  console.log(chalk.redBright(drawBox(`TEST FAILED: ${path} : ${reason}`)));
}

export function printTestsRunnerHeader() {
  console.log(chalk.blueBright(drawBox(`Running tests...`)));
}

export function printTestsRunnerSuccess(completedTests: number, skippedTests: number) {
  console.log(chalk.greenBright(drawBox(`${completedTests} test(s) completed successfully`)));
  if (skippedTests > 0) {
  console.log(chalk.yellowBright(drawBox(`WARNING: ${skippedTests} test(s) SKIPPED`)));
  }
}

export function drawBox(title: string) {
  return `╔${"═".repeat(80)}╗\n` + `║ ${title}${" ".repeat(78 - title.length)} ║\n` + `╚${"═".repeat(80)}╝`;
}
