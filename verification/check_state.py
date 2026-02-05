from playwright.sync_api import sync_playwright
import time

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            print("Navigating...")
            page.goto("http://localhost:5173", timeout=30000)
            print("Page loaded.")

            # Wait a bit for React to render
            time.sleep(5)

            page.screenshot(path="verification/initial_state.png")
            print("Screenshot taken: verification/initial_state.png")

            print(f"Page Title: {page.title()}")

            # Check for login form or dashboard elements
            if page.get_by_text("Sign In").count() > 0:
                print("Login page detected.")
            elif page.get_by_text("Study Time").count() > 0:
                 print("Dashboard detected.")
            else:
                print("Unknown state. Dumping body text sample...")
                print(page.locator("body").inner_text()[:200])

        except Exception as e:
            print(f"Error: {e}")
            try:
                page.screenshot(path="verification/error_state.png")
                print("Error screenshot taken.")
            except:
                pass
        finally:
            browser.close()

if __name__ == "__main__":
    run()
