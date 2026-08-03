import { Box, type Component, Container, getCapabilities, Image, Spacer, Text, type TUI } from "@earendil-works/pi-tui";
import type { ToolDefinition, ToolRenderContext } from "../../../core/extensions/types.ts";
import { createAllToolDefinitions, type ToolName } from "../../../core/tools/index.ts";
import { getTextOutput as getRenderedTextOutput } from "../../../core/tools/render-utils.ts";
import { stripAnsi } from "../../../utils/ansi.ts";
import { convertToPng } from "../../../utils/image-convert.ts";
import { theme } from "../theme/theme.ts";

const TOOL_OUTPUT_PREVIEW_LINES = 5;
const BACKGROUND_TOOL_NAMES = new Set(["AskUserQuestion", "EnterPlanMode", "ExitPlanMode", "TodoWrite"]);

function isBackgroundTool(toolName: string): boolean {
	return BACKGROUND_TOOL_NAMES.has(toolName);
}

function isTerminalImageSequence(line: string): boolean {
	return line.includes("\x1b_G") || line.includes("\x1b]1337;File=");
}

class CallSummaryComponent implements Component {
	private component: Component;

	constructor(component: Component) {
		this.component = component;
	}

	render(width: number): string[] {
		const lines = this.component.render(width);
		const start = lines.findIndex((line) => stripAnsi(line).trim().length > 0);
		if (start === -1) return [];

		let end = start;
		while (end < lines.length && stripAnsi(lines[end] ?? "").trim().length > 0) end++;
		return lines.slice(start, end);
	}

	invalidate(): void {
		this.component.invalidate?.();
	}
}

class LatestLinesComponent implements Component {
	private component: Component;

	constructor(component: Component) {
		this.component = component;
	}

	render(width: number): string[] {
		const lines = this.component.render(width);
		let start = 0;
		let end = lines.length;
		while (start < end && stripAnsi(lines[start] ?? "").trim().length === 0) start++;
		while (end > start && stripAnsi(lines[end - 1] ?? "").trim().length === 0) end--;
		return lines.slice(start, end).slice(-TOOL_OUTPUT_PREVIEW_LINES);
	}

	invalidate(): void {
		this.component.invalidate?.();
	}
}

export interface ToolExecutionOptions {
	showImages?: boolean;
	imageWidthCells?: number;
}

export class ToolExecutionComponent extends Container {
	private contentBox: Box;
	private selfRenderContainer: Container;
	private callRendererComponent?: Component;
	private resultRendererComponent?: Component;
	private rendererState: any = {};
	private imageComponents: Image[] = [];
	private imageSpacers: Spacer[] = [];
	private toolName: string;
	private toolCallId: string;
	private args: any;
	private expanded = false;
	private showImages: boolean;
	private imageWidthCells: number;
	private isPartial = true;
	private toolDefinition?: ToolDefinition<any, any>;
	private builtInToolDefinition?: ToolDefinition<any, any>;
	private ui: TUI;
	private cwd: string;
	private executionStarted = false;
	private argsComplete = false;
	private result?: {
		content: Array<{ type: string; text?: string; data?: string; mimeType?: string }>;
		isError: boolean;
		details?: any;
	};
	private convertedImages = new Map<number, { data: string; mimeType: string }>();

	constructor(
		toolName: string,
		toolCallId: string,
		args: any,
		options: ToolExecutionOptions = {},
		toolDefinition: ToolDefinition<any, any> | undefined,
		ui: TUI,
		cwd: string,
	) {
		super();
		this.toolName = toolName;
		this.toolCallId = toolCallId;
		this.args = args;
		this.toolDefinition = toolDefinition;
		this.builtInToolDefinition = createAllToolDefinitions(cwd)[toolName as ToolName];
		this.showImages = options.showImages ?? true;
		this.imageWidthCells = options.imageWidthCells ?? 60;
		this.ui = ui;
		this.cwd = cwd;

		this.addChild(new Spacer(1));

		// Always create both shell variants. contentBox is used for default and fallback composition.
		// selfRenderContainer is used when the tool renders its own framing.
		this.contentBox = new Box(1, 0);
		this.selfRenderContainer = new Container();
		this.addChild(
			this.hasRendererDefinition() && this.getRenderShell() === "self" ? this.selfRenderContainer : this.contentBox,
		);

		this.updateDisplay();
	}

	private getCallRenderer(): ToolDefinition<any, any>["renderCall"] | undefined {
		if (!this.builtInToolDefinition) {
			return this.toolDefinition?.renderCall;
		}
		if (!this.toolDefinition) {
			return this.builtInToolDefinition.renderCall;
		}
		return this.toolDefinition.renderCall ?? this.builtInToolDefinition.renderCall;
	}

	private getResultRenderer(): ToolDefinition<any, any>["renderResult"] | undefined {
		if (!this.builtInToolDefinition) {
			return this.toolDefinition?.renderResult;
		}
		if (!this.toolDefinition) {
			return this.builtInToolDefinition.renderResult;
		}
		return this.toolDefinition.renderResult ?? this.builtInToolDefinition.renderResult;
	}

	private hasRendererDefinition(): boolean {
		return this.builtInToolDefinition !== undefined || this.toolDefinition !== undefined;
	}

	private getRenderShell(): "default" | "self" {
		if (!this.builtInToolDefinition) {
			return this.toolDefinition?.renderShell ?? "default";
		}
		if (!this.toolDefinition) {
			return this.builtInToolDefinition.renderShell ?? "default";
		}
		return this.toolDefinition.renderShell ?? this.builtInToolDefinition.renderShell ?? "default";
	}

	private getRenderContext(lastComponent: Component | undefined): ToolRenderContext {
		return {
			args: this.args,
			toolCallId: this.toolCallId,
			invalidate: () => {
				this.invalidate();
				this.ui.requestRender();
			},
			lastComponent,
			state: this.rendererState,
			cwd: this.cwd,
			executionStarted: this.executionStarted,
			argsComplete: this.argsComplete,
			isPartial: this.isPartial,
			expanded: this.expanded,
			showImages: this.showImages,
			isError: this.result?.isError ?? false,
		};
	}

	private createCallFallback(): Component {
		let text = theme.fg("toolTitle", theme.bold(this.toolName));
		const args = JSON.stringify(this.args);
		if (args && args !== "{}") {
			text += ` ${theme.fg("toolOutput", args)}`;
		}
		return new Text(text, 0, 0);
	}

	private getDisplayedCallComponent(component: Component): Component {
		if ((this.isPartial && !this.executionStarted) || this.toolName === "bash") return component;
		return new CallSummaryComponent(component);
	}

	private createResultFallback(): Component | undefined {
		const output = this.getTextOutput();
		if (!output) {
			return undefined;
		}
		return new Text(theme.fg("toolOutput", output), 0, 0);
	}

	updateArgs(args: any): void {
		this.args = args;
		this.updateDisplay();
	}

	markExecutionStarted(): void {
		this.executionStarted = true;
		this.updateDisplay();
		this.ui.requestRender();
	}

	setArgsComplete(): void {
		this.argsComplete = true;
		this.updateDisplay();
		this.ui.requestRender();
	}

	updateResult(
		result: {
			content: Array<{ type: string; text?: string; data?: string; mimeType?: string }>;
			details?: any;
			isError: boolean;
		},
		isPartial = false,
	): void {
		this.result = result;
		this.isPartial = isPartial;
		this.updateDisplay();
		this.maybeConvertImagesForKitty();
	}

	private maybeConvertImagesForKitty(): void {
		if (!this.isPartial || !this.expanded || !this.showImages || !this.result) return;
		if (getCapabilities().images !== "kitty") return;

		const imageBlocks = this.result.content.filter((content) => content.type === "image");
		for (let i = 0; i < imageBlocks.length; i++) {
			const image = imageBlocks[i];
			if (!image.data || !image.mimeType || image.mimeType === "image/png" || this.convertedImages.has(i)) {
				continue;
			}

			void convertToPng(image.data, image.mimeType).then((converted) => {
				if (!converted) return;
				this.convertedImages.set(i, converted);
				this.updateDisplay();
				this.ui.requestRender();
			});
		}
	}

	setExpanded(expanded: boolean): void {
		this.expanded = expanded;
		this.updateDisplay();
		this.maybeConvertImagesForKitty();
	}

	setShowImages(show: boolean): void {
		this.showImages = show;
		this.updateDisplay();
		this.maybeConvertImagesForKitty();
	}

	setImageWidthCells(width: number): void {
		this.imageWidthCells = Math.max(1, Math.floor(width));
		this.updateDisplay();
	}

	override invalidate(): void {
		super.invalidate();
		this.updateDisplay();
	}

	override render(width: number): string[] {
		if (isBackgroundTool(this.toolName)) return [];

		const contentWidth = Math.max(1, width - 2);
		const lines = super.render(contentWidth);
		const firstContentLine = lines.findIndex(
			(line) => isTerminalImageSequence(line) || stripAnsi(line).trim().length > 0,
		);
		const status = this.isPartial
			? theme.fg("toolRunning", "●")
			: this.result?.isError
				? theme.fg("toolError", "●")
				: theme.fg("toolSuccess", "●");

		if (firstContentLine === -1) {
			return ["", `${status} ${theme.fg("toolTitle", theme.bold(this.toolName))}`];
		}
		if (isTerminalImageSequence(lines[firstContentLine] ?? "")) {
			return ["", `${status} ${theme.fg("toolTitle", theme.bold(this.toolName))}`, ...lines];
		}

		return lines.map((line, index) => {
			if (index === firstContentLine) return `${status} ${line}`;
			return line === "" || isTerminalImageSequence(line) ? line : `  ${line}`;
		});
	}

	private updateDisplay(): void {
		if (this.hasRendererDefinition()) {
			const renderContainer = this.getRenderShell() === "self" ? this.selfRenderContainer : this.contentBox;
			renderContainer.clear();

			const callRenderer = this.getCallRenderer();
			if (!callRenderer) {
				renderContainer.addChild(this.getDisplayedCallComponent(this.createCallFallback()));
			} else {
				try {
					const component = callRenderer(this.args, theme, this.getRenderContext(this.callRendererComponent));
					this.callRendererComponent = component;
					renderContainer.addChild(this.getDisplayedCallComponent(component));
				} catch {
					this.callRendererComponent = undefined;
					renderContainer.addChild(this.getDisplayedCallComponent(this.createCallFallback()));
				}
			}

			if (this.result) {
				const resultRenderer = this.getResultRenderer();
				let renderedResult: Component | undefined;
				if (!resultRenderer) {
					renderedResult = this.createResultFallback();
				} else {
					try {
						const component = resultRenderer(
							{ content: this.result.content as any, details: this.result.details },
							{ expanded: this.expanded, isPartial: this.isPartial },
							theme,
							this.getRenderContext(this.resultRendererComponent),
						);
						this.resultRendererComponent = component;
						renderedResult = component;
					} catch {
						this.resultRendererComponent = undefined;
						renderedResult = this.createResultFallback();
					}
				}

				if (this.isPartial) {
					const textResult = this.createOutputTextComponent();
					if (this.expanded) {
						const expandedResult = renderedResult ?? textResult;
						if (expandedResult) renderContainer.addChild(expandedResult);
					} else {
						const previewSource = textResult ?? renderedResult;
						if (previewSource) renderContainer.addChild(new LatestLinesComponent(previewSource));
					}
				}
			}
		} else {
			this.contentBox.clear();
			this.contentBox.addChild(new Text(this.formatFallbackCall(), 0, 0));
			if (this.isPartial) {
				const outputComponent = this.createOutputTextComponent();
				if (outputComponent) {
					this.contentBox.addChild(this.expanded ? outputComponent : new LatestLinesComponent(outputComponent));
				}
			}
		}

		for (const image of this.imageComponents) this.removeChild(image);
		for (const spacer of this.imageSpacers) this.removeChild(spacer);
		this.imageComponents = [];
		this.imageSpacers = [];

		if (this.isPartial && this.expanded && this.result) {
			const capabilities = getCapabilities();
			const imageBlocks = this.result.content.filter((content) => content.type === "image");
			for (let i = 0; i < imageBlocks.length; i++) {
				const image = imageBlocks[i];
				if (!capabilities.images || !this.showImages || !image.data || !image.mimeType) continue;

				const converted = this.convertedImages.get(i);
				const imageData = converted?.data ?? image.data;
				const imageMimeType = converted?.mimeType ?? image.mimeType;
				if (capabilities.images === "kitty" && imageMimeType !== "image/png") continue;

				const spacer = new Spacer(1);
				const imageComponent = new Image(
					imageData,
					imageMimeType,
					{ fallbackColor: (text: string) => theme.fg("toolOutput", text) },
					{ maxWidthCells: this.imageWidthCells },
				);
				this.imageSpacers.push(spacer);
				this.imageComponents.push(imageComponent);
				this.addChild(spacer);
				this.addChild(imageComponent);
			}
		}
	}

	private createOutputTextComponent(): Text | undefined {
		const output = getRenderedTextOutput(this.result, false).trimEnd();
		if (!output) return undefined;
		return new Text(
			output
				.split("\n")
				.map((line) => theme.fg("toolOutput", line))
				.join("\n"),
			0,
			0,
		);
	}

	private getTextOutput(): string {
		return getRenderedTextOutput(this.result, this.isPartial && this.expanded && this.showImages);
	}

	private formatFallbackCall(): string {
		let text = theme.fg("toolTitle", theme.bold(this.toolName));
		const compact = !this.isPartial || this.executionStarted;
		const args = JSON.stringify(this.args, null, compact ? undefined : 2);
		if (args && args !== "{}") {
			text += compact ? ` ${theme.fg("toolOutput", args)}` : `\n\n${theme.fg("toolOutput", args)}`;
		}
		return text;
	}
}
