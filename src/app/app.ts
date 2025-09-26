import {Component, ElementRef, OnDestroy, OnInit, ViewChild} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {TextareaModule} from 'primeng/textarea';
import {Subscription} from 'rxjs';
import {MarkdownComponent} from "ngx-markdown";
import {ChatSocketService} from "./service/chat-socket.service";
import {AutoScrollToBottomDirective} from "./directive/auto-scroll.directive";

type Role = 'user' | 'bot';

interface ChatMessage {
    id: string;
    role: Role;
    content: string;
    done: boolean
}

@Component({
    selector: 'app-root',
    standalone: true,
    imports: [FormsModule, TextareaModule, MarkdownComponent, AutoScrollToBottomDirective],
    templateUrl: './app.html',
    styleUrls: ['./app.scss']
})
export class App implements OnInit, OnDestroy {
    private subscription?: Subscription;
    private chatMessageMap = new Map<string, ChatMessage>();

    userMessage = '';
    messages: ChatMessage[] = [];

    constructor(private chatSocketService: ChatSocketService) {
    }

    ngOnInit(): void {
        this.subscription = this.chatSocketService
            .connect()
            .subscribe(evt => this.handleIncomingMessage(evt));
    }

    ngOnDestroy(): void {
        this.subscription?.unsubscribe();
        this.chatSocketService.close();
    }

    protected handleIncomingMessage(response: {
        type: 'delta' | 'done' | 'text';
        id?: string;
        content?: string
    }): void {
        if (response.type === 'text' || !response.type) {
            const msg: ChatMessage = {
                id: crypto.randomUUID(),
                content: response.content ?? '',
                role: 'bot',
                done: true
            };
            this.messages.push(msg);
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
            msg.content += (response.content ?? ''); // behoud spaties van tokens
        } else if (response.type === 'done') {
            msg.done = true;
        }
    }

    sendMessage(): void {
        const text = this.userMessage.trim();
        if (!text) return;

        this.chatSocketService.send(text);
        this.messages.push({
            id: crypto.randomUUID(),
            role: 'user',
            content: text,
            done: true
        });

        this.userMessage = '';
    }
}
