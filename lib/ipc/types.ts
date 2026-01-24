export type RpcRequest = {
	kind: 'rpc';
	id: string;
	method: string;
	args: unknown[];
};

export type RpcResult = {
	kind: 'rpc:result';
	id: string;
	result: unknown;
};

export type RpcError = {
	kind: 'rpc:error';
	id: string;
	error: { message: string; stack?: string };
};

export type WebViewEvent = {
	kind: 'event';
	type: string;
	payload?: unknown;
};

export type WebViewToRnMessage = RpcResult | RpcError | WebViewEvent;
export type RnToWebViewMessage = RpcRequest;

