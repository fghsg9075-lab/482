
import asyncio
from playwright.async_api import async_playwright

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            viewport={'width': 1280, 'height': 720}
        )

        # Inject Admin User & Settings to bypass login/popups
        await context.add_init_script("""
            localStorage.setItem('nst_current_user', JSON.stringify({
                id: 'ADMIN_001',
                name: 'Admin User',
                role: 'ADMIN',
                isPremium: true
            }));
            localStorage.setItem('nst_system_settings', JSON.stringify({
                appName: 'Test App',
                maintenanceMode: false
            }));
            // Suppress daily trackers if possible by setting dates
            const today = new Date().toDateString();
            localStorage.setItem('nst_last_daily_tracker_date', today);
            localStorage.setItem('nst_last_daily_challenge_date', today);
        """)

        page = await context.new_page()

        try:
            print("Navigating to Dashboard...")
            await page.goto("http://localhost:5173", wait_until="networkidle")

            # Screenshot initial state
            await page.screenshot(path="debug_initial.png")

            # Handle Popups (Daily Goal Tracker)
            # Look for an 'X' button or typical close button inside a modal
            try:
                # Common close button selector in this app seems to be lucide-x inside a button
                # or just text "Close"
                close_btn = page.locator("button:has(.lucide-x)")
                if await close_btn.count() > 0:
                    print("Closing popup...")
                    await close_btn.first.click()
                    await page.wait_for_timeout(500)
            except Exception as e:
                print(f"Popup handling error (might be none): {e}")

            # 1. Click "Enter Master Mode"
            print("Looking for Master Mode button...")
            master_btn = page.locator("text=Enter Master Mode")
            await master_btn.wait_for(state="visible", timeout=5000)
            await master_btn.click()

            # 2. Click "Visibility" Card
            print("Looking for Visibility Card...")
            # DashboardCard with label="Visibility"
            vis_card = page.locator("text=Visibility")
            await vis_card.wait_for(state="visible", timeout=5000)
            await vis_card.click()

            # 3. Verify "Explore Grid Visibility" section
            print("Verifying Visibility Controls...")
            await page.wait_for_selector("text=Explore Grid Visibility", timeout=5000)

            # Check for specific toggles
            content = await page.content()
            if "Inbox" in content and "Analytics" in content:
                print("✅ Verified: Inbox and Analytics toggles are present.")
            else:
                print("❌ Failed: Toggles not found.")
                print(content[:500]) # Print snippet

            await page.screenshot(path="success_visibility.png")

        except Exception as e:
            print(f"❌ Error: {e}")
            await page.screenshot(path="error_visibility.png")

        await browser.close()

asyncio.run(run())
