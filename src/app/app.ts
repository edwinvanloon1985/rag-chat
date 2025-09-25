import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TextareaModule } from 'primeng/textarea';
import { ButtonModule } from 'primeng/button';
import { Observable } from 'rxjs';
import { HttpClient, HttpClientModule } from '@angular/common/http';

type Role = 'user' | 'bot';
interface ChatMsg { id: number; role: Role; text: string; }
interface ChatResponse { message: string }
interface ChatRequest { message: string }

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [FormsModule, TextareaModule, ButtonModule],
  templateUrl: './app.html',
  styleUrls: ['./app.scss']
})
export class App {
  chatMessage = '';
  private nextId = 1;
  messages: ChatMsg[] = [];

  constructor(private httpClient: HttpClient) { }

  sendMessage() {
    const text = this.chatMessage.trim();
    if (!text) return;
    this.messages.push({ id: this.nextId++, role: 'user', text });
    this.chatMessage = '';

    setTimeout(() => {
      this.callAi(text).subscribe((response) => {
        this.messages.push({
          id: this.nextId++,
          role: 'bot',
          text: response.message
        });
      });
    }, 300);
  }

  callAi(message: string): Observable<ChatResponse> {
    return this.httpClient.post<ChatResponse>('http://localhost:8080/chat', { message });
  }
}
