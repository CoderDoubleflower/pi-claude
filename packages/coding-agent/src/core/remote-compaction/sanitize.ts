import { cloneResponseItem, IMAGE_CONTENT_OMITTED_PLACEHOLDER, isRecord, type ResponseItem } from "./types.ts";

function replaceImageItems(value: unknown): unknown {
	if (!Array.isArray(value)) return value;
	return value.map((item) =>
		isRecord(item) && item.type === "input_image"
			? { type: "input_text", text: IMAGE_CONTENT_OMITTED_PLACEHOLDER }
			: item,
	);
}

export function stripImagesFromRemoteHistory(items: ResponseItem[]): ResponseItem[] {
	return items.map((item) => {
		const next = cloneResponseItem(item);
		if (next.type === "message" && Array.isArray(next.content)) {
			next.content = next.content.map((part) =>
				part.type === "input_image" ? { type: "input_text", text: IMAGE_CONTENT_OMITTED_PLACEHOLDER } : part,
			);
			return next;
		}
		if ((next.type === "function_call_output" || next.type === "custom_tool_call_output") && "output" in next) {
			next.output = replaceImageItems(next.output);
		}
		return next;
	});
}
