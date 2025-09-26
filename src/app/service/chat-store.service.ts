// src/app/services/chat-store.service.ts
import {Injectable} from '@angular/core';
import localforage from 'localforage';
import {compressToUTF16, decompressFromUTF16} from 'lz-string';
import {ChatMessage} from "../model/chat-message.model";

export type ChatThread = {
    threadId: string;
    title: string;
    messages: ChatMessage[];
    updatedAt: number;
};

@Injectable({providedIn: 'root'})
export class ChatStoreService {
    private store = localforage.createInstance({
        name: 'my-chat',
        storeName: 'threads',
        description: 'Persisted chat threads'
    });

    // Optioneel: lijst met threadIds voor snelle index
    private INDEX_KEY = '__index__';

    async listThreads(): Promise<Array<Pick<ChatThread, 'threadId' | 'title' | 'updatedAt'>>> {
        const indexRaw = await this.store.getItem<string>(this.INDEX_KEY);
        const index = indexRaw ? JSON.parse(indexRaw) as Array<{
            threadId: string;
            title: string;
            updatedAt: number
        }> : [];
        // meest recent bovenaan
        return index.sort((a, b) => b.updatedAt - a.updatedAt);
    }

    async getThread(threadId: string): Promise<ChatThread | null> {
        const raw = await this.store.getItem<string>(`thread:${threadId}`);
        if (!raw) return null;
        const json = decompressFromUTF16(raw);
        return JSON.parse(json) as ChatThread;
    }

    async upsertThread(thread: ChatThread): Promise<void> {
        const compressed = compressToUTF16(JSON.stringify(thread));
        await this.store.setItem(`thread:${thread.threadId}`, compressed);

        // index bijwerken
        const index = await this.listThreads();
        const existingIdx = index.findIndex(i => i.threadId === thread.threadId);
        const brief = {threadId: thread.threadId, title: thread.title, updatedAt: thread.updatedAt};
        if (existingIdx >= 0) index[existingIdx] = brief; else index.push(brief);
        await this.store.setItem(this.INDEX_KEY, JSON.stringify(index));
        this.broadcastChange(thread.threadId);
    }

    async appendMessage(threadId: string, msg: ChatMessage, titleIfNew = 'Nieuw gesprek'): Promise<ChatThread> {
        const existing = await this.getThread(threadId);
        const thread: ChatThread = existing ?? {threadId, title: titleIfNew, messages: [], updatedAt: Date.now()};
        thread.messages.push(msg);
        thread.updatedAt = Date.now();
        await this.upsertThread(thread);
        return thread;
    }

    async renameThread(threadId: string, title: string) {
        const t = await this.getThread(threadId);
        if (!t) return;
        t.title = title;
        t.updatedAt = Date.now();
        await this.upsertThread(t);
    }

    async deleteThread(threadId: string) {
        await this.store.removeItem(`thread:${threadId}`);
        const index = await this.listThreads();
        const filtered = index.filter(i => i.threadId !== threadId);
        await this.store.setItem(this.INDEX_KEY, JSON.stringify(filtered));
        this.broadcastChange(threadId);
    }

    // — Tab sync via BroadcastChannel —
    private channel = typeof window !== 'undefined' && 'BroadcastChannel' in window ? new BroadcastChannel('chat-sync') : null;

    private broadcastChange(threadId: string) {
        this.channel?.postMessage({type: 'changed', threadId});
    }

    onExternalChange(handler: (threadId: string) => void) {
        this.channel!.onmessage = (e: MessageEvent) => {
            const data = e.data as { threadId: string };
            handler(data.threadId);
        };
    }
}
