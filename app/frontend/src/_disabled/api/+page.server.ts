// Get API endpoints info from FastAPI docs

import type { Load } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';

// Define the structure we want for our processed endpoints
export interface EndpointInfo {
  path: string;
  method: string; // Will be uppercase (GET, POST, etc.)
  summary?: string; // Use summary or description from OpenAPI
  description?: string;
  tags?: string[];
  parameters?: { name: string; in: string; description?: string; required?: boolean }[];
  // Add more fields if needed, e.g., requestBody, responses
}

// Basic types for relevant parts of OpenAPI spec (you might want more detailed types)
interface OpenApiParameter {
    name: string;
    in: 'path' | 'query' | 'header' | 'cookie';
    description?: string;
    required?: boolean;
    schema?: object; // Can be more detailed
}

interface OpenApiOperation {
    tags?: string[];
    summary?: string;
    description?: string;
    operationId?: string;
    parameters?: OpenApiParameter[];
    requestBody?: object; // Can be more detailed
    responses?: object; // Can be more detailed
}

// Type for methods within a path (get, post, etc.)
type HttpMethod = 'get' | 'post' | 'put' | 'delete' | 'patch' | 'options' | 'head' | 'trace';

// Type for a path item, containing operations for different methods
type PathItem = {
    [method in HttpMethod]?: OpenApiOperation;
} & {
    parameters?: OpenApiParameter[]; // Parameters common to all methods in this path
};

// Basic type for the overall OpenAPI document structure
interface OpenApiSpec {
  openapi: string;
  info: {
    title: string;
    version: string;
    // ... other info fields
  };
  paths: {
    [path: string]: PathItem;
  };
  components?: object; // Schemas, security schemes etc.
  // ... other top-level fields
}


export const load: Load = async ({ fetch }) => {
    const backendApiBase = env.BACKEND_API_BASE;

    if (!backendApiBase) {
        console.error("BACKEND_API_BASE environment variable is not set.");
        // You could throw an error here, or return an empty list/error state
        // throw error(500, "Backend API base URL is not configured");
        return {
            endpoints: [],
            error: "Backend API base URL is not configured on the server.",
            apiTitle: "API Docs", // Default title
            apiVersion: "",
        };
    }

    const openApiUrl = `${backendApiBase}/openapi.json`; // Default FastAPI OpenAPI URL

    try {
        console.log(`Fetching OpenAPI spec from: ${openApiUrl}`);
        const response = await fetch(openApiUrl);

        if (!response.ok) {
            console.error(`Failed to fetch OpenAPI spec: ${response.status} ${response.statusText}`);
            const errorText = await response.text();
            console.error("Response body:", errorText);
            return {
                endpoints: [],
                error: `Failed to fetch API documentation (${response.status}) from ${openApiUrl}. Is the backend running and accessible?`,
                apiTitle: "API Docs Error",
                apiVersion: "",
            };
            // Or throw: throw error(response.status, `Failed to fetch API documentation: ${response.statusText}`);
        }

        const openapiDoc = await response.json() as OpenApiSpec;

        // --- Process the OpenAPI document ---
        const processedEndpoints: EndpointInfo[] = [];
        const apiTitle = openapiDoc.info?.title ?? "API Documentation";
        const apiVersion = openapiDoc.info?.version ?? "";


        for (const path in openapiDoc.paths) {
            const pathItem = openapiDoc.paths[path];
            const commonParameters = pathItem.parameters || []; // Parameters defined at the path level

            // Iterate over possible HTTP methods
            (Object.keys(pathItem) as HttpMethod[]).forEach((method) => {
                 // Filter out non-method keys like 'parameters', 'summary', etc.
                 if (!['get', 'post', 'put', 'delete', 'patch', 'options', 'head', 'trace'].includes(method)) {
                    return;
                 }

                const operation = pathItem[method];
                if (operation) {
                    // Combine path-level parameters with operation-specific parameters
                     const operationParameters = operation.parameters || [];
                     const allParameters = [...commonParameters, ...operationParameters];
                     // Basic parameter processing (can be enhanced)
                     const processedParams = allParameters.map(p => ({
                         name: p.name,
                         in: p.in,
                         description: p.description,
                         required: p.required
                     }));

                    processedEndpoints.push({
                        path: path,
                        method: method.toUpperCase(), // Standardize to uppercase
                        summary: operation.summary,
                        description: operation.description,
                        tags: operation.tags,
                        parameters: processedParams.length > 0 ? processedParams : undefined,
                    });
                }
            });
        }

        // Optional: Sort endpoints (e.g., by path, then method)
        processedEndpoints.sort((a, b) => {
            if (a.path < b.path) return -1;
            if (a.path > b.path) return 1;
            // If paths are equal, sort by method (e.g., GET before POST)
            const methodOrder = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD', 'TRACE'];
            return methodOrder.indexOf(a.method) - methodOrder.indexOf(b.method);
        });

        return {
            endpoints: processedEndpoints,
            apiTitle: apiTitle,
            apiVersion: apiVersion,
            error: null, // No error
        };

    } catch (e: any) {
        console.error("Error fetching or processing OpenAPI spec:", e);
        // Return an error state that the page can display
        return {
            endpoints: [],
            error: `An error occurred while fetching or processing API documentation: ${e.message}`,
            apiTitle: "API Docs Error",
            apiVersion: "",
        };
        // Or throw: throw error(500, `Failed to process API documentation: ${e.message}`);
    }
};