import os
import time
from playwright.sync_api import sync_playwright

def verify_explore_feature(page):
    print("Navigating to dashboard...")
    page.goto("http://localhost:5000")

    # Inject LocalStorage Flags
    settings = {
        "specialDiscountEvent": {
            "enabled": True,
            "eventName": "TEST SALE",
            "startsAt": "2024-01-01T00:00:00.000Z",
            "endsAt": "2099-01-01T00:00:00.000Z",
            "discountPercent": 50
        }
    }

    user = {
        "id": "test-user",
        "name": "Test Student",
        "classLevel": "10",
        "board": "CBSE",
        "role": "STUDENT",
        "credits": 100,
        "isPremium": True,
        "subscriptionLevel": "ULTRA",
        "createdAt": "2024-01-01T00:00:00.000Z"
    }

    print("Injecting settings and user...")
    page.evaluate("""(data) => {
        localStorage.setItem('nst_terms_accepted', 'true');
        localStorage.setItem('nst_has_seen_welcome', 'true');
        localStorage.setItem('nst_tracker_minimized', 'true');
        localStorage.setItem('nst_last_daily_tracker_date', new Date().toDateString());
        localStorage.setItem('nst_system_settings', JSON.stringify(data.settings));
        localStorage.setItem('nst_current_user', JSON.stringify(data.user));
        localStorage.setItem('nst_users', JSON.stringify([data.user]));
        localStorage.setItem('daily_challenge_gen_' + new Date().toDateString(), 'true');
    }""", {"settings": settings, "user": user})

    print("Reloading...")
    page.reload()

    print("Waiting for load...")
    time.sleep(5)

    # Close overlays
    try:
        page.get_by_text("Close").click(timeout=1000)
    except:
        pass
    try:
        page.get_by_text("Remind me later").click(timeout=1000)
    except:
        pass

    # Verify 'Explore More' button in the grid
    print("Verifying 'Explore More' button...")
    explore_btn = page.get_by_role("button").filter(has_text="Explore More").first
    explore_btn.wait_for(state="visible", timeout=10000)
    explore_btn.scroll_into_view_if_needed()

    print("Taking screenshot of Home with Explore button...")
    page.screenshot(path="verification/home_explore.png")

    # Click it
    print("Clicking Explore More...")
    explore_btn.click()

    # Verify we are on Explore Page (Layer 2)
    print("Waiting for Explore page content...")
    # Look for "Explore" header or something specific to Layer 2
    header = page.get_by_text("Explore", exact=True)
    header.wait_for(state="visible", timeout=5000)

    print("Taking screenshot of Explore Page...")
    page.screenshot(path="verification/explore_page.png")

    print("Verification Successful.")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            verify_explore_feature(page)
        except Exception as e:
            print(f"Error: {e}")
            page.screenshot(path="verification/error.png")
        finally:
            browser.close()
