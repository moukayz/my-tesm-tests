import { renderHook, act } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useStreamMessage } from "@/lib/apiHooks";

describe("useStreamMessage", () => {
  it("parses thinking, answer, and done events", async () => {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(
          encoder.encode(
            "event: thinking\ndata: {\"token\":\"Hello \"}\n\n"
          )
        );
        controller.enqueue(
          encoder.encode(
            "event: answer\ndata: {\"token\":\"world\"}\n\n"
          )
        );
        controller.enqueue(
          encoder.encode(
            "event: done\ndata: {\"completion_id\":\"c1\",\"finish_reason\":\"stop\"}\n\n"
          )
        );
        controller.close();
      },
    });

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(stream, { status: 200 }))
    );

    const { result } = renderHook(() => useStreamMessage());
    const onThinking = vi.fn();
    const onAnswer = vi.fn();
    const onDone = vi.fn();
    const onError = vi.fn();

    await act(async () => {
      await result.current.startStream(
        {
          model_id: "gpt-4o-mini",
          messages: [{ role: "user", content: "Hello" }],
        },
        { onThinking, onAnswer, onDone, onError }
      );
    });

    expect(onThinking).toHaveBeenCalledWith("Hello ");
    expect(onAnswer).toHaveBeenCalledWith("world");
    expect(onDone).toHaveBeenCalledWith({
      completion_id: "c1",
      finish_reason: "stop",
    });
    expect(onError).not.toHaveBeenCalled();
  });
});
