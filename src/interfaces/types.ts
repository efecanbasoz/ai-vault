export interface AppInterface {
  readonly name: string;
  start(): Promise<void>;
  stop(): Promise<void>;
}
