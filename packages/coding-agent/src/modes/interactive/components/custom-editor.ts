import { Editor, type EditorOptions, type EditorTheme, type TUI } from "@earendil-works/pi-tui";
import type { AppKeybinding, KeybindingsManager } from "../../../core/keybindings.ts";
import { stripAnsi } from "../../../utils/ansi.ts";

const PROMPT_PREFIX_WIDTH = 2;

function isEditorBorderLine(line: string): boolean {
	const plain = stripAnsi(line);
	return /^─+$/.test(plain) || /^─── [↑↓] \d+ more /.test(plain);
}

/**
 * Custom editor that handles app-level keybindings for coding-agent.
 */
export class CustomEditor extends Editor {
	private keybindings: KeybindingsManager;
	private readonly themeBorderColor: EditorTheme["borderColor"];
	public actionHandlers: Map<AppKeybinding, () => void> = new Map();

	// Special handlers that can be dynamically replaced
	public onEscape?: () => void;
	public onCtrlD?: () => void;
	public onPasteImage?: () => void;
	/** Handler for extension-registered shortcuts. Returns true if handled. */
	public onExtensionShortcut?: (data: string) => boolean;

	constructor(tui: TUI, theme: EditorTheme, keybindings: KeybindingsManager, options?: EditorOptions) {
		super(tui, theme, options);
		this.keybindings = keybindings;
		this.themeBorderColor = theme.borderColor;
	}

	override render(width: number): string[] {
		if (!this.getText().trimStart().startsWith("!")) {
			this.borderColor = this.themeBorderColor;
		}

		if (width <= PROMPT_PREFIX_WIDTH) {
			return super.render(width);
		}

		// Render the editor two columns narrower so the prompt marker participates
		// in wrapping and cursor layout instead of clipping the right edge.
		const lines = super.render(width - PROMPT_PREFIX_WIDTH);
		let bottomBorderIndex = -1;
		for (let index = lines.length - 1; index > 0; index--) {
			if (isEditorBorderLine(lines[index] ?? "")) {
				bottomBorderIndex = index;
				break;
			}
		}
		if (bottomBorderIndex === -1) {
			return lines;
		}

		const borderExtension = this.borderColor("─".repeat(PROMPT_PREFIX_WIDTH));
		const continuationPrefix = " ".repeat(PROMPT_PREFIX_WIDTH);
		const promptPrefix = `${this.borderColor("❯")} `;
		const firstLogicalLineIsVisible = !stripAnsi(lines[0] ?? "").includes("↑");

		return lines.map((line, index) => {
			if (index === 0 || index === bottomBorderIndex) {
				return `${line}${borderExtension}`;
			}
			if (index < bottomBorderIndex) {
				return `${index === 1 && firstLogicalLineIsVisible ? promptPrefix : continuationPrefix}${line}`;
			}
			// Autocomplete rows align with the editable content, not the marker.
			return `${continuationPrefix}${line}`;
		});
	}

	/**
	 * Register a handler for an app action.
	 */
	onAction(action: AppKeybinding, handler: () => void): void {
		this.actionHandlers.set(action, handler);
	}

	handleInput(data: string): void {
		// Check extension-registered shortcuts first
		if (this.onExtensionShortcut?.(data)) {
			return;
		}

		// Check for clipboard paste keybinding
		if (this.keybindings.matches(data, "app.clipboard.pasteImage")) {
			this.onPasteImage?.();
			return;
		}

		// Check app keybindings first

		// Escape/interrupt - only if autocomplete is NOT active
		if (this.keybindings.matches(data, "app.interrupt")) {
			if (!this.isShowingAutocomplete()) {
				// Use dynamic onEscape if set, otherwise registered handler
				const handler = this.onEscape ?? this.actionHandlers.get("app.interrupt");
				if (handler) {
					handler();
					return;
				}
			}
			// Let parent handle escape for autocomplete cancellation
			super.handleInput(data);
			return;
		}

		// Exit (Ctrl+D) - only when editor is empty
		if (this.keybindings.matches(data, "app.exit")) {
			if (this.getText().length === 0) {
				const handler = this.onCtrlD ?? this.actionHandlers.get("app.exit");
				if (handler) handler();
				return;
			}
			// Fall through to editor handling for delete-char-forward when not empty
		}

		// Check all other app actions
		for (const [action, handler] of this.actionHandlers) {
			if (action !== "app.interrupt" && action !== "app.exit" && this.keybindings.matches(data, action)) {
				handler();
				return;
			}
		}

		// Pass to parent for editor handling
		super.handleInput(data);
	}
}
