export type Role = 'user' | 'bot';

export interface ChatMessage {
    id: string;
    role: Role;
    content: string;
    done?: boolean,
    ts?: number
}