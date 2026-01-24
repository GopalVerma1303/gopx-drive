import type { RefObject } from 'react';
import type { WebViewMessageEvent } from 'react-native-webview';

import type { RnToWebViewMessage, RpcError, RpcRequest, RpcResult, WebViewEvent, WebViewToRnMessage } from './types';

type PostMessageCapableWebView = {
	postMessage: (message: string) => void;
};

type PendingCall = {
	resolve: (value: unknown) => void;
	reject: (error: Error) => void;
	timeoutId: ReturnType<typeof setTimeout>;
};

type OnEvent = (event: WebViewEvent) => void;

const randomId = () => {
	// Short, unique enough for in-process RPC.
	return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
};

const safeJsonParse = (input: unknown): unknown => {
	if (typeof input !== 'string') return null;
	try {
		return JSON.parse(input);
	} catch {
		return null;
	}
};

export default class RNToWebViewMessenger {
	private readonly webViewRef: RefObject<PostMessageCapableWebView | null>;
	private readonly pendingCalls: Map<string, PendingCall> = new Map();
	private readonly outgoingQueue: RnToWebViewMessage[] = [];
	private onEvent_: OnEvent | null = null;

	public constructor(webViewRef: RefObject<PostMessageCapableWebView | null>) {
		this.webViewRef = webViewRef;
	}

	public setOnEvent(handler: OnEvent | null) {
		this.onEvent_ = handler;
	}

	public onWebViewLoaded() {
		this.flushOutgoingQueue();
	}

	public onWebViewMessage(event: WebViewMessageEvent) {
		const raw = event?.nativeEvent?.data;
		const parsed = safeJsonParse(raw);
		if (!parsed || typeof parsed !== 'object') return;

		const msg = parsed as WebViewToRnMessage;
		if (msg.kind === 'event') {
			this.onEvent_?.(msg);
			return;
		}

		if (msg.kind === 'rpc:result') {
			this.handleRpcResult(msg);
			return;
		}

		if (msg.kind === 'rpc:error') {
			this.handleRpcError(msg);
			return;
		}
	}

	public call(method: string, ...args: unknown[]) {
		const id = randomId();
		const request: RpcRequest = {
			kind: 'rpc',
			id,
			method,
			args,
		};

		const timeoutMs = 10_000;

		const promise = new Promise<unknown>((resolve, reject) => {
			const timeoutId = setTimeout(() => {
				this.pendingCalls.delete(id);
				reject(new Error(`WebView RPC timeout: ${method}`));
			}, timeoutMs);

			this.pendingCalls.set(id, { resolve, reject, timeoutId });
		});

		this.send(request);
		return promise;
	}

	public send(message: RnToWebViewMessage) {
		const webView = this.webViewRef.current;
		if (!webView) {
			this.outgoingQueue.push(message);
			return;
		}

		try {
			webView.postMessage(JSON.stringify(message));
		} catch (error) {
			// If something went wrong serializing or posting, fail pending calls fast.
			if (message.kind === 'rpc') {
				const pending = this.pendingCalls.get(message.id);
				if (pending) {
					clearTimeout(pending.timeoutId);
					this.pendingCalls.delete(message.id);
					pending.reject(error instanceof Error ? error : new Error(String(error)));
				}
			}
		}
	}

	private flushOutgoingQueue() {
		const webView = this.webViewRef.current;
		if (!webView) return;

		while (this.outgoingQueue.length) {
			const msg = this.outgoingQueue.shift();
			if (!msg) break;
			try {
				webView.postMessage(JSON.stringify(msg));
			} catch {
				// If we can't send, stop and retry later.
				this.outgoingQueue.unshift(msg);
				break;
			}
		}
	}

	private handleRpcResult(msg: RpcResult) {
		const pending = this.pendingCalls.get(msg.id);
		if (!pending) return;

		clearTimeout(pending.timeoutId);
		this.pendingCalls.delete(msg.id);
		pending.resolve(msg.result);
	}

	private handleRpcError(msg: RpcError) {
		const pending = this.pendingCalls.get(msg.id);
		if (!pending) return;

		clearTimeout(pending.timeoutId);
		this.pendingCalls.delete(msg.id);

		const error = new Error(msg.error?.message || 'WebView RPC error');
		if (msg.error?.stack) {
			(error as any).stack = msg.error.stack;
		}
		pending.reject(error);
	}
}

