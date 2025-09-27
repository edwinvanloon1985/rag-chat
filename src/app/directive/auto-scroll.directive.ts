import {AfterViewInit, Directive, ElementRef, Input, NgZone, OnDestroy} from "@angular/core";

@Directive({ selector: '[autoScrollToBottom]', standalone: true })
export class AutoScrollToBottomDirective implements AfterViewInit, OnDestroy {
    @Input('autoScrollToBottom') target?: string; // CSS selector van de scroller (bv. ".message-container")

    private mo?: MutationObserver;
    private ro?: ResizeObserver;
    private atBottom = true;
    private scheduled = false;
    private anchor!: HTMLDivElement;
    private scrollEl!: HTMLElement;
    private onScrollHandler = () => {
        const e = this.scrollEl;
        const tolerance = 80;
        this.atBottom = e.scrollTop + e.clientHeight >= e.scrollHeight - tolerance;
    };

    constructor(private hostRef: ElementRef<HTMLElement>, private zone: NgZone) {}

    ngAfterViewInit() {
        const host = this.hostRef.nativeElement;
        this.scrollEl = this.target ? host.querySelector<HTMLElement>(this.target)! : host;
        if (!this.scrollEl) return;

        this.anchor = document.createElement('div');
        this.anchor.className = 'scroll-anchor';
        this.scrollEl.appendChild(this.anchor);

        this.scheduleScroll('init');

        this.mo = new MutationObserver(() => { if (this.atBottom) this.scheduleScroll('mutation'); });
        this.mo.observe(this.scrollEl, { childList: true, subtree: true, characterData: true });

        this.ro = new ResizeObserver(() => { if (this.atBottom) this.scheduleScroll('resize'); });
        this.ro.observe(this.scrollEl);

        this.scrollEl.addEventListener('scroll', this.onScrollHandler, { passive: true });
    }

    ngOnDestroy() {
        this.mo?.disconnect();
        this.ro?.disconnect();
        this.scrollEl?.removeEventListener('scroll', this.onScrollHandler);
    }

    private scheduleScroll(_reason: 'init'|'mutation'|'resize') {
        if (this.scheduled) return;
        this.scheduled = true;
        this.zone.runOutsideAngular(() => {
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    this.anchor.scrollIntoView({ block: 'end', inline: 'nearest' });
                    const e = this.scrollEl;
                    e.scrollTop = Math.max(0, e.scrollHeight - e.clientHeight);
                    this.scheduled = false;
                });
            });
        });
    }
}
