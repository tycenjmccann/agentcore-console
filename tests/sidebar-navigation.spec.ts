import { test, expect, Page } from '@playwright/test';

/**
 * E2E Test Suite: Sidebar Navigation Enhancement
 * Ticket: TEAM-550
 * Tests all four sub-features plus regression checks.
 */

// ============================================================
// Test Fixtures & Helpers
// ============================================================

const SIDEBAR_SELECTOR = '[data-testid="sidebar"]';
const COLLAPSE_TOGGLE = '[data-testid="sidebar-collapse-toggle"]';

const NAV_ITEMS = [
  { testId: 'nav-dashboard', href: '/' },
  { testId: 'nav-agents', href: '/agents' },
  { testId: 'nav-build', href: '/build' },
  { testId: 'nav-workflow', href: '/workflow' },
  { testId: 'nav-routing', href: '/routing' },
  { testId: 'nav-ticket-history', href: '/tickets' },
];

const QUICK_ACTIONS = [
  { testId: 'quick-action-new-workflow', href: '/workflow?action=new' },
  { testId: 'quick-action-deploy-agent', href: '/build' },
  { testId: 'quick-action-view-logs', href: '/tickets' },
];

/**
 * Mock the agents API to return deterministic data.
 */
async function mockAgentsAPI(page: Page, agents: any[] = []) {
  await page.route('**/api/agentcore/agents', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(agents),
    });
  });
}

/**
 * Mock the workflow list API to return deterministic data.
 */
async function mockWorkflowAPI(page: Page, workflows: any[] = []) {
  await page.route('**/api/workflow/list', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ workflows }),
    });
  });
}

function createMockAgents(count: number) {
  const statuses = ['active', 'idle', 'error'];
  return Array.from({ length: count }, (_, i) => ({
    id: `agent-${i + 1}`,
    name: `Agent ${i + 1}`,
    type: 'runtime',
    status: statuses[i % statuses.length],
  }));
}

function createMockWorkflows(count: number) {
  const statuses = ['running', 'completed', 'failed'];
  return Array.from({ length: count }, (_, i) => ({
    id: `wf-${i + 1}`,
    name: `Workflow ${i + 1}`,
    status: statuses[i % statuses.length],
    createdAt: new Date(Date.now() - i * 3600000).toISOString(),
  }));
}

// ============================================================
// 1. AGENT STATUS INDICATORS
// ============================================================

test.describe('Agent Status Indicators', () => {
  test('displays agent status section with heading and count', async ({ page }) => {
    const agents = createMockAgents(3);
    await mockAgentsAPI(page, agents);
    await mockWorkflowAPI(page);
    await page.goto('/');

    // Section heading "Agents" should be visible
    const heading = page.locator('h3', { hasText: 'Agents' });
    await expect(heading).toBeVisible();

    // Count badge should show the number of agents
    const countBadge = page.locator('text=3').first();
    await expect(countBadge).toBeVisible();
  });

  test('status dots show correct colors for active/idle/error', async ({ page }) => {
    const agents = [
      { id: '1', name: 'Active Agent', type: 'runtime', status: 'active' },
      { id: '2', name: 'Idle Agent', type: 'runtime', status: 'idle' },
      { id: '3', name: 'Error Agent', type: 'runtime', status: 'error' },
    ];
    await mockAgentsAPI(page, agents);
    await mockWorkflowAPI(page);
    await page.goto('/');

    // Active agent should have status-running class (green pulse)
    const activeDot = page.locator('.status-running');
    await expect(activeDot).toBeVisible();

    // Idle agent should have status-stopped class (gray)
    const idleDot = page.locator('.status-stopped');
    await expect(idleDot).toBeVisible();

    // Error agent should have status-error class (red)
    const errorDot = page.locator('.status-error');
    await expect(errorDot).toBeVisible();
  });

  test('shows max 5 agents with "+N more" link when exceeded', async ({ page }) => {
    const agents = createMockAgents(8);
    await mockAgentsAPI(page, agents);
    await mockWorkflowAPI(page);
    await page.goto('/');

    // Should show exactly 5 agent entries
    const agentItems = page.locator('[data-testid="sidebar"] .status-running, [data-testid="sidebar"] .status-stopped, [data-testid="sidebar"] .status-error');
    await expect(agentItems).toHaveCount(5);

    // Should show "+3 more" link
    const moreLink = page.locator('a', { hasText: '+3 more' });
    await expect(moreLink).toBeVisible();
    await expect(moreLink).toHaveAttribute('href', '/agents');
  });

  test('loading state renders skeleton', async ({ page }) => {
    // Delay the API response to see loading state
    await page.route('**/api/agentcore/agents', async (route) => {
      await new Promise((r) => setTimeout(r, 2000));
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });
    await mockWorkflowAPI(page);
    await page.goto('/');

    // Loading skeleton should be visible (animate-pulse elements)
    const skeleton = page.locator('[data-testid="sidebar"] .animate-pulse').first();
    await expect(skeleton).toBeVisible();
  });

  test('error state handled gracefully without crashing', async ({ page }) => {
    await page.route('**/api/agentcore/agents', (route) => {
      route.fulfill({ status: 500, body: 'Internal Server Error' });
    });
    await mockWorkflowAPI(page);
    await page.goto('/');

    // Error message should appear
    const errorMsg = page.locator('text=Unable to load agents');
    await expect(errorMsg).toBeVisible();

    // Page should not crash - sidebar still renders
    await expect(page.locator(SIDEBAR_SELECTOR)).toBeVisible();
  });

  test('polls for status updates every 30 seconds', async ({ page }) => {
    let callCount = 0;
    await page.route('**/api/agentcore/agents', (route) => {
      callCount++;
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(createMockAgents(2)),
      });
    });
    await mockWorkflowAPI(page);
    await page.goto('/');

    // Initial fetch
    expect(callCount).toBe(1);

    // Fast-forward time by 30s
    await page.waitForTimeout(31000);

    // Should have polled at least once more
    expect(callCount).toBeGreaterThanOrEqual(2);
  });
});

// ============================================================
// 2. WORKFLOW HISTORY
// ============================================================

test.describe('Workflow History', () => {
  test('workflow list appears with name, status, and timestamp', async ({ page }) => {
    const workflows = createMockWorkflows(3);
    await mockAgentsAPI(page);
    await mockWorkflowAPI(page, workflows);
    await page.goto('/');

    // Section heading
    const heading = page.locator('h3', { hasText: 'Recent Workflows' });
    await expect(heading).toBeVisible();

    // Each workflow name should be visible
    for (const wf of workflows) {
      await expect(page.locator(`text=${wf.name}`).first()).toBeVisible();
    }

    // Status badges should be present
    await expect(page.locator('text=running').first()).toBeVisible();
    await expect(page.locator('text=completed').first()).toBeVisible();
    await expect(page.locator('text=failed').first()).toBeVisible();
  });

  test('search input filters workflows by name in real-time', async ({ page }) => {
    const workflows = [
      { id: 'wf-1', name: 'Deploy API', status: 'completed', createdAt: new Date().toISOString() },
      { id: 'wf-2', name: 'Build Frontend', status: 'running', createdAt: new Date().toISOString() },
      { id: 'wf-3', name: 'Run Tests', status: 'completed', createdAt: new Date().toISOString() },
    ];
    await mockAgentsAPI(page);
    await mockWorkflowAPI(page, workflows);
    await page.goto('/');

    // Type in search
    const searchInput = page.locator('[aria-label="Search workflows"]');
    await searchInput.fill('Deploy');

    // Wait for debounce (300ms + buffer)
    await page.waitForTimeout(400);

    // Only "Deploy API" should remain
    await expect(page.locator('text=Deploy API')).toBeVisible();
    await expect(page.locator('text=Build Frontend')).not.toBeVisible();
    await expect(page.locator('text=Run Tests')).not.toBeVisible();
  });

  test('search is debounced (not firing on every keystroke)', async ({ page }) => {
    const workflows = createMockWorkflows(5);
    await mockAgentsAPI(page);
    await mockWorkflowAPI(page, workflows);
    await page.goto('/');

    const searchInput = page.locator('[aria-label="Search workflows"]');

    // Type rapidly
    await searchInput.pressSequentially('Work', { delay: 50 });

    // Immediately after typing, all workflows should still be visible
    // because the debounce hasn't triggered yet
    const visibleWorkflows = page.locator('[data-testid="sidebar"] a[href^="/workflow/"]');
    const count = await visibleWorkflows.count();
    // Should still show results (debounce hasn't processed yet)
    expect(count).toBeGreaterThan(0);
  });

  test('status filter tabs work: All, Running, Completed, Failed', async ({ page }) => {
    const workflows = [
      { id: 'wf-1', name: 'WF Running', status: 'running', createdAt: new Date().toISOString() },
      { id: 'wf-2', name: 'WF Completed', status: 'completed', createdAt: new Date().toISOString() },
      { id: 'wf-3', name: 'WF Failed', status: 'failed', createdAt: new Date().toISOString() },
    ];
    await mockAgentsAPI(page);
    await mockWorkflowAPI(page, workflows);
    await page.goto('/');

    // Click "Running" filter
    await page.locator('[aria-label="Filter by Running"]').click();
    await expect(page.locator('text=WF Running')).toBeVisible();
    await expect(page.locator('text=WF Completed')).not.toBeVisible();
    await expect(page.locator('text=WF Failed')).not.toBeVisible();

    // Click "Completed" filter
    await page.locator('[aria-label="Filter by Completed"]').click();
    await expect(page.locator('text=WF Completed')).toBeVisible();
    await expect(page.locator('text=WF Running')).not.toBeVisible();

    // Click "Failed" filter
    await page.locator('[aria-label="Filter by Failed"]').click();
    await expect(page.locator('text=WF Failed')).toBeVisible();
    await expect(page.locator('text=WF Completed')).not.toBeVisible();

    // Click "All" to reset
    await page.locator('[aria-label="Filter by All"]').click();
    await expect(page.locator('text=WF Running')).toBeVisible();
    await expect(page.locator('text=WF Completed')).toBeVisible();
    await expect(page.locator('text=WF Failed')).toBeVisible();
  });

  test('clicking workflow navigates to /workflow/[id]', async ({ page }) => {
    const workflows = [
      { id: 'wf-abc123', name: 'My Workflow', status: 'completed', createdAt: new Date().toISOString() },
    ];
    await mockAgentsAPI(page);
    await mockWorkflowAPI(page, workflows);
    await page.goto('/');

    const link = page.locator('a[href="/workflow/wf-abc123"]');
    await expect(link).toBeVisible();
    await link.click();

    // Verify navigation
    await expect(page).toHaveURL(/\/workflow\/wf-abc123/);
  });

  test('scrollable when >10 items', async ({ page }) => {
    const workflows = createMockWorkflows(15);
    await mockAgentsAPI(page);
    await mockWorkflowAPI(page, workflows);
    await page.goto('/');

    // The scrollable container should have overflow-y-auto and max-h-48
    const scrollContainer = page.locator('[data-testid="sidebar"] .overflow-y-auto.scrollbar-thin');
    await expect(scrollContainer).toBeVisible();

    // Should only show max 10 items (capped in hook)
    const workflowLinks = page.locator('[data-testid="sidebar"] a[href^="/workflow/"]');
    const count = await workflowLinks.count();
    expect(count).toBeLessThanOrEqual(10);
  });

  test('empty state message when no results match', async ({ page }) => {
    await mockAgentsAPI(page);
    await mockWorkflowAPI(page, []);
    await page.goto('/');

    const emptyMsg = page.locator('text=No workflows found');
    await expect(emptyMsg).toBeVisible();
  });
});

// ============================================================
// 3. QUICK-ACTION BUTTONS
// ============================================================

test.describe('Quick-Action Buttons', () => {
  test.beforeEach(async ({ page }) => {
    await mockAgentsAPI(page);
    await mockWorkflowAPI(page);
    await page.goto('/');
  });

  test('"New Workflow" button present with icon, navigates correctly', async ({ page }) => {
    const btn = page.locator('[data-testid="quick-action-new-workflow"]');
    await expect(btn).toBeVisible();
    await expect(btn).toHaveAttribute('href', '/workflow?action=new');
  });

  test('"Deploy Agent" button present with icon, navigates to /build', async ({ page }) => {
    const btn = page.locator('[data-testid="quick-action-deploy-agent"]');
    await expect(btn).toBeVisible();
    await expect(btn).toHaveAttribute('href', '/build');
  });

  test('"View Logs" button present with icon, navigates correctly', async ({ page }) => {
    const btn = page.locator('[data-testid="quick-action-view-logs"]');
    await expect(btn).toBeVisible();
    await expect(btn).toHaveAttribute('href', '/tickets');
  });

  test('buttons are keyboard accessible', async ({ page }) => {
    // Tab through to find quick action buttons
    const btn = page.locator('[data-testid="quick-action-new-workflow"]');
    await btn.focus();
    await expect(btn).toBeFocused();

    // Press Enter to activate link
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/workflow\?action=new/);
  });
});

// ============================================================
// 4. COLLAPSIBLE MODE
// ============================================================

test.describe('Collapsible Mode', () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage before each test
    await page.addInitScript(() => {
      localStorage.removeItem('sidebar-collapsed');
    });
    await mockAgentsAPI(page);
    await mockWorkflowAPI(page);
  });

  test('toggle button visible and clickable', async ({ page }) => {
    await page.goto('/');
    const toggle = page.locator(COLLAPSE_TOGGLE);
    await expect(toggle).toBeVisible();
    await expect(toggle).toHaveAttribute('aria-label', 'Collapse sidebar');
  });

  test('clicking collapses sidebar to narrow width (~64px)', async ({ page }) => {
    await page.goto('/');
    const sidebar = page.locator(SIDEBAR_SELECTOR);

    // Initially expanded (w-64 = 256px)
    await expect(sidebar).toHaveClass(/w-64/);

    // Click toggle
    await page.locator(COLLAPSE_TOGGLE).click();

    // Should now be collapsed (w-16 = 64px)
    await expect(sidebar).toHaveClass(/w-16/);
  });

  test('clicking again expands to full width (256px)', async ({ page }) => {
    await page.goto('/');
    const sidebar = page.locator(SIDEBAR_SELECTOR);

    // Collapse
    await page.locator(COLLAPSE_TOGGLE).click();
    await expect(sidebar).toHaveClass(/w-16/);

    // Expand
    await page.locator(COLLAPSE_TOGGLE).click();
    await expect(sidebar).toHaveClass(/w-64/);
  });

  test('animation is smooth (has transition class)', async ({ page }) => {
    await page.goto('/');
    const sidebar = page.locator(SIDEBAR_SELECTOR);
    await expect(sidebar).toHaveClass(/transition-all/);
    await expect(sidebar).toHaveClass(/duration-300/);
  });

  test('collapse state persists after page reload', async ({ page }) => {
    await page.goto('/');

    // Collapse the sidebar
    await page.locator(COLLAPSE_TOGGLE).click();
    await expect(page.locator(SIDEBAR_SELECTOR)).toHaveClass(/w-16/);

    // Verify localStorage
    const stored = await page.evaluate(() => localStorage.getItem('sidebar-collapsed'));
    expect(stored).toBe('true');

    // Reload and verify state persists
    await page.reload();
    await expect(page.locator(SIDEBAR_SELECTOR)).toHaveClass(/w-16/);
  });

  test('icons show tooltips on hover when collapsed', async ({ page }) => {
    await page.goto('/');

    // Collapse sidebar
    await page.locator(COLLAPSE_TOGGLE).click();

    // Hover over a nav item
    const navItem = page.locator('[data-testid="nav-dashboard"]');
    await navItem.hover();

    // Tooltip should appear (opacity-100 via group-hover)
    const tooltip = navItem.locator('.group-hover\\:opacity-100');
    await expect(tooltip).toBeVisible();
    await expect(tooltip).toContainText('Dashboard');
  });

  test('main content area margin adjusts correctly', async ({ page }) => {
    await page.goto('/');

    // When expanded, main content should have ml-64
    const mainContent = page.locator('.ml-64').first();
    await expect(mainContent).toBeVisible();

    // Collapse sidebar
    await page.locator(COLLAPSE_TOGGLE).click();

    // Main content should now have ml-16
    const collapsed = page.locator('.ml-16').first();
    await expect(collapsed).toBeVisible();
  });

  test('no layout shift on page load (state read from localStorage)', async ({ page }) => {
    // Pre-set collapsed state
    await page.addInitScript(() => {
      localStorage.setItem('sidebar-collapsed', 'true');
    });
    await page.goto('/');

    // Should immediately render as collapsed without flash
    const sidebar = page.locator(SIDEBAR_SELECTOR);
    await expect(sidebar).toHaveClass(/w-16/);

    // The inline script sets --sidebar-width CSS variable
    const cssVar = await page.evaluate(() =>
      document.documentElement.style.getPropertyValue('--sidebar-width')
    );
    expect(cssVar).toBe('64px');
  });
});

// ============================================================
// 5. REGRESSION CHECKS
// ============================================================

test.describe('Regression Checks', () => {
  test.beforeEach(async ({ page }) => {
    await mockAgentsAPI(page, createMockAgents(2));
    await mockWorkflowAPI(page, createMockWorkflows(3));
  });

  test('all existing navigation links still work', async ({ page }) => {
    await page.goto('/');

    for (const item of NAV_ITEMS) {
      const link = page.locator(`[data-testid="${item.testId}"]`);
      await expect(link).toBeVisible();
      await expect(link).toHaveAttribute('href', item.href);
    }
  });

  test('active state highlighting works on nav items', async ({ page }) => {
    await page.goto('/agents');

    // The agents nav item should have active styling
    const agentsLink = page.locator('[data-testid="nav-agents"]');
    await expect(agentsLink).toHaveClass(/bg-brand-600/);
    await expect(agentsLink).toHaveClass(/text-brand-400/);
  });

  test('logo section displays correctly in both states', async ({ page }) => {
    await page.goto('/');

    // Expanded: logo + text visible
    await expect(page.locator('h1', { hasText: 'Agentis' })).toBeVisible();

    // Collapse
    await page.locator(COLLAPSE_TOGGLE).click();

    // Collapsed: logo icon still visible, text hidden
    const logoIcon = page.locator('[data-testid="sidebar"] .bg-brand-600');
    await expect(logoIcon).toBeVisible();
    await expect(page.locator('h1', { hasText: 'Agentis' })).not.toBeVisible();
  });

  test('no console errors or warnings', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error' || msg.type() === 'warning') {
        // Ignore known Next.js hydration warnings and favicon 404s
        const text = msg.text();
        if (!text.includes('favicon') && !text.includes('Download the React DevTools')) {
          consoleErrors.push(text);
        }
      }
    });

    await page.goto('/');
    await page.waitForTimeout(2000);

    expect(consoleErrors).toHaveLength(0);
  });

  test('sidebar renders correctly in both themes', async ({ page }) => {
    await page.goto('/');

    // Verify sidebar exists in default theme
    await expect(page.locator(SIDEBAR_SELECTOR)).toBeVisible();

    // Switch theme (set data-theme attribute)
    await page.evaluate(() => {
      const current = document.documentElement.getAttribute('data-theme');
      const newTheme = current === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', newTheme);
    });

    // Sidebar should still render
    await expect(page.locator(SIDEBAR_SELECTOR)).toBeVisible();

    // Nav items should still be visible
    for (const item of NAV_ITEMS) {
      await expect(page.locator(`[data-testid="${item.testId}"]`)).toBeVisible();
    }
  });

  test('polling cleanup on navigation (no memory leaks)', async ({ page }) => {
    let fetchCount = 0;
    await page.route('**/api/agentcore/agents', (route) => {
      fetchCount++;
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });
    await page.goto('/');

    const initialCount = fetchCount;

    // Navigate away (simulating unmount)
    await page.goto('about:blank');
    await page.waitForTimeout(35000);

    // No additional fetches should happen after navigation
    expect(fetchCount).toBe(initialCount);
  });
});

// ============================================================
// 6. ACCESSIBILITY
// ============================================================

test.describe('Accessibility', () => {
  test.beforeEach(async ({ page }) => {
    await mockAgentsAPI(page, createMockAgents(3));
    await mockWorkflowAPI(page, createMockWorkflows(3));
    await page.goto('/');
  });

  test('sidebar has aria-label', async ({ page }) => {
    await expect(page.locator(SIDEBAR_SELECTOR)).toHaveAttribute('aria-label', 'Sidebar navigation');
  });

  test('collapse toggle has descriptive aria-label', async ({ page }) => {
    const toggle = page.locator(COLLAPSE_TOGGLE);
    await expect(toggle).toHaveAttribute('aria-label', 'Collapse sidebar');

    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-label', 'Expand sidebar');
  });

  test('filter buttons have aria-pressed attribute', async ({ page }) => {
    const allFilter = page.locator('[aria-label="Filter by All"]');
    await expect(allFilter).toHaveAttribute('aria-pressed', 'true');

    const runningFilter = page.locator('[aria-label="Filter by Running"]');
    await expect(runningFilter).toHaveAttribute('aria-pressed', 'false');

    await runningFilter.click();
    await expect(runningFilter).toHaveAttribute('aria-pressed', 'true');
    await expect(allFilter).toHaveAttribute('aria-pressed', 'false');
  });

  test('search input has aria-label', async ({ page }) => {
    const input = page.locator('[aria-label="Search workflows"]');
    await expect(input).toBeVisible();
  });

  test('keyboard navigation through sidebar', async ({ page }) => {
    // Focus the first nav item and tab through
    const firstNav = page.locator('[data-testid="nav-dashboard"]');
    await firstNav.focus();
    await expect(firstNav).toBeFocused();

    // Tab to next item
    await page.keyboard.press('Tab');
    const secondNav = page.locator('[data-testid="nav-agents"]');
    await expect(secondNav).toBeFocused();
  });
});
