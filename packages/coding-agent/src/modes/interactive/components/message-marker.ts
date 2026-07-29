import { type Component, visibleWidth } from "@earendil-works/pi-tui";

/**
 * Prefix the first rendered line with a marker and align continuation lines
 * with the content that follows it.
 */
export class MessageMarkerComponent implements Component {
	private readonly component: Component;
	private readonly marker: string;
	private readonly contentPad: number;

	constructor(component: Component, marker: string, contentPad = 0) {
		this.component = component;
		this.marker = marker;
		this.contentPad = Number.isFinite(contentPad) ? Math.max(0, Math.floor(contentPad)) : 0;
	}

	render(width: number): string[] {
		const firstLinePrefix = `${this.marker} ${" ".repeat(this.contentPad)}`;
		const continuationPrefix = " ".repeat(visibleWidth(firstLinePrefix));
		const contentWidth = Math.max(1, width - visibleWidth(firstLinePrefix));
		return this.component
			.render(contentWidth)
			.map((line, index) => `${index === 0 ? firstLinePrefix : continuationPrefix}${line}`);
	}

	invalidate(): void {
		this.component.invalidate?.();
	}
}
