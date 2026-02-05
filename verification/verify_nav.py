from playwright.sync_api import sync_playwright
import time
import json

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()

        try:
            page.goto("http://localhost:5173", timeout=30000)

            user_data = {
                "id": "test-user",
                "name": "Test Student",
                "role": "STUDENT",
                "classLevel": "10",
                "board": "CBSE",
                "stream": "Science",
                "credits": 100,
                "streak": 5,
                "isPremium": True,
                "subscriptionTier": "MONTHLY",
                "subscriptionEndDate": "2026-01-01T00:00:00.000Z",
                "createdAt": "2024-01-01T00:00:00.000Z"
            }

            page.evaluate(f"localStorage.setItem('nst_current_user', '{json.dumps(user_data)}');")
            page.reload()
            time.sleep(5)

            if page.get_by_text("Test Student").count() > 0:
                print("Dashboard Loaded.")

            # Find "Explore More"
            print("Looking for 'Explore More' button...")
            explore_btn = page.get_by_text("Explore More")
            if explore_btn.count() > 0:
                print("Button found. Clicking (Force)...")
                explore_btn.click(force=True)
                time.sleep(2)
                page.screenshot(path="verification/step2_scrolled.png")
                print("Scrolled down.")
            else:
                print("Explore More button not found!")

        except Exception as e:
            print(f"Error: {e}")
        finally:
            browser.close()

if __name__ == "__main__":
    run()
