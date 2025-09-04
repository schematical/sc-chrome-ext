// src/services/meshyViewerService.ts

import { ConfigService } from './configService';

export interface MeshyTask {
    id: string;
    status: string;
    model_urls?: {
        glb?: string;
        usdz?: string;
        obj?: string;
    };
    created_at?: string;
    updated_at?: string;
    error?: string;
}

export interface MeshyTasksResponse {
    tasks: MeshyTask[];
}

export class MeshyViewerService {
    private static readonly TASKS_ENDPOINT = '/api/meshy/tasks';

    /**
     * Fetch all Meshy tasks
     */
    static async getTasks(): Promise<MeshyTask[]> {
        try {
            const apiBaseUrl = await ConfigService.getApiBaseUrl();
            const response = await fetch(`${apiBaseUrl}${this.TASKS_ENDPOINT}`);
            
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Failed to fetch tasks: ${response.status} ${response.statusText}`);
            }

            const data: MeshyTasksResponse = await response.json();
            return data.tasks || [];
        } catch (error) {
            console.error('Error fetching Meshy tasks:', error);
            throw error;
        }
    }

    /**
     * Get a specific task by ID
     */
    static async getTaskById(id: string): Promise<MeshyTask | null> {
        try {
            const tasks = await this.getTasks();
            return tasks.find(task => task.id === id) || null;
        } catch (error) {
            console.error('Error fetching task by ID:', error);
            throw error;
        }
    }

    /**
     * Get the GLB download URL for a task
     */
    static async getGlbDownloadUrl(taskId: string): Promise<string> {
        const apiBaseUrl = await ConfigService.getApiBaseUrl();
        return `${apiBaseUrl}/api/meshy/tasks/${taskId}/download/glb`;
    }

    /**
     * Check if a task has a completed model
     */
    static hasCompletedModel(task: MeshyTask): boolean {
        return task.status === 'completed' && !!task.model_urls?.glb;
    }

    /**
     * Get task status display text
     */
    static getStatusDisplayText(status: string): string {
        switch (status) {
            case 'pending':
                return '⏳ Pending';
            case 'processing':
                return '🔄 Processing';
            case 'completed':
                return '✅ Completed';
            case 'failed':
                return '❌ Failed';
            default:
                return status;
        }
    }
}
