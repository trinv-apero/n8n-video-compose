import events from "events";

export class AgentEmitter extends events.EventEmitter {
  async emitAsync<T = any>(event: string, ...args: any[]): Promise<T> {
    return new Promise<T>((resolve) => {
      this.emit(event, ...args, resolve);
    });
  }
}

export const image2imageEmitter = new AgentEmitter();
export const text2imageEmitter = new AgentEmitter();
export const videoLiteEmitter = new AgentEmitter();
export const combineImageEmitter = new AgentEmitter();
