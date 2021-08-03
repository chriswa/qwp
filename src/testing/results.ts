import { ErrorWithSourcePos } from "../ErrorWithSourcePos"

export enum TestResultKind {
  COMPILE_ERROR,
  RUNTIME_ERROR,
  COMPLETION,
}
export const testExpectedKindStringToEnum: Record<string, TestResultKind | undefined> = {
  'COMPILE ERROR': TestResultKind.COMPILE_ERROR,
  'RUNTIME ERROR': TestResultKind.RUNTIME_ERROR,
  'COMPLETION': TestResultKind.COMPLETION,
}
export class TestResult {
  constructor(
    public kind: TestResultKind,
    public detail: string,
    public errorsWithSourcePos: Array<ErrorWithSourcePos> | undefined,
  ) { }
  matchesKind(other: TestResult): boolean {
    return this.constructor === other.constructor;
  }
  matchesDetail(other: TestResult): boolean {
    return this.matchesKind(other) && this.detail === other.detail;
  }
}
