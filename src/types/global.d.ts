interface Window {
    ethereum?: {
      isMetaMask?: boolean;
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
      on: (event: string, callback: (params: unknown) => void) => void;
      removeListener: (event: string, callback: (params: unknown) => void) => void;
      selectedAddress?: string;
      chainId?: string;
    };
  }
  
  declare module '*.webp' {
    const src: string;
    export default src;
  }