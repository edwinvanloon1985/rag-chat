import {Injectable} from '@angular/core';
import {BehaviorSubject, defer, Observable, timer} from 'rxjs';
import {map, retry, shareReplay} from 'rxjs/operators';
import {webSocket, WebSocketSubject} from 'rxjs/webSocket';

export type WebSocketMessage =
    | { type: 'delta'; id: string; content?: string }
    | { type: 'done'; id: string }
    | { type: 'text'; content?: string };

@Injectable({providedIn: 'root'})
export class ChatSocketService {
    // TODO: Make this url environment dependent.
    private readonly url = 'ws://localhost:8080/customer-support-agent';
    private readonly status$ = new BehaviorSubject<'connecting' | 'open' | 'closed'>('closed');

    private socket$?: WebSocketSubject<string>;

    connect(): Observable<WebSocketMessage> {
        return defer(() => {
            if (!this.socket$ || this.socket$.closed) {
                this.status$.next('connecting');

                this.socket$ = webSocket<string>({
                    url: this.url,
                    deserializer: (event: MessageEvent<string>) => event.data,
                    serializer: (value: string) => value,
                    openObserver: {
                        next: () => this.status$.next('open'),
                    },
                    closeObserver: {
                        next: () => this.status$.next('closed'),
                    },
                });
            }

            return this.socket$.pipe(
                // Parse server frames → WebSocketMessage
                map(raw => {
                    try {
                        const obj = JSON.parse(raw);
                        if (obj && (obj.type === 'delta' || obj.type === 'done' || obj.type === 'text')) {
                            return obj as WebSocketMessage;
                        }
                        // Unknown json → treat as text.
                        return {type: 'text', content: raw} as WebSocketMessage;
                    } catch {
                        // No json → treat as plain text.
                        return {type: 'text', content: String(raw)} as WebSocketMessage;
                    }
                }),
                // Auto-reconnect with exponential back-off.
                retry({
                    count: Infinity,
                    delay: (_err, retryIndex) => timer(Math.min(1000 * Math.pow(2, retryIndex), 10000)),
                }),
                // Share 1 stream for all subscribers.
                // Keep last event.
                shareReplay({bufferSize: 1, refCount: true}),
            );
        });
    }

    send(message: string): void {
        this.socket$?.next(message);
    }

    close(): void {
        this.socket$?.complete();
        this.status$.next('closed');
    }
}
