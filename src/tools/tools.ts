// src/tools/tools.ts

import type { ChatCompletionTool } from 'openai/resources/chat/completions';

// Export tool definitions directly in ChatCompletionTool schema
export const TOOL_DEFS: ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'get_store_data',
      description:
        'Extract filters, products, and pagination from the current wheels store page. Call this after you run the apply_store_filters tool to figure out what is on the page.',
      parameters: { type: 'object', properties: {}, additionalProperties: false },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_current_filters',
      description: 'Return current query-string filters for the store page.',
      parameters: { type: 'object', properties: {}, additionalProperties: false },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_user_vehicle_data',
      description:
        "Return info about user's stored vehicle including imageCountThatCouldBeRenderedAsComposite.",
      parameters: { type: 'object', properties: {}, additionalProperties: false },
    },
  },
  {
    type: 'function',
    function: {
      name: 'apply_store_filters',
      description:
        "Navigate to /store/wheels with selected filters, then extract results. If the filters already match the ones passed to you in the system message don't call this. IMPORTANT: Call the `get_store_data` before calling this so you know what filters are available. ",
      parameters: {
        type: 'object',
        additionalProperties: false,
        properties: {
          year: { type: 'string', description: 'Vehicle year' },
          make: { type: 'string', description: 'Vehicle make' },
          model: { type: 'string', description: 'Wheel Model (not vehicle model)' },
          trim: { type: 'string' },
          drive: { type: 'string' },
          brand: { type: 'string' },
          dia: { type: 'string', description: 'Diameter (e.g., 20)' },
          width: { type: 'string', description: 'Width (e.g., 9 or 9.5)' },
          offset: { type: 'string', description: 'Offset (e.g., +35, -12)' },
          bolt: { type: 'string', description: 'Bolt pattern (e.g., 5x114.3)' },
          mat: { type: 'string', description: 'Material/finish' },
          color: { type: 'string' },
          price: { type: 'string', description: 'Range like 100-250' },
          min: { type: 'number', description: 'Min price' },
          max: { type: 'number', description: 'Max price' },
          weight: { type: 'string', description: 'Weight range like 20-30' },
          minWeight: { type: 'number' },
          maxWeight: { type: 'number' },
          reviews: { type: 'number' },
          page: { type: 'number' },
          
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'generate_composite',
      description:
        'Use stored vehicle polygons and product image to generate a composite image for a vehicle.',
      parameters: {
        type: 'object',
        additionalProperties: false,
        properties: {
          imageIndex: { type: 'number', description: '0-based among images with polygons' },
          productImage: { type: 'string' },
          productDescription: { type: 'string' },
        },
      },
    },
  },
];

// UI helper: derive UI-friendly tool defs from ChatCompletionTool[]
export type UiToolParam = { key: string; type: 'string' | 'number'; optional: boolean; label: string; description?: string };
export type UiToolDef = { id: string; name: string; description?: string; params: UiToolParam[] };

function titleCaseFromName(name: string): string {
  return name.replace(/[_-]+/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());
}

export function getUiToolDefs(): UiToolDef[] {
  return TOOL_DEFS.map((tool) => {
    const fn = tool.function;
    const schema = fn.parameters as any;
    const required: string[] = Array.isArray(schema?.required) ? schema.required : [];
    const params: UiToolParam[] = Object.entries(schema?.properties || {}).map(([key, val]: [string, any]) => ({
      key,
      type: val?.type === 'number' ? 'number' : 'string',
      optional: !required.includes(key),
      label: titleCaseFromName(key),
      description: val?.description,
    }));
    return { id: fn.name, name: titleCaseFromName(fn.name), description: fn.description, params };
  });
}
