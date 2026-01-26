import { RefObject } from 'react';
import { WebViewControl } from './ExtendedWebView';
import { EditorEvent } from './types';

export class EditorMessenger {
  private webviewRef: RefObject<WebViewControl | null>;
  private messageHandlers: Map<string, (data: any) => void> = new Map();
  private messageId = 0;
  private pendingMessages: Map<number, { resolve: (value: any) => void; reject: (error: any) => void }> = new Map();

  constructor(webviewRef: RefObject<WebViewControl | null>) {
    this.webviewRef = webviewRef;
  }

  onMessage(event: { nativeEvent: { data: string } }) {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      
      if (data.type === 'response' && data.id !== undefined) {
        const pending = this.pendingMessages.get(data.id);
        if (pending) {
          if (data.error) {
            pending.reject(new Error(data.error));
          } else {
            pending.resolve(data.result);
          }
          this.pendingMessages.delete(data.id);
        }
        return;
      }

      if (data.type === 'event') {
        const handler = this.messageHandlers.get(data.eventType);
        if (handler) {
          handler(data.payload);
        }
      }
    } catch (error) {
      console.error('Error parsing WebView message:', error);
    }
  }

  on(eventType: string, handler: (data: any) => void) {
    this.messageHandlers.set(eventType, handler);
  }

  off(eventType: string) {
    this.messageHandlers.delete(eventType);
  }

  async sendCommand(command: string, ...args: any[]): Promise<any> {
    return new Promise((resolve, reject) => {
      const id = this.messageId++;
      this.pendingMessages.set(id, { resolve, reject });

      const script = `
        (function() {
          if (window.editorApi && window.editorApi.${command}) {
            const result = window.editorApi.${command}(${args.map(arg => JSON.stringify(arg)).join(', ')});
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'response',
              id: ${id},
              result: result
            }));
          } else {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'response',
              id: ${id},
              error: 'Command ${command} not found'
            }));
          }
        })();
        true;
      `;

      this.webviewRef.current?.injectJS(script);

      // Timeout after 5 seconds
      setTimeout(() => {
        if (this.pendingMessages.has(id)) {
          this.pendingMessages.delete(id);
          reject(new Error(`Command ${command} timed out`));
        }
      }, 5000);
    });
  }

  sendEvent(event: EditorEvent) {
    const script = `
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'event',
        eventType: '${event.kind}',
        payload: ${JSON.stringify(event)}
      }));
      true;
    `;
    this.webviewRef.current?.injectJS(script);
  }
}
