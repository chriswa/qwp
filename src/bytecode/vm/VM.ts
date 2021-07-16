import { ByteBuffer } from "../compiler/ByteBuffer"
import { OpCode } from "../opcodes"
import { opCodeHandlers } from "./opCodeHandlers"

class CallFrame {
  private stackTopRamByteIndex = 0;
  private savedInstructionPointerByteIndex: number = -1;
  public stackBuffer: ByteBuffer;
  public constructor(
    ramBuffer: ByteBuffer,
    public outerCallFrame: CallFrame | undefined,
    stackBaseRamByteIndex: number,
  ) {
    this.stackBuffer = new ByteBuffer(ramBuffer.buffer);
    this.stackBuffer.setByteCursor(stackBaseRamByteIndex);
  }
  /*
  public popUint32() {
    this.stackTopRamByteIndex -= 4;
    return this.ramBuffer.peekUint32At(this.stackTopRamByteIndex);
  }
  public pushUint32(uint32: number) {
    this.ramBuffer.pokeUint32At(this.stackTopRamByteIndex, uint32);
    this.stackTopRamByteIndex += 4;
  }
  public pushFloat(float32: number) {
    this.ramBuffer.pokeFloat32At(this.stackTopRamByteIndex, float32);
    this.stackTopRamByteIndex += 4;
  }
  public popFloat(): number {
    this.stackTopRamByteIndex -= 4;
    return this.ramBuffer.peekFloat32At(this.stackTopRamByteIndex);
  }
  public peekFloatAt(index: number): number {
    return this.ramBuffer.peekFloat32At(this.stackBaseRamByteIndex + index * 4);
  }
  public peekUint32At(index: number): number {
    return this.ramBuffer.peekUint32At(this.stackBaseRamByteIndex + index * 4);
  }
  public pokeFloatAt(index: number, value: number) {
    return this.ramBuffer.pokeFloat32At(this.stackBaseRamByteIndex + index * 4, value);
  }
  public pokeUint32At(index: number, value: number) {
    return this.ramBuffer.pokeUint32At(this.stackBaseRamByteIndex + index * 4, value);
  }
  public pushBool(value: boolean) {
    this.pushFloat(value ? 1 : 0);
  }
  public popBool(): boolean {
    const value = this.popFloat();
    if (value !== 0 && value !== 1) { throw new Error(`assertion failed: tried to do binary logic on non-binary value`) }
    return value === 1;
  }
  public peekBool(): boolean {
    const value = this.ramBuffer.peekFloat32At(this.stackTopRamByteIndex);
    if (value !== 0 && value !== 1) { throw new Error(`assertion failed: tried to do binary logic on non-binary value`) }
    return value === 1;
  }
  */
}

export class VM {
  public ramBuffer: ByteBuffer;
  public currentCallFrame: CallFrame;
  public constructor(
    public constantBuffer: ByteBuffer,
    ramBytesTotal: number, // includes stack and heap!
  ) {
    this.ramBuffer = new ByteBuffer(new ArrayBuffer(ramBytesTotal));
    this.currentCallFrame = new CallFrame(this.ramBuffer, undefined, 0);
    const startConstantIndex = this.constantBuffer.peekUint32At(0);
    this.constantBuffer.setByteCursor(startConstantIndex * 4);
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
