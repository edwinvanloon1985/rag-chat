import {Component, OnDestroy, OnInit} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {TextareaModule} from 'primeng/textarea';
import {Observable, Subscription} from 'rxjs';
import {MarkdownComponent} from "ngx-markdown";
import {ChatSocketService} from "./service/chat-socket.service";
import {AutoScrollToBottomDirective} from "./directive/auto-scroll.directive";
import {ChatMessage, Role} from "./model/chat-message.model";
import {ChatStoreService} from "./service/chat-store.service";
import {ConversationsSidebarComponent, ThreadBrief} from "./converstations-sidebar/conversations-sidebar.component";
import {HttpClient} from "@angular/common/http";

@Component({
    selector: 'app-root',
    standalone: true,
    imports: [
        FormsModule,
        TextareaModule,
        MarkdownComponent,
        AutoScrollToBottomDirective,
        ConversationsSidebarComponent,
    ],
    templateUrl: './app.html',
    styleUrls: ['./app.scss']
})
export class App implements OnInit, OnDestroy {
    private subscription?: Subscription;
    private chatMessageMap = new Map<string, ChatMessage>();
    private hasRenamedThread = false;

    threads: ThreadBrief[] = [];
    activeThreadId: string = localStorage.getItem('activeThreadId') ?? crypto.randomUUID();

    userMessage = '';
    messages: ChatMessage[] = [];

    constructor(
        private chatSocketService: ChatSocketService,
        private chatStore: ChatStoreService,
        private http: HttpClient
    ) {
    }

    ngOnInit(): void {
        this.refreshThreads().then(async () => {
            await this.openThread(this.activeThreadId, {createIfMissing: true});

            this.subscription = this.chatSocketService
                .connect()
                .subscribe(evt => {
                    void this.handleIncomingMessage(evt);
                });
        });
    }

    ngOnDestroy(): void {
        this.subscription?.unsubscribe();
        this.chatSocketService.close();
    }

    async refreshThreads() {
        this.threads = await this.chatStore.listThreads();
    }

    async startNewThread() {
        const newId = crypto.randomUUID();
        await this.openThread(newId, {createIfMissing: true});
        await this.refreshThreads();
    }

    async openThread(threadId: string, opts: { createIfMissing?: boolean } = {}) {
        this.activeThreadId = threadId;
        localStorage.setItem('activeThreadId', threadId);

        this.chatMessageMap.clear();

        const t = await this.chatStore.getThread(threadId);
        if (!t) {
            this.messages = [];
            this.hasRenamedThread = false;
            return;
        }

        this.messages = t.messages.map(m => ({
            id: m.id,
            role: m.role as any,
            content: m.content,
            done: true
        }));
        this.hasRenamedThread = !!t.title;
    }

    async renameThread(threadId: string) {
        const current = this.threads.find(t => t.threadId === threadId);
        const title = prompt('Nieuwe titel:', current?.title ?? 'Gesprek');
        if (!title) return;
        await this.chatStore.renameThread(threadId, title);
        await this.refreshThreads();
    }

    async deleteThread(threadId: string) {
        if (!confirm('Dit gesprek verwijderen?')) return;
        await this.chatStore.deleteThread(threadId);
        if (threadId === this.activeThreadId) {
            const next = this.threads.find(t => t.threadId !== threadId);
            const fallback = next?.threadId ?? crypto.randomUUID();
            await this.openThread(fallback, {createIfMissing: true});
        }
        await this.refreshThreads();
        this.deleteChat(threadId).subscribe({
            next: () => console.log(`Gesprek met id: ${threadId} verwijderd!`),
            error: (err) => console.log(`Verwijderen van gesprek met id: ${threadId} mislukt!`)
        });
    }

    private async persistMessage(role: Role, content: string) {
        await this.chatStore.appendMessage(
            this.activeThreadId,
            {
                id: crypto.randomUUID(),
                role: role,
                content: content,
                ts: Date.now(),
            }
        );
    }

    private deleteChat(id: string): Observable<void> {
        return this.http.delete<void>(`/chat-store/${id}`);
    }

    protected async handleIncomingMessage(response: {
        type: 'delta' | 'done' | 'text';
        id?: string;
        content?: string
    }): Promise<void> {
        if (response.type === 'text' || !response.type) {
            const content = response.content ?? '';
            const msg: ChatMessage = {
                id: crypto.randomUUID(),
                content,
                role: 'bot',
                done: true
            };
            this.messages.push(msg);

            await this.persistMessage('bot', content);
            return;
        }

        if (!response.id) return;

        let msg = this.chatMessageMap.get(response.id);
        if (!msg) {
            msg = {id: response.id, content: '', role: 'bot', done: false};
            this.chatMessageMap.set(response.id, msg);
            this.messages.push(msg);
        }

        if (response.type === 'delta') {
            msg.content += (response.content ?? '');
        } else if (response.type === 'done') {
            msg.done = true;
            await this.persistMessage('bot', msg.content);
        }
    }

    async sendMessage(): Promise<void> {
        this.chatStore.getThread(this.activeThreadId).then(thread => {
            console.log('Thread inhoud:', thread);
        });

        const text = this.userMessage.trim();
        if (!text) return;

        this.messages.push({
            id: crypto.randomUUID(),
            role: 'user',
            content: text,
        });

        await this.persistMessage('user', text);

        if (!this.hasRenamedThread) {
            const firstLine = text.split('\n')[0].slice(0, 60);
            await this.chatStore.renameThread(this.activeThreadId, firstLine || 'Gesprek');
            this.hasRenamedThread = true;
            await this.refreshThreads();
        }

        this.chatSocketService.send({
            id: this.activeThreadId,
            userMessage: text
        });

        this.userMessage = '';
    }
}