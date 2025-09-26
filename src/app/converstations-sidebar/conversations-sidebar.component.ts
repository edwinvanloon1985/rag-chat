import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

export type ThreadBrief = { threadId: string; title: string; updatedAt: number };

@Component({
    selector: 'app-conversations-sidebar',
    standalone: true,
    imports: [CommonModule],
    templateUrl: 'conversations-sidebar.component.html',
    styleUrls: ['conversations-sidebar.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class ConversationsSidebarComponent {
    @Input() threads: ThreadBrief[] = [];
    @Input() activeThreadId: string | null = null;

    @Output() newThread = new EventEmitter<void>();
    @Output() openThread = new EventEmitter<string>();
    @Output() renameThread = new EventEmitter<string>();
    @Output() deleteThread = new EventEmitter<string>();

    trackById = (_: number, t: ThreadBrief) => t.threadId;

    onOpen(tid: string)   { this.openThread.emit(tid); }
    onRename(tid: string) { this.renameThread.emit(tid); }
    onDelete(tid: string) { this.deleteThread.emit(tid); }
}
