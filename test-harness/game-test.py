"""
Dam-Orama visual test harness.

Usage:
  python test-harness/game-test.py [command]

Commands:
  screenshot   - Take a screenshot of current state
  full-cycle   - Run a full game cycle: build → flood → resolution → retry
  build-test   - Test material placement (click to place sand)
  camera-test  - Test camera controls (orbit, zoom)
  stress-test  - Run multiple cycles checking for state leaks

Assumes dev server is running on localhost:5173.
"""

import sys
import os
import json
import time
from datetime import datetime
from playwright.sync_api import sync_playwright

SCREENSHOTS_DIR = os.path.join(os.path.dirname(__file__), 'screenshots')
URL = 'http://localhost:5173'
VIEWPORT = {"width": 1280, "height": 720}


def ensure_dir():
    os.makedirs(SCREENSHOTS_DIR, exist_ok=True)


def stamp():
    return datetime.now().strftime('%H%M%S')


def setup_page(playwright):
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page(viewport=VIEWPORT)

    logs = []
    errors = []
    page.on("console", lambda msg: logs.append(f"[{msg.type}] {msg.text}"))
    page.on("pageerror", lambda err: errors.append(str(err)))

    page.goto(URL)
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(1000)  # let first frames render

    return browser, page, logs, errors


def screenshot(page, name):
    ensure_dir()
    path = os.path.join(SCREENSHOTS_DIR, f'{stamp()}-{name}.png')
    page.screenshot(path=path)
    print(f"  Screenshot: {path}")
    return path


def get_fps(page):
    # FPS display has green color (#0f0)
    el = page.query_selector("div[style*='color:#0f0']")
    if not el:
        el = page.query_selector("div[style*='color: rgb(0, 255, 0)']")
    return el.text_content() if el else "N/A"


def click_button(page, text, timeout=2000):
    btn = page.locator("button", has_text=text)
    if btn.count() > 0 and btn.is_visible():
        btn.click()
        print(f"  Clicked: {text}")
        return True
    else:
        print(f"  Button not found/visible: {text}")
        return False


def is_button_visible(page, text):
    btn = page.locator("button", has_text=text)
    return btn.count() > 0 and btn.is_visible()


def click_canvas(page, x, y, steps=1):
    """Click on the canvas at viewport coordinates."""
    canvas = page.query_selector("canvas")
    if not canvas:
        print("  No canvas found!")
        return
    box = canvas.bounding_box()
    page.mouse.click(box['x'] + x, box['y'] + y)


def drag_canvas(page, x1, y1, x2, y2, steps=10):
    """Drag on the canvas (LMB for building)."""
    canvas = page.query_selector("canvas")
    if not canvas:
        return
    box = canvas.bounding_box()
    page.mouse.move(box['x'] + x1, box['y'] + y1)
    page.mouse.down()
    for i in range(steps):
        t = (i + 1) / steps
        cx = x1 + (x2 - x1) * t
        cy = y1 + (y2 - y1) * t
        page.mouse.move(box['x'] + cx, box['y'] + cy)
        page.wait_for_timeout(30)
    page.mouse.up()


def report(logs, errors):
    print(f"\n  Console logs: {len(logs)}")
    page_errors = [e for e in errors]
    js_errors = [l for l in logs if l.startswith('[error]')]
    if page_errors:
        print(f"  PAGE ERRORS ({len(page_errors)}):")
        for e in page_errors:
            print(f"    {e}")
    if js_errors:
        print(f"  JS ERRORS ({len(js_errors)}):")
        for e in js_errors:
            print(f"    {e}")
    if not page_errors and not js_errors:
        print("  No errors")


# ---- Commands ----

def cmd_screenshot():
    print("Taking screenshot...")
    with sync_playwright() as p:
        browser, page, logs, errors = setup_page(p)
        fps = get_fps(page)
        print(f"  FPS: {fps}")
        screenshot(page, "current")
        report(logs, errors)
        browser.close()


def cmd_full_cycle():
    print("Running full game cycle...")
    with sync_playwright() as p:
        browser, page, logs, errors = setup_page(p)

        # 1. Construction phase
        print("\n[Construction]")
        print(f"  FPS: {get_fps(page)}")
        print(f"  Start Flood visible: {is_button_visible(page, 'Start Flood')}")
        screenshot(page, "01-construction")

        # 2. Place some material (drag across center of canvas)
        print("\n[Building]")
        drag_canvas(page, 500, 300, 700, 350, steps=15)
        page.wait_for_timeout(500)
        screenshot(page, "02-after-build")

        # 3. Start Flood
        print("\n[Flood]")
        click_button(page, "Start Flood")
        page.wait_for_timeout(500)
        print(f"  Start Flood visible: {is_button_visible(page, 'Start Flood')}")
        print(f"  Retry visible: {is_button_visible(page, 'Retry')}")

        # Wait for water to flow
        for sec in [3, 6, 9]:
            page.wait_for_timeout(3000)
            print(f"  {sec}s elapsed - FPS: {get_fps(page)}")
            screenshot(page, f"03-flood-{sec}s")

        # 4. Wait for resolution (might need longer in headless)
        print("\n[Waiting for Resolution]")
        for i in range(10):
            page.wait_for_timeout(2000)
            if is_button_visible(page, 'Retry'):
                print(f"  Resolution reached after ~{9 + (i+1)*2}s")
                break
        else:
            print("  Resolution not reached within timeout")

        screenshot(page, "04-resolution")
        print(f"  Retry visible: {is_button_visible(page, 'Retry')}")

        # 5. Retry
        print("\n[Retry]")
        if click_button(page, "Retry"):
            page.wait_for_timeout(500)
            print(f"  Start Flood visible: {is_button_visible(page, 'Start Flood')}")
            screenshot(page, "05-after-retry")

        report(logs, errors)
        browser.close()


def cmd_build_test():
    print("Testing material placement...")
    with sync_playwright() as p:
        browser, page, logs, errors = setup_page(p)

        screenshot(page, "build-00-initial")

        # Click different tool buttons
        for tool in ["Sand", "Clay", "Stone"]:
            btn = page.locator(f"button", has_text=tool)
            if btn.count() > 0:
                btn.click()
                print(f"  Selected: {tool}")
                page.wait_for_timeout(200)

                # Drag to place
                drag_canvas(page, 400, 300, 600, 350, steps=10)
                page.wait_for_timeout(300)
                screenshot(page, f"build-{tool.lower()}")

        # Test smooth
        btn = page.locator("button", has_text="Smooth")
        if btn.count() > 0:
            btn.click()
            drag_canvas(page, 400, 300, 600, 350, steps=10)
            page.wait_for_timeout(300)
            screenshot(page, "build-smooth")

        # Test remove
        btn = page.locator("button", has_text="Remove")
        if btn.count() > 0:
            btn.click()
            drag_canvas(page, 400, 300, 600, 350, steps=10)
            page.wait_for_timeout(300)
            screenshot(page, "build-remove")

        # Test undo (Ctrl+Z)
        page.keyboard.press("Control+z")
        page.wait_for_timeout(300)
        screenshot(page, "build-undo")

        report(logs, errors)
        browser.close()


def cmd_camera_test():
    print("Testing camera controls...")
    with sync_playwright() as p:
        browser, page, logs, errors = setup_page(p)

        screenshot(page, "cam-00-initial")

        # Q/E rotation
        page.keyboard.press("q")
        page.wait_for_timeout(500)
        screenshot(page, "cam-01-rotateQ")

        page.keyboard.press("e")
        page.keyboard.press("e")
        page.wait_for_timeout(500)
        screenshot(page, "cam-02-rotateE")

        # F to recenter
        page.keyboard.press("f")
        page.wait_for_timeout(500)
        screenshot(page, "cam-03-recenter")

        # Scroll to zoom
        canvas = page.query_selector("canvas")
        if canvas:
            box = canvas.bounding_box()
            cx = box['x'] + box['width'] / 2
            cy = box['y'] + box['height'] / 2
            page.mouse.move(cx, cy)
            page.mouse.wheel(0, -300)  # zoom in
            page.wait_for_timeout(500)
            screenshot(page, "cam-04-zoomin")

            page.mouse.wheel(0, 600)  # zoom out
            page.wait_for_timeout(500)
            screenshot(page, "cam-05-zoomout")

        report(logs, errors)
        browser.close()


def cmd_stress_test():
    print("Running stress test (3 full cycles)...")
    with sync_playwright() as p:
        browser, page, logs, errors = setup_page(p)

        for cycle in range(3):
            print(f"\n--- Cycle {cycle + 1} ---")

            # Build
            drag_canvas(page, 400, 300, 700, 350, steps=10)
            page.wait_for_timeout(300)

            # Flood
            click_button(page, "Start Flood")

            # Wait for resolution
            for i in range(15):
                page.wait_for_timeout(2000)
                if is_button_visible(page, "Retry"):
                    print(f"  Resolution at ~{(i+1)*2}s")
                    break

            fps = get_fps(page)
            print(f"  FPS: {fps}")
            screenshot(page, f"stress-cycle{cycle+1}")

            # Retry
            click_button(page, "Retry")
            page.wait_for_timeout(500)

        print(f"\n  Final state - Start visible: {is_button_visible(page, 'Start Flood')}")
        report(logs, errors)
        browser.close()


# ---- Main ----

COMMANDS = {
    'screenshot': cmd_screenshot,
    'full-cycle': cmd_full_cycle,
    'build-test': cmd_build_test,
    'camera-test': cmd_camera_test,
    'stress-test': cmd_stress_test,
}

if __name__ == '__main__':
    cmd = sys.argv[1] if len(sys.argv) > 1 else 'full-cycle'
    if cmd in COMMANDS:
        COMMANDS[cmd]()
    else:
        print(f"Unknown command: {cmd}")
        print(f"Available: {', '.join(COMMANDS.keys())}")
        sys.exit(1)
