
from playwright.sync_api import sync_playwright, expect
import json
import time

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context()
    page = context.new_page()

    # 1. Inject Admin User into LocalStorage
    admin_user = {
        "id": "admin_123",
        "name": "Admin User",
        "role": "ADMIN",
        "email": "admin@example.com"
    }

    page.goto("http://localhost:3000")

    user_json = json.dumps(admin_user)

    # Inject ALL needed flags to bypass popups
    page.evaluate(f"""() => {{
        localStorage.setItem('nst_current_user', '{user_json}');
        localStorage.setItem('nst_terms_accepted', 'true');
        localStorage.setItem('nst_has_seen_welcome', 'true');
        localStorage.setItem('nst_last_daily_tracker_date', new Date().toDateString());
        localStorage.setItem('nst_last_daily_challenge_date', new Date().toDateString());
    }}""")

    page.reload()
    time.sleep(2)

    # 2. Enter Master Mode
    if page.get_by_text("Enter Master Mode").is_visible():
        print("Found Master Mode button, clicking...")
        page.get_by_text("Enter Master Mode").click()
    else:
        # Check if we are already in dashboard (e.g. if I updated logic to auto-enter)
        if not page.get_by_text("Admin Console").is_visible():
             print("Master Mode button not found and not in Dashboard. Dumping...")
             page.screenshot(path="verification/debug_fail_2.png")

    # 3. Wait for Dashboard
    try:
        expect(page.get_by_text("Admin Console")).to_be_visible(timeout=10000)
    except:
        print("Admin Console not found!")
        # If there's an overlay still?
        page.screenshot(path="verification/dashboard_fail.png")
        raise

    # 4. Click AI Control Tower Card
    print("Clicking AI Control Tower...")
    # Wait for the card to be stable
    time.sleep(1)
    page.get_by_text("AI Control Tower").click()

    # 5. Verify "Save Changes" button is visible
    save_btn = page.get_by_role("button", name="Save Changes")
    try:
        expect(save_btn).to_be_visible(timeout=5000)
        print("SUCCESS: Save Changes button is visible!")
    except:
        print("FAILURE: Save Changes button NOT visible.")
        page.screenshot(path="verification/failure.png")
        raise

    # 6. Take Screenshot
    page.screenshot(path="verification/ai_tower_save.png")

    browser.close()

with sync_playwright() as playwright:
    run(playwright)
