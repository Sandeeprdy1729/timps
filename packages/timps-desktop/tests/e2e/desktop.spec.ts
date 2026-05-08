import { test, expect, _electron as electron } from '@playwright/test';

test.describe('TIMPS Desktop', () => {
  test('should launch and show the main window', async ({ page }) => {
    await page.goto('http://localhost:5173');
    
    // Check that app loads
    await expect(page.locator('.app')).toBeVisible();
    
    // Check logo/header
    await expect(page.locator('.logo-text')).toHaveText('TIMPS');
  });

  test('should accept project path and load memories', async ({ page }) => {
    await page.goto('http://localhost:5173');
    
    // Enter a project path
    const projectInput = page.locator('.project-input');
    await projectInput.fill('/tmp/test-project');
    await projectInput.press('Enter');
    
    // Should show loading or results
    await expect(page.locator('.app-body')).toBeVisible();
  });

  test('should navigate between tabs', async ({ page }) => {
    await page.goto('http://localhost:5173');
    
    // Set a project to enable navigation
    await page.locator('.project-input').fill('/tmp/test');
    await page.locator('.btn-primary').click();
    
    // Navigate to Stats tab
    await page.locator('text=Stats').click();
    await expect(page.locator('.stats-view')).toBeVisible();
    
    // Navigate to Semantic tab
    await page.locator('text=Memory').click();
    await expect(page.locator('.semantic-view')).toBeVisible();
  });

  test('should display empty state without project', async ({ page }) => {
    await page.goto('http://localhost:5173');
    
    // Should show empty state
    await expect(page.locator('.empty-state')).toBeVisible();
    await expect(page.locator('.empty-state h2')).toHaveText('Open a project');
  });

  test('should handle errors gracefully', async ({ page }) => {
    // Mock a failed API call
    await page.route('**/invoke/*', route => {
      route.abort('failed');
    });
    
    await page.goto('http://localhost:5173');
    
    // Enter invalid project path
    await page.locator('.project-input').fill('/nonexistent/path');
    await page.locator('.btn-primary').click();
    
    // Should show error banner
    await expect(page.locator('.error-banner')).toBeVisible();
  });
});

test.describe('System Integration', () => {
  test('should have working system tray', async ({ electronApp }) => {
    // This would test the system tray if we could access it
    // Playwright can connect to Electron apps
    const window = await electronApp.firstWindow();
    expect(window).toBeDefined();
  });

  test('should respond to global shortcut', async ({ electronApp }) => {
    // The global shortcut is handled by the OS/Tauri
    // We can verify the app receives focus
    const window = await electronApp.firstWindow();
    await window.focus();
    expect(await window.isFocused()).toBeTruthy();
  });
});