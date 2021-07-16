import { ByteBuffer } from "./ByteBuffer"

export class ConstantsTable {
  public readonly buffer: ByteBuffer = new ByteBuffer();
  private index: Map<number, number> = new Map();
  public putUint32(uint32Value: number): number {
    const existingIndex = this.index.get(uint32Value);
    if (existingIndex) {
      return existingIndex;
    }
    const index = this.buffer.byteCursor / 4 | 0;
    this.index.set(uint32Value, index);
    this.buffer.writeUint32(uint32Value);
    return index;
  }
  private scratchUint32 = new Uint32Array(1);
  private scratchFloat32 = new Float32Array(this.scratchUint32.buffer);
  public putFloat32(float32Value: number): number {
    this.scratchFloat32[0] = float32Value;
    return this.putUint32(this.scratchUint32[0]);
  }
  public putBuffer(buffer: ArrayBuffer) {
    const index = this.buffer.byteCursor / 4 | 0;
    this.buffer.writeBuffer(buffer);
    while (this.buffer.byteCursor % 4 !== 0) {
      this.buffer.writeUint8(0); // pad to 32 bits!
    }
    return index;
  }
}

