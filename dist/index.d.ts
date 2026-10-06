export interface MinaPluginConfig {
    endpoint?: string;
    privateKey?: string;
}
export declare function fetchCurrentNonce(endpoint: string, publicKey: string): Promise<number>;
export declare function executeMinaPayment(endpoint: string, privateKey: string, receiver: string, amountMina: number): Promise<string>;
export declare function traceTransaction(endpoint: string, txHash: string): Promise<string>;
export declare function initializePlugin(api: any): void;
export default initializePlugin;
