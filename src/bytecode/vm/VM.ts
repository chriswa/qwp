import { ByteBuffer } from "../compiler/ByteBuffer"
import { OpCode } from "../opcodes"
import { opCodeHandlers } from "./opCodeHandlers"

/*
class LegitHeap {
  private ramWordCount: number;
  public constructor(
    public vm: VM,
  ) {
    this.ramWordCount = this.vm.ramBuffer.buffer.byteLength / 4;
    this.heapBottom = this.ramWordCount - 2;
    vm.setStackLimit(this.heapBottom);
  }
  public get heapBottom() { return this.vm.ramBuffer.peekUint32At(4 * (this.ramWordCount - 1)); }
  public set heapBottom(v) { this.vm.ramBuffer.pokeUint32At(4 * (this.ramWordCount - 1), v); }
  public get heapHoleListStart() { return this.vm.ramBuffer.peekUint32At(4 * (this.ramWordCount - 2)); }
  public set heapHoleListStart(v) { this.vm.ramBuffer.pokeUint32At(4 * (this.ramWordCount - 2), v); }
  public allocScalar32(value: number): number {
    let holeIndex = this.heapHoleListStart;
    if (holeIndex === 0) {
      this.heapBottom -= 1;
      this.vm.setStackLimit(this.heapBottom);
      holeIndex = this.heapBottom;
    }
    else {
      let lastHoleIndex: number;
      while (holeIndex !== 0) {
        lastHoleIndex = holeIndex;
        holeIndex = this.vm.ramBuffer.peekUint32At(4 * holeIndex);
      }
    }
    this.vm.ramBuffer.pokeUint32At(4 * holeIndex, value);
    return holeIndex;
  }
}
*/

class ClosureStruct {
  constructor(
    public functionIndex: number,
    public closureValueCount: number,
    public closureValues: Array<number>,
  ) { }
}

class Heap {
  private ptrMap: Map<number, unknown> = new Map();
  private nextIndex = 0xffff;
  private reusableIndexes: Array<number> = [];
  public constructor(
    public vm: VM,
  ) {
  }
  private acquireIndex() {
    if (this.reusableIndexes.length > 0) {
      return this.reusableIndexes.pop()!;
    }
    else {
      const index = this.nextIndex;
      this.nextIndex -= 1;
      return index;
    }
  }
  public allocNumber(value: number): number {
    const index = this.acquireIndex();
    this.ptrMap.set(index, value);
    return index;
  }
  public allocClosure(functionIndex: number, closureValues: Array<number>): number {
    const index = this.acquireIndex();
    this.ptrMap.set(index, new ClosureStruct(functionIndex, closureValues.length, closureValues));
    return index;
  }
  public fetchNumber(ptr: number): number {
    return this.ptrMap.get(ptr) as number;
  }
  public fetchClosure(ptr: number): ClosureStruct {
    return this.ptrMap.get(ptr) as ClosureStruct;
  }
  public assignNumber(ptr: number, value: number) {
    this.ptrMap.set(ptr, value);
  }
}

export class VM {
  public ramBuffer: ByteBuffer; // this.ramBuffer.byteCursor is our stack pointer!
  public isHalted = false;
  public callFrameIndex = 0; // for accessing locals (e.g. callFrameIndex + 0 => first function argument)
  public returnInfoOffset = 0;
  public heap: Heap;
  public constructor(
    public constantBuffer: ByteBuffer,
    ramBytesTotal: number, // includes stack and heap!
  ) {
    this.ramBuffer = new ByteBuffer(new ArrayBuffer(ramBytesTotal));
    const startConstantIndex = this.constantBuffer.peekUint32At(0);
    this.constantBuffer.setByteCursor(startConstantIndex * 4);
    this.heap = new Heap(this); // TODO: figure out how to prevent conflicts between builtin Ids and closure indexes on the heap
  }
  public setStackLimit(wordLimit: number) {
    const byteLength = 4 * wordLimit;
    if (this.ramBuffer.byteCursor > byteLength) {
      throw new Error(`Out of memory`);
    }
    this.ramBuffer.pushByteLimit = byteLength;
  }
  public runOneInstruction() {
    const opCode = this.constantBuffer.readUint8();
    const handler = opCodeHandlers[opCode];
    if (handler === undefined) {
      throw new Error(`unknown opcode ${OpCode[opCode]}`)
    }
    handler(this);
  }
}
