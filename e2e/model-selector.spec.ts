/**
 * E2E Tests: Per-Invocation Model Selector Feature
 * 
 * Tests complete workflow from UI selection to agent invocation
 * with different model providers and configurations.
 */

import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

test.describe('Model Selector Feature - E2E Tests', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL);
  });

  test.describe('UI Model Selector', () => {
    
    test('should display model selector dropdown in IntakeForm', async ({ page }) => {
      // Navigate to workflow intake form
      await page.click('text=New Workflow');
      
      // Verify model selector exists
      const modelSelector = page.locator('[data-testid="model-selector"]');
      await expect(modelSelector).toBeVisible();
    });

    test('should show all available models from API', async ({ page }) => {
      await page.click('text=New Workflow');
      
      // Open dropdown
      await page.click('[data-testid="model-selector"]');
      
      // Verify Bedrock models
      await expect(page.locator('text=Claude Sonnet 4.5')).toBeVisible();
      await expect(page.locator('text=Claude Opus 4')).toBeVisible();
      await expect(page.locator('text=Claude 3.5 Sonnet')).toBeVisible();
      
      // Verify OpenAI models
      await expect(page.locator('text=GPT-4 Turbo')).toBeVisible();
      await expect(page.locator('text=GPT-4')).toBeVisible();
      await expect(page.locator('text=GPT-4o')).toBeVisible();
      
      // Verify Gemini models
      await expect(page.locator('text=Gemini Pro')).toBeVisible();
      await expect(page.locator('text=Gemini 1.5 Pro')).toBeVisible();
    });

    test('should clearly indicate default model', async ({ page }) => {
      await page.click('text=New Workflow');
      
      const modelSelector = page.locator('[data-testid="model-selector"]');
      const defaultText = await modelSelector.textContent();
      
      // Default should be Claude Sonnet 4.5
      expect(defaultText).toContain('Claude Sonnet 4.5');
      expect(defaultText).toContain('(default)');
    });

    test('should allow user to select alternative model', async ({ page }) => {
      await page.click('text=New Workflow');
      
      // Open and select GPT-4 Turbo
      await page.click('[data-testid="model-selector"]');
      await page.click('text=GPT-4 Turbo');
      
      // Verify selection
      const selectedValue = await page.locator('[data-testid="model-selector"]').textContent();
      expect(selectedValue).toContain('GPT-4 Turbo');
    });
  });

  test.describe('Complete Workflow with Bedrock Models', () => {
    
    test('should complete workflow with default Claude Sonnet 4.5', async ({ page }) => {
      // Fill out form with default model
      await page.fill('[name="title"]', 'Test Feature - Default Model');
      await page.fill('[name="description"]', 'Testing default model workflow');
      await page.fill('[name="repoUrl"]', 'https://github.com/test/repo');
      
      // Start workflow
      await page.click('button:has-text("Start Workflow")');
      
      // Wait for workflow to start
      await expect(page.locator('text=Workflow Started')).toBeVisible({ timeout: 10000 });
      
      // Verify workflow is using default model
      const workflowDetails = page.locator('[data-testid="workflow-details"]');
      await expect(workflowDetails).toContainText('Claude Sonnet 4.5');
    });

    test('should complete workflow with Claude Opus 4', async ({ page }) => {
      await page.fill('[name="title"]', 'Test Feature - Opus');
      await page.fill('[name="description"]', 'Testing Opus model');
      await page.fill('[name="repoUrl"]', 'https://github.com/test/repo');
      
      // Select Opus model
      await page.click('[data-testid="model-selector"]');
      await page.click('text=Claude Opus 4');
      
      // Start workflow
      await page.click('button:has-text("Start Workflow")');
      
      // Verify model selection
      await expect(page.locator('text=Claude Opus 4')).toBeVisible();
    });

    test('should complete workflow with Claude 3.5 Sonnet', async ({ page }) => {
      await page.fill('[name="title"]', 'Test Feature - 3.5 Sonnet');
      await page.fill('[name="description"]', 'Testing 3.5 Sonnet model');
      await page.fill('[name="repoUrl"]', 'https://github.com/test/repo');
      
      // Select 3.5 Sonnet
      await page.click('[data-testid="model-selector"]');
      await page.click('text=Claude 3.5 Sonnet');
      
      await page.click('button:has-text("Start Workflow")');
      await expect(page.locator('text=Claude 3.5 Sonnet')).toBeVisible();
    });
  });

  test.describe('Complete Workflow with OpenAI Models', () => {
    
    test('should complete workflow with GPT-4 Turbo', async ({ page }) => {
      await page.fill('[name="title"]', 'Test Feature - GPT-4 Turbo');
      await page.fill('[name="description"]', 'Testing GPT-4 Turbo');
      await page.fill('[name="repoUrl"]', 'https://github.com/test/repo');
      
      await page.click('[data-testid="model-selector"]');
      await page.click('text=GPT-4 Turbo');
      
      await page.click('button:has-text("Start Workflow")');
      await expect(page.locator('text=GPT-4 Turbo')).toBeVisible();
    });

    test('should complete workflow with GPT-4', async ({ page }) => {
      await page.fill('[name="title"]', 'Test Feature - GPT-4');
      await page.fill('[name="description"]', 'Testing GPT-4');
      await page.fill('[name="repoUrl"]', 'https://github.com/test/repo');
      
      await page.click('[data-testid="model-selector"]');
      await page.click('text=GPT-4');
      
      await page.click('button:has-text("Start Workflow")');
      await expect(page.locator('text=GPT-4')).toBeVisible();
    });

    test('should complete workflow with GPT-4o', async ({ page }) => {
      await page.fill('[name="title"]', 'Test Feature - GPT-4o');
      await page.fill('[name="description"]', 'Testing GPT-4o');
      await page.fill('[name="repoUrl"]', 'https://github.com/test/repo');
      
      await page.click('[data-testid="model-selector"]');
      await page.click('text=GPT-4o');
      
      await page.click('button:has-text("Start Workflow")');
      await expect(page.locator('text=GPT-4o')).toBeVisible();
    });
  });

  test.describe('Complete Workflow with Gemini Models', () => {
    
    test('should complete workflow with Gemini Pro', async ({ page }) => {
      await page.fill('[name="title"]', 'Test Feature - Gemini Pro');
      await page.fill('[name="description"]', 'Testing Gemini Pro');
      await page.fill('[name="repoUrl"]', 'https://github.com/test/repo');
      
      await page.click('[data-testid="model-selector"]');
      await page.click('text=Gemini Pro');
      
      await page.click('button:has-text("Start Workflow")');
      await expect(page.locator('text=Gemini Pro')).toBeVisible();
    });

    test('should complete workflow with Gemini 1.5 Pro', async ({ page }) => {
      await page.fill('[name="title"]', 'Test Feature - Gemini 1.5');
      await page.fill('[name="description"]', 'Testing Gemini 1.5 Pro');
      await page.fill('[name="repoUrl"]', 'https://github.com/test/repo');
      
      await page.click('[data-testid="model-selector"]');
      await page.click('text=Gemini 1.5 Pro');
      
      await page.click('button:has-text("Start Workflow")');
      await expect(page.locator('text=Gemini 1.5 Pro')).toBeVisible();
    });
  });

  test.describe('Error Scenarios', () => {
    
    test('should handle invalid model configuration gracefully', async ({ page }) => {
      // Intercept API and return invalid model
      await page.route('**/api/models', route => {
        route.fulfill({
          status: 200,
          body: JSON.stringify({
            models: [
              {
                provider: 'bedrock',
                modelId: 'invalid-model',
                displayName: 'Invalid Model',
                isDefault: false
              }
            ]
          })
        });
      });
      
      await page.reload();
      
      // Should show error or fallback to default
      await expect(page.locator('text=Claude Sonnet 4.5')).toBeVisible();
    });

    test('should fallback to default when provider unavailable', async ({ page }) => {
      await page.fill('[name="title"]', 'Test Feature - Unavailable');
      await page.fill('[name="description"]', 'Testing unavailable provider');
      await page.fill('[name="repoUrl"]', 'https://github.com/test/repo');
      
      // Select a model
      await page.click('[data-testid="model-selector"]');
      await page.click('text=GPT-4 Turbo');
      
      // Mock provider failure
      await page.route('**/api/workflow/start', route => {
        route.fulfill({
          status: 200,
          body: JSON.stringify({
            workflowId: 'wf_123',
            modelConfig: {
              provider: 'bedrock',
              modelId: 'global.anthropic.claude-sonnet-4-5-20250929-v1:0'
            },
            message: 'Started with fallback model'
          })
        });
      });
      
      await page.click('button:has-text("Start Workflow")');
      
      // Should show fallback message
      await expect(page.locator('text=fallback')).toBeVisible();
    });

    test('should display clear error for truly invalid model', async ({ page }) => {
      await page.fill('[name="title"]', 'Test Feature - Error');
      await page.fill('[name="description"]', 'Testing error handling');
      await page.fill('[name="repoUrl"]', 'https://github.com/test/repo');
      
      // Mock validation error
      await page.route('**/api/workflow/start', route => {
        route.fulfill({
          status: 400,
          body: JSON.stringify({
            error: 'Invalid model configuration'
          })
        });
      });
      
      await page.click('button:has-text("Start Workflow")');
      
      // Should show error message
      await expect(page.locator('text=Invalid model configuration')).toBeVisible();
    });
  });

  test.describe('Backward Compatibility', () => {
    
    test('should work with workflows created before model selector', async ({ page }) => {
      // Simulate loading old workflow without modelConfig
      await page.goto(`${BASE_URL}/workflow/wf_old_123`);
      
      // Should display as using default model
      await expect(page.locator('text=Claude Sonnet 4.5')).toBeVisible();
    });

    test('should preserve existing workflow without model selection', async ({ page }) => {
      // Create workflow without selecting model
      await page.fill('[name="title"]', 'Test Feature - No Model');
      await page.fill('[name="description"]', 'Testing backward compatibility');
      await page.fill('[name="repoUrl"]', 'https://github.com/test/repo');
      
      // Don't change model selector (use default)
      await page.click('button:has-text("Start Workflow")');
      
      // Should work normally with default
      await expect(page.locator('text=Workflow Started')).toBeVisible();
    });
  });

  test.describe('Agent Scoping', () => {
    
    test('should apply model override only to dev agents', async ({ page }) => {
      await page.fill('[name="title"]', 'Test Feature - Agent Scope');
      await page.fill('[name="description"]', 'Testing agent scoping');
      await page.fill('[name="repoUrl"]', 'https://github.com/test/repo');
      
      await page.click('[data-testid="model-selector"]');
      await page.click('text=GPT-4 Turbo');
      
      await page.click('button:has-text("Start Workflow")');
      
      // Wait for workflow to progress
      await page.waitForSelector('[data-testid="agent-list"]', { timeout: 15000 });
      
      // Dev agents should show GPT-4 Turbo
      const devAgents = page.locator('[data-agent-type="dev"]');
      await expect(devAgents.first()).toContainText('GPT-4 Turbo');
      
      // System agents should show default
      const systemAgents = page.locator('[data-agent-type="system"]');
      await expect(systemAgents.first()).toContainText('Claude Sonnet 4.5');
    });

    test('should verify dev agent list', async ({ page }) => {
      // Navigate to agent configuration page
      await page.goto(`${BASE_URL}/agents`);
      
      // Verify dev agents are correctly identified
      await expect(page.locator('text=team-backend-dev')).toBeVisible();
      await expect(page.locator('text=team-api-dev')).toBeVisible();
      await expect(page.locator('text=team-frontend-dev')).toBeVisible();
    });
  });

  test.describe('Performance', () => {
    
    test('should handle concurrent workflows with different models', async ({ browser }) => {
      const contexts = await Promise.all([
        browser.newContext(),
        browser.newContext(),
        browser.newContext()
      ]);
      
      const pages = await Promise.all(
        contexts.map(ctx => ctx.newPage())
      );
      
      // Start 3 concurrent workflows with different models
      const workflows = [
        { page: pages[0], model: 'Claude Opus 4' },
        { page: pages[1], model: 'GPT-4 Turbo' },
        { page: pages[2], model: 'Gemini Pro' }
      ];
      
      await Promise.all(workflows.map(async ({ page, model }) => {
        await page.goto(BASE_URL);
        await page.fill('[name="title"]', `Concurrent Test - ${model}`);
        await page.fill('[name="description"]', 'Performance test');
        await page.fill('[name="repoUrl"]', 'https://github.com/test/repo');
        
        await page.click('[data-testid="model-selector"]');
        await page.click(`text=${model}`);
        
        await page.click('button:has-text("Start Workflow")');
      }));
      
      // Verify all started successfully
      await Promise.all(pages.map(page => 
        expect(page.locator('text=Workflow Started')).toBeVisible()
      ));
      
      // Cleanup
      await Promise.all(contexts.map(ctx => ctx.close()));
    });

    test('should not degrade performance with model selection', async ({ page }) => {
      const startTime = Date.now();
      
      await page.fill('[name="title"]', 'Performance Test');
      await page.fill('[name="description"]', 'Testing performance');
      await page.fill('[name="repoUrl"]', 'https://github.com/test/repo');
      
      await page.click('[data-testid="model-selector"]');
      await page.click('text=Claude Opus 4');
      
      await page.click('button:has-text("Start Workflow")');
      await expect(page.locator('text=Workflow Started')).toBeVisible();
      
      const duration = Date.now() - startTime;
      
      // Should start within 5 seconds
      expect(duration).toBeLessThan(5000);
    });
  });

  test.describe('API Integration', () => {
    
    test('should fetch models from GET /api/models', async ({ page }) => {
      const response = await page.request.get(`${BASE_URL}/api/models`);
      expect(response.ok()).toBeTruthy();
      
      const data = await response.json();
      expect(data.models).toBeDefined();
      expect(data.models.length).toBeGreaterThan(0);
      
      // Verify structure
      const firstModel = data.models[0];
      expect(firstModel).toHaveProperty('provider');
      expect(firstModel).toHaveProperty('modelId');
      expect(firstModel).toHaveProperty('displayName');
      expect(firstModel).toHaveProperty('isDefault');
    });

    test('should send modelConfig in workflow start request', async ({ page }) => {
      let capturedRequest: any;
      
      await page.route('**/api/workflow/start', route => {
        capturedRequest = route.request().postDataJSON();
        route.fulfill({
          status: 200,
          body: JSON.stringify({ workflowId: 'wf_test_123' })
        });
      });
      
      await page.fill('[name="title"]', 'API Test');
      await page.fill('[name="description"]', 'Testing API integration');
      await page.fill('[name="repoUrl"]', 'https://github.com/test/repo');
      
      await page.click('[data-testid="model-selector"]');
      await page.click('text=GPT-4 Turbo');
      
      await page.click('button:has-text("Start Workflow")');
      
      // Verify modelConfig was sent
      expect(capturedRequest.modelConfig).toBeDefined();
      expect(capturedRequest.modelConfig.provider).toBe('openai');
      expect(capturedRequest.modelConfig.modelId).toBe('gpt-4-turbo');
    });
  });
});
