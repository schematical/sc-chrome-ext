// src/services/meshyService.ts

export interface MeshyRequest {
    imageUrls: string[];
    texturePrompt: string;
}

export interface MeshyResponse {
    id: string;
}

export interface MeshyError {
    error: string;
    details?: string;
    status?: number;
}

export interface MeshyRetextureRequest {
    image_style_URL: string;
}

export interface MeshyRetextureResponse {
    id: string;
    status: string;
    message?: string;
}

export class MeshyService {
    private static readonly API_BASE_URL = process.env.MESHY_API_URL || 'http://localhost:3000';
    private static readonly MESHY_ENDPOINT = '/api/meshy';

    /**
     * Generate 3D model using the Meshy API
     */
    static async generate3DModel(request: MeshyRequest): Promise<MeshyResponse> {
        try {
            console.log('Sending 3D model generation request:', request);

            const response = await fetch(`${this.API_BASE_URL}${this.MESHY_ENDPOINT}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(request)
            });

            if (!response.ok) {
                const errorText = await response.text();
                let errorDetails = `HTTP ${response.status}: ${response.statusText}`;
                
                try {
                    const errorJson = JSON.parse(errorText);
                    errorDetails = errorJson.message || errorJson.error || errorDetails;
                } catch {
                    if (errorText) {
                        errorDetails = errorText;
                    }
                }

                throw new Error(`Meshy API Error: ${errorDetails}`);
            }

            const result: MeshyResponse = await response.json();
            
            console.log('3D model generation successful:', result);
            return result;

        } catch (error) {
            console.error('Error generating 3D model:', error);
            
            if (error instanceof TypeError && error.message.includes('fetch')) {
                throw new Error('Unable to connect to Meshy service. Make sure the service is running.');
            }
            
            throw error;
        }
    }

    /**
     * Validate the request payload before sending
     */
    static validateRequest(request: MeshyRequest): { valid: boolean; errors: string[] } {
        const errors: string[] = [];

        if (!request.imageUrls || !Array.isArray(request.imageUrls) || request.imageUrls.length === 0) {
            errors.push('At least one image URL is required');
        } else {
            request.imageUrls.forEach((url, index) => {
                if (!url || typeof url !== 'string') {
                    errors.push(`Image URL ${index + 1}: Valid URL is required`);
                }
            });
        }

        if (!request.texturePrompt || request.texturePrompt.trim().length === 0) {
            errors.push('Texture prompt is required');
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    /**
     * Retexture an existing 3D model using the Meshy API
     */
    static async retextureModel(taskId: string, imageStyleUrl: string): Promise<MeshyRetextureResponse> {
        try {
            console.log('Sending 3D model retexture request:', { taskId, imageStyleUrl: imageStyleUrl.substring(0, 50) + '...' });

            const request: MeshyRetextureRequest = {
                image_style_URL: imageStyleUrl
            };

            const response = await fetch(`${this.API_BASE_URL}${this.MESHY_ENDPOINT}/tasks/${taskId}/retexture`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(request)
            });

            if (!response.ok) {
                const errorText = await response.text();
                let errorDetails = `HTTP ${response.status}: ${response.statusText}`;
                
                try {
                    const errorJson = JSON.parse(errorText);
                    errorDetails = errorJson.message || errorJson.error || errorDetails;
                } catch {
                    if (errorText) {
                        errorDetails = errorText;
                    }
                }

                throw new Error(`Meshy Retexture API Error: ${errorDetails}`);
            }

            const result: MeshyRetextureResponse = await response.json();
            
            console.log('3D model retexture successful:', result);
            return result;

        } catch (error) {
            console.error('Error retexturing 3D model:', error);
            
            if (error instanceof TypeError && error.message.includes('fetch')) {
                throw new Error('Unable to connect to Meshy service. Make sure the service is running.');
            }
            
            throw error;
        }
    }
}
