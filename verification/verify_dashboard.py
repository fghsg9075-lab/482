import os
from playwright.sync_api import sync_playwright

def verify_dashboard():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # 1. Navigate to init localStorage
        page.goto("http://localhost:5000")

        # 2. Inject flags
        page.evaluate("""() => {
            localStorage.setItem('nst_terms_accepted', 'true');
            localStorage.setItem('nst_has_seen_welcome', 'true');
            if (!localStorage.getItem('nst_user_undefined') && !localStorage.getItem('nst_current_user')) {
                 const user = {
                    id: 'test-user',
                    name: 'Test Student',
                    classLevel: '10',
                    board: 'CBSE',
                    credits: 100,
                    streak: 5,
                    createdAt: new Date().toISOString(),
                    role: 'STUDENT'
                 };
                 localStorage.setItem('nst_current_user', JSON.stringify(user));
                 localStorage.setItem('nst_users', JSON.stringify([user]));
            }
        }""")

        # 3. Reload
        page.reload()

        # Helper to close popups
        def close_popups():
            closed_something = False
            # Daily Challenge
            if page.is_visible("text=Daily Challenge"):
                try:
                    page.click("text=Remind me later", force=True, timeout=1000)
                    closed_something = True
                except:
                    pass
                try:
                     page.click("div:has-text('Daily Challenge') >> button >> svg", force=True, timeout=1000)
                     closed_something = True
                except:
                    pass

            # Daily Goal Tracker
            if page.is_visible("text=Daily Goal Tracker"):
                try:
                    page.click("text=Continue Learning", force=True, timeout=1000)
                    closed_something = True
                except:
                    pass

            # Referral Popup
            if page.is_visible("text=Referral Code"):
                try:
                    page.click("button:has-text('Skip')", force=True, timeout=1000)
                    closed_something = True
                except:
                    pass

            return closed_something

        # Try closing popups loop
        for _ in range(5):
            page.wait_for_timeout(2000)
            if not close_popups():
                if page.is_visible("text=Study Time"):
                    break

        try:
            page.wait_for_selector("text=Study Time", timeout=15000)

            # Scroll to Video Lectures button
            video_btn = page.wait_for_selector("text=Video Lectures", timeout=10000)
            video_btn.scroll_into_view_if_needed()
            page.wait_for_timeout(500) # Wait for scroll

            # Screenshot Hero (Grid)
            page.screenshot(path="verification/dashboard_hero_grid.png")
            print("Screenshot saved: dashboard_hero_grid.png")

            # Scroll to Explore Features
            explore_btn = page.wait_for_selector("text=Explore Features", timeout=5000)
            explore_btn.scroll_into_view_if_needed()

            # Click Explore Features
            explore_btn.click(force=True)

            # Wait for Layer 2 header
            page.wait_for_selector("h2:has-text('Explore')", timeout=5000)

            # Screenshot Layer 2
            page.screenshot(path="verification/dashboard_layer2.png")
            print("Screenshot saved: dashboard_layer2.png")

        except Exception as e:
            print(f"Verification failed: {e}")
            page.screenshot(path="verification/error.png")

        browser.close()

if __name__ == "__main__":
    verify_dashboard()
