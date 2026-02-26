import { http, HttpResponse } from "msw";

const models = {
  models: [
    {
      id: "gpt-4o-mini",
      label: "GPT-4o Mini",
      supports_streaming: true,
      description: "Fast and efficient model.",
      context_length: 128000,
      default_temperature: 0.6,
    },
  ],
  updated_at: new Date().toISOString(),
};

export const handlers = [
  http.get("/api/v1/models", () => HttpResponse.json(models)),
];
