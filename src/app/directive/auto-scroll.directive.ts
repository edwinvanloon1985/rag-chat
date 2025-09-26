import {
    Directive, ElementRef, AfterViewInit, OnDestroy, HostListener, NgZone
} from '@angular/core';

@Directive({
    selector: '[autoScrollToBottom]',
    standalone: true
})
export class AutoScrollToBottomDirective implements AfterViewInit, OnDestroy {
    private mo?: MutationObserver;
    private ro?: ResizeObserver;
    private atBottom = true;
    private scheduled = false;
    private anchor!: HTMLDivElement;

    constructor(private elRef: ElementRef<HTMLElement>, private zone: NgZone) {}

    private get el() { return this.elRef.nativeElement; }

    ngAfterViewInit() {
        // Create anchor (last child)
        this.anchor = document.createElement('div');
        this.anchor.className = 'scroll-anchor';
        this.el.appendChild(this.anchor);

        // initialize scrolling when directive is called
        this.scheduleScroll('init');

        // DOM-changes (new messages)
        this.mo = new MutationObserver(() => {
            if (this.atBottom) this.scheduleScroll('mutation');
        });
        this.mo.observe(this.el, { childList: true, subtree: true, characterData: true });

        // Custom adjustments (images that take longer to render)
        this.ro = new ResizeObserver(() => {
            if (this.atBottom) this.scheduleScroll('resize');
        });
        this.ro.observe(this.el);
    }

    ngOnDestroy() {
        this.mo?.disconnect();
        this.ro?.disconnect();
    }

    @HostListener('scroll')
    onScroll() {
        const e = this.el;
        const tolerance = 80;
        this.atBottom = e.scrollTop + e.clientHeight >= e.scrollHeight - tolerance;
    }

    private scheduleScroll(_reason: 'init'|'mutation'|'resize') {
        if (this.scheduled) return;
        this.scheduled = true;

        this.zone.runOutsideAngular(() => {
            // double request animation frame: wait for layout + paint
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    // 1) primair: scroll to anchor in container
                    this.anchor.scrollIntoView({ block: 'end', inline: 'nearest' });

                    // 2) backup step: set scroll top to max
                    const e = this.el;
                    e.scrollTop = Math.max(0, e.scrollHeight - e.clientHeight);

                    this.scheduled = false;
                });
            });
        });
    }
}
