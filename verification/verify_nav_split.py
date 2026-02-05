
import os
from playwright.sync_api import sync_playwright, expect

def verify_nav_split():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            viewport={'width': 375, 'height': 812},
            user_agent='Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1'
        )
        page = context.new_page()

        # Listen to console
        page.on("console", lambda msg: print(f"Browser Console: {msg.text}"))

        # Inject LocalStorage
        page.add_init_script("""
            localStorage.setItem('nst_terms_accepted', 'true');
            localStorage.setItem('nst_has_seen_welcome', 'true');
            localStorage.setItem('nst_last_daily_tracker_date', new Date().toDateString());
            localStorage.setItem('nst_last_daily_challenge_date', new Date().toDateString());
            localStorage.setItem('nst_last_read_update', Date.now().toString());

            const user = {
                id: 'test-student',
                name: 'Test Student',
                role: 'STUDENT',
                classLevel: '10',
                board: 'CBSE',
                isPremium: true,
                subscriptionLevel: 'ULTRA',
                subscriptionEndDate: new Date(Date.now() + 86400000).toISOString(),
                credits: 100,
                streak: 5,
                lastLoginRewardDate: new Date().toISOString()
            };
            localStorage.setItem('nst_current_user', JSON.stringify(user));
        """)

        print("Navigating to Dashboard on port 5000...")
        try:
            page.goto("http://localhost:5000/", timeout=60000)
        except Exception as e:
            print(f"Navigation failed: {e}")
            return

        page.wait_for_timeout(3000)

        # HANDLE POPUPS
        try:
            claim_later = page.locator("button").filter(has_text="Claim Later").first
            if claim_later.is_visible(timeout=2000):
                print("Closing Reward Popup (Claim Later)...")
                claim_later.click()
                page.wait_for_timeout(1000)

            close_x = page.locator("button svg.lucide-x").locator("..").first
            if close_x.is_visible(timeout=1000):
                 print("Closing Popup (X)...")
                 close_x.click()
                 page.wait_for_timeout(1000)
        except:
            pass

        # 2. Navigate to AI Tools using JS click
        print("Navigating to AI Tools (via JS)...")
        # Find the AI Tools button (2nd child usually, or filter by text)
        page.evaluate("""
            const buttons = Array.from(document.querySelectorAll('.fixed.bottom-0 button'));
            const aiBtn = buttons.find(b => b.innerText.includes('AI Tools'));
            if (aiBtn) aiBtn.click();
            else console.error("AI Tools button not found in JS");
        """)

        page.wait_for_timeout(3000)

        # 4. Verify AI Tools Page
        print("Verifying AI Tools Page...")
        try:
            expect(page.get_by_text("AI Tools", exact=True).first).to_be_visible()
            expect(page.get_by_text("Notes Generator")).to_be_visible()
            page.screenshot(path="verification/ai_tools_page.png")
            print("AI Tools Page Verified.")
        except Exception as e:
            page.screenshot(path="verification/debug_ai_fail_js.png")
            print(f"AI Tools Verification Failed: {e}")

        browser.close()

if __name__ == "__main__":
    verify_nav_split()
