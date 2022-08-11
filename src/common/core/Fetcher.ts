export interface Fetcher {
  fetch(options: RequestFacade, firstByteOnly?: boolean): Promise<ResponseFacade>;
}

export interface RequestFacade {
  url: string;
  method?: string;
  query?: any;
  body?: any;
  headers?: { [name: string]: string };
  redirect?: boolean;
}

export interface ResponseFacade {
  readonly url: string;
  readonly status: number;
  readonly statusText: string;
  readonly headers: HeadersFacade;
  readonly bodyUsed: boolean;
  json(): Promise<any>;
  text(): Promise<string>;
  arrayBuffer(): Promise<ArrayBuffer>;
  clone(): ResponseFacade;
}

export interface HeadersFacade {
  get(name: string): string | null;
  has(name: string): boolean;
  forEach(callback: (value: string, key: string, parent: HeadersFacade) => void, thisArg?: any): void;
}
